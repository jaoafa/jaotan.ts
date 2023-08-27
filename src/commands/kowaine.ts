import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class KowaineCommand implements BaseCommand {
  get name(): string {
    return 'kowaine'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(_discord: Discord, message: Message<boolean>): Promise<void> {
    await message.reply('えんえん')
  }
}
