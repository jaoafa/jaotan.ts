/* eslint-disable @typescript-eslint/unbound-method */
import { ChannelType } from 'discord.js'
import { Discord } from '@/discord'
import { Birthday } from '@/features/birthday'
import { Kinenbi } from '@/features/kinenbi'
import { EveryDayJob } from '@/jobs/everyday'

describe('EveryDayJob', () => {
  afterEach(() => jest.restoreAllMocks())

  it('posts the daily summary and handles an empty anniversary list', async () => {
    jest.spyOn(Birthday.prototype, 'get').mockReturnValue([])
    jest.spyOn(Kinenbi.prototype, 'get').mockResolvedValue([])
    jest.spyOn(Kinenbi.prototype, 'getRanking').mockResolvedValue(null)
    const channel = { type: ChannelType.GuildText, send: jest.fn() }
    const discord = {
      getConfig: () => ({ get: () => ({ channel: { general: 'general' } }) }),
      client: { channels: { fetch: jest.fn().mockResolvedValue(channel) } },
    } as unknown as Discord

    await new EveryDayJob(discord).execute()

    expect(channel.send).toHaveBeenCalledWith(
      expect.stringContaining('年間通算')
    )
    expect(channel.send).toHaveBeenCalledWith(
      expect.stringContaining(
        '本日の記念日が存在しないか、取得できませんでした。'
      )
    )
  })

  it('skips non-text channels', async () => {
    const discord = {
      getConfig: () => ({ get: () => ({}) }),
      client: {
        channels: {
          fetch: jest.fn().mockResolvedValue({ type: ChannelType.GuildVoice }),
        },
      },
    } as unknown as Discord

    await new EveryDayJob(discord).execute()

    expect(discord.client.channels.fetch).toHaveBeenCalled()
  })
})
