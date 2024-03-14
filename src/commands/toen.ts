import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'
import { Translate } from '@/features/translate'

export class ToenCommand implements BaseCommand {
  get name(): string {
    return 'toen'
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
    await translate.execute(message, beforeLanguage, ['en'], text)
  }
}
