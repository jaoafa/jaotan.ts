import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  EmojiRanking,
  extractMessageEmojis,
  getMonthKey,
  getPreviousMonthKey,
} from './emoji-ranking'

describe('getMonthKey', () => {
  it('Asia/Tokyo基準の年月キーを返す', () => {
    // UTC 2026-01-31T15:30:00Z は Asia/Tokyo で 2026-02-01T00:30:00+09:00
    const date = new Date('2026-01-31T15:30:00Z')
    expect(getMonthKey(date)).toBe('2026-02')
  })

  it('月が1桁の場合も0埋めで返す', () => {
    const date = new Date('2026-03-15T00:00:00+09:00')
    expect(getMonthKey(date)).toBe('2026-03')
  })
})

describe('getPreviousMonthKey', () => {
  it('通常の月であれば1つ前の月を返す', () => {
    expect(getPreviousMonthKey('2026-07')).toBe('2026-06')
  })

  it('1月の場合は前年の12月を返す', () => {
    expect(getPreviousMonthKey('2026-01')).toBe('2025-12')
  })
})

describe('EmojiRanking', () => {
  let beforeDataDir: string | undefined
  let dataDir: string

  beforeEach(() => {
    beforeDataDir = process.env.DATA_DIR
    dataDir = path.join(tmpdir(), `emoji-ranking-test-${randomUUID()}`)
    fs.mkdirSync(dataDir, { recursive: true })
    process.env.DATA_DIR = dataDir
  })

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true })
    process.env.DATA_DIR = beforeDataDir
  })

  it('リアクションを加算すると当月のバケットに反映される', () => {
    const emojiRanking = new EmojiRanking()
    const month = getMonthKey(new Date())

    emojiRanking.addReaction({ kind: 'unicode', key: '😄', display: '😄' })
    emojiRanking.addReaction({ kind: 'unicode', key: '😄', display: '😄' })

    const ranking = emojiRanking.getRanking(month, 'reactions', 10)
    expect(ranking).toEqual([
      { kind: 'unicode', key: '😄', display: '😄', count: 2 },
    ])
  })

  it('リアクションを取り消すとカウントが減算される', () => {
    const emojiRanking = new EmojiRanking()
    const month = getMonthKey(new Date())

    emojiRanking.addReaction({ kind: 'unicode', key: '😄', display: '😄' })
    emojiRanking.addReaction({ kind: 'unicode', key: '😄', display: '😄' })
    emojiRanking.removeReaction({ kind: 'unicode', key: '😄', display: '😄' })

    const ranking = emojiRanking.getRanking(month, 'reactions', 10)
    expect(ranking).toEqual([
      { kind: 'unicode', key: '😄', display: '😄', count: 1 },
    ])
  })

  it('カウントが0未満にはならない', () => {
    const emojiRanking = new EmojiRanking()
    const month = getMonthKey(new Date())

    emojiRanking.removeReaction({ kind: 'unicode', key: '😄', display: '😄' })

    const ranking = emojiRanking.getRanking(month, 'reactions', 10)
    expect(ranking).toEqual([])
  })

  it('メッセージ投稿分の絵文字を加算できる', () => {
    const emojiRanking = new EmojiRanking()
    const month = getMonthKey(new Date())

    emojiRanking.addMessageEmojis([
      { kind: 'unicode', key: '🎉', display: '🎉' },
      {
        kind: 'custom',
        key: 'wave:123',
        display: '<:wave:123>',
      },
    ])

    const ranking = emojiRanking.getRanking(month, 'messages', 10)
    expect(ranking).toEqual(
      expect.arrayContaining([
        { kind: 'unicode', key: '🎉', display: '🎉', count: 1 },
        { kind: 'custom', key: 'wave:123', display: '<:wave:123>', count: 1 },
      ])
    )
  })

  it('件数降順で上位N件のみ返す', () => {
    const emojiRanking = new EmojiRanking()
    const month = getMonthKey(new Date())

    emojiRanking.addReaction({ kind: 'unicode', key: 'a', display: 'a' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'b', display: 'b' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'b', display: 'b' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'c', display: 'c' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'c', display: 'c' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'c', display: 'c' })

    const ranking = emojiRanking.getRanking(month, 'reactions', 2)
    expect(ranking.map((record) => record.key)).toEqual(['c', 'b'])
  })

  it('件数が同数の場合は元データの並び順を維持する(安定ソート)', () => {
    const emojiRanking = new EmojiRanking()
    const month = getMonthKey(new Date())

    emojiRanking.addReaction({ kind: 'unicode', key: 'x', display: 'x' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'y', display: 'y' })
    emojiRanking.addReaction({ kind: 'unicode', key: 'z', display: 'z' })

    const ranking = emojiRanking.getRanking(month, 'reactions', 10)
    expect(ranking.map((record) => record.key)).toEqual(['x', 'y', 'z'])
  })

  it('存在しない年月を指定すると空配列を返す', () => {
    const emojiRanking = new EmojiRanking()
    const ranking = emojiRanking.getRanking('2000-01', 'reactions', 10)
    expect(ranking).toEqual([])
  })

  it('月をまたいだ加算は別バケットとして独立している', () => {
    const emojiRanking = new EmojiRanking()

    emojiRanking.addReaction({ kind: 'unicode', key: '😄', display: '😄' })

    // ファイルを直接書き換えて、当月分のデータを別の月へ移し替える
    const filePath = path.join(dataDir, 'emoji-ranking.json')
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw) as {
      months: Record<string, unknown>
    }
    const [month, monthly] = Object.entries(data.months)[0]
    data.months = { '1999-01': monthly }
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8')

    const reloaded = new EmojiRanking()
    expect(reloaded.getRanking(month, 'reactions', 10)).toEqual([])
    expect(reloaded.getRanking('1999-01', 'reactions', 10)).toEqual([
      { kind: 'unicode', key: '😄', display: '😄', count: 1 },
    ])
  })
})

describe('extractMessageEmojis', () => {
  it('Unicode絵文字を抽出する', () => {
    const result = extractMessageEmojis('おはよう😄よろしく')
    expect(result).toEqual([{ kind: 'unicode', key: '😄', display: '😄' }])
  })

  it('カスタム絵文字を抽出する', () => {
    const result = extractMessageEmojis('こんにちは<:wave:123456789012345678>')
    expect(result).toEqual([
      {
        kind: 'custom',
        key: 'wave:123456789012345678',
        display: '<:wave:123456789012345678>',
      },
    ])
  })

  it('アニメーションカスタム絵文字を抽出する', () => {
    const result = extractMessageEmojis('<a:dance:987654321098765432>')
    expect(result).toEqual([
      {
        kind: 'custom',
        key: 'dance:987654321098765432',
        display: '<a:dance:987654321098765432>',
      },
    ])
  })

  it('カスタム絵文字とUnicode絵文字が混在していても両方抽出する', () => {
    const result = extractMessageEmojis('やった🎉<:wave:123>おめでとう')
    expect(result).toEqual(
      expect.arrayContaining([
        { kind: 'unicode', key: '🎉', display: '🎉' },
        { kind: 'custom', key: 'wave:123', display: '<:wave:123>' },
      ])
    )
    expect(result).toHaveLength(2)
  })

  it('同じ絵文字が複数回出現しても1件に重複排除される', () => {
    const result = extractMessageEmojis('😄😄😄')
    expect(result).toEqual([{ kind: 'unicode', key: '😄', display: '😄' }])
  })

  it('絵文字が含まれない場合は空配列を返す', () => {
    const result = extractMessageEmojis('こんにちは、世界')
    expect(result).toEqual([])
  })
})
