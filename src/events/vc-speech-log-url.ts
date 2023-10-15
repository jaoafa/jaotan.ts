import {
  ChannelType,
  Colors,
  EmbedBuilder,
  Message,
} from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Configuration } from '../config'

/**
 * #vc-speech-log へのメッセージリンクが投稿された際、リンク先メッセージの内容を引用する
 */
export class VCSpeechLogMessageUrlEvent extends BaseDiscordEvent<'messageCreate'> {
  private readonly messageUrlRegex =
    /^https:\/\/.*?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)\??(.*)$/i

  get eventName(): 'messageCreate' {
    return 'messageCreate'
  }

  async execute(message: Message<boolean>): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const vcSpeechLogChannelId =
      config.get('discord').channel?.vcSpeechLog || '1149606247314767993'

    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (message.author.bot) return

    // メッセージにURLが含まれていない場合は無視
    const messageUrlMatch = message.content.match(this.messageUrlRegex)
    if (!messageUrlMatch) return

    const urlChannelId = messageUrlMatch[2]
    const urlMessageId = messageUrlMatch[3]

    // #vc-speech-log チャンネル以外は無視
    if (urlChannelId !== vcSpeechLogChannelId) return

    // メッセージを取得
    const vcSpeechLogChannel = await message.guild.channels.fetch(urlChannelId)
    if (
      !vcSpeechLogChannel ||
      vcSpeechLogChannel.type !== ChannelType.GuildText
    )
      return

    const vcSpeechLogMessage =
      await vcSpeechLogChannel.messages.fetch(urlMessageId)
    if (!vcSpeechLogMessage) return

    // メッセージを引用
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setDescription(vcSpeechLogMessage.content)
      .setTimestamp(vcSpeechLogMessage.createdAt)
      .setFooter({
        text: `#${vcSpeechLogChannel.name}`,
      })

    await message.channel.send({
      embeds: [embed],
      reply: {
        messageReference: message,
        failIfNotExists: false,
      },
    })
  }
}
