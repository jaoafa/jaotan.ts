import {
  BURST_MS,
  buildRanking,
  formatRankingMessage,
  getMonthWindow,
  Ranking,
  toMonthlyStats,
  UnitAccumulator,
} from './aggregate'
import { AccumulatedResult, MonthlyStats, WordExtractor } from './types'

const MIN = 60 * 1000
const extract: WordExtractor = (content) =>
  content
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => ({ key: word.toLowerCase(), display: word }))
const jst = (iso: string) => Date.parse(`${iso}+09:00`)

describe('getMonthWindow', () => {
  it('covers the target month and the five months before it', () => {
    expect(getMonthWindow('2026-10')).toEqual({
      months: [
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
      ],
      startMs: jst('2026-05-01T00:00:00'),
      endMs: jst('2026-11-01T00:00:00'),
    })
  })

  it('crosses a year boundary', () => {
    const window = getMonthWindow('2026-02')
    expect(window.months).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
    expect(window.startMs).toBe(jst('2025-09-01T00:00:00'))
    expect(window.endMs).toBe(jst('2026-03-01T00:00:00'))
  })

  it('ends at the start of the next year for December', () => {
    expect(getMonthWindow('2026-12').endMs).toBe(jst('2027-01-01T00:00:00'))
  })
})

describe('UnitAccumulator', () => {
  const message = (
    overrides: Partial<{
      channelId: string
      authorId: string
      timestamp: number
      content: string
    }> = {}
  ) => ({
    channelId: 'c1',
    authorId: 'u1',
    timestamp: jst('2026-10-05T12:00:00'),
    content: 'ケツ',
    ...overrides,
  })
  const entriesOf = (result: AccumulatedResult, month: string) =>
    result.months.find(([key]) => key === month)?.[1]

  it('merges consecutive messages of one user in one channel within the burst window', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base }))
    accumulator.add(message({ timestamp: base + 4 * MIN }))
    accumulator.add(message({ timestamp: base + 8 * MIN }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([['ケツ', 1, 1]])
  })

  it('splits when the gap from the previous message exceeds the burst window', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base }))
    accumulator.add(message({ timestamp: base + BURST_MS + 1 }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([['ケツ', 2, 1]])
  })

  it('merges when the gap equals the burst window', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base }))
    accumulator.add(message({ timestamp: base + BURST_MS }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([['ケツ', 1, 1]])
  })

  it('does not merge different users or different channels', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base }))
    accumulator.add(message({ authorId: 'u2', timestamp: base + MIN }))
    accumulator.add(message({ channelId: 'c2', timestamp: base + MIN }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([['ケツ', 3, 2]])
  })

  it('counts a word once per unit even when it appears in several messages', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base, content: 'ケツ 虫' }))
    accumulator.add(message({ timestamp: base + MIN, content: 'ケツ' }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([
      ['ケツ', 1, 1],
      ['虫', 1, 1],
    ])
  })

  it('keeps a chain going through a message that has no words', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base }))
    accumulator.add(message({ timestamp: base + 4 * MIN, content: '' }))
    accumulator.add(message({ timestamp: base + 8 * MIN }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([['ケツ', 1, 1]])
  })

  it('assigns a unit to the month (Asia/Tokyo) of its first message', () => {
    const accumulator = new UnitAccumulator(extract)
    accumulator.add(message({ timestamp: jst('2026-09-30T23:58:00') }))
    accumulator.add(message({ timestamp: jst('2026-10-01T00:02:00') }))

    const result = accumulator.finish()
    expect(entriesOf(result, '2026-09')).toEqual([['ケツ', 1, 1]])
    expect(entriesOf(result, '2026-10')).toBeUndefined()
  })

  it('counts distinct users per word', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ authorId: 'u1', timestamp: base }))
    accumulator.add(message({ authorId: 'u2', timestamp: base + 10 * MIN }))
    accumulator.add(message({ authorId: 'u1', timestamp: base + 20 * MIN }))

    expect(entriesOf(accumulator.finish(), '2026-10')).toEqual([['ケツ', 3, 2]])
  })

  it('picks the most used display and breaks ties by the smaller string', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    const add = (index: number, content: string) => {
      accumulator.add(message({ timestamp: base + index * 10 * MIN, content }))
    }
    add(0, 'ABC')
    add(1, 'abc')
    add(2, 'abc')
    add(3, 'xyz')
    add(4, 'XYZ')

    expect(accumulator.finish().displays).toEqual([
      ['abc', 'abc'],
      ['xyz', 'XYZ'],
    ])
  })

  it('rejects messages that go back in time within a channel', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ timestamp: base }))

    expect(() => {
      accumulator.add(message({ timestamp: base - 1 }))
    }).toThrow(
      `チャンネル c1 のメッセージが昇順ではありません: ${base - 1} < ${base}`
    )
  })

  it('allows the same timestamps in different channels independently', () => {
    const accumulator = new UnitAccumulator(extract)
    const base = jst('2026-10-05T12:00:00')
    accumulator.add(message({ channelId: 'c1', timestamp: base + MIN }))
    expect(() => {
      accumulator.add(message({ channelId: 'c2', timestamp: base }))
    }).not.toThrow()
  })
})

describe('buildRanking', () => {
  type Rows = Record<string, [units: number, users: number]>
  const stats = (months: Record<string, Rows>): MonthlyStats =>
    toMonthlyStats({
      months: Object.entries(months).map(([month, rows]) => [
        month,
        Object.entries(rows).map(([word, [units, users]]) => [
          word,
          units,
          users,
        ]),
      ]),
      displays: [],
    })

  it('returns empty lists when the target month has no data', () => {
    expect(buildRanking(stats({}), '2026-10')).toEqual({
      frequent: [],
      newcomers: [],
    })
  })

  it('requires at least three users in the target month', () => {
    const result = buildRanking(
      stats({ '2026-10': { two: [50, 2], three: [5, 3] } }),
      '2026-10'
    )
    expect(result.frequent).toEqual([{ word: 'three', units: 5 }])
  })

  it('discounts words that appeared in earlier months', () => {
    const result = buildRanking(
      stats({
        '2026-10': { always: [40, 4], fresh: [25, 4], once: [30, 4] },
        '2026-09': { always: [40, 4], once: [10, 4] },
        '2026-08': { always: [40, 4] },
        '2026-07': { always: [40, 4] },
        '2026-06': { always: [40, 4] },
        '2026-05': { always: [40, 4] },
      }),
      '2026-10'
    )
    expect(result.frequent).toEqual([
      { word: 'fresh', units: 25 },
      { word: 'once', units: 30 },
      { word: 'always', units: 40 },
    ])
  })

  it('orders ties by users descending and then by word ascending', () => {
    const result = buildRanking(
      stats({ '2026-10': { b: [10, 3], a: [10, 3], c: [10, 4] } }),
      '2026-10'
    )
    expect(result.frequent.map(({ word }) => word)).toEqual(['c', 'a', 'b'])
  })

  it('limits each list to ten words', () => {
    const rows: Rows = {}
    for (let i = 0; i < 15; i++)
      rows[`w${String(i).padStart(2, '0')}`] = [20 - i, 3]
    const result = buildRanking(stats({ '2026-10': rows }), '2026-10')
    expect(result.frequent).toHaveLength(10)
    expect(result.newcomers).toHaveLength(5)
  })

  it('treats a word used by many users every month at a low rate as generic', () => {
    const month = { generic: [10, 5], topical: [8, 3] } as Rows
    const result = buildRanking(
      stats({
        '2026-10': month,
        '2026-09': month,
        '2026-08': month,
        '2026-07': month,
        '2026-06': month,
        '2026-05': month,
      }),
      '2026-10'
    )
    expect(result.frequent.map(({ word }) => word)).toEqual(['topical'])
  })

  it('does not treat a word as generic when it is missing in one month of the window', () => {
    const month = { word: [10, 5] } as Rows
    const result = buildRanking(
      stats({
        '2026-10': month,
        '2026-09': month,
        '2026-08': month,
        '2026-07': month,
        '2026-06': month,
      }),
      '2026-10'
    )
    expect(result.frequent.map(({ word }) => word)).toEqual(['word'])
  })

  it('does not treat a heavily used word as generic', () => {
    const month = { loud: [30, 5] } as Rows
    const result = buildRanking(
      stats({
        '2026-10': month,
        '2026-09': month,
        '2026-08': month,
        '2026-07': month,
        '2026-06': month,
        '2026-05': month,
      }),
      '2026-10'
    )
    expect(result.frequent.map(({ word }) => word)).toEqual(['loud'])
  })

  it('lists newcomers that were used at most once in the previous three months', () => {
    const popular: Rows = {}
    for (let i = 0; i < 10; i++) popular[`popular${i}`] = [100 + i, 4]
    const result = buildRanking(
      stats({
        '2026-10': {
          ...popular,
          brandnew: [9, 3],
          barelyseen: [8, 3],
          known: [7, 3],
          oldword: [6, 3],
        },
        '2026-09': { barelyseen: [1, 1], known: [1, 1] },
        '2026-08': { known: [1, 1] },
        '2026-06': { oldword: [30, 5] },
      }),
      '2026-10'
    )
    expect(result.newcomers).toEqual([
      { word: 'brandnew', units: 9 },
      { word: 'barelyseen', units: 8 },
      { word: 'oldword', units: 6 },
    ])
  })

  it('excludes words that are already in the frequent list from newcomers', () => {
    const rows: Rows = {}
    for (let i = 0; i < 12; i++)
      rows[`w${String(i).padStart(2, '0')}`] = [30 - i, 3]
    const result = buildRanking(stats({ '2026-10': rows }), '2026-10')
    expect(result.frequent.map(({ word }) => word)).toEqual([
      'w00',
      'w01',
      'w02',
      'w03',
      'w04',
      'w05',
      'w06',
      'w07',
      'w08',
      'w09',
    ])
    expect(result.newcomers.map(({ word }) => word)).toEqual(['w10', 'w11'])
  })
})

describe('formatRankingMessage', () => {
  const displays = new Map([
    ['ナニイ', 'ナニィ'],
    ['a*b', 'a*b'],
  ])

  it('renders both sections with display forms and counts', () => {
    const ranking: Ranking = {
      frequent: [{ word: 'ナニイ', units: 24 }],
      newcomers: [{ word: 'a*b', units: 5 }],
    }
    expect(formatRankingMessage('2026-10', ranking, displays)).toBe(
      [
        ':bar_chart: __**2026-10 の単語ランキング**__ :bar_chart:',
        '',
        '**よく使われた単語**',
        '1. ナニィ (24回)',
        '',
        '**今月の新顔**',
        '1. a\\*b (5回)',
      ].join('\n')
    )
  })

  it('shows a placeholder line for an empty section', () => {
    expect(
      formatRankingMessage('2026-10', { frequent: [], newcomers: [] }, displays)
    ).toBe(
      [
        ':bar_chart: __**2026-10 の単語ランキング**__ :bar_chart:',
        '',
        '**よく使われた単語**',
        '該当する単語がありませんでした',
        '',
        '**今月の新顔**',
        '該当する単語がありませんでした',
      ].join('\n')
    )
  })

  it('throws when a display form is missing', () => {
    expect(() =>
      formatRankingMessage(
        '2026-10',
        { frequent: [{ word: '未登録', units: 3 }], newcomers: [] },
        displays
      )
    ).toThrow('語 "未登録" の表示用の語がありません')
  })
})
