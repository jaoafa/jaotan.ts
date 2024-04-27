import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class AlphaCommand implements BaseCommand {
  readonly name = 'alpha'
  readonly permissions = null

  async execute(_discord: Discord, message: Message): Promise<void> {
    await message.channel.send(
      'オ、オオwwwwwwwwオレアルファwwwwwwww最近めっちょふぁぼられてんねんオレwwwwwwwwエゴサとかかけるとめっちょ人気やねんwwwwァァァァァァァwwwクソアルファを見下しながら食べるエビフィレオは一段とウメェなァァァァwwwwwwww'
    )
  }
}
