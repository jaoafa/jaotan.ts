import { Discord } from '../discord'

export abstract class BaseDiscordTask {
  protected readonly discord: Discord

  constructor(discord: Discord) {
    this.discord = discord
  }

  /** 定期実行する間隔（秒） */
  abstract get interval(): number

  register(): NodeJS.Timeout {
    return setInterval(this.execute.bind(this), this.interval * 1000)
  }

  abstract execute(): Promise<void>
}
