/* eslint-disable @typescript-eslint/unbound-method */
import { Message } from 'discord.js'
import { Discord } from '@/discord'
import { GetAtamaCommand } from '@/commands/getatama'
import { SearchCommand } from '@/commands/search'
import { SearchImageCommand } from '@/commands/searchimg'
import { UnmuteCommand } from '@/commands/unmute'
import { SetbannerExtraCommand } from '@/commands/setbannerextra'
import { AkakeseCommand } from '@/commands/akakese'
import { BirthdayCommand } from '@/commands/birthday'
import { OriginCommand } from '@/commands/origin'
import { SetbannerCommand } from '@/commands/setbanner'

const mockSearch = jest.fn()
const mockGetRequestCount = jest.fn(() => 3)
const mockGetRequestLimit = jest.fn(() => 100)

jest.mock('@/features/google-search', () => ({
  GoogleSearch: jest.fn().mockImplementation(() => ({
    search: mockSearch,
    getRequestCount: mockGetRequestCount,
    getRequestLimit: mockGetRequestLimit,
  })),
}))

const message = (overrides: Record<string, unknown> = {}) =>
  ({
    author: { id: 'user-1', tag: 'user#0001' },
    channel: { send: jest.fn() },
    guild: { setBanner: jest.fn() },
    member: { voice: { setMute: jest.fn() } },
    reply: jest.fn(),
    ...overrides,
  }) as unknown as Message<true>

describe('GetAtamaCommand', () => {
  const fetchMock = jest.fn()
  const originalFetch = fetch

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('reports missing configuration without sending a request', async () => {
    const input = message()
    const discord = {
      getConfig: () => ({ get: () => undefined }),
    } as unknown as Discord

    await new GetAtamaCommand().execute(discord, input, [])

    expect(input.reply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          description: 'APIのURLが設定されていません。',
        }),
      ],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds the requested count and formats returned phrases', async () => {
    const input = message()
    const discord = {
      getConfig: () => ({ get: () => 'https://example.com/phrase' }),
    } as unknown as Discord
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ results: [{ full: 'first' }, { full: 'second' }] }),
    })

    await new GetAtamaCommand().execute(discord, input, ['2'])

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/phrase?count=2')
    expect(input.reply).toHaveBeenCalledWith('```\nfirst\nsecond\n```')
  })
})

describe('Search commands', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects an empty query before reading configuration', async () => {
    const input = message()
    const discord = { getConfig: jest.fn() } as unknown as Discord

    await new SearchCommand().execute(discord, input, [])

    expect(discord.getConfig).not.toHaveBeenCalled()
    expect(input.reply).toHaveBeenCalled()
  })

  it('sends an image query using the configured keys', async () => {
    const input = message()
    const discord = {
      getConfig: () => ({ get: () => ({ gcpKey: 'key', cx: 'engine' }) }),
    } as unknown as Discord
    mockSearch.mockResolvedValue({
      searchTime: '0.1',
      totalResult: '1',
      items: [
        {
          decodedTitle: 'cat',
          decodedSnippet: 'a cat',
          link: 'https://example.com',
          imageLink: 'https://example.com/cat.png',
        },
      ],
    })

    await new SearchImageCommand().execute(discord, input, ['cute', 'cats'])

    expect(mockSearch).toHaveBeenCalledWith('cute cats', 'image')
    expect(input.reply).toHaveBeenCalledWith({ embeds: [expect.anything()] })
  })

  it('sends a text query using the configured keys', async () => {
    const input = message()
    const discord = {
      getConfig: () => ({ get: () => ({ gcpKey: 'key', cx: 'engine' }) }),
    } as unknown as Discord
    mockSearch.mockResolvedValue({
      searchTime: '0.1',
      totalResult: '0',
      items: [],
    })

    await new SearchCommand().execute(discord, input, ['jao', 'server'])

    expect(mockSearch).toHaveBeenCalledWith('jao server')
    expect(input.reply).toHaveBeenCalledWith({ embeds: [expect.anything()] })
  })
})

describe('UnmuteCommand', () => {
  it('reports a missing member', async () => {
    const input = message({ member: null })

    await new UnmuteCommand().execute({} as Discord, input)

    expect(input.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({ title: 'エラー' })],
    })
  })

  it('unmutes the member and confirms success', async () => {
    const input = message()

    await new UnmuteCommand().execute({} as Discord, input)

    expect(input.member?.voice.setMute).toHaveBeenCalledWith(false)
    expect(input.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({ title: 'サーバミュート解除成功' })],
    })
  })
})

describe('SetbannerExtraCommand', () => {
  it('treats ordinary text as text rather than an image URL or custom emoji', async () => {
    await expect(
      new SetbannerExtraCommand().parseEmojiText('🙂')
    ).resolves.toEqual({
      image: null,
      text: '🙂',
    })
  })
})

describe('BirthdayCommand', () => {
  it('shows help for an unknown subcommand', async () => {
    const input = message()

    await new BirthdayCommand().execute({} as Discord, input, ['unknown'])

    expect(input.channel.send).toHaveBeenCalledWith({
      embeds: [expect.anything()],
    })
  })
})

describe('OriginCommand', () => {
  it('rejects non-numeric anniversary indexes without network access', async () => {
    const input = message()

    await new OriginCommand().execute({} as Discord, input, ['first'])

    expect(input.reply).toHaveBeenCalledWith(
      expect.stringContaining('記念日ナンバーは半角数字です')
    )
  })
})

describe('SetbannerCommand', () => {
  it('sets a generated banner and sends it as an attachment', async () => {
    const input = message()

    await new SetbannerCommand().execute({} as Discord, input, ['hello'])

    expect(input.guild.setBanner).toHaveBeenCalledWith(
      expect.any(Buffer),
      'Updated by setbanner command : user#0001'
    )
    expect(input.channel.send).toHaveBeenCalledWith({
      embeds: [expect.anything()],
      files: [expect.objectContaining({ name: 'banner.png' })],
    })
  })
})

describe('AkakeseCommand', () => {
  it('defaults the target mention to the author', async () => {
    const input = message({ author: { id: '123456789' } })

    await new AkakeseCommand().execute({} as Discord, input, [])

    expect(input.channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('<@123456789>,'),
      })
    )
  })

  it('normalizes a numeric target id to a user mention', async () => {
    const input = message()

    await new AkakeseCommand().execute({} as Discord, input, ['123456789'])

    expect(input.channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('<@123456789>,'),
      })
    )
  })
})
