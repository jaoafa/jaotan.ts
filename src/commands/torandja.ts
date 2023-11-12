import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'
import { Translate } from '@/features/translate'

export class TorandCommand implements BaseCommand {
  get name(): string {
    return 'torandja'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(
    discord: Discord,
    message: Message<boolean>,
    args: string[]
  ): Promise<void> {
    const text = args.join(' ')

    const config = discord.getConfig()
    const translate = new Translate(config)

    const beforeLanguage = await translate.detectLanguage(text)

    const afterLanguages = [
      translate.randomLanguage([beforeLanguage, 'ja']),
      'ja',
    ]

    await translate.execute(message, beforeLanguage, afterLanguages, text)
  }
}
