import { AccumulatedResult, WordStat } from '@/features/word-ranking/types'

export const HABIT_MIN_WORD_UNITS = 8
export const HABIT_MIN_SPEAKER_UNITS = 30
export const HABIT_MIN_WORD_USERS = 2
export const HABIT_TOP_N = 5
export const MAX_SPEAKERS = 8

export interface SpeakerVolume {
  speaker: string
  messages: number
  chars: number
}

export interface HabitWord {
  word: string
  /** 話者がその語を使った単位数 */
  units: number
  /** 話者の使用率が、他の人の使用率の何倍か */
  lift: number
}

export interface SpeakerHabit {
  speaker: string
  words: HabitWord[]
}

type Volumes = ReadonlyMap<string, { messages: number; chars: number }>

function compareVolume(a: SpeakerVolume, b: SpeakerVolume): number {
  if (a.chars !== b.chars) return b.chars - a.chars
  return a.speaker < b.speaker ? -1 : 1
}

/** 発言文字数の多い順に、上位の話者の発言量を返す */
export function buildVolume(volumes: Volumes): SpeakerVolume[] {
  return [...volumes]
    .map(([speaker, volume]) => ({ speaker, ...volume }))
    .toSorted(compareVolume)
    .slice(0, MAX_SPEAKERS)
}

function compareHabitWord(a: HabitWord, b: HabitWord): number {
  if (a.lift !== b.lift) return b.lift - a.lift
  if (a.units !== b.units) return b.units - a.units
  return a.word < b.word ? -1 : 1
}

/**
 * 話者ごとの口癖 (他の人より多く使う語) を返す。
 * 倍率は、話者の使用率 (語を使った単位数 / 話者の単位数) を、
 * 他の人の使用率 (平滑化あり) で割った値。
 * 単位数が少ない話者、使用者が 1 人の語、話者本人の使用が少ない語は対象外。
 * 並び順は、発言文字数 (volumes) の多い順。
 * @param input.authors - 話者別の集計。話者別の集計を有効にしていない結果では undefined
 * @param input.stats - 対象月の語ごとの全体の集計
 */
export function buildHabits(input: {
  authors: AccumulatedResult['authors']
  month: string
  stats: ReadonlyMap<string, WordStat>
  volumes: Volumes
}): SpeakerHabit[] {
  const rows = (input.authors ?? []).filter(([month]) => month === input.month)
  const totalUnits = rows.reduce((sum, row) => sum + row[2], 0)

  const habits: SpeakerHabit[] = []
  for (const [, speaker, speakerUnits, words] of rows) {
    const otherUnits = totalUnits - speakerUnits
    if (otherUnits === 0) continue
    if (speakerUnits < HABIT_MIN_SPEAKER_UNITS) continue

    const ranked = words
      .flatMap(([word, units]): HabitWord[] => {
        const stat = input.stats.get(word)
        if (stat === undefined) return []
        if (units < HABIT_MIN_WORD_UNITS) return []
        if (stat.users < HABIT_MIN_WORD_USERS) return []
        const others = stat.units - units
        return [
          {
            word,
            units,
            lift: units / speakerUnits / ((others + 0.5) / otherUnits),
          },
        ]
      })
      .toSorted(compareHabitWord)
      .slice(0, HABIT_TOP_N)
    if (ranked.length > 0) habits.push({ speaker, words: ranked })
  }

  const chars = (speaker: string) => input.volumes.get(speaker)?.chars ?? 0
  return habits
    .toSorted((a, b) =>
      compareVolume(
        { speaker: a.speaker, messages: 0, chars: chars(a.speaker) },
        { speaker: b.speaker, messages: 0, chars: chars(b.speaker) }
      )
    )
    .slice(0, MAX_SPEAKERS)
}
