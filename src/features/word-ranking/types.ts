export interface WordMessage {
  channelId: string
  authorId: string
  /** メッセージの投稿時刻 (UTC エポックのミリ秒) */
  timestamp: number
  content: string
}

export interface ExtractedWord {
  /** 集計のキー (正規化済みの語) */
  key: string
  /** 表示用の語 (正規化前の見出し語) */
  display: string
}

export type WordExtractor = (content: string) => ExtractedWord[]

export interface WordStat {
  units: number
  users: number
}

/** 月 (YYYY-MM) → 語 → 集計値 */
export type MonthlyStats = ReadonlyMap<string, ReadonlyMap<string, WordStat>>

export interface AccumulatedResult {
  months: [
    month: string,
    entries: [word: string, units: number, users: number][],
  ][]
  displays: [key: string, display: string][]
}

export interface StopwordData {
  added: string[]
  removed: string[]
}

export type WorkerRequest =
  | { type: 'init'; stopwords: string[] }
  | { type: 'messages'; messages: WordMessage[] }
  | { type: 'finish' }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; result: AccumulatedResult }
  | { type: 'error'; message: string }
