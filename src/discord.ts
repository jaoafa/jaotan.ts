import { Client, GatewayIntentBits, Message } from 'discord.js'
import { Logger } from '@book000/node-utils'
import { BaseDiscordEvent } from './events'
import { Configuration } from './config'
import { BaseCommand } from './commands'
import { BasslineCommand } from './commands/bassline'
import { PingCommand } from './commands/ping'
import { PotatoCommand } from './commands/potato'
import { KawaiineCommand } from './commands/kawaiine'
import { KowaineCommand } from './commands/kowaine'

export class Discord {
  public readonly client: Client

  public static readonly commands: BaseCommand[] = [
    new BasslineCommand(),
    new PingCommand(),
    new PotatoCommand(),
    new KawaiineCommand(),
    new KowaineCommand(),
  ]

  constructor(config: Configuration) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
    })
    this.client.on('ready', this.onReady.bind(this))
    this.client.on('messageCreate', this.onMessageCreate.bind(this))

    const events: BaseDiscordEvent[] = []
    for (const event of events) {
      event.register()
    }

    this.client.login(config.get('discord').token)
  }

  public getClient() {
    return this.client
  }

  public close() {
    this.client.destroy()
  }

  async onReady() {
    const logger = Logger.configure('Discord.onReady')
    logger.info(`👌 ready: ${this.client.user?.tag}`)
  }

  async onMessageCreate(message: Message) {
    const command = Discord.commands.find((command) =>
      message.content.startsWith(`/${command.name}`)
    )
    if (!command) {
      return
    }

    command.execute(this, message)
  }

  waitReady() {
    return new Promise<void>((resolve) => {
      if (this.client.isReady()) {
        resolve()
      }
      this.client.once('ready', () => {
        resolve()
      })
    })
  }
}
