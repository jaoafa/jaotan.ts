/* eslint-disable @typescript-eslint/unbound-method */
import { ChannelType, Message } from 'discord.js'
import { Discord } from '@/discord'
import { Nitrotan } from '@/features/nitrotan'
import { BaseDiscordEvent } from '@/events/index'
import { MeetingReactionVoteEvent } from '@/events/meeting-vote-reaction'
import { NitrotanMessageEvent } from '@/events/nitrotan-message'
import { NitrotanReactionEvent } from '@/events/nitrotan-reaction'
import { VCSpeechLogMessageUrlEvent } from '@/events/vc-speech-log-url'

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

describe('VCSpeechLogMessageUrlEvent', () => {
  it('quotes the content of a linked message in the configured channel', async () => {
    const source = {
      type: ChannelType.GuildText,
      name: 'vc-speech-log',
      messages: {
        fetch: jest.fn().mockResolvedValue({
          content: 'recognized words',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    }
    const discord = {
      getConfig: () => ({ get: () => ({ channel: { vcSpeechLog: '123' } }) }),
    } as unknown as Discord
    const input = {
      member: {},
      author: { bot: false },
      content: 'https://discord.com/channels/456/123/789',
      guild: { channels: { fetch: jest.fn().mockResolvedValue(source) } },
      channel: { send: jest.fn() },
    } as unknown as Message<true>

    await new VCSpeechLogMessageUrlEvent(discord).execute(input)

    expect(source.messages.fetch).toHaveBeenCalledWith('789')
    expect(input.channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: expect.objectContaining({ messageReference: input }),
      })
    )
  })

  it.each([
    '1149606247314767993',
    '1555541589164560415',
    '1555864863052398632',
  ])(
    'quotes the content of a linked message in supported channel %s',
    async (channelId) => {
      const source = {
        type: ChannelType.GuildText,
        name: 'vc-speech-log',
        messages: {
          fetch: jest.fn().mockResolvedValue({
            content: 'recognized words',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          }),
        },
      }
      const discord = {
        getConfig: () => ({ get: () => ({ channel: {} }) }),
      } as unknown as Discord
      const input = {
        member: {},
        author: { bot: false },
        content: `https://discord.com/channels/456/${channelId}/789`,
        guild: { channels: { fetch: jest.fn().mockResolvedValue(source) } },
        channel: { send: jest.fn() },
      } as unknown as Message<true>

      await new VCSpeechLogMessageUrlEvent(discord).execute(input)

      expect(input.guild.channels.fetch).toHaveBeenCalledWith(channelId)
      expect(source.messages.fetch).toHaveBeenCalledWith('789')
      expect(input.channel.send).toHaveBeenCalled()
    }
  )

  it('ignores links to unsupported channels', async () => {
    const fetchChannel = jest.fn()
    const discord = {
      getConfig: () => ({ get: () => ({ channel: {} }) }),
    } as unknown as Discord
    const input = {
      member: {},
      author: { bot: false },
      content: 'https://discord.com/channels/456/123/789',
      guild: { channels: { fetch: fetchChannel } },
      channel: { send: jest.fn() },
    } as unknown as Message<true>

    await new VCSpeechLogMessageUrlEvent(discord).execute(input)

    expect(fetchChannel).not.toHaveBeenCalled()
    expect(input.channel.send).not.toHaveBeenCalled()
  })
})
