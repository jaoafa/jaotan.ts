import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'
import { Translate } from '@/features/translate'

export class TranslateCommand implements BaseCommand {
  get name(): string {
    return 'translate'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(
    discord: Discord,
    message: Message<boolean>,
    args: string[]
  ): Promise<void> {
    // 引数は最低3つ必要
    if (args.length < 3) {
      await message.reply(
        ':x: 引数が足りません。`/translate <before> <after> <text>` の形式で入力してください。'
      )
      return
    }

    // 翻訳前の言語、翻訳後の言語、翻訳するテキストを取得
    const beforeLanguage = args[0]
    const afterLanguage = args[1]
    const text = args.slice(2).join(' ')

    const config = discord.getConfig()
    const translate = new Translate(config)

    await translate.execute(message, beforeLanguage, [afterLanguage], text)
  }
}
