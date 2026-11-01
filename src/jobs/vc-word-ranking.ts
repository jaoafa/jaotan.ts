import { Logger } from '@book000/node-utils'
import { ChannelType, Message, MessageType } from 'discord.js'
import { BaseDiscordJob } from '.'
import { defaultDependencies, WordRankingJobDependencies } from './word-ranking'
import { Discord } from '@/discord'
import { getMonthKey, getPreviousMonthKey } from '@/features/emoji-ranking'
import { formatVcRankingMessages } from '@/features/vc-word-ranking/format'
import { buildHabits, buildVolume } from '@/features/vc-word-ranking/habits'
import { parseSpeechLog } from '@/features/vc-word-ranking/parse'
import {
  buildRanking,
  getSingleMonthRange,
  toMonthlyStats,
} from '@/features/word-ranking/aggregate'
import { isSkippableDiscordError } from '@/features/word-ranking/collect'
import { composeStopwords } from '@/features/word-ranking/stopwords'
import { WordMessage, WordStat } from '@/features/word-ranking/types'

export const DEFAULT_VC_CHANNEL_ID = '1149605620027232276'

type Volumes = Map<string, { messages: number; chars: number }>

/** VC 音声認識 Bot の投稿だけを、話者を投稿者とする WordMessage にする。集計対象の発言量も数える */
function toSpeechMessages(
  batch: readonly Message[],
  volumes: Volumes
): WordMessage[] {
  const messages: WordMessage[] = []
  for (const message of batch) {
    if (
      !message.author.bot ||
      message.webhookId !== null ||
      message.type !== MessageType.Default
    ) {
      continue
    }
    const log = parseSpeechLog(message.content)
    if (!log || log.text.trim() === '') continue

    const volume = volumes.get(log.speaker) ?? { messages: 0, chars: 0 }
    volume.messages++
    volume.chars += log.text.length
    volumes.set(log.speaker, volume)
    messages.push({
      channelId: message.channelId,
      authorId: log.speaker,
      timestamp: message.createdTimestamp,
      content: log.text,
    })
  }
  return messages
}

/**
 * 毎月 1 日 1:30 に、前月の VC 音声認識ログの頻出単語・発言量・口癖を #vc へ投稿する。
 * 集計中に失敗した場合は、何も保存・投稿しない。
 */
export class MonthlyVcWordRankingJob extends BaseDiscordJob {
  readonly schedule = '30 1 1 * *'

  constructor(
    discord: Discord,
    private readonly dependencies: WordRankingJobDependencies = defaultDependencies
  ) {
    super(discord)
  }

  async execute(): Promise<void> {
    const logger = Logger.configure('MonthlyVcWordRankingJob.execute')

    const channelIds = this.discord
      .getChannelConfigStore()
      .get('vc-word-ranking')
    if (!channelIds) {
      throw new Error('Channel config is unavailable')
    }
    if (channelIds.length === 0) {
      logger.info('ℹ️ no channels are registered for the VC word ranking')
      return
    }
    const stopwordData = this.discord.getStopwordStore().get()
    if (!stopwordData) {
      throw new Error('Stopword config is unavailable')
    }
    const statsStore = this.discord.getVcWordStatsStore()
    const history = statsStore.get()
    if (!history) {
      throw new Error('VC word stats are unavailable')
    }
    const dictPath = process.env.SUDACHI_DICT_PATH
    if (!dictPath) {
      throw new Error('SUDACHI_DICT_PATH is not set')
    }

    const vcChannel = await this.discord.client.channels.fetch(
      DEFAULT_VC_CHANNEL_ID
    )
    if (vcChannel?.type !== ChannelType.GuildText) {
      throw new Error(
        `VC channel ${DEFAULT_VC_CHANNEL_ID} is not a text channel`
      )
    }

    const targetMonth = getPreviousMonthKey(
      getMonthKey(this.dependencies.now())
    )
    const { startMs, endMs } = getSingleMonthRange(targetMonth)
    logger.info(
      `🚀 start ${targetMonth}: ${channelIds.length} channel(s) registered`
    )

    const sources = await this.dependencies.collectSources(
      vcChannel.guild,
      channelIds,
      startMs,
      logger
    )
    if (sources.length === 0) {
      throw new Error(
        `No readable source for VC word ranking: ${channelIds.join(', ')}`
      )
    }
    const worker = await this.dependencies.startWorker({
      dictPath,
      stopwords: [...composeStopwords(stopwordData)],
      trackAuthors: true,
    })
    const volumes: Volumes = new Map()
    let messageCount = 0
    let result
    try {
      for (const source of sources) {
        try {
          for await (const batch of this.dependencies.fetchMessages(
            source,
            startMs,
            endMs
          )) {
            const messages = toSpeechMessages(batch, volumes)
            messageCount += messages.length
            if (messages.length > 0) await worker.send(messages)
          }
        } catch (error) {
          if (!isSkippableDiscordError(error)) throw error
          logger.warn(`⚠️ skip ${source.id}: ${(error as Error).message}`)
        }
      }
      if (messageCount === 0) {
        logger.info(`ℹ️ no speech log in ${targetMonth}`)
        return
      }
      result = await worker.finish()
    } finally {
      worker.kill()
    }

    const entries = result.months.find(([month]) => month === targetMonth)?.[1]
    const targetStats =
      toMonthlyStats(result).get(targetMonth) ?? new Map<string, WordStat>()
    const stats = new Map([
      ...[...history].filter(([month]) => month < targetMonth),
      [targetMonth, targetStats],
    ])
    const ranking = buildRanking(stats, targetMonth)
    const messages = formatVcRankingMessages({
      month: targetMonth,
      frequent: ranking.frequent,
      volume: buildVolume(volumes),
      habits: buildHabits({
        authors: result.authors,
        month: targetMonth,
        stats: targetStats,
        volumes,
      }),
      displays: new Map(result.displays),
    })

    await statsStore.save(targetMonth, entries ?? [])
    for (const content of messages) {
      await vcChannel.send({ content, allowedMentions: { parse: [] } })
    }
    logger.info(
      `✅ posted ${targetMonth}: ${sources.length} source(s), ${messageCount} message(s), ${messages.length} post(s)`
    )
  }
}
