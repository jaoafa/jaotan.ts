import { Logger } from '@book000/node-utils'
import { ChannelType } from 'discord.js'
import { BaseDiscordJob } from '.'
import { Discord } from '@/discord'
import { getMonthKey, getPreviousMonthKey } from '@/features/emoji-ranking'
import {
  buildRanking,
  getMonthWindow,
  toMonthlyStats,
} from '@/features/word-ranking/aggregate'
import {
  collectSources,
  fetchMessages,
  isSkippableDiscordError,
  toWordMessage,
} from '@/features/word-ranking/collect'
import { formatRankingMessage } from '@/features/word-ranking/format'
import { composeStopwords } from '@/features/word-ranking/stopwords'
import { WordWorker } from '@/features/word-ranking/worker-client'

const DEFAULT_GENERAL_CHANNEL_ID = '1138605147287728150'

export interface WordRankingJobDependencies {
  collectSources: typeof collectSources
  fetchMessages: typeof fetchMessages
  startWorker: typeof WordWorker.start
  now: () => Date
}

const defaultDependencies: WordRankingJobDependencies = {
  collectSources,
  fetchMessages,
  startWorker: (options) => WordWorker.start(options),
  now: () => new Date(),
}

/**
 * 前月に使われた単語のランキングを #general へ投稿する。
 * 集計中に失敗した場合は、順位が歪むため何も投稿しない。
 */
export class MonthlyWordRankingJob extends BaseDiscordJob {
  readonly schedule = '0 1 1 * *'

  constructor(
    discord: Discord,
    private readonly dependencies: WordRankingJobDependencies = defaultDependencies
  ) {
    super(discord)
  }

  async execute(): Promise<void> {
    const logger = Logger.configure('MonthlyWordRankingJob.execute')

    const channelIds = this.discord.getChannelConfigStore().get('word-ranking')
    if (!channelIds) {
      throw new Error('Channel config is unavailable')
    }
    if (channelIds.length === 0) {
      logger.info('ℹ️ no channels are registered for the word ranking')
      return
    }
    const stopwordData = this.discord.getStopwordStore().get()
    if (!stopwordData) {
      throw new Error('Stopword config is unavailable')
    }
    const dictPath = process.env.SUDACHI_DICT_PATH
    if (!dictPath) {
      throw new Error('SUDACHI_DICT_PATH is not set')
    }

    const generalChannelId =
      this.discord.getConfig().get('discord').channel?.general ??
      DEFAULT_GENERAL_CHANNEL_ID
    const generalChannel =
      await this.discord.client.channels.fetch(generalChannelId)
    if (generalChannel?.type !== ChannelType.GuildText) {
      throw new Error(
        `General channel ${generalChannelId} is not a text channel`
      )
    }

    const targetMonth = getPreviousMonthKey(
      getMonthKey(this.dependencies.now())
    )
    const { startMs, endMs } = getMonthWindow(targetMonth)
    logger.info(
      `🚀 start ${targetMonth}: ${channelIds.length} channel(s) registered`
    )

    const sources = await this.dependencies.collectSources(
      generalChannel.guild,
      channelIds,
      startMs,
      logger
    )
    if (sources.length === 0) {
      throw new Error(
        `No readable source for word ranking: ${channelIds.join(', ')}`
      )
    }
    const worker = await this.dependencies.startWorker({
      dictPath,
      stopwords: [...composeStopwords(stopwordData)],
    })
    let result
    let messageCount = 0
    try {
      for (const source of sources) {
        try {
          for await (const batch of this.dependencies.fetchMessages(
            source,
            startMs,
            endMs
          )) {
            const messages = batch.flatMap(
              (message) => toWordMessage(message) ?? []
            )
            messageCount += messages.length
            if (messages.length > 0) await worker.send(messages)
          }
        } catch (error) {
          if (!isSkippableDiscordError(error)) throw error
          logger.warn(`⚠️ skip ${source.id}: ${(error as Error).message}`)
        }
      }
      result = await worker.finish()
    } finally {
      worker.kill()
    }

    const ranking = buildRanking(toMonthlyStats(result), targetMonth)
    await generalChannel.send({
      content: formatRankingMessage(
        targetMonth,
        ranking,
        new Map(result.displays)
      ),
      allowedMentions: { parse: [] },
    })
    logger.info(
      `✅ posted ${targetMonth}: ${sources.length} source(s), ${messageCount} message(s)`
    )
  }
}
