import { StopwordData } from './types'
import { normalizeWord } from './words'

const MAX_STOPWORD_LENGTH = 100

const DEFAULT_STOPWORD_LIST = [
  ...'the and was are you for that this with have not but they from what can will just like get has how his her out one all would there their been when who which more some your than then them these into only other its our over also any'.split(
    ' '
  ),
  ...'方 分 時 気 子 以外 みたい 出る 言う 使う 知る 思う 見る 行く 来る 持つ ある いる なる できる やる 入る 分かる 考える 見える 感じる 今 前 後 中 上 下 人 事 物 話 所 場合 本当 つくる 作る 現地 正確 命令 クール そんな こわい 距離 ゲーム'.split(
    ' '
  ),
]

export const DEFAULT_STOPWORDS: ReadonlySet<string> = new Set(
  DEFAULT_STOPWORD_LIST.map((word) => normalizeWord(word))
)

export type AddStopwordResult = 'added' | 'restored' | 'exists'
export type RemoveStopwordResult = 'removed' | 'excluded' | 'absent'

/** 標準 + 独自の追加 - 独自の除外 から、集計に使うストップワード (正規形) を作る */
export function composeStopwords(data: StopwordData): Set<string> {
  const stopwords = new Set(DEFAULT_STOPWORDS)
  for (const word of data.removed) stopwords.delete(normalizeWord(word))
  for (const word of data.added) stopwords.add(normalizeWord(word))
  return stopwords
}

/**
 * 管理者が入力した語を正規化する。
 * @returns 正規形。空、空白を含む、100 文字を超える場合は `undefined`
 */
export function normalizeStopwordInput(input: string): string | undefined {
  const word = normalizeWord(input)
  if (word.length === 0 || /\s/.test(word)) return undefined
  return word.length > MAX_STOPWORD_LENGTH ? undefined : word
}

/**
 * 語をストップワードに加える。標準の語が除外されていた場合は除外を解く。
 * @param word - `normalizeStopwordInput` で正規化済みの語
 */
export function addStopword(
  data: StopwordData,
  word: string
): { data: StopwordData; result: AddStopwordResult } {
  if (DEFAULT_STOPWORDS.has(word)) {
    return data.removed.includes(word)
      ? {
          data: {
            added: data.added,
            removed: data.removed.filter((item) => item !== word),
          },
          result: 'restored',
        }
      : { data, result: 'exists' }
  }
  return data.added.includes(word)
    ? { data, result: 'exists' }
    : {
        data: { added: [...data.added, word], removed: data.removed },
        result: 'added',
      }
}

/**
 * 語をストップワードから外す。標準の語は除外リストに加える。
 * @param word - `normalizeStopwordInput` で正規化済みの語
 */
export function removeStopword(
  data: StopwordData,
  word: string
): { data: StopwordData; result: RemoveStopwordResult } {
  if (DEFAULT_STOPWORDS.has(word)) {
    return data.removed.includes(word)
      ? { data, result: 'absent' }
      : {
          data: { added: data.added, removed: [...data.removed, word] },
          result: 'excluded',
        }
  }
  return data.added.includes(word)
    ? {
        data: {
          added: data.added.filter((item) => item !== word),
          removed: data.removed,
        },
        result: 'removed',
      }
    : { data, result: 'absent' }
}
