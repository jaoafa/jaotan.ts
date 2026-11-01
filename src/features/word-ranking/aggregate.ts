import { escapeMarkdown } from 'discord.js'
import { getMonthKey, getPreviousMonthKey } from '@/features/emoji-ranking'
import {
  AccumulatedResult,
  MonthlyStats,
  WordExtractor,
  WordMessage,
} from './types'

export const BURST_MS = 5 * 60 * 1000
export const MIN_USERS = 3
export const PERENNIAL_WEIGHT = 0.5
export const HISTORY_MONTHS = 5
export const NEW_WORD_MONTHS = 3
export const NEW_WORD_MAX_PREV_UNITS = 1
export const TOP_N = 10
export const GENERIC_MIN_USERS = 5
export const GENERIC_MAX_UNITS_PER_USER = 4

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export interface RankedWord {
  word: string
  units: number
}

export interface Ranking {
  frequent: RankedWord[]
  newcomers: RankedWord[]
}

export interface MonthWindow {
  /** 古い順の月 (対象月の前 HISTORY_MONTHS か月 + 対象月) */
  months: string[]
  /** 取得期間の開始 (最も古い月の 1 日 0:00 JST) */
  startMs: number
  /** 取得期間の終了 (対象月の翌月 1 日 0:00 JST。この時刻は含まない) */
  endMs: number
}

function monthStartMs(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return Date.UTC(year, month - 1, 1) - JST_OFFSET_MS
}

function previousMonths(monthKey: string, count: number): string[] {
  const months: string[] = []
  let current = monthKey
  for (let i = 0; i < count; i++) {
    current = getPreviousMonthKey(current)
    months.push(current)
  }
  return months
}

export function getMonthWindow(targetMonth: string): MonthWindow {
  const months = [
    ...previousMonths(targetMonth, HISTORY_MONTHS).toReversed(),
    targetMonth,
  ]
  const [year, month] = targetMonth.split('-').map(Number)
  return {
    months,
    startMs: monthStartMs(months[0]),
    endMs: Date.UTC(year, month, 1) - JST_OFFSET_MS,
  }
}

function mostVoted(votes: ReadonlyMap<string, number>): string {
  if (votes.size === 0) throw new Error('表示用の語の候補がありません')
  return [...votes].toSorted(
    ([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : 1)
  )[0][0]
}

interface PendingUnit {
  authorId: string
  firstTimestamp: number
  lastTimestamp: number
  words: Map<string, string>
}

interface WordTally {
  units: number
  users: Set<string>
}

/**
 * 同一チャンネル・同一ユーザーの連続した発言を 1 つの「単位」にまとめ、
 * 月ごと・語ごとに単位数と使用ユーザー数を数える。
 * 同じチャンネルのメッセージは、時刻の昇順で渡すこと。
 */
export class UnitAccumulator {
  private readonly pending = new Map<string, PendingUnit>()
  private readonly months = new Map<string, Map<string, WordTally>>()
  private readonly displayVotes = new Map<string, Map<string, number>>()

  constructor(
    private readonly extract: WordExtractor,
    private readonly burstMs: number = BURST_MS
  ) {}

  add(message: WordMessage): void {
    const unit = this.pending.get(message.channelId)
    if (unit && message.timestamp < unit.lastTimestamp) {
      throw new Error(
        `チャンネル ${message.channelId} のメッセージが昇順ではありません: ${message.timestamp} < ${unit.lastTimestamp}`
      )
    }

    const words = this.extract(message.content)
    if (
      unit?.authorId === message.authorId &&
      message.timestamp - unit.lastTimestamp <= this.burstMs
    ) {
      for (const { key, display } of words) unit.words.set(key, display)
      unit.lastTimestamp = message.timestamp
      return
    }

    if (unit) this.flush(unit)
    this.pending.set(message.channelId, {
      authorId: message.authorId,
      firstTimestamp: message.timestamp,
      lastTimestamp: message.timestamp,
      words: new Map(words.map(({ key, display }) => [key, display])),
    })
  }

  finish(): AccumulatedResult {
    for (const unit of this.pending.values()) this.flush(unit)
    this.pending.clear()

    return {
      months: [...this.months]
        .toSorted(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, tallies]) => [
          month,
          [...tallies]
            .toSorted(([a], [b]) => (a < b ? -1 : 1))
            .map(([word, tally]) => [word, tally.units, tally.users.size]),
        ]),
      displays: [...this.displayVotes]
        .toSorted(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, votes]) => [key, mostVoted(votes)]),
    }
  }

  private flush(unit: PendingUnit): void {
    const month = getMonthKey(new Date(unit.firstTimestamp))
    let tallies = this.months.get(month)
    if (!tallies) {
      tallies = new Map()
      this.months.set(month, tallies)
    }
    for (const [key, display] of unit.words) {
      let tally = tallies.get(key)
      if (!tally) {
        tally = { units: 0, users: new Set() }
        tallies.set(key, tally)
      }
      tally.units++
      tally.users.add(unit.authorId)

      let votes = this.displayVotes.get(key)
      if (!votes) {
        votes = new Map()
        this.displayVotes.set(key, votes)
      }
      votes.set(display, (votes.get(display) ?? 0) + 1)
    }
  }
}

export function toMonthlyStats(result: AccumulatedResult): MonthlyStats {
  return new Map(
    result.months.map(([month, entries]) => [
      month,
      new Map(entries.map(([word, units, users]) => [word, { units, users }])),
    ])
  )
}

function compareRanked(
  a: { word: string; score: number; users: number },
  b: { word: string; score: number; users: number }
): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.users !== b.users) return b.users - a.users
  return a.word < b.word ? -1 : 1
}

/** 対象月の「よく使われた単語」と「今月の新顔」を作る */
export function buildRanking(
  stats: MonthlyStats,
  targetMonth: string
): Ranking {
  const target = stats.get(targetMonth)
  if (!target) return { frequent: [], newcomers: [] }

  const history = previousMonths(targetMonth, HISTORY_MONTHS)
  const window = [targetMonth, ...history]
  const isGeneric = (word: string) =>
    window.every((month) => {
      const stat = stats.get(month)?.get(word)
      return (
        stat !== undefined &&
        stat.users >= GENERIC_MIN_USERS &&
        stat.units / stat.users <= GENERIC_MAX_UNITS_PER_USER
      )
    })

  const eligible = [...target]
    .filter(([word, stat]) => stat.users >= MIN_USERS && !isGeneric(word))
    .map(([word, stat]) => ({ word, ...stat }))

  const frequent = eligible
    .map(({ word, units, users }) => {
      const presentMonths = history.filter((month) =>
        stats.get(month)?.has(word)
      ).length
      return {
        word,
        units,
        users,
        score: units / (1 + PERENNIAL_WEIGHT * presentMonths),
      }
    })
    .toSorted(compareRanked)
    .slice(0, TOP_N)

  const frequentWords = new Set(frequent.map(({ word }) => word))
  const newWordHistory = history.slice(0, NEW_WORD_MONTHS)
  const newcomers = eligible
    .filter(({ word }) => {
      const previousUnits = newWordHistory.reduce(
        (sum, month) => sum + (stats.get(month)?.get(word)?.units ?? 0),
        0
      )
      return (
        previousUnits <= NEW_WORD_MAX_PREV_UNITS && !frequentWords.has(word)
      )
    })
    .map(({ word, units, users }) => ({ word, units, users, score: units }))
    .toSorted(compareRanked)
    .slice(0, TOP_N)

  return {
    frequent: frequent.map(({ word, units }) => ({ word, units })),
    newcomers: newcomers.map(({ word, units }) => ({ word, units })),
  }
}

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
