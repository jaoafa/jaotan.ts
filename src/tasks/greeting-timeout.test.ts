import { Discord } from '@/discord'
import { GreetingTimeoutTask } from '@/tasks/greeting-timeout'

describe('GreetingTimeoutTask', () => {
  it('kicks an overdue member who only has the everyone role', async () => {
    const member = {
      user: { bot: false, tag: 'user#0001' },
      id: 'member-1',
      joinedAt: new Date(Date.now() - 11 * 60 * 1000),
      roles: { cache: { filter: () => ({ size: 0 }) } },
      kickable: true,
      kick: jest.fn().mockResolvedValue(undefined),
    }
    const discord = {
      getConfig: () => ({ get: () => ({ discord: { guildId: 'guild-1' } }) }),
      client: {
        guilds: {
          fetch: jest.fn().mockResolvedValue({
            members: {
              fetch: () => Promise.resolve(new Map([['member-1', member]])),
            },
          }),
        },
      },
    } as unknown as Discord

    await new GreetingTimeoutTask(discord).execute()

    expect(member.kick).toHaveBeenCalledWith(
      expect.stringContaining('挨拶タイムアウト')
    )
  })

  it('skips bots and members who have another role', async () => {
    const bot = {
      user: { bot: true },
      joinedAt: new Date(Date.now() - 11 * 60 * 1000),
      roles: { cache: { filter: () => ({ size: 0 }) } },
      kickable: true,
      kick: jest.fn(),
    }
    const regularMember = {
      user: { bot: false },
      joinedAt: new Date(Date.now() - 11 * 60 * 1000),
      roles: { cache: { filter: () => ({ size: 1 }) } },
      kickable: true,
      kick: jest.fn(),
    }
    const discord = {
      getConfig: () => ({ get: () => ({ discord: {} }) }),
      client: {
        guilds: {
          fetch: jest.fn().mockResolvedValue({
            id: 'guild-1',
            members: {
              fetch: () =>
                Promise.resolve(
                  new Map([
                    ['bot', bot],
                    ['regular', regularMember],
                  ])
                ),
            },
          }),
        },
      },
    } as unknown as Discord

    await new GreetingTimeoutTask(discord).execute()

    expect(bot.kick).not.toHaveBeenCalled()
    expect(regularMember.kick).not.toHaveBeenCalled()
  })
})
