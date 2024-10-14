import { ChannelType, Message } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Mebo } from '@/features/mebo'

/**
 * jaotanに対してリプライされた場合、miibo のチャット API を利用して返信する
 */
export class ReplyEvent extends BaseDiscordEvent<'messageCreate'> {
  readonly eventName = 'messageCreate'

  private static readonly userIdMapping = new Map<string, string>()
  private readonly resetKeywords = ['reset', 'clear']

  async execute(message: Message<true>): Promise<void> {
    // メンバーが取得できない場合は無視
    if (!message.member) return
    // Botは無視
    if (message.author.bot) return
    // サーバのテキストチャンネルとスレッド以外は無視
    if (
      message.channel.type !== ChannelType.GuildText &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    )
      return
    // 自分自身に対してリプライされていない場合は無視
    if (!this.isReplyToMe(message)) return

    const meboUserId = this.getMeboUserId(message.author.id)

    const mentionTexts = message.mentions.users.map(
      (user) => `@${user.displayName}`
    )
    let content = message.cleanContent
    for (const mentionText of mentionTexts) {
      content = content.replace(mentionText, '')
    }
    content = content.trim()

    if (this.resetKeywords.includes(content)) {
      ReplyEvent.userIdMapping.delete(message.author.id)
      await message.react('✅')
      return
    }

    const config = this.discord.getConfig()
    const meboConfig = config.get('mebo')
    const mebo = new Mebo(meboConfig.apiKey, meboConfig.agentId)

    const result = await mebo.chat({
      utterance: content,
      uid: meboUserId,
    })
    if (!result) {
      await message.reply(':warning: 応答を取得できませんでした。')
      return
    }

    const bestResponse = result.bestResponse
    await message.reply({
      content: bestResponse.utterance,
      embeds: [
        {
          footer: {
            text: `score: ${bestResponse.score} / meboUserId: ${meboUserId}`,
          },
        },
      ],
    })
  }

  getMeboUserId(userId: string): string {
    if (!ReplyEvent.userIdMapping.has(userId)) {
      ReplyEvent.userIdMapping.set(userId, Math.random().toString(36).slice(-8))
    }
    const meboUserId = ReplyEvent.userIdMapping.get(userId)
    if (!meboUserId) throw new Error('meboUserId is undefined')
    return meboUserId
  }

  isReplyToMe(message: Message<true>): boolean {
    const clientUserId = this.discord.client.user?.id
    if (!clientUserId) return false
    return message.mentions.users.has(clientUserId)
  }
}
