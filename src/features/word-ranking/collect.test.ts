/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@book000/node-utils'
import {
  ChannelType,
  Collection,
  DiscordAPIError,
  Guild,
  Message,
  MessageType,
} from 'discord.js'
import {
  collectSources,
  fetchMessages,
  isSkippableDiscordError,
  MessageSource,
  toWordMessage,
} from './collect'

const START = Date.UTC(2026, 4, 1) - 9 * 60 * 60 * 1000
const END = Date.UTC(2026, 10, 1) - 9 * 60 * 60 * 1000
const DISCORD_EPOCH = 1_420_070_400_000n

const apiError = (status: number) =>
  new DiscordAPIError(
    { message: `status ${status}`, code: 50_001 },
    50_001,
    status,
    'GET',
    '/test',
    {}
  )
const snowflake = (timestampMs: number, increment: number): string =>
  (
    ((BigInt(timestampMs) - DISCORD_EPOCH) << 22n) +
    BigInt(increment)
  ).toString()

describe('isSkippableDiscordError', () => {
  it.each([
    [apiError(403), true],
    [apiError(404), true],
    [apiError(500), false],
    [new Error('403'), false],
  ])('%s -> %s', (error, expected) => {
    expect(isSkippableDiscordError(error)).toBe(expected)
  })
})

describe('toWordMessage', () => {
  const message = (overrides: Record<string, unknown> = {}) =>
    ({
      author: { bot: false, id: 'user1' },
      webhookId: null,
      type: MessageType.Default,
      content: 'こんにちは',
      channelId: 'channel1',
      createdTimestamp: START + 1000,
      ...overrides,
    }) as unknown as Message

  it('converts a regular message', () => {
    expect(toWordMessage(message())).toEqual({
      channelId: 'channel1',
      authorId: 'user1',
      timestamp: START + 1000,
      content: 'こんにちは',
    })
  })

  it('accepts a reply', () => {
    expect(toWordMessage(message({ type: MessageType.Reply }))).toBeDefined()
  })

  it.each([
    ['a bot message', { author: { bot: true, id: 'bot1' } }],
    ['a webhook message', { webhookId: 'webhook1' }],
    ['a thread starter message', { type: MessageType.ThreadStarterMessage }],
    ['a system message', { type: MessageType.UserJoin }],
    ['an empty message', { content: '' }],
    ['a whitespace-only message', { content: ' \n ' }],
    ['a Wordle result', { content: 'Wordle 1,915 5/6\n🟨⬛' }],
  ])('skips %s', (_, overrides) => {
    expect(toWordMessage(message(overrides))).toBeUndefined()
  })
})

describe('fetchMessages', () => {
  const discordMessage = (timestampMs: number, increment: number) => ({
    id: snowflake(timestampMs, increment),
    createdTimestamp: timestampMs,
  })
  const asCollection = (messages: ReturnType<typeof discordMessage>[]) =>
    new Collection(messages.map((message) => [message.id, message]))
  const collect = async (source: MessageSource) => {
    const batches: string[][] = []
    for await (const batch of fetchMessages(source, START, END)) {
      batches.push(batch.map((message) => message.id))
    }
    return batches
  }

  it('starts just before the window start and returns batches oldest first', async () => {
    const first = [
      discordMessage(START + 3000, 0),
      discordMessage(START + 1000, 0),
      discordMessage(START + 2000, 0),
    ]
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(asCollection(first))
      .mockResolvedValueOnce(asCollection([]))
    const source = { messages: { fetch } } as unknown as MessageSource

    const batches = await collect(source)

    expect(batches).toEqual([[first[1].id, first[2].id, first[0].id]])
    expect(fetch).toHaveBeenNthCalledWith(1, {
      limit: 100,
      after: (BigInt(snowflake(START, 0)) - 1n).toString(),
    })
    expect(fetch).toHaveBeenNthCalledWith(2, {
      limit: 100,
      after: first[0].id,
    })
  })

  it('stops at the window end and drops messages at or after it', async () => {
    const inside = discordMessage(END - 1, 0)
    const outside = discordMessage(END, 0)
    const fetch = jest.fn().mockResolvedValue(asCollection([outside, inside]))
    const source = { messages: { fetch } } as unknown as MessageSource

    const batches = await collect(source)

    expect(batches).toEqual([[inside.id]])
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('collectSources', () => {
  const logger = { warn: jest.fn() } as unknown as Logger

  const textChannel = (id: string, archivedPages: unknown[] | Error = []) => {
    const fetchArchived = jest.fn()
    if (archivedPages instanceof Error) {
      fetchArchived.mockRejectedValue(archivedPages)
    } else {
      for (const page of archivedPages)
        fetchArchived.mockResolvedValueOnce(page)
      fetchArchived.mockResolvedValue({
        threads: new Collection(),
        hasMore: false,
      })
    }
    return {
      id,
      type: ChannelType.GuildText,
      threads: { fetchArchived },
    }
  }
  const thread = (
    id: string,
    parentId: string,
    overrides: Record<string, unknown> = {}
  ) => ({
    id,
    parentId,
    type: ChannelType.PublicThread,
    archiveTimestamp: START + 1000,
    ...overrides,
  })
  const page = (threads: ReturnType<typeof thread>[], hasMore = false) => ({
    threads: new Collection(threads.map((item) => [item.id, item])),
    hasMore,
  })
  const createGuild = (
    channels: Record<string, unknown>,
    activeThreads: ReturnType<typeof thread>[] = []
  ) =>
    ({
      channels: {
        fetch: jest.fn((id: string) => {
          const channel = channels[id]
          return channel instanceof Error
            ? Promise.reject(channel)
            : Promise.resolve(channel ?? null)
        }),
        fetchActiveThreads: jest.fn().mockResolvedValue({
          threads: new Collection(activeThreads.map((item) => [item.id, item])),
        }),
      },
    }) as unknown as Guild
  const ids = (sources: MessageSource[]) => sources.map((source) => source.id)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the channels with their active public threads', async () => {
    const guild = createGuild(
      { c1: textChannel('c1'), c2: textChannel('c2') },
      [
        thread('t1', 'c1'),
        thread('t2', 'other'),
        thread('t3', 'c2', { type: ChannelType.PrivateThread }),
      ]
    )

    const sources = await collectSources(guild, ['c1', 'c2'], START, logger)

    expect(ids(sources)).toEqual(['c1', 'c2', 't1'])
  })

  it('pages archived threads until one was archived before the window start', async () => {
    const channel = textChannel('c1', [
      page([thread('a1', 'c1'), thread('a2', 'c1')], true),
      page(
        [
          thread('a3', 'c1'),
          thread('old', 'c1', { archiveTimestamp: START - 1 }),
        ],
        true
      ),
    ])
    const guild = createGuild({ c1: channel })

    const sources = await collectSources(guild, ['c1'], START, logger)

    expect(ids(sources)).toEqual(['c1', 'a1', 'a2', 'a3'])
    expect(channel.threads.fetchArchived).toHaveBeenNthCalledWith(2, {
      type: 'public',
      limit: 100,
      before: START + 1000,
    })
  })

  it('does not duplicate a thread listed as both active and archived', async () => {
    const channel = textChannel('c1', [page([thread('t1', 'c1')])])
    const guild = createGuild({ c1: channel }, [thread('t1', 'c1')])

    const sources = await collectSources(guild, ['c1'], START, logger)

    expect(ids(sources)).toEqual(['c1', 't1'])
  })

  it.each([403, 404])(
    'skips a channel that responds with %s, with its threads',
    async (status) => {
      const guild = createGuild(
        { c1: apiError(status), c2: textChannel('c2') },
        [thread('t1', 'c1'), thread('t2', 'c2')]
      )

      const sources = await collectSources(guild, ['c1', 'c2'], START, logger)

      expect(ids(sources)).toEqual(['c2', 't2'])
      expect(logger.warn).toHaveBeenCalledWith(`⚠️ skip c1: status ${status}`)
    }
  )

  it('skips a channel that is not a text channel', async () => {
    const guild = createGuild({
      c1: { id: 'c1', type: ChannelType.GuildVoice },
      c2: null,
    })

    const sources = await collectSources(guild, ['c1', 'c2'], START, logger)

    expect(sources).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith('⚠️ skip c1: not a text channel')
    expect(logger.warn).toHaveBeenCalledWith('⚠️ skip c2: not a text channel')
  })

  it('keeps the channel when its archived thread list is forbidden', async () => {
    const guild = createGuild({ c1: textChannel('c1', apiError(403)) })

    const sources = await collectSources(guild, ['c1'], START, logger)

    expect(ids(sources)).toEqual(['c1'])
    expect(logger.warn).toHaveBeenCalledWith(
      '⚠️ skip archived threads of c1: status 403'
    )
  })

  it('aborts on any other error', async () => {
    const guild = createGuild({ c1: apiError(500) })

    await expect(collectSources(guild, ['c1'], START, logger)).rejects.toThrow(
      'status 500'
    )
  })
})
