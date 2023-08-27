import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class PowaCommand implements BaseCommand {
  get name(): string {
    return 'powa'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(_discord: Discord, message: Message<boolean>): Promise<void> {
    await message.channel.send(
      'ポわ～～～～～～～ｗｗｗｗ！！！ｗ！ｗｗ！ｗ！ｗ'
    )
  }
}
