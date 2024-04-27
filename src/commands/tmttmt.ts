import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class TmttmtCommand implements BaseCommand {
  readonly name = 'tmttmt'
  readonly permissions = null

  async execute(_discord: Discord, message: Message): Promise<void> {
    await message.channel.send(
      'とまとぉwとまとぉw ( https://youtu.be/v372aagNItc )'
    )
  }
}
