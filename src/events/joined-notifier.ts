import { ChannelType, GuildMember } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Configuration } from '@/config'

/**
 * ユーザーがサーバに参加した際、以下の処理を行う
 * - #general で参加したことを通知する
 * - #greeting で挨拶するよう促す
 */
export class JoinedNotifierEvent extends BaseDiscordEvent<'guildMemberAdd'> {
  readonly eventName = 'guildMemberAdd'

  async execute(member: GuildMember): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const generalChannelId =
      config.get('discord').channel?.general ?? '1138605147287728150'
    const greetingChannelId =
      config.get('discord').channel?.greeting ?? '1149587870273773569'

    const generalChannel =
      await this.discord.client.channels.fetch(generalChannelId)
    if (generalChannel?.type !== ChannelType.GuildText) {
      throw new Error('generalChannel is not found')
    }
    const greetingChannel =
      await this.discord.client.channels.fetch(greetingChannelId)
    if (greetingChannel?.type !== ChannelType.GuildText) {
      throw new Error('greetingChannel is not found')
    }

    // general チャンネルがあるサーバ以外は無視
    if (generalChannel.guildId !== member.guild.id) return

    // #general で参加したことを通知する
    const generalMessageContent = `:man_dancing:<@${member.id}>さんが jao Gamers Club に参加しました！`
    await generalChannel.send(generalMessageContent)

    // #greeting で挨拶するよう促す
    const greetingMessageContent = `:man_dancing:<@${member.id}>さん、jao Gamers Club にようこそ。\n__**運営方針により、参加から10分以内に発言がない場合システムによって自動的にキック**__されます。<#${greetingChannelId}>チャンネルで「jao」「afa」とあいさつしてみましょう！`
    await greetingChannel.send(greetingMessageContent)
  }
}
