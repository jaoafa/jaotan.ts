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
import { LeavedNotififerEvent } from './events/leaved-notifier'
import { TojaCommand } from './commands/toja'
import { ToarCommand } from './commands/toar'
import { ToarjaCommand } from './commands/toarja'
import { ContorandjaCommand } from './commands/controrandja'
import { TochaosCommand } from './commands/tochaos'
import { ToheCommand } from './commands/tohe'
import { TohejaCommand } from './commands/toheja'
import { TojaenCommand } from './commands/tojaen'
import { TokojaCommand } from './commands/tokoja'
import { TorandCommand } from './commands/torandja'
import { ToswjaCommand } from './commands/toswja'
import { TozhCommand } from './commands/tozh'
import { TozhjaCommand } from './commands/tozhja'
import { NewDiscussionMention } from './events/new-discussion-mention'
import { BaseDiscordJob } from './jobs'
import nodeCron from 'node-cron'
import { EveryDayJob } from './jobs/everyday'
import { BirthdayCommand } from './commands/birthday'
import { GetAtamaCommand } from './commands/getatama'
import { SetbannerCommand } from './commands/setbanner'
import { SearchCommand } from './commands/search'
import { SearchImageCommand } from './commands/searchimg'
import { AkakeseCommand } from './commands/akakese'
import { ToenCommand } from './commands/toen'
import { UnmuteCommand } from './commands/unmute'
import { NitrotanReactionEvent } from './events/nitrotan-reaction'
import { NitrotanMessageEvent } from './events/nitrotan-message'
import { NitrotanOptimizeTask } from './tasks/nitrotan-optimize'
import { NitrotanProfileTask } from './tasks/nitrotan-profile'
import { ReplyEvent } from './events/reply'
import { SetbannerExtraCommand } from './commands/setbannerextra'
import { GreetingTimeoutTask } from './tasks/greeting-timeout'

export class Discord {
  private config: Configuration
  public readonly client: Client

  private readonly tasks: BaseDiscordTask[] = []

  public static readonly commands: BaseCommand[] = [
    new AkakeseCommand(),
    new AlphaCommand(),
    new BirthdayCommand(),
    new ContorandjaCommand(),
    new GetAtamaCommand(),
    new OriginCommand(),
    new PingCommand(),
    new PotatoCommand(),
    new PowaCommand(),
    new SearchCommand(),
    new SearchImageCommand(),
    new SetbannerCommand(),
    new SetbannerExtraCommand(),
    new SuperCommand(),
    new TmttmtCommand(),
    new ToarCommand(),
    new ToarjaCommand(),
    new TochaosCommand(),
    new ToenCommand(),
    new ToheCommand(),
    new TohejaCommand(),
    new TojaCommand(),
    new TojaenCommand(),
    new TokojaCommand(),
    new TorandCommand(),
    new ToswjaCommand(),
    new TozhCommand(),
    new TozhjaCommand(),
    new TranslateCommand(),
    new UnmuteCommand(),
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
    this.client.on('messageCreate', (message) => {
      if (!message.inGuild()) {
        return
      }
      this.onMessageCreate(message).catch((err: unknown) => {
        Logger.configure('Discord.onMessageCreate').error(
          '❌ Error',
          err as Error
        )
      })
    })

    const events: BaseDiscordEvent<any>[] = [
      new GreetingEvent(this),
      new JoinedNotifierEvent(this),
      new LeavedNotififerEvent(this),
      new MeetingNewVoteEvent(this),
      new MeetingReactionVoteEvent(this),
      new NewDiscussionMention(this),
      new NitrotanMessageEvent(this),
      new NitrotanReactionEvent(this),
      new PinPrefixEvent(this),
      new PinReactionEvent(this),
      new ReplyEvent(this),
      new VCSpeechLogMessageUrlEvent(this),
    ]
    for (const event of events) {
      event.register()
    }

    this.client.login(config.get('discord').token).catch((err: unknown) => {
      Logger.configure('Discord.login').error('❌ login failed', err as Error)
    })

    this.tasks = [
      new MeetingVoteTask(this),
      new NitrotanOptimizeTask(this),
      new NitrotanProfileTask(this),
      new GreetingTimeoutTask(this),
    ]
    for (const task of this.tasks) {
      task.register().catch((err: unknown) => {
        Logger.configure('Discord.task').error(
          '❌ task register failed',
          err as Error
        )
      })
    }

    const crons: BaseDiscordJob[] = [new EveryDayJob(this)]
    for (const job of crons) {
      job.register(nodeCron)
    }

    this.config = config
  }

  public getClient() {
    return this.client
  }

  public getConfig() {
    return this.config
  }

  public async close() {
    await this.client.destroy()
  }

  onReady() {
    const logger = Logger.configure('Discord.onReady')
    logger.info(`👌 ready: ${this.client.user?.tag}`)

    for (const task of this.tasks) {
      task.execute().catch((err: unknown) => {
        logger.error('❌ task execute failed', err as Error)
      })
    }
  }

  async onMessageCreate(message: Message<true>) {
    const logger = Logger.configure('Discord.onMessageCreate')
    // Botのメッセージは無視
    if (message.author.bot) {
      return
    }

    // guildIdが設定されている場合、そのサーバ以外のメッセージは無視
    const onlyGuildId = this.config.get('discord').guildId
    if (onlyGuildId && message.guild.id !== onlyGuildId) {
      return
    }

    // 対応するコマンドを探す
    // コマンドは長い順にソートしておく
    const command = Discord.commands
      .toSorted((a, b) => b.name.length - a.name.length)
      .find((command) => message.content.startsWith(`/${command.name}`))
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
    } catch (err) {
      // エラー処理
      logger.error('❌ Error', err as Error)
      const stacktrace = (err as Error).stack?.toString() ?? ''
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
                value: `\`\`\`\n${(err as Error).message}\n\`\`\``,
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
