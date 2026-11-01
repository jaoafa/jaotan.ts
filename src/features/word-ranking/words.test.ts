import {
  extractWords,
  isEligiblePos,
  isNoiseWord,
  normalizeWord,
} from './words'

describe('normalizeWord', () => {
  it('merges elongated spellings of the same word', () => {
    expect(normalizeWord('ナニィ')).toBe('ナニイ')
    expect(normalizeWord('ナニィイイイ')).toBe('ナニイ')
    expect(normalizeWord('スゥゥゥ')).toBe('スウ')
  })

  it('applies NFKC and lowercases', () => {
    expect(normalizeWord('ＡＢＣ')).toBe('abc')
    expect(normalizeWord('ﾃｽﾄ')).toBe('テスト')
  })

  it('keeps a run of two identical characters', () => {
    expect(normalizeWord('ママ')).toBe('ママ')
  })
})

describe('isEligiblePos', () => {
  it.each([
    [['名詞', '普通名詞', '一般', '*', '*', '*'], true],
    [['名詞', '固有名詞', '一般', '*', '*', '*'], true],
    [['名詞', '普通名詞', '副詞可能', '*', '*', '*'], false],
    [['名詞', '数詞', '*', '*', '*', '*'], false],
    [['名詞', '代名詞', '*', '*', '*', '*'], false],
    [['名詞', '普通名詞', '助数詞可能', '*', '*', '*'], true],
    [['名詞', '固有名詞', '人名', '一般', '*', '*'], false],
    [['名詞', '固有名詞', '地名', '一般', '*', '*'], false],
    [['名詞', '普通名詞', '形式名詞', '*', '*', '*'], false],
    [['動詞', '一般', '*', '*', '下一段-ラ行', '連用形-一般'], true],
    [['動詞', '非自立可能', '*', '*', '上一段-ガ行', '連体形-一般'], false],
    [['形容詞', '一般', '*', '*', '形容詞', '終止形-一般'], true],
    [['感動詞', '一般', '*', '*', '*', '*'], true],
    [['形状詞', '一般', '*', '*', '*', '*'], true],
    [['副詞', '*', '*', '*', '*', '*'], false],
    [['助詞', '格助詞', '*', '*', '*', '*'], false],
    [['助動詞', '*', '*', '*', '助動詞-タ', '終止形-一般'], false],
    [['接頭辞', '*', '*', '*', '*', '*'], false],
  ])('%j -> %s', (poses, expected) => {
    expect(isEligiblePos(poses)).toBe(expected)
  })
})

describe('isNoiseWord', () => {
  it.each([
    ['草', false],
    ['あ', true],
    ['ケ', true],
    ['する', true],
    ['ケツ', false],
    ['1234', true],
    ['!!', true],
    ['ab', true],
    ['abc', false],
    ['supercalifragilistic', true],
    ['abcdefghijkl', false],
    ['abcdefghijklm', true],
  ])('%s -> %s', (word, expected) => {
    expect(isNoiseWord(word)).toBe(expected)
  })
})

describe('extractWords', () => {
  const stopwords = new Set(['ゲーム'])

  it('returns normalized keys with the original lowercase display', () => {
    const tokens = [
      {
        dictionaryForm: 'ナニィイイイ',
        poses: ['感動詞', '一般', '*', '*', '*', '*'],
      },
      {
        dictionaryForm: 'Wordle',
        poses: ['名詞', '普通名詞', '一般', '*', '*', '*'],
      },
    ]
    expect(extractWords(tokens, stopwords)).toEqual([
      { key: 'ナニイ', display: 'ナニィイイイ' },
      { key: 'wordle', display: 'wordle' },
    ])
  })

  it('drops tokens by part of speech, noise and stopwords', () => {
    const tokens = [
      { dictionaryForm: 'が', poses: ['助詞', '格助詞', '*', '*', '*', '*'] },
      {
        dictionaryForm: 'する',
        poses: ['動詞', '非自立可能', '*', '*', '*', '*'],
      },
      {
        dictionaryForm: 'ゲーム',
        poses: ['名詞', '普通名詞', '一般', '*', '*', '*'],
      },
      { dictionaryForm: '一', poses: ['名詞', '数詞', '*', '*', '*', '*'] },
      {
        dictionaryForm: 'ケツ',
        poses: ['名詞', '普通名詞', '一般', '*', '*', '*'],
      },
    ]
    expect(extractWords(tokens, stopwords)).toEqual([
      { key: 'ケツ', display: 'ケツ' },
    ])
  })
})
