import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'
import { TochaosCommand } from './tochaos'

export class ContorandjaCommand implements BaseCommand {
  readonly name = 'contorandja'
  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message,
    args: string[]
  ): Promise<void> {
    await new TochaosCommand().execute(discord, message, args)
  }
}
