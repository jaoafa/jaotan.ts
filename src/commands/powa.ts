import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class PowaCommand implements BaseCommand {
  readonly name = 'powa'
  readonly permissions = null

  async execute(_discord: Discord, message: Message): Promise<void> {
    await message.channel.send(
      'ポわ～～～～～～～ｗｗｗｗ！！！ｗ！ｗｗ！ｗ！ｗ'
    )
  }
}
