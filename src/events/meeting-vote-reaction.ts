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
import { setTimeout } from 'node:timers/promises'
import { Logger } from '@book000/node-utils'

/**
 * #meeting_vote チャンネルでのリアクションを処理するイベント
 */
export class MeetingReactionVoteEvent extends BaseDiscordEvent<'messageReactionAdd'> {
  readonly eventName = 'messageReactionAdd'

  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const meetingVoteChannelId =
      config.get('discord').channel?.meetingVote ?? '1149598703846440960'

    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message
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
    if (await meetingVoteFeature.isMultipleVote(message, user)) {
      await this.executeMultipleVote(message, reaction, user)
      return
    }

    await meetingVoteFeature.runMessage(message)
  }

  async executeMultipleVote(
    message: Message<true>,
    reaction: MessageReaction | PartialMessageReaction,
    user: User
  ) {
    const logger = Logger.configure('MeetingReactionVoteEvent')
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

    setTimeout(60_000)
      .then(async () => {
        await reply.delete()
      })
      .catch((error: unknown) => {
        logger.error('Failed to delete message', error as Error)
      })
  }

  async executeUserHasNoVoteRight(
    message: Message<true>,
    reaction: MessageReaction | PartialMessageReaction,
    user: User
  ) {
    const logger = Logger.configure('MeetingReactionVoteEvent')
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

    setTimeout(60_000)
      .then(async () => {
        await reply.delete()
      })
      .catch((error: unknown) => {
        logger.error('Failed to delete message', error as Error)
      })
  }
}
