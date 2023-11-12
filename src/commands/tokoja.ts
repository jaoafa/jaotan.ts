import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'
import { Translate } from '@/features/translate'

export class TokojaCommand implements BaseCommand {
  get name(): string {
    return 'tokoja'
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
    await translate.execute(message, beforeLanguage, ['ko', 'ja'], text)
  }
}
