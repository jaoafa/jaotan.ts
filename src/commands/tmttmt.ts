import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class TmttmtCommand implements BaseCommand {
  get name(): string {
    return 'tmttmt'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(_discord: Discord, message: Message<boolean>): Promise<void> {
    await message.channel.send(
      'とまとぉwとまとぉw ( https://youtu.be/v372aagNItc )'
    )
  }
}
