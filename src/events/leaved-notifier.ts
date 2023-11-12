import { ChannelType, GuildMember } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Configuration } from '@/config'

/**
 * ユーザーがサーバから退出した際、以下の処理を行う
 * - #general で退出したことを通知する
 */
export class LeavedNotififerEvent extends BaseDiscordEvent<'guildMemberRemove'> {
  get eventName(): 'guildMemberRemove' {
    return 'guildMemberRemove'
  }

  async execute(member: GuildMember): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const generalChannelId =
      config.get('discord').channel?.general || '1138605147287728150'

    const generalChannel =
      await this.discord.client.channels.fetch(generalChannelId)
    if (!generalChannel || generalChannel.type !== ChannelType.GuildText) {
      throw new Error('generalChannel is not found')
    }

    // general チャンネルがあるサーバ以外は無視
    if (generalChannel.guildId !== member.guild.id) return

    // #general で参加したことを通知する
    const generalMessageContent = `:wave:<@${member.id}>さんが jao Gamers Club から退出しました。`
    await generalChannel.send(generalMessageContent)
  }
}
