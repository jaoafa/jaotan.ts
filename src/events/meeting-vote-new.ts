import { ChannelType, Message } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Configuration } from '../config'
import { MeetingVote } from '../features/meeting-vote'

/**
 * #meeting_vote チャンネルでの新規投票を処理するイベント
 */
export class MeetingNewVoteEvent extends BaseDiscordEvent<'messageCreate'> {
  readonly eventName = 'messageCreate'

  async execute(message: Message): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const meetingVoteChannelId =
      config.get('discord').channel?.meetingVote ?? '1149598703846440960'

    // #meeting_vote チャンネル以外は無視
    if (message.channel.id !== meetingVoteChannelId) return
    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (message.author.bot) return
    // サーバのテキストチャンネル以外は無視
    if (message.channel.type !== ChannelType.GuildText) return

    const channel = message.channel
    const meetingVoteFeature = new MeetingVote(channel)

    // すでにピン留めされたメッセージは無視
    if (message.pinned) return

    await meetingVoteFeature.newVoteMessage(message)
  }
}
