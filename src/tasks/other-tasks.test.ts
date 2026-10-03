import { ChannelType } from 'discord.js'
import { Discord } from '@/discord'
import { MeetingVote } from '@/features/meeting-vote'
import { Nitrotan } from '@/features/nitrotan'
import { MeetingVoteTask } from '@/tasks/meeting-vote'
import { NitrotanOptimizeTask } from '@/tasks/nitrotan-optimize'
import { NitrotanProfileTask } from '@/tasks/nitrotan-profile'

describe('MeetingVoteTask', () => {
  afterEach(() => jest.restoreAllMocks())

  it('runs the meeting vote check for a text channel', async () => {
    const run = jest.spyOn(MeetingVote.prototype, 'run').mockResolvedValue()
    const channel = { type: ChannelType.GuildText }
    const discord = {
      getConfig: () => ({ get: () => ({ channel: { meetingVote: 'vote' } }) }),
      client: { channels: { fetch: jest.fn().mockResolvedValue(channel) } },
    } as unknown as Discord

    await new MeetingVoteTask(discord).execute()

    expect(run).toHaveBeenCalled()
  })
})

describe('NitrotanOptimizeTask', () => {
  it('loads Nitrotan data and runs optimization', async () => {
    const optimize = jest.fn().mockResolvedValue(undefined)
    jest.spyOn(Nitrotan, 'of').mockResolvedValue({ optimize } as never)

    await new NitrotanOptimizeTask({} as Discord).execute()

    expect(optimize).toHaveBeenCalled()
  })
})

describe('NitrotanProfileTask', () => {
  it('recognizes a GIF avatar and records its Nitro reason', async () => {
    const add = jest.fn().mockResolvedValue(undefined)
    const guild = {
      members: {
        fetch: jest.fn().mockResolvedValue(
          new Map([
            [
              'member-1',
              {
                id: 'member-1',
                user: { avatarURL: () => 'https://cdn.example/avatar.gif' },
                displayAvatarURL: () => 'https://cdn.example/server-avatar.png',
              },
            ],
          ])
        ),
      },
    }
    const nitrotan = {
      getGuild: () => guild,
      isNitrotan: () => false,
      add,
      check: jest.fn(),
    }
    jest.spyOn(Nitrotan, 'of').mockResolvedValue(nitrotan as never)

    await new NitrotanProfileTask({} as Discord).execute()

    expect(add).toHaveBeenCalledWith('member-1', 'AVATAR_ANIME')
  })
})
