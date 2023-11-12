import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'
import { TochaosCommand } from './tochaos'

export class ContorandjaCommand implements BaseCommand {
  get name(): string {
    return 'contorandja'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(
    discord: Discord,
    message: Message<boolean>,
    args: string[]
  ): Promise<void> {
    await new TochaosCommand().execute(discord, message, args)
  }
}
