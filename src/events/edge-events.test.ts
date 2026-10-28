import { Discord } from '@/discord'
import { Nitrotan } from '@/features/nitrotan'
import { BaseDiscordEvent } from '@/events/index'
import { MeetingReactionVoteEvent } from '@/events/meeting-vote-reaction'
import { NitrotanMessageEvent } from '@/events/nitrotan-message'
import { NitrotanReactionEvent } from '@/events/nitrotan-reaction'

describe('BaseDiscordEvent', () => {
  it('registers the event and forwards its arguments', async () => {
    class ExampleEvent extends BaseDiscordEvent<'messageCreate'> {
      readonly eventName = 'messageCreate'
      execute = jest.fn().mockResolvedValue(undefined)
    }
    const on = jest.fn()
    const event = new ExampleEvent({ client: { on } } as unknown as Discord)

    event.register()
    const [, handler] = on.mock.calls.at(0) as unknown as [
      string,
      (...args: unknown[]) => void,
    ]
    handler('message')
    await Promise.resolve()

    expect(on).toHaveBeenCalledWith('messageCreate', expect.any(Function))
    expect(event.execute).toHaveBeenCalledWith('message')
  })
})

describe('MeetingReactionVoteEvent', () => {
  it('ignores reactions outside the configured vote channel', async () => {
    const event = new MeetingReactionVoteEvent({
      getConfig: () => ({ get: () => ({ channel: { meetingVote: 'vote' } }) }),
    } as unknown as Discord)
    const inGuild = jest.fn()
    const reaction = {
      message: { partial: false, channel: { id: 'other' }, inGuild },
    }

    await event.execute(reaction as never, { bot: false } as never)

    expect(inGuild).not.toHaveBeenCalled()
  })
})

describe('NitrotanMessageEvent', () => {
  afterEach(() => jest.restoreAllMocks())

  it('recognizes an animated custom emoji in a message', async () => {
    const add = jest.fn().mockResolvedValue(undefined)
    const nitrotan = { isNitrotan: () => false, add, check: jest.fn() }
    jest.spyOn(Nitrotan, 'of').mockResolvedValue(nitrotan as never)
    const message = {
      author: { id: 'user-1' },
      content: '<a:dance:123456789012345678>',
      guild: {
        emojis: { cache: new Map() },
        stickers: { cache: new Map() },
        premiumTier: 0,
      },
      stickers: { some: () => false },
      attachments: { some: () => false },
    }

    await new NitrotanMessageEvent({} as Discord).execute(message as never)

    expect(add).toHaveBeenCalledWith('user-1', 'USE_ANIMATION_EMOJI_MESSAGE')
  })
})

describe('NitrotanReactionEvent', () => {
  afterEach(() => jest.restoreAllMocks())

  it('ignores reactions on non-guild messages', async () => {
    const of = jest.spyOn(Nitrotan, 'of')
    const reaction = {
      partial: false,
      message: { partial: false, inGuild: () => false },
    }

    await new NitrotanReactionEvent({} as Discord).execute(
      reaction as never,
      { partial: false, id: 'user-1' } as never
    )

    expect(of).not.toHaveBeenCalled()
  })
})
