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
    if (channel?.type !== ChannelType.GuildText) return

    // 誕生日を取得
    const birthday = new Birthday()

    const today = new Date()
    const todayBirthdays = birthday.get({
      month: today.getMonth() + 1,
      day: today.getDate(),
    })

    // 記念日を取得
    const kinenbi = new Kinenbi()
    const kinenbiContents = await this.getKinenbiContents(today, kinenbi)

    // 記念日のランキングを取得
    const ranking = await kinenbi.getRanking(today)
    const rankingText = ranking
      ? `今日は記念日が ${ranking.todayCount} 個あり、${ranking.totalDays} 日中 ${ranking.rank} 位です。`
      : null

    const todayYear = today.getFullYear()

    // メッセージに必要な情報を取得
    // 今日の日付 (yyyy年mm月dd日)と曜日
    const todayString = `${todayYear}年${
      today.getMonth() + 1
    }月${today.getDate()}日`
    const todayWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()]

    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    if (
      (todayYear % 4 === 0 && todayYear % 100 !== 0) ||
      todayYear % 400 === 0
    ) {
      daysInMonth[1] = 29
    }

    // 今年の経過日数 (当日を含むため、+1)
    const yearPassed =
      daysInMonth.slice(0, today.getMonth()).reduce((a, b) => a + b, 0) + // 1 月から先月までの日数
      today.getDate() // 今月の日数
    // 年日数
    const yearTotal = daysInMonth.reduce((a, b) => a + b, 0)
    // 残り日数
    const yearLeft = yearTotal - yearPassed + 1
    // 残りパーセント (小数点以下2桁切り捨て)
    const yearLeftPercent = Math.floor((yearLeft / yearTotal) * 10_000) / 100

    // ------------------------------

    const otherCongratulation = [
      ':congratulations: __**その他の今日の記念日**__ :congratulations:',
      '(`/birthday set <日付>` と実行すると、誕生日を設定できます。詳しくは [こちら](https://jaoafa.github.io/jaotan.ts/commands/birthday/))',
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
      ...(rankingText ? [rankingText, ''] : []),
      '',
      ...kinenbiContents,
      '',
      todayBirthdays.length > 0 ? otherCongratulation.join('\n') : '',
    ]

    // メッセージを送信
    await channel.send(content.join('\n').trim())
  }

  private async getKinenbiContents(
    date: Date,
    kinenbi: Kinenbi
  ): Promise<string[]> {
    const todayKinenbi = await kinenbi.get(date, true)
    const contents = []

    let isAlreadyAddedDetail = false

    if (todayKinenbi.length === 0) {
      contents.push('本日の記念日が存在しないか、取得できませんでした。')
      return contents
    }

    let num = 0
    for (const result of todayKinenbi) {
      num++
      const newSuffix = result.isNew ? ':new:' : ''

      if (isAlreadyAddedDetail) {
        contents.push(`${num}. ${result.title} ${newSuffix}`)
        continue
      }

      const detail = await kinenbi.getDetail(result.detail)
      if (detail.description.includes('毎月')) {
        contents.push(`${num}. ${result.title} ${newSuffix}`)
        continue
      }

      contents.push(
        `${num}. ${result.title} ${newSuffix}\`\`\`${detail.description}\`\`\``
      )
      isAlreadyAddedDetail = true
    }

    return contents
  }
}
