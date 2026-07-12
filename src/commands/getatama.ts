import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

interface PhrasePlusResponse {
  results: {
    full: string
  }[]
}

export class GetAtamaCommand implements BaseCommand {
  readonly name = 'getatama'
  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message<true>,
    arguments_: string[]
  ): Promise<void> {
    const config = discord.getConfig()
    const apiUrl = config.get('phrasePlusApiUrl')
    if (!apiUrl) {
      await message.reply({
        embeds: [
          {
            title: 'エラー',
            description: 'APIのURLが設定されていません。',
            color: 0xff_00_00,
          },
        ],
      })
      return
    }

    // 引数が指定されている場合、それをcountとして使う
    // そうでない場合、countは1
    // 引数が数値でない場合、エラー
    const count = arguments_[0] ? Number.parseInt(arguments_[0]) : 1
    if (Number.isNaN(count) || count < 1 || count > 100) {
      await message.reply(
        ':x: 引数が間違っています。`/getatama <取得する数>` の形式で入力してください。取得する数は半角数字で1以上100未満です。'
      )
      return
    }

    const url = new URL(apiUrl)
    url.searchParams.set('count', count.toString())
    const response = await fetch(url.href)
    if (!response.ok) {
      await message.reply({
        embeds: [
          {
            title: 'エラー',
            description: `APIリクエストに失敗しました: ${response.status} ${response.statusText}`,
            color: 0xff_00_00,
          },
        ],
      })
      return
    }

    const data = (await response.json()) as PhrasePlusResponse
    if (!('results' in data)) {
      await message.reply({
        embeds: [
          {
            title: 'エラー',
            description: 'APIのレスポンスが不正です。（result not in data）',
            color: 0xff_00_00,
          },
        ],
      })
      return
    }

    const results = data.results
    if (!Array.isArray(results)) {
      await message.reply({
        embeds: [
          {
            title: 'エラー',
            description: 'APIのレスポンスが不正です。（result is not array）',
            color: 0xff_00_00,
          },
        ],
      })
      return
    }
    const texts = results.map((result) => result.full)

    await message.reply(`\`\`\`\n${texts.join('\n')}\n\`\`\``)
  }
}
