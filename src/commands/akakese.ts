import { Discord } from '@/discord'
import { Message, MessageFlags, User } from 'discord.js'
import { BaseCommand } from '.'
import fs from 'node:fs'

export class AkakeseCommand implements BaseCommand {
  readonly name = 'akakese'
  readonly permissions = null

  async execute(
    _discord: Discord,
    message: Message,
    args: string[]
  ): Promise<void> {
    // GIFファイルのパス
    const assetDirectory = process.env.ASSETS_DIR ?? 'assets'
    const gifPath = `${assetDirectory}/akakese.gif`

    const mentionTo = this.getMentionTo(message.author, args)

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

  private getMentionTo(author: User, args: string[]): string {
    if (args.length === 0) {
      return `<@${author.id}>`
    }

    // 数値なら、IDとみなす
    if (/^\d+$/.test(args[0])) {
      return `<@${args[0]}>`
    }

    // メンションを解釈する
    const mentionTo = args[0]
      .replace(/<@!?(\d+)>/, (_, id) => `<@${id}>`)
      .replace(/<@&(\d+)>/, (_, id) => `<@&${id}>`)
      .replace(/<@#(\d+)>/, (_, id) => `<@#${id}>`)

    return mentionTo
  }
}
