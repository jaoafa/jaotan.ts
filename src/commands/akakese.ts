import { Discord } from '@/discord'
import { Message, MessageFlags, User } from 'discord.js'
import { BaseCommand } from '.'
import fs from 'node:fs'

export class AkakeseCommand implements BaseCommand {
  readonly name = 'akakese'
  readonly permissions = null

  async execute(
    _discord: Discord,
    message: Message<true>,
    arguments_: string[]
  ): Promise<void> {
    // GIFファイルのパス
    const assetDirectory = process.env.ASSETS_DIR ?? 'assets'
    const gifPath = `${assetDirectory}/akakese.gif`

    const mentionTo = this.getMentionTo(message.author, arguments_)

    const buffer = fs.readFileSync(gifPath)
    await message.channel.send({
      content: `${mentionTo}, なンだおまえ!!!!帰れこのやろう!!!!!!!!人間の分際で!!!!!!!!寄るな触るな近づくな!!!!!!!!垢消せ!!!!垢消せ!!!!!!!! ┗(‘o’≡’o’)┛!!!!!!!!!!!!!!!! https://twitter.com/settings/accounts/confirm_deactivation`,
      files: [
        {
          attachment: buffer,
          name: 'akakese.gif',
          contentType: 'image/gif',
        },
      ],
      flags: [MessageFlags.SuppressEmbeds],
    })
  }

  private getMentionTo(author: User, arguments_: string[]): string {
    if (arguments_.length === 0) {
      return `<@${author.id}>`
    }

    // 数値なら、IDとみなす
    if (/^\d+$/.test(arguments_[0])) {
      return `<@${arguments_[0]}>`
    }

    // メンションを解釈する
    const mentionTo = arguments_[0]
      .replace(/<@!?(\d+)>/, (_, id) => `<@${id}>`)
      .replace(/<@&(\d+)>/, (_, id) => `<@&${id}>`)
      .replace(/<@#(\d+)>/, (_, id) => `<@#${id}>`)

    return mentionTo
  }
}
