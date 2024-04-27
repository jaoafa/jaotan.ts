import {
  ChannelType,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  PermissionFlagsBits,
  User,
} from 'discord.js'
import { BaseDiscordEvent } from '.'

/**
 * ピン絵文字のリアクションをメッセージにつけられた場合、そのメッセージをピン止めする
 */
export class PinReactionEvent extends BaseDiscordEvent<'messageReactionAdd'> {
  readonly eventName = 'messageReactionAdd'

  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message
    // PartialUserの場合はfetch
    if (user.partial) {
      user = await user.fetch()
    }

    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (user.bot) return
    // サーバのテキストチャンネルとスレッド以外は無視
    if (
      message.channel.type !== ChannelType.GuildText &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    )
      return
    // リアクションしたユーザにメッセージの書き込み権限がない場合は無視
    const permissions = message.channel.permissionsFor(user)
    if (!permissions?.has(PermissionFlagsBits.SendMessages)) return

    // すでにピン止めされている場合は無視
    if (message.pinned) return
    // リアクションがピン絵文字でない場合は無視
    if (reaction.emoji.name !== '📌') return

    // メッセージをピン止めする
    await message.pin()
  }
}
