import { APIEmbed, ChannelType, Message, MessageFlags } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { load } from 'cheerio'

interface PublishTwitterComResponse {
  url: string
  author_name: string
  author_url: string
  html: string
  width: number
  height: number | null
  type: string
  cache_age: string
  provider_name: string
  provider_url: string
  version: string
}

interface TweetInfo {
  authorName: string
  authorUrl: string
  html: string
  markdown: string
  url: string
}

/**
 * ツイートのURLが投稿された場合、そのツイートを埋め込み表示する
 */
export class TweetEmbedEvent extends BaseDiscordEvent<'messageCreate'> {
  private readonly twitterDomainTweetUrlRegex =
    /https?:\/\/twitter\.com\/(?:#!\/)?(\w+)\/status(es)?\/(\d+)/

  private readonly xDomainTweetUrlRegex =
    /https?:\/\/x\.com\/(?:#!\/)?(\w+)\/status(es)?\/(\d+)/

  get eventName(): 'messageCreate' {
    return 'messageCreate'
  }

  async execute(message: Message<boolean>): Promise<void> {
    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (message.author.bot) return
    // サーバのテキストチャンネルとスレッド以外は無視
    if (
      message.channel.type !== ChannelType.GuildText &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    )
      return

    // メッセージにツイートのURLが含まれていない場合は無視
    const tweetUrl = this.getTweetUrl(message.content)
    if (!tweetUrl) return

    // 埋め込みメッセージを送信する
    const tweetInfo = await this.getTweetInfo(tweetUrl)
    const embed: APIEmbed = {
      url: tweetInfo.url,
      description: tweetInfo.markdown,
      author: {
        name: tweetInfo.authorName,
        url: tweetInfo.authorUrl,
      },
      color: 0x1d_a1_f2,
    }

    await message.reply({
      embeds: [embed],
      flags: MessageFlags.SuppressNotifications,
    })
  }

  /**
   * メッセージ本文からツイートのURLを取得する
   * @param content メッセージ本文
   * @returns ツイートのURL
   */
  private getTweetUrl(content: string): string | null {
    const twitterDomainTweetUrlMatch = content.match(
      this.twitterDomainTweetUrlRegex
    )
    if (twitterDomainTweetUrlMatch) {
      return twitterDomainTweetUrlMatch[0]
    }

    const xDomainTweetUrlMatch = content.match(this.xDomainTweetUrlRegex)
    if (xDomainTweetUrlMatch) {
      // x.com は twitter.com にリダイレクトされるため、twitter.com に変換する
      return `https://twitter.com/${xDomainTweetUrlMatch[1]}/status/${xDomainTweetUrlMatch[3]}`
    }

    return null
  }

  /**
   * ツイートのURLからツイート情報を取得する
   * @param tweetUrl ツイートのURL
   * @returns ツイート情報
   */
  private async getTweetInfo(tweetUrl: string): Promise<TweetInfo> {
    // publish.twitter.com からツイート情報を取得する
    const response = await fetch(
      `https://publish.twitter.com/oembed?url=${tweetUrl}`
    )
    const tweetInfo: PublishTwitterComResponse = await response.json()

    const $ = load(tweetInfo.html)
    const p = $('p')
    if (p.length === 0) {
      throw new Error('Failed to get tweet info: ' + tweetUrl)
    }
    const html = p.html()
    if (html === null) {
      throw new Error('Failed to get tweet info: ' + tweetUrl)
    }
    // aタグはmarkdown型式で埋め込みを行う
    const content = html
      .replaceAll(
        /<a href="https:\/\/t.co\/(.+?)">https:\/\/t.co\/(.+?)<\/a>/g,
        ' https://t.co/$1 '
      )
      .replaceAll(/<a href="(.+?)">(.+?)<\/a>/g, '[$2]($1)')
      .replaceAll('<br>', '\n')

    console.log(content)

    // ツイート情報を返す
    return {
      authorName: tweetInfo.author_name,
      authorUrl: tweetInfo.author_url,
      html: tweetInfo.html,
      markdown: content,
      url: tweetInfo.url,
    }
  }
}
