import { ChannelType, DiscordAPIError, Message, MessageType } from 'discord.js'
import { Discord } from '@/discord'
import { MessageSource } from '@/features/word-ranking/collect'
import {
  AccumulatedResult,
  MonthlyStats,
  StopwordData,
  WordMessage,
} from '@/features/word-ranking/types'
import { WordWorker } from '@/features/word-ranking/worker-client'
import { WordRankingJobDependencies } from '@/jobs/word-ranking'
import {
  DEFAULT_VC_CHANNEL_ID,
  MonthlyVcWordRankingJob,
} from '@/jobs/vc-word-ranking'

const NOW = new Date('2026-10-31T16:00:00Z')
const jst = (iso: string) => Date.parse(`${iso}+09:00`)
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
  authors: [],
}

const apiError = (status: number) =>
  new DiscordAPIError(
    { message: `status ${status}`, code: 50_001 },
    50_001,
    status,
    'GET',
    '/test',
    {}
  )
const logMessage = (
  content: string,
  overrides: Record<string, unknown> = {}
): Message =>
  ({
    author: { bot: true, id: 'bot1' },
    webhookId: null,
    type: MessageType.Default,
    content,
    channelId: 'source1',
    createdTimestamp: 1_700_000_000_000,
    ...overrides,
  }) as unknown as Message

describe('MonthlyVcWordRankingJob', () => {
  let beforeDictPath: string | undefined
  let channelIds: readonly string[] | undefined
  let stopwordData: StopwordData | undefined
  let history: MonthlyStats | undefined
  let vcChannel: { type: ChannelType; guild: object; send: jest.Mock }
  let batchesBySource: Record<string, (Message[] | Error)[]>
  const save = jest.fn<Promise<void>, [string, [string, number, number][]]>()
  const fetchChannel = jest.fn()
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
      getVcWordStatsStore: () => ({ get: () => history, save }),
      client: { channels: { fetch: fetchChannel } },
    } as unknown as Discord
    return new MonthlyVcWordRankingJob(discord, dependencies)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    beforeDictPath = process.env.SUDACHI_DICT_PATH
    process.env.SUDACHI_DICT_PATH = '/dict/system_core.dic'
    channelIds = ['source1']
    stopwordData = { added: ['ケツ2'], removed: ['ゲーム'] }
    history = new Map()
    vcChannel = {
      type: ChannelType.GuildText,
      guild: { id: 'guild1' },
      send: jest.fn(),
    }
    fetchChannel.mockResolvedValue(vcChannel)
    batchesBySource = {
      source1: [[logMessage('`tomachi`: `ケツ` (97%)')]],
    }
    save.mockResolvedValue()
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

  it('runs on the first day of every month at 01:30', () => {
    expect(createJob().schedule).toBe('30 1 1 * *')
  })

  it('posts the ranking of the previous month to the VC channel', async () => {
    await createJob().execute()

    expect(fetchChannel).toHaveBeenCalledWith(DEFAULT_VC_CHANNEL_ID)
    expect(vcChannel.send).toHaveBeenCalledTimes(1)
    const [payload] = vcChannel.send.mock.calls[0] as [
      { content: string; allowedMentions: unknown },
    ]
    expect(payload.allowedMentions).toEqual({ parse: [] })
    expect(payload.content).toContain(
      ':microphone: __**2026-10 の VC 単語ランキング**__ :microphone:'
    )
    expect(payload.content).toContain('1. ケツ (12回)\n2. 虫 (5回)')
  })

  it('fetches only the target month', async () => {
    await createJob().execute()

    const startMs = jst('2026-10-01T00:00:00')
    const endMs = jst('2026-11-01T00:00:00')
    expect(dependencies.collectSources).toHaveBeenCalledWith(
      vcChannel.guild,
      ['source1'],
      startMs,
      expect.anything()
    )
    expect(dependencies.fetchMessages).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'source1' }),
      startMs,
      endMs
    )
  })

  it('starts the worker with author tracking, the dictionary path and the stopwords', async () => {
    await createJob().execute()

    expect(dependencies.startWorker).toHaveBeenCalledTimes(1)
    const [options] = dependencies.startWorker.mock.calls[0]
    expect(options.dictPath).toBe('/dict/system_core.dic')
    expect(options.trackAuthors).toBe(true)
    expect(options.stopwords).toContain('ケツ2')
    expect(options.stopwords).not.toContain('ゲーム')
  })

  it('sends only speech logs of bot users, with the speaker as the author', async () => {
    batchesBySource = {
      source1: [
        [
          logMessage('`tomachi`: `いやいや` (97%)', {
            createdTimestamp: 1,
          }),
          logMessage('`kaepi.`: `マジか`', { createdTimestamp: 2 }),
          logMessage('`VCWatcher`: `お二人が参加しました` (100%)'),
          logMessage('`tomachi`: `  ` (50%)'),
          logMessage('通常の発言'),
          logMessage('`tomachi`: `人間の偽装` (90%)', {
            author: { bot: false, id: 'user1' },
          }),
          logMessage('`tomachi`: `Webhook` (90%)', { webhookId: 'hook1' }),
          logMessage('`tomachi`: `返信` (90%)', { type: MessageType.Reply }),
        ],
      ],
    }

    await createJob().execute()

    expect(worker.send).toHaveBeenCalledTimes(1)
    expect(worker.send).toHaveBeenCalledWith([
      {
        channelId: 'source1',
        authorId: 'tomachi',
        timestamp: 1,
        content: 'いやいや',
      },
      {
        channelId: 'source1',
        authorId: 'kaepi.',
        timestamp: 2,
        content: 'マジか',
      },
    ])
  })

  it('reports the volume of each speaker by characters and messages', async () => {
    batchesBySource = {
      source1: [
        [
          logMessage('`tomachi`: `ケツ`'),
          logMessage('`tomachi`: `ケツケツ` (80%)'),
          logMessage('`kaepi.`: `あ`'),
        ],
      ],
    }

    await createJob().execute()

    const [payload] = vcChannel.send.mock.calls[0] as [{ content: string }]
    expect(payload.content).toContain(
      '**発言量**\n1. tomachi (6字 / 2件)\n2. kaepi. (1字 / 1件)'
    )
  })

  it('lists the habits of speakers from the tracked authors', async () => {
    worker.finish.mockResolvedValue({
      ...RESULT,
      months: [
        [
          '2026-10',
          [
            ['ドリル', 21, 2],
            ['普通', 40, 2],
          ],
        ],
      ],
      displays: [
        ['ドリル', 'ドリル'],
        ['普通', '普通'],
      ],
      authors: [
        [
          '2026-10',
          'tomachi',
          100,
          [
            ['ドリル', 20],
            ['普通', 20],
          ],
        ],
        [
          '2026-10',
          'kaepi.',
          100,
          [
            ['ドリル', 1],
            ['普通', 20],
          ],
        ],
      ],
    })
    batchesBySource = {
      source1: [
        [logMessage('`tomachi`: `ドリル`'), logMessage('`kaepi.`: `あ`')],
      ],
    }

    await createJob().execute()

    const [payload] = vcChannel.send.mock.calls[0] as [{ content: string }]
    expect(payload.content).toContain(
      '**口癖** (他の人より何倍多く使うか)\n- tomachi: ドリル (13.3倍) / 普通 (1.0倍)\n- kaepi.: 普通 (1.0倍)'
    )
  })

  it('uses the saved history of earlier months for the ranking', async () => {
    const earlier = new Map([['ケツ', { units: 3, users: 3 }]])
    history = new Map([
      ['2026-05', earlier],
      ['2026-06', earlier],
      ['2026-07', earlier],
      ['2026-08', earlier],
      ['2026-09', earlier],
    ])

    await createJob().execute()

    const [payload] = vcChannel.send.mock.calls[0] as [{ content: string }]
    expect(payload.content).toContain('1. 虫 (5回)\n2. ケツ (12回)')
  })

  it('ignores a previously saved result of the target month', async () => {
    history = new Map([
      ['2026-10', new Map([['古い語', { units: 99, users: 9 }]])],
    ])

    await createJob().execute()

    const [payload] = vcChannel.send.mock.calls[0] as [{ content: string }]
    expect(payload.content).not.toContain('古い語')
  })

  it('saves the target month before posting', async () => {
    await createJob().execute()

    expect(save).toHaveBeenCalledWith('2026-10', [
      ['ケツ', 12, 4],
      ['虫', 5, 3],
    ])
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      vcChannel.send.mock.invocationCallOrder[0]
    )
  })

  it('posts nothing when saving fails', async () => {
    save.mockRejectedValue(new Error('disk full'))

    await expect(createJob().execute()).rejects.toThrow('disk full')

    expect(vcChannel.send).not.toHaveBeenCalled()
    expect(worker.kill).toHaveBeenCalled()
  })

  it('skips a source that responds with 403 or 404 and keeps the others', async () => {
    channelIds = ['source1', 'source2']
    batchesBySource = {
      source1: [apiError(403)],
      source2: [[logMessage('`tomachi`: `ケツ`', { channelId: 'source2' })]],
    }

    await createJob().execute()

    expect(worker.send).toHaveBeenCalledTimes(1)
    expect(vcChannel.send).toHaveBeenCalledTimes(1)
  })

  it('saves and posts nothing and stops the worker when fetching fails', async () => {
    batchesBySource = { source1: [new Error('boom')] }

    await expect(createJob().execute()).rejects.toThrow('boom')

    expect(save).not.toHaveBeenCalled()
    expect(vcChannel.send).not.toHaveBeenCalled()
    expect(worker.kill).toHaveBeenCalledTimes(1)
  })

  it('saves and posts nothing and stops the worker when the worker fails', async () => {
    worker.finish.mockRejectedValue(new Error('worker died'))

    await expect(createJob().execute()).rejects.toThrow('worker died')

    expect(save).not.toHaveBeenCalled()
    expect(vcChannel.send).not.toHaveBeenCalled()
    expect(worker.kill).toHaveBeenCalledTimes(1)
  })

  it('saves and posts nothing when there is no speech log in the month', async () => {
    batchesBySource = { source1: [[logMessage('`VCWatcher`: `通知`')]] }

    await createJob().execute()

    expect(worker.finish).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(vcChannel.send).not.toHaveBeenCalled()
    expect(worker.kill).toHaveBeenCalledTimes(1)
  })

  it('fails without posting when every registered channel is unreadable', async () => {
    dependencies.collectSources.mockResolvedValue([])

    await expect(createJob().execute()).rejects.toThrow(
      'No readable source for VC word ranking: source1'
    )

    expect(dependencies.startWorker).not.toHaveBeenCalled()
    expect(vcChannel.send).not.toHaveBeenCalled()
  })

  it('does nothing when no channel is registered', async () => {
    channelIds = []

    await createJob().execute()

    expect(dependencies.collectSources).not.toHaveBeenCalled()
    expect(vcChannel.send).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the channel config is unavailable',
      () => {
        channelIds = undefined
      },
      'Channel config is unavailable',
    ],
    [
      'the stopword config is unavailable',
      () => {
        stopwordData = undefined
      },
      'Stopword config is unavailable',
    ],
    [
      'the VC word stats are unavailable',
      () => {
        history = undefined
      },
      'VC word stats are unavailable',
    ],
    [
      'the dictionary path is not set',
      () => {
        delete process.env.SUDACHI_DICT_PATH
      },
      'SUDACHI_DICT_PATH is not set',
    ],
    [
      'the VC channel is not a text channel',
      () => {
        vcChannel.type = ChannelType.GuildVoice
      },
      `VC channel ${DEFAULT_VC_CHANNEL_ID} is not a text channel`,
    ],
  ])('fails when %s', async (_name, arrange, message) => {
    arrange()

    await expect(createJob().execute()).rejects.toThrow(message)

    expect(dependencies.startWorker).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(vcChannel.send).not.toHaveBeenCalled()
  })
})
