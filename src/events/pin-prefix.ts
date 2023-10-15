import { ChannelType, Message } from 'discord.js'
import { BaseDiscordEvent } from '.'

/**
 * ピン絵文字がメッセージ本文の先頭につけられた場合、そのメッセージをピン止めする
 */
export class PinPrefixEvent extends BaseDiscordEvent<'messageCreate'> {
  get eventName(): 'messageCreate' {
    return 'messageCreate'
  }

  async execute(message: Message<boolean>): Promise<void> {
    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (message.author.bot) return
    // サーバのテキストチャンネル以外は無視
    if (message.channel.type !== ChannelType.GuildText) return
    // メッセージの先頭にピン絵文字がついていない場合は無視
    if (!message.content.startsWith('📌')) return

    // すでにピン止めされている場合は無視
    if (message.pinned) return

    // メッセージをピン止めする
    await message.pin()
  }
}
