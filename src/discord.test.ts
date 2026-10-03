import nodeCron from 'node-cron'
import { Client } from 'discord.js'
import { Discord } from '@/discord'
import { BaseDiscordTask } from '@/tasks'

describe('Discord command registry', () => {
  it('registers each command name exactly once', () => {
    const names = Discord.commands.map((command) => command.name)

    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('ping')
    expect(names).toContain('translate')
  })

  it('routes a user message to the matching command', async () => {
    const login = jest
      .spyOn(Client.prototype, 'login')
      .mockResolvedValue('token')
    const registerTask = jest
      .spyOn(BaseDiscordTask.prototype, 'register')
      .mockResolvedValue(undefined)
    const schedule = jest
      .spyOn(nodeCron, 'schedule')
      .mockReturnValue({} as never)
    const config = {
      get: (key: string) => (key === 'discord' ? { token: 'token' } : {}),
    }
    const discord = new Discord(config as never)
    const input = {
      author: { bot: false, tag: 'user#0001' },
      content: '/ping',
      guild: { id: 'guild-1' },
      reply: jest.fn(),
    }

    await discord.onMessageCreate(input as never)

    expect(input.reply).toHaveBeenCalledWith('pong!')
    expect(login).toHaveBeenCalledWith('token')
    expect(registerTask).toHaveBeenCalledTimes(4)
    expect(schedule).toHaveBeenCalledTimes(2)

    jest.restoreAllMocks()
  })
})
