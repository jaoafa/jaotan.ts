import { ExtractedWord } from './types'

const EXCLUDED_NOUN_SUBCATEGORIES = new Set([
  '数詞',
  '代名詞',
  '助数詞',
  '形式名詞',
  '副詞可能',
  '助動詞',
  '非自立可能',
  '人名',
  '地名',
])
const MAX_ASCII_LENGTH = 12
const SMALL_KANA_TO_LARGE: Record<string, string> = {
  ァ: 'ア',
  ィ: 'イ',
  ゥ: 'ウ',
  ェ: 'エ',
  ォ: 'オ',
}

export interface WordToken {
  dictionaryForm: string
  poses: readonly string[]
}

/**
 * 集計用の正規形にする。NFKC 正規化と小文字化に加え、小書きカナを通常のカナにし、
 * 同じ文字が 3 回以上続く部分を 1 文字にまとめて表記ゆれを統合する。
 */
export function normalizeWord(word: string): string {
  return word
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[ァィゥェォ]/g, (char) => SMALL_KANA_TO_LARGE[char])
    .replaceAll(/(.)\1{2,}/gu, '$1')
}

/** 名詞・動詞・形容詞・感動詞・形状詞のうち、内容語として扱える品詞か */
export function isEligiblePos(poses: readonly string[]): boolean {
  const [major, sub1, sub2] = poses
  switch (major) {
    case '名詞': {
      return (
        !EXCLUDED_NOUN_SUBCATEGORIES.has(sub1) &&
        !EXCLUDED_NOUN_SUBCATEGORIES.has(sub2)
      )
    }
    case '動詞':
    case '形容詞': {
      return sub1 !== '非自立可能' && sub1 !== '助動詞'
    }
    case '感動詞':
    case '形状詞': {
      return true
    }
    default: {
      return false
    }
  }
}

/** 正規化済みの語が、ランキングに載せる価値のない語か */
export function isNoiseWord(word: string): boolean {
  return (
    (word.length < 2 && !/\p{Script=Han}/u.test(word)) ||
    /^[\s\d\p{P}\p{S}]+$/u.test(word) ||
    /^[ぁ-ん]{1,2}$/.test(word) ||
    /^[a-z]{1,2}$/i.test(word) ||
    (/^[\u0000-\u007F]+$/.test(word) && word.length > MAX_ASCII_LENGTH)
  )
}

/**
 * 形態素解析の結果から、集計対象の語を取り出す。
 * @param stopwords - 正規形のストップワード
 */
export function extractWords(
  tokens: readonly WordToken[],
  stopwords: ReadonlySet<string>
): ExtractedWord[] {
  const words: ExtractedWord[] = []
  for (const token of tokens) {
    if (!isEligiblePos(token.poses)) continue
    const display = token.dictionaryForm.toLowerCase()
    const key = normalizeWord(display)
    if (isNoiseWord(key) || stopwords.has(key)) continue
    words.push({ key, display })
  }
  return words
}
