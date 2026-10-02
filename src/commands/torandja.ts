import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'
import { Translate } from '@/features/translate'

export class TorandCommand implements BaseCommand {
  readonly name = 'torandja'
  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    const text = args.join(' ')

    const config = discord.getConfig()
    const translate = new Translate(config)

    if (!(await translate.beginCommand(message, text))) return

    const beforeLanguage = await translate.detectLanguage(text)
    const randomLanguage = await translate.randomLanguage([
      beforeLanguage,
      'ja',
    ])

    const afterLanguages = [randomLanguage, 'ja']

    await translate.execute(message, beforeLanguage, afterLanguages, text)
  }
}
