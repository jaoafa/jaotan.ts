/* eslint-disable @typescript-eslint/unbound-method */
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ChannelType } from 'discord.js'
import { Discord } from '@/discord'
import { EmojiRanking } from '@/features/emoji-ranking'
import { MonthlyEmojiRankingJob } from '@/jobs/emoji-ranking'

describe('MonthlyEmojiRankingJob', () => {
  let beforeDataDir: string | undefined
  let dataDir: string

  beforeEach(() => {
    beforeDataDir = process.env.DATA_DIR
    dataDir = fs.mkdtempSync(path.join(tmpdir(), 'emoji-ranking-job-test-'))
    process.env.DATA_DIR = dataDir
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
    if (beforeDataDir === undefined) {
      delete process.env.DATA_DIR
    } else {
      process.env.DATA_DIR = beforeDataDir
    }
  })

  it('posts both previous month rankings to the configured general channel', async () => {
    jest
      .spyOn(EmojiRanking.prototype, 'getRanking')
      .mockImplementation((_month, category) =>
        category === 'reactions'
          ? [{ kind: 'unicode', key: '🎉', display: '🎉', count: 4 }]
          : []
      )
    const channel = { type: ChannelType.GuildText, send: jest.fn() }
    const discord = {
      getConfig: () => ({ get: () => ({ channel: { general: 'general' } }) }),
      client: { channels: { fetch: jest.fn().mockResolvedValue(channel) } },
    } as unknown as Discord

    await new MonthlyEmojiRankingJob(discord).execute()

    expect(channel.send).toHaveBeenCalledWith(
      expect.stringContaining('1. 🎉 (4回)')
    )
    expect(channel.send).toHaveBeenCalledWith(
      expect.stringContaining('先月は利用がありませんでした')
    )
  })

  it('does not send to a non-text channel', async () => {
    const discord = {
      getConfig: () => ({ get: () => ({}) }),
      client: {
        channels: {
          fetch: jest.fn().mockResolvedValue({ type: ChannelType.GuildVoice }),
        },
      },
    } as unknown as Discord

    await new MonthlyEmojiRankingJob(discord).execute()

    expect(discord.client.channels.fetch).toHaveBeenCalled()
  })
})
