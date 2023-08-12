import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class PingCommand implements BaseCommand {
  get name(): string {
    return 'ping'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(_discord: Discord, message: Message<boolean>) {
    await message.reply('pong!')
  }
}
