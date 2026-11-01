import { ChannelType, DiscordAPIError, Message, MessageType } from 'discord.js'
import { Discord } from '@/discord'
import { MessageSource } from '@/features/word-ranking/collect'
import {
  AccumulatedResult,
  StopwordData,
  WordMessage,
} from '@/features/word-ranking/types'
import { WordWorker } from '@/features/word-ranking/worker-client'
import {
  MonthlyWordRankingJob,
  WordRankingJobDependencies,
} from '@/jobs/word-ranking'

const NOW = new Date('2026-10-31T16:00:00Z')
const RESULT: AccumulatedResult = {
  months: [
    [
      '2026-10',
      [
        ['ケツ', 12, 4],
        ['虫', 5, 3],
      ],
    ],
  ],
  displays: [
    ['ケツ', 'ケツ'],
    ['虫', '虫'],
  ],
}
const EXPECTED_MESSAGE = [
  ':bar_chart: __**2026-10 の単語ランキング**__ :bar_chart:',
  '',
  '**よく使われた単語**',
  '1. ケツ (12回)',
  '2. 虫 (5回)',
  '',
  '**今月の新顔**',
  '該当する単語がありませんでした',
].join('\n')

const apiError = (status: number) =>
  new DiscordAPIError(
    { message: `status ${status}`, code: 50_001 },
    50_001,
    status,
    'GET',
    '/test',
    {}
  )
const discordMessage = (overrides: Record<string, unknown> = {}) =>
  ({
    author: { bot: false, id: 'user1' },
    webhookId: null,
    type: MessageType.Default,
    content: 'ケツ',
    channelId: 'source1',
    createdTimestamp: 1_700_000_000_000,
    ...overrides,
  }) as unknown as Message

describe('MonthlyWordRankingJob', () => {
  let beforeDictPath: string | undefined
  let channelIds: readonly string[] | undefined
  let stopwordData: StopwordData | undefined
  let generalChannel: { type: ChannelType; guild: object; send: jest.Mock }
  let batchesBySource: Record<string, (Message[] | Error)[]>
  const worker = {
    send: jest.fn<Promise<void>, [WordMessage[]]>(),
    finish: jest.fn<Promise<AccumulatedResult>, []>(),
    kill: jest.fn<undefined, []>(),
  }
  const dependencies = {
    collectSources: jest.fn<
      Promise<MessageSource[]>,
      Parameters<WordRankingJobDependencies['collectSources']>
    >(),
    fetchMessages: jest.fn<
      AsyncGenerator<Message[]>,
      Parameters<WordRankingJobDependencies['fetchMessages']>
    >(),
    startWorker: jest.fn<
      Promise<WordWorker>,
      Parameters<WordRankingJobDependencies['startWorker']>
    >(),
    now: () => NOW,
  }

  const createJob = () => {
    const discord = {
      getChannelConfigStore: () => ({ get: () => channelIds }),
      getStopwordStore: () => ({ get: () => stopwordData }),
      getConfig: () => ({ get: () => ({ channel: { general: 'general' } }) }),
      client: {
        channels: { fetch: jest.fn().mockResolvedValue(generalChannel) },
      },
    } as unknown as Discord
    return {
      discord,
      job: new MonthlyWordRankingJob(discord, dependencies),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    beforeDictPath = process.env.SUDACHI_DICT_PATH
    process.env.SUDACHI_DICT_PATH = '/dict/system_core.dic'
    channelIds = ['source1']
    stopwordData = { added: ['ケツ2'], removed: ['ゲーム'] }
    generalChannel = {
      type: ChannelType.GuildText,
      guild: { id: 'guild1' },
      send: jest.fn(),
    }
    batchesBySource = { source1: [[discordMessage()]] }
    worker.finish.mockResolvedValue(RESULT)
    dependencies.collectSources.mockImplementation((_guild, ids) =>
      Promise.resolve(ids.map((id) => ({ id }) as unknown as MessageSource))
    )
    dependencies.fetchMessages.mockImplementation(async function* (source) {
      const batches = batchesBySource[source.id]
      for (const batch of batches) {
        await Promise.resolve()
        if (batch instanceof Error) throw batch
        yield batch
      }
    })
    dependencies.startWorker.mockResolvedValue(worker as unknown as WordWorker)
  })

  afterEach(() => {
    if (beforeDictPath === undefined) {
      delete process.env.SUDACHI_DICT_PATH
    } else {
      process.env.SUDACHI_DICT_PATH = beforeDictPath
    }
  })

  it('runs on the first day of every month at 01:00', () => {
    expect(createJob().job.schedule).toBe('0 1 1 * *')
  })

  it('posts the ranking of the previous month to the general channel', async () => {
    await createJob().job.execute()

    expect(generalChannel.send).toHaveBeenCalledTimes(1)
    expect(generalChannel.send).toHaveBeenCalledWith({
      content: EXPECTED_MESSAGE,
      allowedMentions: { parse: [] },
    })
    expect(dependencies.collectSources).toHaveBeenCalledWith(
      generalChannel.guild,
      ['source1'],
      Date.UTC(2026, 4, 1) - 9 * 60 * 60 * 1000,
      expect.anything()
    )
    expect(dependencies.fetchMessages).toHaveBeenCalledWith(
      { id: 'source1' },
      Date.UTC(2026, 4, 1) - 9 * 60 * 60 * 1000,
      Date.UTC(2026, 10, 1) - 9 * 60 * 60 * 1000
    )
    expect(worker.kill).toHaveBeenCalledTimes(1)
  })

  it('starts the worker with the dictionary path and the composed stopwords', async () => {
    await createJob().job.execute()

    expect(dependencies.startWorker).toHaveBeenCalledTimes(1)
    const { dictPath, stopwords } = dependencies.startWorker.mock.calls[0][0]
    expect(dictPath).toBe('/dict/system_core.dic')
    expect(stopwords).toContain('the')
    expect(stopwords).toContain('ケツ2')
    expect(stopwords).not.toContain('ゲーム')
  })

  it('sends only countable messages, batch by batch', async () => {
    batchesBySource = {
      source1: [
        [
          discordMessage({ content: 'one' }),
          discordMessage({ author: { bot: true, id: 'bot' } }),
          discordMessage({ content: 'two' }),
        ],
        [discordMessage({ content: '' })],
        [discordMessage({ content: 'three' })],
      ],
    }

    await createJob().job.execute()

    expect(
      worker.send.mock.calls.map(([messages]) =>
        messages.map((message) => message.content)
      )
    ).toEqual([['one', 'two'], ['three']])
  })

  it('skips a source that responds with 403 or 404 and keeps the others', async () => {
    channelIds = ['source1', 'source2', 'source3']
    batchesBySource = {
      source1: [apiError(403)],
      source2: [apiError(404)],
      source3: [[discordMessage({ content: 'kept', channelId: 'source3' })]],
    }

    await createJob().job.execute()

    expect(worker.send).toHaveBeenCalledTimes(1)
    expect(worker.send.mock.calls[0][0][0].content).toBe('kept')
    expect(generalChannel.send).toHaveBeenCalledTimes(1)
  })

  it('posts nothing and stops the worker when fetching fails', async () => {
    batchesBySource = { source1: [apiError(500)] }

    await expect(createJob().job.execute()).rejects.toThrow('status 500')

    expect(generalChannel.send).not.toHaveBeenCalled()
    expect(worker.kill).toHaveBeenCalledTimes(1)
  })

  it('posts nothing and stops the worker when the worker fails', async () => {
    worker.finish.mockRejectedValue(
      new Error('Word worker timed out after 1ms')
    )

    await expect(createJob().job.execute()).rejects.toThrow(
      'Word worker timed out after 1ms'
    )

    expect(generalChannel.send).not.toHaveBeenCalled()
    expect(worker.kill).toHaveBeenCalledTimes(1)
  })

  it('fails without posting when every registered channel is unreadable', async () => {
    channelIds = ['source1', 'source2']
    dependencies.collectSources.mockResolvedValue([])

    await expect(createJob().job.execute()).rejects.toThrow(
      'No readable source for word ranking: source1, source2'
    )

    expect(dependencies.startWorker).not.toHaveBeenCalled()
    expect(generalChannel.send).not.toHaveBeenCalled()
  })

  it('does nothing when no channel is registered', async () => {
    channelIds = []

    await createJob().job.execute()

    expect(dependencies.startWorker).not.toHaveBeenCalled()
    expect(generalChannel.send).not.toHaveBeenCalled()
  })

  it('fails when the channel config is unavailable', async () => {
    channelIds = undefined

    await expect(createJob().job.execute()).rejects.toThrow(
      'Channel config is unavailable'
    )
    expect(generalChannel.send).not.toHaveBeenCalled()
  })

  it('fails when the stopword config is unavailable', async () => {
    stopwordData = undefined

    await expect(createJob().job.execute()).rejects.toThrow(
      'Stopword config is unavailable'
    )
    expect(dependencies.startWorker).not.toHaveBeenCalled()
  })

  it('fails when the dictionary path is not set', async () => {
    delete process.env.SUDACHI_DICT_PATH

    await expect(createJob().job.execute()).rejects.toThrow(
      'SUDACHI_DICT_PATH is not set'
    )
    expect(dependencies.startWorker).not.toHaveBeenCalled()
  })

  it('fails when the general channel is not a text channel', async () => {
    generalChannel.type = ChannelType.GuildVoice

    await expect(createJob().job.execute()).rejects.toThrow(
      'General channel general is not a text channel'
    )
    expect(dependencies.startWorker).not.toHaveBeenCalled()
  })
})
