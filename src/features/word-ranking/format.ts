import { escapeMarkdown } from 'discord.js'
import { RankedWord, Ranking } from './aggregate'

function formatSection(
  title: string,
  words: readonly RankedWord[],
  displays: ReadonlyMap<string, string>
): string[] {
  if (words.length === 0) {
    return [title, '該当する単語がありませんでした']
  }
  return [
    title,
    ...words.map(({ word, units }, index) => {
      const display = displays.get(word)
      if (display === undefined) {
        throw new Error(`語 "${word}" の表示用の語がありません`)
      }
      return `${index + 1}. ${escapeMarkdown(display)} (${units}回)`
    }),
  ]
}

export function formatRankingMessage(
  month: string,
  ranking: Ranking,
  displays: ReadonlyMap<string, string>
): string {
  return [
    `:bar_chart: __**${month} の単語ランキング**__ :bar_chart:`,
    '',
    ...formatSection('**よく使われた単語**', ranking.frequent, displays),
    '',
    ...formatSection('**今月の新顔**', ranking.newcomers, displays),
  ].join('\n')
}
