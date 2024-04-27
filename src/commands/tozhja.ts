import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'
import { Translate } from '@/features/translate'

export class TozhjaCommand implements BaseCommand {
  readonly name = 'tozhja'
  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message,
    args: string[]
  ): Promise<void> {
    const text = args.join(' ')

    const config = discord.getConfig()
    const translate = new Translate(config)

    const beforeLanguage = await translate.detectLanguage(text)
    await translate.execute(message, beforeLanguage, ['zh', 'ja'], text)
  }
}
