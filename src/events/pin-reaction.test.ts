import {
  ChannelType,
  PermissionFlagsBits,
  MessageReaction,
  User,
} from 'discord.js'
import { Discord } from '@/discord'
import { PinReactionEvent } from '@/events/pin-reaction'

describe('PinReactionEvent', () => {
  it('pins an unpinned guild message for a user with send permission', async () => {
    const message = {
      partial: false,
      inGuild: () => true,
      member: {},
      channel: {
        type: ChannelType.GuildText,
        permissionsFor: () => ({
          has: (permission: bigint) =>
            permission === PermissionFlagsBits.SendMessages,
        }),
      },
      pinned: false,
      pin: jest.fn(),
    }
    const reaction = {
      message,
      emoji: { name: '📌' },
    } as unknown as MessageReaction
    const user = { partial: false, bot: false } as User

    await new PinReactionEvent({} as Discord).execute(reaction, user)

    expect(message.pin).toHaveBeenCalled()
  })

  it('ignores other reactions', async () => {
    const message = {
      partial: false,
      inGuild: () => true,
      member: {},
      channel: {
        type: ChannelType.GuildText,
        permissionsFor: () => ({ has: () => true }),
      },
      pinned: false,
      pin: jest.fn(),
    }
    const reaction = {
      message,
      emoji: { name: '👍' },
    } as unknown as MessageReaction

    await new PinReactionEvent({} as Discord).execute(reaction, {
      partial: false,
      bot: false,
    } as User)

    expect(message.pin).not.toHaveBeenCalled()
  })
})
