import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class PingCommand implements BaseCommand {
  readonly name = 'ping'
  readonly permissions = null

  async execute(_discord: Discord, message: Message) {
    await message.reply('pong!')
  }
}
