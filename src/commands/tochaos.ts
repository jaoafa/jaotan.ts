import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'
import { Translate } from '@/features/translate'

export class TochaosCommand implements BaseCommand {
  readonly name = 'tochaos'
  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    const text = args.join(' ')

    const config = discord.getConfig()
    const translate = new Translate(config)

    const beforeLanguage = await translate.detectLanguage(text)

    const afterLanguages: string[] = []
    // 3 から 5 の間のランダムな数値を生成
    const translateCount = Math.floor(Math.random() * 3) + 3
    for (let i = 0; i < translateCount; i++) {
      const excludes = [beforeLanguage, ...afterLanguages, 'ja']
      afterLanguages.push(translate.randomLanguage(excludes))
    }

    afterLanguages.push('ja')

    await translate.execute(message, beforeLanguage, afterLanguages, text)
  }
}
