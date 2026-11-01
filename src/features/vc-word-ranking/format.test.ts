import {
  formatVcRankingMessages,
  MAX_MESSAGE_LENGTH,
  MAX_SPEAKER_NAME_LENGTH,
} from './format'

const displays = new Map([
  ['ドリル', 'ドリル'],
  ['襲う', '襲う'],
  ['a*b', 'a*b'],
])
const base = {
  month: '2026-10',
  frequent: [
    { word: 'ドリル', units: 24 },
    { word: 'a*b', units: 5 },
  ],
  volume: [
    { speaker: 'ekusas83', messages: 2698, chars: 60_115 },
    { speaker: 'kaepi.', messages: 1111, chars: 16_089 },
  ],
  habits: [
    {
      speaker: 'ekusas83',
      words: [
        { word: 'ドリル', units: 20, lift: 30.26 },
        { word: '襲う', units: 42, lift: 21.24 },
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
        '1. ドリル (24回)',
        '2. a\\*b (5回)',
        '',
        '**発言量**',
        '1. ekusas83 (60,115字 / 2,698件)',
        '2. kaepi. (16,089字 / 1,111件)',
        '',
        '**口癖** (他の人より何倍多く使うか)',
        '- ekusas83: ドリル (30.3倍) / 襲う (21.2倍)',
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
            speaker: 'ekusas83',
            words: [{ word: '未登録', units: 9, lift: 2 }],
          },
        ],
      })
    ).toThrow('語 "未登録" の表示用の語がありません')
  })

  it('splits at section boundaries when the message is too long', () => {
    const long = 'あ'.repeat(360)
    const wideDisplays = new Map(displays)
    const frequent = Array.from({ length: 5 }, (_, index) => {
      const word = `${long}${index}`
      wideDisplays.set(word, word)
      return { word, units: 10 - index }
    })
    const volume = ['a', 'b', 'c', 'd'].map((speaker) => ({
      speaker: `speaker-${speaker}`,
      messages: 1000,
      chars: 20_000,
    }))

    const messages = formatVcRankingMessages({
      ...base,
      frequent,
      volume,
      displays: wideDisplays,
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].startsWith(':microphone:')).toBe(true)
    expect(messages[0]).toContain('**よく使われた単語**')
    expect(messages[1].startsWith('**発言量**')).toBe(true)
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
  })

  it('splits at line boundaries when a section alone is too long', () => {
    const long = 'あ'.repeat(300)
    const wideDisplays = new Map(displays)
    const frequent = Array.from({ length: 10 }, (_, index) => {
      const word = `${long}${index}`
      wideDisplays.set(word, word)
      return { word, units: 10 - index }
    })

    const messages = formatVcRankingMessages({
      ...base,
      frequent,
      displays: wideDisplays,
    })

    expect(messages.length).toBeGreaterThan(2)
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
    }
    const joined = messages.join('\n')
    for (const [index] of frequent.entries()) {
      expect(joined).toContain(`${index + 1}. ${long}${index} (`)
    }
  })
})
