import { Client, GatewayIntentBits, Message } from 'discord.js'
import { Logger } from '@book000/node-utils'
import { BaseDiscordEvent } from './events'
import { Configuration } from './config'
import { BaseCommand } from './commands'
import { BasslineCommand } from './commands/bassline'
import { PingCommand } from './commands/ping'
import { TmttmtCommand } from './commands/tmttmt'
import { PotatoCommand } from './commands/potato'
import { KowaineCommand } from './commands/kowaine'
import { KawaiineCommand } from './commands/kawaiine'
import { SuperCommand } from './commands/super'
import { PowaCommand } from './commands/powa'
import { AlphaCommand } from './commands/alpha'
import { GreetingEvent } from './events/greeting'

export class Discord {
  private config: Configuration
  public readonly client: Client

  public static readonly commands: BaseCommand[] = [
    new AlphaCommand(),
    new BasslineCommand(),
    new PingCommand(),
    new PotatoCommand(),
    new KowaineCommand(),
    new KawaiineCommand(),
    new SuperCommand(),
    new PowaCommand(),
    new TmttmtCommand(),
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

    const events: BaseDiscordEvent<any>[] = [new GreetingEvent(this)]
    for (const event of events) {
      event.register()
    }

    this.client.login(config.get('discord').token)
    this.config = config
  }

  public getClient() {
    return this.client
  }

  public getConfig() {
    return this.config
  }

  public close() {
    this.client.destroy()
  }

  async onReady() {
    const logger = Logger.configure('Discord.onReady')
    logger.info(`👌 ready: ${this.client.user?.tag}`)
  }

  async onMessageCreate(message: Message) {
    const logger = Logger.configure('Discord.onMessageCreate')
    // Botのメッセージは無視
    if (message.author.bot) {
      return
    }

    // guildIdが設定されている場合、そのサーバ以外のメッセージは無視
    const onlyGuildId = this.config.get('discord').guildId
    if (onlyGuildId && message.guild?.id !== onlyGuildId) {
      return
    }

    // 対応するコマンドを探す
    const command = Discord.commands.find((command) =>
      message.content.startsWith(`/${command.name}`)
    )
    if (!command) {
      // コマンドが見つからない場合は無視
      return
    }

    // コマンドの実行権限を確認
    if (command.permissions) {
      const member = message.member
      if (!member) {
        logger.warn(`🚫 user not found: ${message.author.tag}`)
        return
      }

      const hasPermission = command.permissions.some((permission) => {
        switch (permission.type) {
          case 'USER': {
            return member.id === permission.identifier
          }
          case 'ROLE': {
            return member.roles.cache.some(
              (role) => role.id === permission.identifier
            )
          }
          case 'PERMISSION': {
            return member.permissions.has(permission.identifier)
          }
          default: {
            return false
          }
        }
      })
      if (!hasPermission) {
        logger.warn(`🚫 permission denied: ${message.author.tag}`)
        await message.react('🚫')
        return
      }
    }

    logger.info(`👌 ${message.author.tag}: execute ${command.name}`)

    const [, ...args] = message.content.split(' ')
    command.execute(this, message, args)
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
