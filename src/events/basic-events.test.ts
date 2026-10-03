/* eslint-disable @typescript-eslint/unbound-method */
import { ChannelType, Message } from 'discord.js'
import { Discord } from '@/discord'
import { JoinedNotifierEvent } from '@/events/joined-notifier'
import { LeavedNotififerEvent } from '@/events/leaved-notifier'
import { NewDiscussionMention } from '@/events/new-discussion-mention'
import { PinPrefixEvent } from '@/events/pin-prefix'
import { ReplyEvent } from '@/events/reply'

describe('JoinedNotifierEvent', () => {
  it('announces a new member in the configured channels', async () => {
    const general = {
      type: ChannelType.GuildText,
      guildId: 'guild-1',
      send: jest.fn(),
    }
    const greeting = { type: ChannelType.GuildText, send: jest.fn() }
    const discord = {
      getConfig: () => ({
        get: () => ({ channel: { general: 'general', greeting: 'greeting' } }),
      }),
      client: {
        channels: {
          fetch: jest
            .fn()
            .mockResolvedValueOnce(general)
            .mockResolvedValueOnce(greeting),
        },
      },
    } as unknown as Discord
    const member = { id: 'member-1', guild: { id: 'guild-1' } }

    await new JoinedNotifierEvent(discord).execute(member as never)

    expect(general.send).toHaveBeenCalledWith(
      expect.stringContaining('<@member-1>')
    )
    expect(greeting.send).toHaveBeenCalledWith(
      expect.stringContaining('<#greeting>')
    )
  })
})

describe('LeavedNotififerEvent', () => {
  it('announces a departure in the configured general channel', async () => {
    const general = {
      type: ChannelType.GuildText,
      guildId: 'guild-1',
      send: jest.fn(),
    }
    const discord = {
      getConfig: () => ({ get: () => ({ channel: { general: 'general' } }) }),
      client: { channels: { fetch: jest.fn().mockResolvedValue(general) } },
    } as unknown as Discord

    await new LeavedNotififerEvent(discord).execute({
      id: 'member-1',
      guild: { id: 'guild-1' },
    } as never)

    expect(general.send).toHaveBeenCalledWith(
      expect.stringContaining('<@member-1>')
    )
  })
})

describe('NewDiscussionMention', () => {
  it('mentions the configured admin role only for new discussion threads', async () => {
    const discord = {
      getConfig: () => ({
        get: () => ({
          channel: { discussion: 'discussion' },
          role: { admin: 'admin' },
        }),
      }),
    } as unknown as Discord
    const thread = {
      parentId: 'discussion',
      isThread: () => true,
      type: ChannelType.PublicThread,
      send: jest.fn(),
    }
    const event = new NewDiscussionMention(discord)

    await event.execute(thread as never, true)
    await event.execute(thread as never, false)

    expect(thread.send).toHaveBeenCalledTimes(1)
    expect(thread.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: '<@&admin>' })
    )
  })
})

describe('PinPrefixEvent', () => {
  it('pins an eligible message prefixed with the pin emoji', async () => {
    const event = new PinPrefixEvent({} as Discord)
    const input = {
      member: {},
      author: { bot: false },
      channel: { type: ChannelType.GuildText },
      content: '📌 important',
      pinned: false,
      pin: jest.fn(),
    } as unknown as Message<true>

    await event.execute(input)

    expect(input.pin).toHaveBeenCalled()
  })

  it('ignores messages without the prefix', async () => {
    const event = new PinPrefixEvent({} as Discord)
    const input = {
      member: {},
      author: { bot: false },
      channel: { type: ChannelType.GuildText },
      content: 'important 📌',
      pinned: false,
      pin: jest.fn(),
    } as unknown as Message<true>

    await event.execute(input)

    expect(input.pin).not.toHaveBeenCalled()
  })
})

describe('ReplyEvent', () => {
  it('keeps a stable per-user chat id and recognizes mentions of this bot', () => {
    const discord = { client: { user: { id: 'bot-1' } } } as unknown as Discord
    const event = new ReplyEvent(discord)
    const firstId = event.getMeboUserId('member-1')

    expect(event.getMeboUserId('member-1')).toBe(firstId)
    expect(
      event.isReplyToMe({
        mentions: { users: new Map([['bot-1', {}]]) },
      } as never)
    ).toBe(true)
    expect(event.isReplyToMe({ mentions: { users: new Map() } } as never)).toBe(
      false
    )
  })
})
