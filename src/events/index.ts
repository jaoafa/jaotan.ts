import { Discord } from '@/discord'
import { Logger } from '@book000/node-utils'
import { ClientEvents } from 'discord.js'

export abstract class BaseDiscordEvent<T extends keyof ClientEvents> {
  protected readonly discord: Discord

  constructor(discord: Discord) {
    this.discord = discord
  }

  abstract get eventName(): T

  register(): void {
    this.discord.client.on(this.eventName, (...eventArguments) => {
      this.execute(...eventArguments).catch((err: unknown) => {
        const logger = Logger.configure('BaseDiscordEvent')
        logger.error('❌ Error', err as Error)
      })
    })
  }

  abstract execute(...eventArguments: ClientEvents[T]): Promise<void>
}
