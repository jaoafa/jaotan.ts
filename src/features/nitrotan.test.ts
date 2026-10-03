import { Discord } from '@/discord'
import { Nitrotan } from '@/features/nitrotan'

describe('Nitrotan.of', () => {
  it('fails clearly when the configured channel cannot be found', async () => {
    const discord = {
      getConfig: () => ({
        get: () => ({ channel: { other: 'other-channel' } }),
      }),
      client: {
        channels: {
          cache: new Map(),
          fetch: jest.fn().mockRejectedValue(new Error('missing')),
        },
      },
    } as unknown as Discord

    await expect(Nitrotan.of(discord)).rejects.toThrow('Channel not found')
  })
})
