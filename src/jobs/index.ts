import { Logger } from '@book000/node-utils'
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
    const logger = Logger.configure(`${this.constructor.name}.register`)
    cron.schedule(
      this.schedule,
      () => {
        this.execute().catch((err: unknown) => {
          logger.error('❌ job failed', err as Error)
        })
      },
      {
        timezone: 'Asia/Tokyo',
      }
    )
  }

  abstract execute(): Promise<void>
}
