import fs from 'node:fs'
import path from 'node:path'
import { Logger } from '@book000/node-utils'
import { SerialQueue, writeJsonAtomically } from './atomic-json'
import { ChannelConfigUnavailableError } from './channel-config-store'
import { HISTORY_MONTHS, toMonthlyStats } from './word-ranking/aggregate'
import { MonthlyStats } from './word-ranking/types'

/** 対象月と、その前の履歴ぶん */
export const RETAINED_MONTHS = HISTORY_MONTHS + 1

type Entry = [word: string, units: number, users: number]
type StatsData = Record<string, Entry[]>

const MONTH_KEY = /^\d{4}-(?:0[1-9]|1[0-2])$/

function assertMonthKey(month: string): void {
  if (!MONTH_KEY.test(month)) {
    throw new TypeError(`Invalid month key: ${month}`)
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function parseEntries(month: string, source: unknown): Entry[] {
  if (!Array.isArray(source)) {
    throw new TypeError(`"${month}" must be an array`)
  }
  const entries: Entry[] = []
  const words = new Set<string>()
  for (const entry of source as unknown[]) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 3 ||
      typeof entry[0] !== 'string' ||
      entry[0] === '' ||
      !isPositiveInteger(entry[1]) ||
      !isPositiveInteger(entry[2]) ||
      entry[2] > entry[1]
    ) {
      throw new TypeError(
        `"${month}" contains an invalid entry: ${JSON.stringify(entry)}`
      )
    }
    const [word, units, users] = entry as Entry
    if (words.has(word)) {
      throw new TypeError(`"${month}" contains a duplicate: ${word}`)
    }
    words.add(word)
    entries.push([word, units, users])
  }
  return entries
}

export function parseVcWordStats(source: unknown): StatsData {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw new TypeError('Root must be an object')
  }
  const { months } = source as Record<string, unknown>
  if (typeof months !== 'object' || months === null || Array.isArray(months)) {
    throw new TypeError('"months" must be an object')
  }
  const data: StatsData = {}
  for (const [month, entries] of Object.entries(months)) {
    assertMonthKey(month)
    data[month] = parseEntries(month, entries)
  }
  return data
}

/**
 * VC 音声認識ログの月ごとの語の集計 (単位数・使用者数) を vc-word-stats.json に保存・管理する。
 * 読み込みや検証に失敗した場合はエラー状態になり、get は undefined を返し、ファイルは上書きしない。
 */
export class VcWordStatsStore {
  private readonly filePath: string
  private readonly queue = new SerialQueue()
  private data: StatsData | undefined

  constructor(options: { dataDirectory?: string } = {}) {
    this.filePath = path.join(
      options.dataDirectory ?? process.env.DATA_DIR ?? 'data',
      'vc-word-stats.json'
    )
  }

  /** 集計を読み込む。ファイルが無ければ空として扱う。失敗してもスローせず、エラー状態になる。 */
  async init(): Promise<void> {
    const logger = Logger.configure('VcWordStatsStore.init')
    this.data = undefined
    try {
      let source: string | undefined
      try {
        source = await fs.promises.readFile(this.filePath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
      this.data =
        source === undefined ? {} : parseVcWordStats(JSON.parse(source))
    } catch (error) {
      logger.error(
        `❌ failed to load ${this.filePath}; features using it are disabled`,
        error as Error
      )
    }
  }

  get(): MonthlyStats | undefined {
    if (!this.data) return undefined
    return toMonthlyStats({
      months: Object.entries(this.data),
      displays: [],
    })
  }

  /** 月の集計を保存する。同じ月は上書きし、新しい順に RETAINED_MONTHS か月を超える月は捨てる。 */
  save(month: string, entries: readonly Entry[]): Promise<void> {
    return this.queue.enqueue(async () => {
      assertMonthKey(month)
      if (!this.data) {
        throw new ChannelConfigUnavailableError(
          `VC word stats are unavailable: ${this.filePath}`
        )
      }
      const retained = Object.entries({
        ...this.data,
        [month]: parseEntries(month, entries),
      })
        .toSorted(([a], [b]) => (a < b ? -1 : 1))
        .slice(-RETAINED_MONTHS)
      const next: StatsData = Object.fromEntries(retained)
      await writeJsonAtomically(this.filePath, { months: next })
      this.data = next
    })
  }
}
