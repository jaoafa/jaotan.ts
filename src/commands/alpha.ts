import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class AlphaCommand implements BaseCommand {
  get name(): string {
    return 'alpha'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(_discord: Discord, message: Message<boolean>): Promise<void> {
    await message.channel.send(
      'オ、オオwwwwwwwwオレアルファwwwwwwww最近めっちょふぁぼられてんねんオレwwwwwwwwエゴサとかかけるとめっちょ人気やねんwwwwァァァァァァァwwwクソアルファを見下しながら食べるエビフィレオは一段とウメェなァァァァwwwwwwww'
    )
  }
}
