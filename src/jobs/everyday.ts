import { Birthday } from '@/features/birthday'
import { BaseDiscordJob } from '.'
import { Configuration } from '@/config'
import { ChannelType } from 'discord.js'
import { Kinenbi } from '@/features/kinenbi'

/**
 * 毎日0時に#generalへメッセージを送信する
 */
export class EveryDayJob extends BaseDiscordJob {
  readonly schedule = '0 0 * * *'

  async execute(): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const generalChannelId =
      config.get('discord').channel?.general ?? '1138605147287728150'

    const channel = await this.discord.client.channels.fetch(generalChannelId)
    if (!channel || channel.type !== ChannelType.GuildText) return

    // 誕生日を取得
    const birthday = new Birthday()

    const today = new Date()
    const todayBirthdays = birthday.get({
      month: today.getMonth() + 1,
      day: today.getDate(),
    })

    // 記念日を取得
    const kinenbiContents = await this.getKinenbiContents(today)

    // メッセージに必要な情報を取得
    // 今日の日付 (yyyy年mm月dd日)と曜日
    const todayString = `${today.getFullYear()}年${
      today.getMonth() + 1
    }月${today.getDate()}日`
    const todayWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()]

    // 年間通算日数
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const yearEnd = new Date(today.getFullYear(), 11, 31)
    // 今年の経過日数 (当日を含むため、+1)
    const yearPassed =
      Math.floor(
        (today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    // 年日数
    const yearTotal = Math.floor(
      (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    // 残り日数
    const yearLeft = yearTotal - yearPassed
    // 残りパーセント (小数点以下2桁切り捨て)
    const yearLeftPercent = Math.floor((yearLeft / yearTotal) * 10_000) / 100

    // ------------------------------

    const otherCongratulation = [
      ':congratulations: __**その他の今日の記念日**__ :congratulations:',
      '',
      ...todayBirthdays.map((birthday) => {
        const age = Birthday.getAge(birthday)
        const ageText = !!age && age < 23 ? `(${age}歳)` : ''
        return `- <@${birthday.discordId}>の誕生日 ${ageText}`
      }),
    ]

    // メッセージを作成
    const content = [
      `:loudspeaker:__**${todayString} (${todayWeek}曜日)**__:loudspeaker:`,
      `**年間通算 ${yearPassed} 日目**`,
      `**年間残り ${yearLeft} 日 (${yearLeftPercent}%)**`,
      '',
      ':birthday: __**今日の記念日 (一般社団法人 日本記念日協会)**__ :birthday:',
      '記念日名の前にある番号(記念日ナンバー)を使って、記念日を詳しく調べられます。`/origin <記念日ナンバー>`を実行して下さい。(当日のみ)',
      '',
      ...kinenbiContents,
      '',
      todayBirthdays.length > 0 ? otherCongratulation.join('\n') : '',
    ]

    // メッセージを送信
    await channel.send(content.join('\n').trim())
  }

  private async getKinenbiContents(date: Date): Promise<string[]> {
    const kinenbi = new Kinenbi()
    const todayKinenbi = await kinenbi.get(date)
    const contents = []

    let isAlreadyAddedDetail = false

    if (todayKinenbi.length === 0) {
      contents.push('本日の記念日が存在しないか、取得できませんでした。')
      return contents
    }

    let num = 0
    for (const result of todayKinenbi) {
      num++
      if (result.title.includes('えのすいクラゲ')) {
        contents.push(`${num}. ${result.title} <@372701608053833730>`)
        continue
      }

      if (isAlreadyAddedDetail) {
        contents.push(`${num}. ${result.title}`)
        continue
      }

      const detail = await kinenbi.getDetail(result.detail)
      if (detail.description.includes('毎月')) {
        contents.push(`${num}. ${result.title}`)
        continue
      }

      contents.push(`${num}. ${result.title} \`\`\`${detail.description}\`\`\``)
      isAlreadyAddedDetail = true
    }

    return contents
  }
}
