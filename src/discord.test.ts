import nodeCron from 'node-cron'
import { Client, MessageFlags } from 'discord.js'
import { Discord } from '@/discord'
import * as jaotants from '@/interactions/jaotants'
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

describe('Discord interaction routing', () => {
  const createDiscord = () => {
    jest.spyOn(Client.prototype, 'login').mockResolvedValue('token')
    jest.spyOn(BaseDiscordTask.prototype, 'register').mockResolvedValue()
    jest.spyOn(nodeCron, 'schedule').mockReturnValue({} as never)
    const config = {
      get: (key: string) => (key === 'discord' ? { token: 'token' } : {}),
    }
    return new Discord(config as never)
  }

  const createInteraction = (commandName: string, chatInput = true) => ({
    isChatInputCommand: () => chatInput,
    commandName,
    deferred: false,
    replied: false,
    reply: jest.fn(),
    followUp: jest.fn(),
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('routes /jaotants to the handler', async () => {
    const handler = jest
      .spyOn(jaotants, 'handleJaotantsInteraction')
      .mockResolvedValue()
    const discord = createDiscord()
    const interaction = createInteraction('jaotants')

    await discord.onInteractionCreate(interaction as never)

    expect(handler).toHaveBeenCalledWith(discord, interaction)
  })

  it.each([
    ['another chat input command', createInteraction('ping')],
    ['a non chat input interaction', createInteraction('jaotants', false)],
  ])('does not route %s to the handler', async (_name, interaction) => {
    const handler = jest
      .spyOn(jaotants, 'handleJaotantsInteraction')
      .mockResolvedValue()

    await createDiscord().onInteractionCreate(interaction as never)

    expect(handler).not.toHaveBeenCalled()
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('replies with an ephemeral error when the handler throws', async () => {
    jest
      .spyOn(jaotants, 'handleJaotantsInteraction')
      .mockRejectedValue(new Error('boom'))
    const interaction = createInteraction('jaotants')

    await createDiscord().onInteractionCreate(interaction as never)

    expect(interaction.reply).toHaveBeenCalledWith({
      content: jaotants.jaotantsMessages.error,
      flags: MessageFlags.Ephemeral,
    })
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('follows up when the interaction was already deferred', async () => {
    jest
      .spyOn(jaotants, 'handleJaotantsInteraction')
      .mockRejectedValue(new Error('boom'))
    const interaction = { ...createInteraction('jaotants'), deferred: true }

    await createDiscord().onInteractionCreate(interaction as never)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: jaotants.jaotantsMessages.error,
      flags: MessageFlags.Ephemeral,
    })
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('initializes the channel config before registering the command', async () => {
    const order: string[] = []
    const discord = createDiscord()
    jest
      .spyOn(discord.getChannelConfigStore(), 'init')
      .mockImplementation(() => {
        order.push('init')
        return Promise.resolve()
      })
    jest.spyOn(jaotants, 'registerJaotantsCommand').mockImplementation(() => {
      order.push('register')
      return Promise.resolve()
    })

    await discord.onReady()

    expect(order).toEqual(['init', 'register'])
  })
})
