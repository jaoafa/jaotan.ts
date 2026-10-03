import { ChannelType, Message } from 'discord.js'
import { Discord } from '@/discord'
import { MeetingVote } from '@/features/meeting-vote'
import { MeetingNewVoteEvent } from '@/events/meeting-vote-new'

describe('MeetingNewVoteEvent', () => {
  afterEach(() => jest.restoreAllMocks())

  it('forwards a new member message in the meeting vote channel', async () => {
    const vote = jest
      .spyOn(MeetingVote.prototype, 'newVoteMessage')
      .mockResolvedValue()
    const discord = {
      getConfig: () => ({
        get: () => ({ channel: { meetingVote: 'vote-channel' } }),
      }),
    } as unknown as Discord
    const message = {
      channel: { id: 'vote-channel', type: ChannelType.GuildText },
      member: {},
      author: { bot: false },
      pinned: false,
    } as unknown as Message<true>

    await new MeetingNewVoteEvent(discord).execute(message)

    expect(vote).toHaveBeenCalledWith(message)
  })

  it('ignores bot messages and messages outside the vote channel', async () => {
    const vote = jest.spyOn(MeetingVote.prototype, 'newVoteMessage')
    const discord = {
      getConfig: () => ({
        get: () => ({ channel: { meetingVote: 'vote-channel' } }),
      }),
    } as unknown as Discord
    const event = new MeetingNewVoteEvent(discord)

    await event.execute({ channel: { id: 'other' } } as never)
    await event.execute({
      channel: { id: 'vote-channel', type: ChannelType.GuildText },
      member: {},
      author: { bot: true },
      pinned: false,
    } as never)

    expect(vote).not.toHaveBeenCalled()
  })
})
