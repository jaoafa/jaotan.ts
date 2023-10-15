import { ChannelType } from 'discord.js'
import { BaseDiscordTask } from '.'
import { Configuration } from '../config'
import { MeetingVote } from '../features/meeting-vote'

/**
 * 定期的に #meeting_vote チャンネルの投票を処理するタスク
 */
export class MeetingVoteTask extends BaseDiscordTask {
  get interval(): number {
    // 30分毎
    return 30 * 60
  }

  async execute(): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const meetingVoteChannelId =
      config.get('discord').channel?.meetingVote || '1149598703846440960'

    const channel =
      await this.discord.client.channels.fetch(meetingVoteChannelId)
    if (!channel || channel.type !== ChannelType.GuildText) return

    const meetingVoteFeature = new MeetingVote(channel)
    await meetingVoteFeature.run()
  }
}
