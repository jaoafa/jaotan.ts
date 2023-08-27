import { Discord } from '@/discord'
import { ClientEvents } from 'discord.js'

export abstract class BaseDiscordEvent<T extends keyof ClientEvents> {
  protected readonly discord: Discord

  constructor(discord: Discord) {
    this.discord = discord
  }

  abstract get eventName(): T

  register(): void {
    this.discord.client.on(this.eventName, this.execute.bind(this))
  }

  abstract execute(...eventArguments: ClientEvents[T]): Promise<void>
}
