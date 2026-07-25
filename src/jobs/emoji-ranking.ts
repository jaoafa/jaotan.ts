import { BaseDiscordJob } from '.'
import { Configuration } from '@/config'
import { ChannelType } from 'discord.js'
import {
  EmojiRanking,
  EmojiUsageRecord,
  getMonthKey,
  getPreviousMonthKey,
} from '@/features/emoji-ranking'

/**
 * 毎月1日0:30に、前月使われた絵文字のランキングを#generalへ投稿する
 */
export class MonthlyEmojiRankingJob extends BaseDiscordJob {
  readonly schedule = '30 0 1 * *'

  async execute(): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const generalChannelId =
      config.get('discord').channel?.general ?? '1138605147287728150'

    const channel = await this.discord.client.channels.fetch(generalChannelId)
    if (channel?.type !== ChannelType.GuildText) return

    const previousMonth = getPreviousMonthKey(getMonthKey(new Date()))

    const emojiRanking = new EmojiRanking()
    const reactionRanking = emojiRanking.getRanking(
      previousMonth,
      'reactions',
      10
    )
    const messageRanking = emojiRanking.getRanking(
      previousMonth,
      'messages',
      10
    )

    const content = [
      `:bar_chart: __**先月(${previousMonth})の絵文字ランキング**__ :bar_chart:`,
      '',
      '**リアクションでよく使われた絵文字**',
      ...this.formatRanking(reactionRanking),
      '',
      '**投稿でよく使われた絵文字**',
      ...this.formatRanking(messageRanking),
    ]

    await channel.send(content.join('\n').trim())
  }

  /**
   * ランキングデータをメッセージ表示用の文字列配列に整形する
   *
   * @param records ランキングデータ(件数降順)
   * @returns 表示用の文字列配列。データが1件もない場合は代替文言を1行返す
   */
  private formatRanking(records: EmojiUsageRecord[]): string[] {
    if (records.length === 0) {
      return ['先月は利用がありませんでした']
    }

    return records.map(
      (record, index) => `${index + 1}. ${record.display} (${record.count}回)`
    )
  }
}
