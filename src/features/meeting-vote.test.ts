import { MessageType, User } from 'discord.js'
import { MeetingVote } from '@/features/meeting-vote'

describe('MeetingVote', () => {
  const channel = { id: 'vote-channel', send: jest.fn() }

  beforeEach(() => jest.clearAllMocks())

  it('accepts only eligible voters', () => {
    const feature = new MeetingVote(channel as never)
    Object.defineProperty(feature, 'memberIds', { value: ['test-user'] })

    expect(feature.hasVoteRight({ id: 'test-user' } as User)).toBe(true)
    expect(feature.hasVoteRight({ id: 'unlisted' } as User)).toBe(false)
  })

  it('pins a new default message, adds three vote reactions, and posts instructions', async () => {
    const feature = new MeetingVote(channel as never)
    const message = {
      channel,
      type: MessageType.Default,
      author: { bot: false, id: 'author-1' },
      pinned: false,
      content: 'Proposal [Border:2]',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      pin: jest.fn(),
      react: jest.fn(),
    }

    await feature.newVoteMessage(message as never)

    expect(message.pin).toHaveBeenCalled()
    expect(message.react.mock.calls).toEqual([['👍'], ['👎'], ['🏳']])
    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: expect.objectContaining({ messageReference: message }),
      })
    )
  })

  it('rejects a message from a different channel', async () => {
    const feature = new MeetingVote(channel as never)

    await expect(
      feature.newVoteMessage({ channel: { id: 'other' } } as never)
    ).rejects.toThrow('This message is not in the vote channel.')
  })
})
