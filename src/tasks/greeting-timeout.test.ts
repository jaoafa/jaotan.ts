import { Discord } from '@/discord'
import { GreetingTimeoutTask } from '@/tasks/greeting-timeout'

const overdueMember = (id: string) => ({
  user: { bot: false, tag: `${id}#0001` },
  id,
  joinedAt: new Date(Date.now() - 11 * 60 * 1000),
  roles: { cache: { filter: () => ({ size: 0 }), some: () => false } },
  kickable: true,
  kick: jest.fn().mockResolvedValue(undefined),
})

/**
 * `warmUp` は引数なしの全メンバー取得、引数ありの取得は対象 1 人の最新化として扱う
 */
const createDiscord = (
  members: Map<string, unknown>,
  warmUp: jest.Mock<Promise<void>> = jest.fn().mockResolvedValue(undefined),
  latest: (id: string) => unknown = (id) => members.get(id)
) =>
  ({
    getConfig: () => ({ get: () => ({ discord: { guildId: 'guild-1' } }) }),
    client: {
      guilds: {
        fetch: jest.fn().mockResolvedValue({
          id: 'guild-1',
          members: {
            fetch: (options?: { user: string; force?: boolean }) => {
              if (!options) return warmUp()
              return Promise.resolve(
                options.force ? latest(options.user) : members.get(options.user)
              )
            },
            cache: members,
          },
        }),
      },
    },
  }) as unknown as Discord

describe('GreetingTimeoutTask', () => {
  it('kicks an overdue member who only has the everyone role', async () => {
    const member = overdueMember('member-1')
    const discord = createDiscord(new Map([['member-1', member]]))

    await new GreetingTimeoutTask(discord).execute()

    expect(member.kick).toHaveBeenCalledWith(
      expect.stringContaining('挨拶タイムアウト')
    )
  })

  it('skips bots and members who have another role', async () => {
    const bot = {
      ...overdueMember('bot'),
      user: { bot: true },
    }
    const regularMember = {
      ...overdueMember('regular'),
      roles: { cache: { filter: () => ({ size: 1 }), some: () => true } },
    }
    const target = overdueMember('target')
    const discord = createDiscord(
      new Map<string, unknown>([
        ['bot', bot],
        ['regular', regularMember],
        ['target', target],
      ])
    )

    await new GreetingTimeoutTask(discord).execute()

    expect(bot.kick).not.toHaveBeenCalled()
    expect(regularMember.kick).not.toHaveBeenCalled()
    expect(target.kick).toHaveBeenCalledTimes(1)
  })

  it('does not kick a member who gained a role after the cache was filled', async () => {
    const stale = overdueMember('stale')
    const refreshed = {
      ...stale,
      roles: { cache: { filter: () => ({ size: 1 }), some: () => true } },
    }
    const discord = createDiscord(
      new Map([['stale', stale]]),
      undefined,
      () => refreshed
    )

    await new GreetingTimeoutTask(discord).execute()

    expect(stale.kick).not.toHaveBeenCalled()
  })

  it('fetches all members only once across executions', async () => {
    const warmUp = jest.fn().mockResolvedValue(undefined)
    const task = new GreetingTimeoutTask(createDiscord(new Map(), warmUp))

    await task.execute()
    await task.execute()

    expect(warmUp).toHaveBeenCalledTimes(1)
  })

  it('retries the fetch on the next execution when it fails', async () => {
    const member = overdueMember('member-1')
    const warmUp = jest
      .fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue(undefined)
    const task = new GreetingTimeoutTask(
      createDiscord(new Map([['member-1', member]]), warmUp)
    )

    await task.execute()
    expect(member.kick).not.toHaveBeenCalled()

    await task.execute()
    expect(warmUp).toHaveBeenCalledTimes(2)
    expect(member.kick).toHaveBeenCalledTimes(1)
  })
})
