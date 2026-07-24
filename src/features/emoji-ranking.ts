import fs from 'node:fs'

/**
 * 日付から Asia/Tokyo 基準の年月キー (YYYY-MM) を取得する
 *
 * @param date 対象の日時
 * @returns 年月キー (例: "2026-06")
 */
export function getMonthKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  if (!year || !month) {
    throw new Error(
      `Failed to resolve month key from date: ${date.toISOString()}`
    )
  }
  return `${year}-${month}`
}

/**
 * 年月キーから、その前月の年月キーを取得する
 *
 * @param monthKey 基準となる年月キー (例: "2026-01")
 * @returns 前月の年月キー (例: "2025-12")
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearString, monthString] = monthKey.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  if (month === 1) {
    return `${year - 1}-12`
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`
}

/** 絵文字の種類 */
export type EmojiKind = 'custom' | 'unicode'

/** 絵文字を一意に識別するための入力情報 */
export interface EmojiInput {
  /** 絵文字の種類 */
  kind: EmojiKind
  /** 集計キー。カスタム絵文字は "name:id"、Unicode 絵文字は文字そのもの */
  key: string
  /** 表示用文字列。カスタム絵文字は "<:name:id>" または "<a:name:id>"、Unicode 絵文字は文字そのもの */
  display: string
}

/** 絵文字ごとの集計結果 */
export interface EmojiUsageRecord extends EmojiInput {
  /** 集計件数 */
  count: number
}

/** 1 か月分の集計データ */
export interface EmojiMonthlyUsage {
  /** リアクションの集計 */
  reactions: EmojiUsageRecord[]
  /** メッセージ投稿の集計 */
  messages: EmojiUsageRecord[]
}

/** 絵文字利用状況の永続化データ */
export interface EmojiUsageData {
  /** 年月 (YYYY-MM形式、Asia/Tokyo基準) をキーとした月別集計データ */
  months: Record<string, EmojiMonthlyUsage>
}

/** 集計カテゴリ */
export type EmojiUsageCategory = 'reactions' | 'messages'

/**
 * 絵文字の利用状況(リアクション・メッセージ投稿)を月別に集計・永続化するクラス
 */
export class EmojiRanking {
  private data: EmojiUsageData = { months: {} }

  /**
   * コンストラクタ
   *
   * ファイルから集計データを読み込む
   */
  constructor() {
    this.load()
  }

  /**
   * ファイルから集計データを読み込む
   *
   * - ファイルパスは {@link getPath} で取得する
   * - ファイルが存在しない場合は `Nitrotan.load()` と同様に空データを初期値として作成・保存する
   */
  public load(): void {
    const filePath = this.getPath()

    if (!fs.existsSync(filePath)) {
      this.data = { months: {} }
      this.save()
      return
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    this.data = JSON.parse(raw) as EmojiUsageData
  }

  /**
   * ファイルに集計データを保存する
   *
   * - ファイルパスは {@link getPath} で取得する
   */
  public save(): void {
    const filePath = this.getPath()
    fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }

  /**
   * リアクションぶんのカウントを、現在の年月のバケットに加算する
   *
   * @param emoji 加算対象の絵文字
   */
  public addReaction(emoji: EmojiInput): void {
    this.load()
    const monthly = this.getOrCreateMonth(getMonthKey(new Date()))
    this.applyDelta(monthly.reactions, emoji, 1)
    this.save()
  }

  /**
   * リアクション取消ぶんのカウントを、現在の年月のバケットから減算する
   *
   * カウントは 0 未満にはならないようクランプする
   *
   * @param emoji 減算対象の絵文字
   */
  public removeReaction(emoji: EmojiInput): void {
    this.load()
    const monthly = this.getOrCreateMonth(getMonthKey(new Date()))
    this.applyDelta(monthly.reactions, emoji, -1)
    this.save()
  }

  /**
   * メッセージ投稿ぶんのカウントを、現在の年月のバケットに加算する
   *
   * 呼び出し側で重複排除済みの配列を渡すこと(1 メッセージにつき同じ絵文字は 1 件として扱う)
   *
   * @param emojis 加算対象の絵文字一覧
   */
  public addMessageEmojis(emojis: EmojiInput[]): void {
    this.load()
    const monthly = this.getOrCreateMonth(getMonthKey(new Date()))
    for (const emoji of emojis) {
      this.applyDelta(monthly.messages, emoji, 1)
    }
    this.save()
  }

  /**
   * 指定した年月・カテゴリの上位ランキングを取得する
   *
   * @param month 年月キー (YYYY-MM)
   * @param category 集計カテゴリ ('reactions' | 'messages')
   * @param topN 取得する件数
   * @returns 件数降順の上位 N 件。対象月のデータが存在しない場合は空配列
   */
  public getRanking(
    month: string,
    category: EmojiUsageCategory,
    topN: number
  ): EmojiUsageRecord[] {
    this.load()
    const monthly = this.data.months[month]
    if (!monthly) {
      return []
    }
    return monthly[category]
      .toSorted((a, b) => b.count - a.count)
      .slice(0, topN)
  }

  private getOrCreateMonth(month: string): EmojiMonthlyUsage {
    const existing = this.data.months[month]
    if (existing) {
      return existing
    }
    const created: EmojiMonthlyUsage = { reactions: [], messages: [] }
    this.data.months[month] = created
    return created
  }

  private applyDelta(
    records: EmojiUsageRecord[],
    emoji: EmojiInput,
    delta: number
  ): void {
    const existing = records.find((record) => record.key === emoji.key)
    if (existing) {
      existing.count = Math.max(0, existing.count + delta)
      return
    }
    if (delta > 0) {
      records.push({ ...emoji, count: delta })
    }
  }

  /**
   * 集計データのファイルパスを取得する
   *
   * - 環境変数 DATA_DIR が設定されている場合はそのディレクトリを使用する
   * - 環境変数 DATA_DIR が設定されていない場合は data/ ディレクトリを使用する
   * - ファイル名は emoji-ranking.json とする
   *
   * @returns ファイルパス
   */
  private getPath(): string {
    const dataDir = process.env.DATA_DIR ?? 'data/'
    return `${dataDir}/emoji-ranking.json`
  }
}
