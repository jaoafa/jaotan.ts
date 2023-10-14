import {
  ChannelType,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  Message,
  EmbedBuilder,
  Colors,
} from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Configuration } from '../config'
import { MeetingVote } from '../features/meeting-vote'

/**
 * #meeting_vote チャンネルでのリアクションを処理するイベント
 */
export class MeetingReactionVoteEvent extends BaseDiscordEvent<'messageReactionAdd'> {
  get eventName(): 'messageReactionAdd' {
    return 'messageReactionAdd'
  }

  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const meetingVoteChannelId =
      config.get('discord').channel?.meetingVote || '597423974816808970'

    const message = await reaction.message.fetch()
    // #meeting_vote チャンネル以外は無視
    if (message.channel.id !== meetingVoteChannelId) return
    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (user.bot) return
    // サーバのテキストチャンネル以外は無視
    if (message.channel.type !== ChannelType.GuildText) return

    const channel = message.channel
    const meetingVoteFeature = new MeetingVote(channel)

    // ピン留めされていないメッセージは無視
    if (!message.pinned) return

    // PartialUserの場合はfetch
    if (user.partial) {
      user = await user.fetch()
    }

    // 投票権利を有するか確認
    if (!meetingVoteFeature.hasVoteRight(user)) {
      await this.executeUserHasNoVoteRight(message, reaction, user)
      return
    }

    // 複数のリアクションをつけている場合は、リアクションを削除してメッセージを返す
    if (!(await meetingVoteFeature.isMultipleVote(message, user))) {
      await this.executeMultipleVote(message, reaction, user)
    }

    await meetingVoteFeature.runMessage(message)
  }

  async executeMultipleVote(
    message: Message,
    reaction: MessageReaction | PartialMessageReaction,
    user: User
  ) {
    await reaction.users.remove(user)
    const embed = new EmbedBuilder()
      .setDescription(
        '賛成・反対・白票はいずれか一つのみリアクションしてください！変更する場合はすでにつけているリアクションを外してからリアクションしてください。'
      )
      .setFooter({
        text: 'このメッセージは1分後に削除されます。',
      })
      .setColor(Colors.Red)

    const channel = message.channel
    const reply = await channel.send({
      content: `<@${user.id}>`,
      embeds: [embed],
      reply: {
        messageReference: message,
        failIfNotExists: false,
      },
    })

    setTimeout(async () => {
      await reply.delete()
    }, 60_000)
  }

  async executeUserHasNoVoteRight(
    message: Message,
    reaction: MessageReaction | PartialMessageReaction,
    user: User
  ) {
    await reaction.users.remove(user)
    const embed = new EmbedBuilder()
      .setDescription('あなたには投票権利がありません。')
      .setFooter({
        text: 'このメッセージは1分後に削除されます。',
      })
      .setColor(Colors.Red)

    const channel = message.channel
    const reply = await channel.send({
      content: `<@${user.id}>`,
      embeds: [embed],
      reply: {
        messageReference: message,
        failIfNotExists: false,
      },
    })

    setTimeout(async () => {
      await reply.delete()
    }, 60_000)
  }
}
