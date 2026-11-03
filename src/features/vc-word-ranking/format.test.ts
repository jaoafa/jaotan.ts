import {
  formatVcRankingMessages,
  MAX_MESSAGE_LENGTH,
  MAX_SPEAKER_NAME_LENGTH,
  MAX_WORD_LENGTH,
} from './format'

const displays = new Map([
  ['ワードA', 'ワードA'],
  ['ワードB', 'ワードB'],
  ['a*b', 'a*b'],
])
const base = {
  month: '2026-10',
  frequent: [
    { word: 'ワードA', units: 24 },
    { word: 'a*b', units: 5 },
  ],
  volume: [
    { speaker: 'speaker-a', messages: 2698, chars: 60_115 },
    { speaker: 'speaker-b', messages: 1111, chars: 16_089 },
  ],
  habits: [
    {
      speaker: 'speaker-a',
      words: [
        { word: 'ワードA', units: 20, lift: 30.26 },
        { word: 'ワードB', units: 42, lift: 21.24 },
      ],
    },
  ],
  displays,
}

describe('formatVcRankingMessages', () => {
  it('renders the ranking, the volume and the habits in one message', () => {
    expect(formatVcRankingMessages(base)).toEqual([
      [
        ':microphone: __**2026-10 の VC 単語ランキング**__ :microphone:',
        '',
        '**よく使われた単語**',
        '1. ワードA (24回)',
        '2. a\\*b (5回)',
        '',
        '**発言量**',
        '1. speaker-a (60,115字 / 2,698件)',
        '2. speaker-b (16,089字 / 1,111件)',
        '',
        '**口癖** (他の人より何倍多く使うか)',
        '- speaker-a: ワードA (30.3倍) / ワードB (21.2倍)',
      ].join('\n'),
    ])
  })

  it('shows a placeholder line for empty sections', () => {
    expect(
      formatVcRankingMessages({
        ...base,
        frequent: [],
        volume: [],
        habits: [],
      })
    ).toEqual([
      [
        ':microphone: __**2026-10 の VC 単語ランキング**__ :microphone:',
        '',
        '**よく使われた単語**',
        '該当する単語がありませんでした',
        '',
        '**発言量**',
        '該当する話者がいませんでした',
        '',
        '**口癖** (他の人より何倍多く使うか)',
        '該当する話者がいませんでした',
      ].join('\n'),
    ])
  })

  it('escapes Markdown in speaker names', () => {
    const [message] = formatVcRankingMessages({
      ...base,
      volume: [{ speaker: '*bold*_name_', messages: 1, chars: 1 }],
      habits: [],
    })

    expect(message).toContain('1. \\*bold\\*\\_name\\_ (1字 / 1件)')
  })

  it('truncates long speaker names', () => {
    const [message] = formatVcRankingMessages({
      ...base,
      volume: [{ speaker: 'x'.repeat(100), messages: 1, chars: 1 }],
      habits: [],
    })

    expect(message).toContain(
      `1. ${'x'.repeat(MAX_SPEAKER_NAME_LENGTH)}… (1字 / 1件)`
    )
  })

  it('truncates a word that is longer than a message so that every message fits', () => {
    const word = '長'.repeat(MAX_MESSAGE_LENGTH + 1)

    const messages = formatVcRankingMessages({
      ...base,
      frequent: [{ word, units: 1 }],
      habits: [{ speaker: 'speaker-a', words: [{ word, units: 9, lift: 2 }] }],
      displays: new Map([[word, word]]),
    })

    expect(messages.join('\n')).toContain(
      `1. ${'長'.repeat(MAX_WORD_LENGTH)}… (1回)`
    )
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('keeps every message within the limit when the escaped words are long', () => {
    const word = '*'.repeat(MAX_MESSAGE_LENGTH)
    const messages = formatVcRankingMessages({
      ...base,
      frequent: Array.from({ length: 10 }, () => ({ word, units: 1 })),
      habits: [
        {
          speaker: '_'.repeat(MAX_MESSAGE_LENGTH),
          words: Array.from({ length: 5 }, () => ({
            word,
            units: 9,
            lift: 2,
          })),
        },
      ],
      displays: new Map([[word, word]]),
    })

    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('throws when a display form is missing', () => {
    expect(() =>
      formatVcRankingMessages({
        ...base,
        frequent: [{ word: '未登録', units: 3 }],
      })
    ).toThrow('語 "未登録" の表示用の語がありません')
    expect(() =>
      formatVcRankingMessages({
        ...base,
        habits: [
          {
            speaker: 'speaker-a',
            words: [{ word: '未登録', units: 9, lift: 2 }],
          },
        ],
      })
    ).toThrow('語 "未登録" の表示用の語がありません')
  })

  const fullLengthWords = (count: number) =>
    Array.from(
      { length: count },
      (_, index) =>
        `${'あ'.repeat(MAX_WORD_LENGTH - 3)}${String(index).padStart(3, '0')}`
    )
  const longSpeakers = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      `speaker-${index}`.padEnd(MAX_SPEAKER_NAME_LENGTH - 10, 'x')
    )

  it('splits at section boundaries when the message is too long', () => {
    const words = fullLengthWords(10)
    const wideDisplays = new Map(words.map((word) => [word, word]))

    const messages = formatVcRankingMessages({
      ...base,
      frequent: words.map((word, index) => ({ word, units: 10 - index })),
      volume: longSpeakers(8).map((speaker, index) => ({
        speaker,
        messages: 1000,
        chars: 20_000 - index,
      })),
      habits: longSpeakers(4).map((speaker) => ({
        speaker,
        words: words.slice(0, 5).map((word) => ({ word, units: 9, lift: 2 })),
      })),
      displays: wideDisplays,
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].startsWith(':microphone:')).toBe(true)
    expect(messages[0]).toContain('**発言量**')
    expect(messages[1].startsWith('**口癖**')).toBe(true)
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at line boundaries when a section alone is too long', () => {
    const words = fullLengthWords(5)
    const speakers = longSpeakers(8)

    const messages = formatVcRankingMessages({
      ...base,
      habits: speakers.map((speaker) => ({
        speaker,
        words: words.map((word) => ({ word, units: 9, lift: 2 })),
      })),
      displays: new Map([
        ...displays,
        ...words.map((word): [string, string] => [word, word]),
      ]),
    })

    expect(messages.length).toBeGreaterThan(2)
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
    const joined = messages.join('\n')
    for (const speaker of speakers) {
      expect(joined).toContain(`- ${speaker}: ${words[0]} (2.0倍)`)
    }
  })
})
