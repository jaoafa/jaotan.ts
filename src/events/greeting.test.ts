/* eslint-disable @typescript-eslint/unbound-method */
import { Message } from 'discord.js'
import { Discord } from '@/discord'
import { GreetingEvent } from '@/events/greeting'

describe('GreetingEvent', () => {
  const message = (overrides: Record<string, unknown> = {}) =>
    ({
      channel: { id: 'greeting' },
      member: {
        roles: {
          cache: {
            has: () => false,
            filter: () => new Map(),
          },
          add: jest.fn(),
        },
      },
      author: { bot: false, id: 'user-1' },
      content: 'jao',
      delete: jest.fn(),
      react: jest.fn(),
      reply: jest.fn(),
      ...overrides,
    }) as unknown as Message<true>

  const discord = {
    getConfig: () => ({
      get: () => ({
        channel: { greeting: 'greeting' },
        role: { verified: 'verified' },
      }),
    }),
  } as unknown as Discord

  it('ignores messages outside the configured greeting channel', async () => {
    const event = new GreetingEvent(discord)
    const input = message({ channel: { id: 'other' } })

    await event.execute(input)

    expect(input.react).not.toHaveBeenCalled()
    expect(input.delete).not.toHaveBeenCalled()
  })

  it('deletes other messages in the greeting channel', async () => {
    const event = new GreetingEvent(discord)
    const input = message({ content: 'hello' })

    await event.execute(input)

    expect(input.delete).toHaveBeenCalled()
    expect(input.react).not.toHaveBeenCalled()
  })

  it('grants the verified role after a jao then afa sequence', async () => {
    const event = new GreetingEvent(discord)
    const jaoMessage = message()
    await event.execute(jaoMessage)
    expect(jaoMessage.react).toHaveBeenCalledWith('➡')

    const afaMessage = message({ content: 'afa' })
    await event.execute(afaMessage)

    expect(afaMessage.react).toHaveBeenCalledWith('⭕')
    expect(afaMessage.member?.roles.add).toHaveBeenCalledWith('verified')
    expect(afaMessage.reply).toHaveBeenCalled()
  })
})
