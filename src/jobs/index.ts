import { Discord } from '../discord'
import nodeCron from 'node-cron'

export abstract class BaseDiscordJob {
  protected readonly discord: Discord

  constructor(discord: Discord) {
    this.discord = discord
  }

  /** スケジュール */
  abstract get schedule(): string

  register(cron: typeof nodeCron) {
    cron.schedule(
      this.schedule,
      async () => {
        await this.execute()
      },
      {
        timezone: 'Asia/Tokyo',
      }
    )
  }

  abstract execute(): Promise<void>
}
