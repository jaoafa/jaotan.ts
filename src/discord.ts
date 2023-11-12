import {
  Client,
  Colors,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  Partials,
} from 'discord.js'
import { Logger } from '@book000/node-utils'
import { BaseDiscordEvent } from './events'
import { Configuration } from './config'
import { BaseCommand } from './commands'
import { BasslineCommand } from './commands/bassline'
import { PingCommand } from './commands/ping'
import { TmttmtCommand } from './commands/tmttmt'
import { PotatoCommand } from './commands/potato'
import { SuperCommand } from './commands/super'
import { PowaCommand } from './commands/powa'
import { AlphaCommand } from './commands/alpha'
import { GreetingEvent } from './events/greeting'
import { TranslateCommand } from './commands/translate'
import { MeetingNewVoteEvent } from './events/meeting-vote-new'
import { MeetingReactionVoteEvent } from './events/meeting-vote-reaction'
import { BaseDiscordTask } from './tasks'
import { MeetingVoteTask } from './tasks/meeting-vote'
import { PinReactionEvent } from './events/pin-reaction'
import { PinPrefixEvent } from './events/pin-prefix'
import { VCSpeechLogMessageUrlEvent } from './events/vc-speech-log-url'
import { OriginCommand } from './commands/origin'
import { JoinedNotifierEvent } from './events/joined-notifier'
import { TweetEmbedEvent } from './events/tweet-embed'

export class Discord {
  private config: Configuration
  public readonly client: Client

  public static readonly commands: BaseCommand[] = [
    new AlphaCommand(),
    new BasslineCommand(),
    new PingCommand(),
    new PotatoCommand(),
    new SuperCommand(),
    new PowaCommand(),
    new TmttmtCommand(),
    new TranslateCommand(),
    new OriginCommand(),
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
      partials: [
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
        Partials.GuildScheduledEvent,
        Partials.ThreadMember,
      ],
    })
    this.client.on('ready', this.onReady.bind(this))
    this.client.on('messageCreate', this.onMessageCreate.bind(this))

    const events: BaseDiscordEvent<any>[] = [
      new GreetingEvent(this),
      new MeetingNewVoteEvent(this),
      new MeetingReactionVoteEvent(this),
      new PinReactionEvent(this),
      new PinPrefixEvent(this),
      new VCSpeechLogMessageUrlEvent(this),
      new JoinedNotifierEvent(this),
      new TweetEmbedEvent(this),
    ]
    for (const event of events) {
      event.register()
    }

    this.client.login(config.get('discord').token)

    const tasks: BaseDiscordTask[] = [new MeetingVoteTask(this)]
    for (const task of tasks) {
      task.register()
    }

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
    try {
      await command.execute(this, message, args)
    } catch (error) {
      // エラー処理
      logger.error('❌ Error', error as Error)
      const stacktrace = (error as Error).stack?.toString() || ''
      const files = this.getStackTraceTypeScriptFiles(stacktrace)
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ コマンドの実行中にエラーが発生しました。')
            .setDescription(
              '何度か試し、それでも解決しない場合は不具合として報告ください。\n（右クリックから「アプリ」→「不具合報告」を選択）'
            )
            .addFields([
              {
                name: 'エラーメッセージ',
                value: `\`\`\`\n${(error as Error).message}\n\`\`\``,
                inline: false,
              },
              {
                name: '関連ファイル',
                value: files.map((file) => `- \`${file}\``).join('\n'),
                inline: false,
              },
            ])
            .setTimestamp(new Date())
            .setColor(Colors.Red),
        ],
      })
    }
  }

  getStackTraceTypeScriptFiles(stack: string) {
    // at Object.execute (/app/dist/commands/translate.ts:48:23)

    const lines = stack.split('\n')
    const typescriptFiles = lines
      .filter((line) => line.trim().startsWith('at ') && line.includes('.ts:'))
      .map((line) => {
        return line.trim().slice(3)
      })

    return typescriptFiles
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
