import fs from 'node:fs'
import path from 'node:path'
import { Logger } from '@book000/node-utils'
import { SerialQueue, writeJsonAtomically } from './atomic-json'
import { ChannelConfigUnavailableError } from './channel-config-store'
import { StopwordData } from './word-ranking/types'
import { normalizeWord } from './word-ranking/words'

const MAX_WORD_LENGTH = 100

function parseWordList(source: unknown, key: string): string[] {
  if (!Array.isArray(source)) {
    throw new TypeError(`"${key}" must be an array`)
  }
  const words: string[] = []
  for (const word of source as unknown[]) {
    if (typeof word !== 'string') {
      throw new TypeError(
        `"${key}" contains a non-string value: ${String(word)}`
      )
    }
    if (word.length === 0 || /\s/.test(word) || word.length > MAX_WORD_LENGTH) {
      throw new TypeError(
        `"${key}" contains an invalid word: ${JSON.stringify(word)}`
      )
    }
    if (normalizeWord(word) !== word) {
      throw new TypeError(
        `"${key}" contains a word that is not normalized: ${word}`
      )
    }
    if (words.includes(word)) {
      throw new TypeError(`"${key}" contains a duplicate: ${word}`)
    }
    words.push(word)
  }
  return words
}

export function parseStopwordData(source: unknown): StopwordData {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw new TypeError('Root must be an object')
  }
  const unknownKeys = Object.keys(source).filter(
    (key) => key !== 'added' && key !== 'removed'
  )
  if (unknownKeys.length > 0) {
    throw new TypeError(`Unknown keys: ${unknownKeys.join(', ')}`)
  }
  const record = source as Record<string, unknown>
  const added = parseWordList(record.added, 'added')
  const removed = parseWordList(record.removed, 'removed')
  const both = added.find((word) => removed.includes(word))
  if (both !== undefined) {
    throw new TypeError(`"${both}" is in both "added" and "removed"`)
  }
  return { added, removed }
}

/**
 * 独自のストップワード (追加分と、標準からの除外分) を word-stopwords.json に保存・管理する。
 * 読み込みや検証に失敗した場合はエラー状態になり、get は undefined を返す。
 */
export class StopwordStore {
  private readonly filePath: string
  private readonly queue = new SerialQueue()
  private data: StopwordData | undefined

  constructor(options: { dataDirectory?: string } = {}) {
    this.filePath = path.join(
      options.dataDirectory ?? process.env.DATA_DIR ?? 'data',
      'word-stopwords.json'
    )
  }

  /** 設定を読み込む。ファイルが無ければ空の設定として扱う。失敗してもスローせず、エラー状態になる。 */
  async init(): Promise<void> {
    const logger = Logger.configure('StopwordStore.init')
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
        source === undefined
          ? { added: [], removed: [] }
          : parseStopwordData(JSON.parse(source))
    } catch (error) {
      logger.error(
        `❌ failed to load ${this.filePath}; features using it are disabled`,
        error as Error
      )
    }
  }

  get(): Readonly<StopwordData> | undefined {
    return this.data
  }

  /**
   * 現在の設定から新しい設定と結果を作る関数を、直列に実行して保存する。
   * 返された設定が現在と同じ参照なら、保存しない。
   */
  update<T>(
    change: (data: Readonly<StopwordData>) => { data: StopwordData; result: T }
  ): Promise<T> {
    return this.queue.enqueue(async () => {
      if (!this.data) {
        throw new ChannelConfigUnavailableError(
          `Stopword config is unavailable: ${this.filePath}`
        )
      }
      const { data, result } = change(this.data)
      if (data !== this.data) {
        await writeJsonAtomically(this.filePath, data)
        this.data = data
      }
      return result
    })
  }
}
