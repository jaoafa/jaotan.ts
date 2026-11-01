import { WordStat } from '@/features/word-ranking/types'
import { buildHabits, buildVolume, HABIT_TOP_N, MAX_SPEAKERS } from './habits'

type Authors = NonNullable<Parameters<typeof buildHabits>[0]['authors']>

const MONTH = '2026-10'
const stats = (entries: [string, number, number][]) =>
  new Map<string, WordStat>(
    entries.map(([word, units, users]) => [word, { units, users }])
  )
const volumes = (entries: [string, number][]) =>
  new Map(entries.map(([speaker, chars]) => [speaker, { messages: 1, chars }]))

describe('buildVolume', () => {
  it('orders speakers by characters descending and then by name', () => {
    expect(
      buildVolume(
        new Map([
          ['b', { messages: 3, chars: 100 }],
          ['a', { messages: 1, chars: 100 }],
          ['c', { messages: 9, chars: 500 }],
        ])
      )
    ).toEqual([
      { speaker: 'c', messages: 9, chars: 500 },
      { speaker: 'a', messages: 1, chars: 100 },
      { speaker: 'b', messages: 3, chars: 100 },
    ])
  })

  it('keeps only the top speakers', () => {
    const many = new Map(
      Array.from({ length: MAX_SPEAKERS + 2 }, (_, index) => [
        `s${String(index).padStart(2, '0')}`,
        { messages: 1, chars: 1000 - index },
      ])
    )

    expect(buildVolume(many).map(({ speaker }) => speaker)).toEqual(
      Array.from(
        { length: MAX_SPEAKERS },
        (_, index) => `s${String(index).padStart(2, '0')}`
      )
    )
  })
})

describe('buildHabits', () => {
  const authors: Authors = [
    [
      MONTH,
      'A',
      100,
      [
        ['境界', 8],
        ['少ない', 7],
        ['単独', 9],
        ['普通', 10],
        ['ドリル', 20],
      ],
    ],
    [
      MONTH,
      'B',
      100,
      [
        ['境界', 2],
        ['普通', 10],
      ],
    ],
    [
      MONTH,
      'C',
      20,
      [
        ['ドリル', 1],
        ['普通', 5],
      ],
    ],
  ]
  const wordStats = stats([
    ['境界', 10, 2],
    ['少ない', 7, 1],
    ['単独', 9, 1],
    ['普通', 25, 3],
    ['ドリル', 21, 2],
  ])
  const chars = volumes([
    ['A', 500],
    ['B', 300],
    ['C', 100],
  ])

  it('ranks the words a speaker uses more than the others by the ratio of usage rates', () => {
    const habits = buildHabits({
      authors,
      month: MONTH,
      stats: wordStats,
      volumes: chars,
    })

    expect(habits.map(({ speaker }) => speaker)).toEqual(['A', 'B'])
    expect(habits[0].words.map(({ word, units }) => [word, units])).toEqual([
      ['ドリル', 20],
      ['境界', 8],
      ['普通', 10],
    ])
    expect(habits[0].words[0].lift).toBeCloseTo(16, 10)
    expect(habits[0].words[1].lift).toBeCloseTo(3.84, 10)
    expect(habits[0].words[2].lift).toBeCloseTo(0.774_193_548, 8)
  })

  it('excludes words used fewer than eight units by the speaker or by a single user', () => {
    const words = buildHabits({
      authors,
      month: MONTH,
      stats: wordStats,
      volumes: chars,
    }).flatMap((habit) => habit.words.map(({ word }) => word))

    expect(words).not.toContain('少ない')
    expect(words).not.toContain('単独')
  })

  it('omits speakers with fewer than thirty units but counts them in the others', () => {
    const habits = buildHabits({
      authors,
      month: MONTH,
      stats: wordStats,
      volumes: chars,
    })

    expect(habits.some(({ speaker }) => speaker === 'C')).toBe(false)
    expect(habits[0].words[0].lift).toBeCloseTo(16, 10)
  })

  it('includes a speaker with exactly thirty units and a word with exactly eight units', () => {
    const habits = buildHabits({
      authors: [
        [MONTH, 'A', 30, [['語', 8]]],
        [MONTH, 'B', 30, [['語', 1]]],
      ],
      month: MONTH,
      stats: stats([['語', 9, 2]]),
      volumes: volumes([
        ['A', 10],
        ['B', 5],
      ]),
    })

    expect(habits.map(({ speaker }) => speaker)).toEqual(['A'])
  })

  it('orders words with the same ratio and units by the word', () => {
    const habits = buildHabits({
      authors: [
        [
          MONTH,
          'A',
          100,
          [
            ['bbb', 8],
            ['aaa', 8],
          ],
        ],
        [MONTH, 'B', 100, []],
      ],
      month: MONTH,
      stats: stats([
        ['aaa', 8, 2],
        ['bbb', 8, 2],
      ]),
      volumes: volumes([['A', 1]]),
    })

    expect(habits[0].words.map(({ word }) => word)).toEqual(['aaa', 'bbb'])
  })

  it('keeps only the top words of each speaker', () => {
    const words: [string, number][] = Array.from(
      { length: HABIT_TOP_N + 1 },
      (_, index) => [`w${index}`, 8]
    )
    const habits = buildHabits({
      authors: [
        [MONTH, 'A', 100, words],
        [MONTH, 'B', 100, []],
      ],
      month: MONTH,
      stats: stats(words.map(([word]) => [word, 9, 2])),
      volumes: volumes([['A', 1]]),
    })

    expect(habits[0].words).toHaveLength(HABIT_TOP_N)
  })

  it('keeps only the top speakers by characters', () => {
    const speakers = Array.from(
      { length: MAX_SPEAKERS + 2 },
      (_, index) => `s${String(index).padStart(2, '0')}`
    )
    const habits = buildHabits({
      authors: speakers.map((speaker) => [
        MONTH,
        speaker,
        30,
        [[`${speaker}語`, 8]],
      ]),
      month: MONTH,
      stats: stats(speakers.map((speaker) => [`${speaker}語`, 9, 2])),
      volumes: volumes(
        speakers.map((speaker, index): [string, number] => [
          speaker,
          1000 - index,
        ])
      ),
    })

    expect(habits.map(({ speaker }) => speaker)).toEqual(
      speakers.slice(0, MAX_SPEAKERS)
    )
  })

  it('ignores other months', () => {
    const habits = buildHabits({
      authors: [
        ['2026-09', 'A', 100, [['語', 50]]],
        ['2026-09', 'B', 100, []],
      ],
      month: MONTH,
      stats: stats([['語', 50, 2]]),
      volumes: volumes([['A', 1]]),
    })

    expect(habits).toEqual([])
  })

  it('returns nothing when there is a single speaker', () => {
    expect(
      buildHabits({
        authors: [[MONTH, 'A', 100, [['語', 50]]]],
        month: MONTH,
        stats: stats([['語', 50, 2]]),
        volumes: volumes([['A', 1]]),
      })
    ).toEqual([])
  })

  it('returns nothing when the authors are not tracked', () => {
    expect(
      buildHabits({
        authors: undefined,
        month: MONTH,
        stats: wordStats,
        volumes: chars,
      })
    ).toEqual([])
  })
})
