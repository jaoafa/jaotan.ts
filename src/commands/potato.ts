import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class PotatoCommand implements BaseCommand {
  readonly name = 'potato'
  readonly permissions = null

  async execute(_discord: Discord, message: Message<true>): Promise<void> {
    await message.channel.send('(╮╯╭)')
  }
}
