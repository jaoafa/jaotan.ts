import { Discord } from '@/discord'
import { EmbedBuilder, Message } from 'discord.js'
import { BaseCommand } from '.'
import { Kinenbi } from '@/features/kinenbi'

export class OriginCommand implements BaseCommand {
  readonly name = 'origin'
  readonly permissions = null

  async execute(
    _discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    if (args.length === 0) {
      await message.reply(
        ':x: 引数が足りません。`/origin <記念日ナンバー>` の形式で入力してください。'
      )
      return
    }

    const index = Number.parseInt(args[0])
    if (Number.isNaN(index)) {
      await message.reply(
        ':x: 引数が間違っています。`/origin <記念日ナンバー>` の形式で入力してください。記念日ナンバーは半角数字です。'
      )
      return
    }

    const kinenbi = new Kinenbi()
    const results = await kinenbi.get(new Date())

    // resultsにindex - 1の要素が存在しない場合、エラーを返す
    if (index < 1) {
      await message.reply(
        ':x: 引数が間違っています。`/origin <記念日ナンバー>` の形式で入力してください。記念日ナンバーは1以上の半角数字です。'
      )
      return
    }

    if (index > results.length) {
      await message.reply(
        ':x: 指定された記念日ナンバーの記念日は見つかりませんでした。origin コマンドでは、当日の記念日のみ表示できます。'
      )
      return
    }

    const result = results[index - 1]
    const detail = await kinenbi.getDetail(result.detail)
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(detail.title)
          .setDescription(`\`\`\`\n${detail.description}\n\`\`\``)
          .setTimestamp(new Date())
          .setFooter({
            text: '一般社団法人 日本記念日協会',
          })
          .setColor(0x00_ff_00),
      ],
    })
  }
}
