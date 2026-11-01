import { Ranking } from './aggregate'
import { formatRankingMessage } from './format'

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
