import { Discord } from '@/discord'
import { ClientEvents } from 'discord.js'

export abstract class BaseDiscordEvent {
  protected readonly discord: Discord

  constructor(discord: Discord) {
    this.discord = discord
  }

  abstract get eventName(): keyof ClientEvents

  register(): void {
    this.discord.client.on(this.eventName, this.execute.bind(this))
  }

  abstract execute(...eventArguments: any[]): void
}
