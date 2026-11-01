import { Logger } from '@book000/node-utils'
import {
  AnyThreadChannel,
  ChannelType,
  DiscordAPIError,
  Guild,
  Message,
  MessageType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js'
import { isTemplateMessage } from './preprocess'
import { WordMessage } from './types'

export type MessageSource = TextChannel | AnyThreadChannel

const DISCORD_EPOCH = 1_420_070_400_000n
const FETCH_LIMIT = 100

export function isSkippableDiscordError(error: unknown): boolean {
  return (
    error instanceof DiscordAPIError &&
    (error.status === 403 || error.status === 404)
  )
}

function snowflakeAt(timestampMs: number): bigint {
  return (BigInt(timestampMs) - DISCORD_EPOCH) << 22n
}

async function fetchTargetChannels(
  guild: Guild,
  channelIds: readonly string[],
  logger: Logger
): Promise<TextChannel[]> {
  const channels: TextChannel[] = []
  const botMember = guild.members.me ?? (await guild.members.fetchMe())
  for (const channelId of channelIds) {
    try {
      const channel = await guild.channels.fetch(channelId)
      if (channel?.type !== ChannelType.GuildText) {
        logger.warn(`⚠️ skip ${channelId}: not a text channel`)
      } else if (
        channel
          .permissionsFor(botMember)
          .has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ])
      ) {
        channels.push(channel)
      } else {
        logger.warn(`⚠️ skip ${channelId}: missing read permissions`)
      }
    } catch (error) {
      if (!isSkippableDiscordError(error)) throw error
      logger.warn(`⚠️ skip ${channelId}: ${(error as Error).message}`)
    }
  }
  return channels
}

async function fetchArchivedThreads(
  channel: TextChannel,
  startMs: number,
  logger: Logger
): Promise<AnyThreadChannel[]> {
  const threads: AnyThreadChannel[] = []
  let before: number | undefined
  try {
    for (;;) {
      const page = await channel.threads.fetchArchived({
        type: 'public',
        limit: FETCH_LIMIT,
        before,
      })
      for (const thread of page.threads.values()) {
        if ((thread.archiveTimestamp ?? 0) < startMs) return threads
        threads.push(thread)
      }
      const last = page.threads.last()
      if (!page.hasMore || !last?.archiveTimestamp) return threads
      before = last.archiveTimestamp
    }
  } catch (error) {
    if (!isSkippableDiscordError(error)) throw error
    logger.warn(
      `⚠️ skip archived threads of ${channel.id}: ${(error as Error).message}`
    )
    return threads
  }
}

/**
 * 集計対象のチャンネルと、その配下の公開スレッド (稼働中とアーカイブ済み) を列挙する。
 * 見つからない・閲覧できないチャンネルは、そのスレッドも含めて除外して警告する。
 * @param startMs - これより前にアーカイブされたスレッドは対象外
 */
export async function collectSources(
  guild: Guild,
  channelIds: readonly string[],
  startMs: number,
  logger: Logger
): Promise<MessageSource[]> {
  const channels = await fetchTargetChannels(guild, channelIds, logger)
  const targetIds = new Set(channels.map((channel) => channel.id))

  const sources = new Map<string, MessageSource>(
    channels.map((channel) => [channel.id, channel])
  )
  const { threads: activeThreads } = await guild.channels.fetchActiveThreads()
  for (const thread of activeThreads.values()) {
    if (
      thread.type === ChannelType.PublicThread &&
      thread.parentId !== null &&
      targetIds.has(thread.parentId)
    ) {
      sources.set(thread.id, thread)
    }
  }
  for (const channel of channels) {
    const archivedThreads = await fetchArchivedThreads(channel, startMs, logger)
    for (const thread of archivedThreads) sources.set(thread.id, thread)
  }
  return sources.values().toArray()
}

/**
 * 期間内のメッセージを、古い順に返す。
 * @param startMs - この時刻以降のメッセージを含む
 * @param endMs - この時刻より前のメッセージまで含む
 */
export async function* fetchMessages(
  source: MessageSource,
  startMs: number,
  endMs: number
): AsyncGenerator<Message[]> {
  let after = (snowflakeAt(startMs) - 1n).toString()
  for (;;) {
    const batch = await source.messages.fetch({ limit: FETCH_LIMIT, after })
    if (batch.size === 0) return
    const sorted = batch
      .values()
      .toArray()
      .toSorted((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    const inRange = sorted.filter((message) => message.createdTimestamp < endMs)
    if (inRange.length > 0) yield inRange
    if (inRange.length < sorted.length) return
    const last = sorted.at(-1)
    if (!last) return
    after = last.id
  }
}

export function toWordMessage(message: Message): WordMessage | undefined {
  if (message.author.bot || message.webhookId !== null) return undefined
  if (
    message.type !== MessageType.Default &&
    message.type !== MessageType.Reply
  ) {
    return undefined
  }
  if (message.content.trim() === '' || isTemplateMessage(message.content)) {
    return undefined
  }
  return {
    channelId: message.channelId,
    authorId: message.author.id,
    timestamp: message.createdTimestamp,
    content: message.content,
  }
}
