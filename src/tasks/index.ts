import { Discord } from '../discord'
import { setInterval } from 'node:timers/promises'

export abstract class BaseDiscordTask {
  protected readonly discord: Discord

  constructor(discord: Discord) {
    this.discord = discord
  }

  /** 定期実行する間隔（秒） */
  abstract get interval(): number

  async register(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of setInterval(this.interval * 1000)) {
      await this.execute()
    }
  }

  abstract execute(): Promise<void>
}
