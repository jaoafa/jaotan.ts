import {
  addStopword,
  composeStopwords,
  DEFAULT_STOPWORDS,
  normalizeStopwordInput,
  removeStopword,
} from './stopwords'

const empty = { added: [], removed: [] }
const distinctChars = (length: number) =>
  Array.from({ length }, (_, index) =>
    String.fromCodePoint(0x4e_00 + index)
  ).join('')

describe('DEFAULT_STOPWORDS', () => {
  it('contains English function words and common Japanese words in normalized form', () => {
    expect(DEFAULT_STOPWORDS.has('the')).toBe(true)
    expect(DEFAULT_STOPWORDS.has('ゲーム')).toBe(true)
    expect(DEFAULT_STOPWORDS.has('分かる')).toBe(true)
  })
})

describe('composeStopwords', () => {
  it('returns the defaults when nothing is customized', () => {
    expect(composeStopwords(empty)).toEqual(new Set(DEFAULT_STOPWORDS))
  })

  it('adds custom words and removes excluded defaults', () => {
    const stopwords = composeStopwords({
      added: ['ケツ'],
      removed: ['ゲーム'],
    })
    expect(stopwords.has('ケツ')).toBe(true)
    expect(stopwords.has('ゲーム')).toBe(false)
    expect(stopwords.has('the')).toBe(true)
  })

  it('normalizes custom words the same way as extracted words', () => {
    expect(
      composeStopwords({ added: ['ナニィイイイ'], removed: [] }).has('ナニイ')
    ).toBe(true)
  })
})

describe('normalizeStopwordInput', () => {
  it('normalizes with the same rules as extracted words', () => {
    expect(normalizeStopwordInput('ＡＢＣ')).toBe('abc')
    expect(normalizeStopwordInput('ナニィイイイ')).toBe('ナニイ')
  })

  it.each(['', ' ', 'a b', '語\t語', distinctChars(101)])(
    'rejects %j',
    (input) => {
      expect(normalizeStopwordInput(input)).toBeUndefined()
    }
  )

  it('accepts a word of exactly 100 characters', () => {
    const word = 'ab'.repeat(50)
    expect(normalizeStopwordInput(word)).toBe(word)
  })
})

describe('addStopword', () => {
  it('adds a new word', () => {
    expect(addStopword(empty, 'ケツ')).toEqual({
      data: { added: ['ケツ'], removed: [] },
      result: 'added',
    })
  })

  it('reports an already added word', () => {
    const data = { added: ['ケツ'], removed: [] }
    expect(addStopword(data, 'ケツ')).toEqual({ data, result: 'exists' })
  })

  it('reports a default word that is already active', () => {
    expect(addStopword(empty, 'ゲーム')).toEqual({
      data: empty,
      result: 'exists',
    })
  })

  it('restores a default word that was excluded', () => {
    expect(
      addStopword({ added: ['ケツ'], removed: ['ゲーム'] }, 'ゲーム')
    ).toEqual({
      data: { added: ['ケツ'], removed: [] },
      result: 'restored',
    })
  })
})

describe('removeStopword', () => {
  it('removes a custom word', () => {
    expect(
      removeStopword({ added: ['ケツ', 'ウンチ'], removed: [] }, 'ケツ')
    ).toEqual({
      data: { added: ['ウンチ'], removed: [] },
      result: 'removed',
    })
  })

  it('excludes a default word', () => {
    expect(removeStopword(empty, 'ゲーム')).toEqual({
      data: { added: [], removed: ['ゲーム'] },
      result: 'excluded',
    })
  })

  it('reports a default word that is already excluded', () => {
    const data = { added: [], removed: ['ゲーム'] }
    expect(removeStopword(data, 'ゲーム')).toEqual({ data, result: 'absent' })
  })

  it('reports an unknown word', () => {
    expect(removeStopword(empty, 'ケツ')).toEqual({
      data: empty,
      result: 'absent',
    })
  })
})
