import { escapeMarkdown } from 'discord.js'
import { RankedWord } from '@/features/word-ranking/aggregate'
import { SpeakerHabit, SpeakerVolume } from './habits'

export const MAX_MESSAGE_LENGTH = 2000
export const MAX_SPEAKER_NAME_LENGTH = 40
export const MAX_WORD_LENGTH = 50

const NO_WORDS = '該当する単語がありませんでした'
const NO_SPEAKERS = '該当する話者がいませんでした'

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function speakerName(speaker: string): string {
  return escapeMarkdown(truncate(speaker, MAX_SPEAKER_NAME_LENGTH))
}

function displayOf(word: string, displays: ReadonlyMap<string, string>) {
  const display = displays.get(word)
  if (display === undefined) {
    throw new Error(`語 "${word}" の表示用の語がありません`)
  }
  return escapeMarkdown(truncate(display, MAX_WORD_LENGTH))
}

function splitLines(text: string): string[] {
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    const candidate = current === '' ? line : `${current}\n${line}`
    if (candidate.length <= MAX_MESSAGE_LENGTH) {
      current = candidate
      continue
    }
    chunks.push(current)
    current = line
  }
  chunks.push(current)
  return chunks
}

/** セクションの境界で、できるだけ少ないメッセージに詰める。1 つのセクションが長すぎる場合は行の境界で分ける */
function pack(sections: readonly string[]): string[] {
  const messages: string[] = []
  let current = ''
  for (const section of sections) {
    const candidate = current === '' ? section : `${current}\n\n${section}`
    if (candidate.length <= MAX_MESSAGE_LENGTH) {
      current = candidate
      continue
    }
    if (current !== '') messages.push(current)
    const parts =
      section.length <= MAX_MESSAGE_LENGTH ? [section] : splitLines(section)
    messages.push(...parts.slice(0, -1))
    current = parts.at(-1) ?? ''
  }
  if (current !== '') messages.push(current)
  return messages
}

/**
 * 月次の VC 単語ランキングの投稿本文を作る。
 * @returns 投稿するメッセージ。それぞれ MAX_MESSAGE_LENGTH 文字以内で、先頭から順に送る
 * @throws 語の表示用の語が displays に無い場合
 */
export function formatVcRankingMessages(input: {
  month: string
  frequent: readonly RankedWord[]
  volume: readonly SpeakerVolume[]
  habits: readonly SpeakerHabit[]
  displays: ReadonlyMap<string, string>
}): string[] {
  const { displays } = input
  const locale = (value: number) => value.toLocaleString('ja-JP')

  const frequent =
    input.frequent.length === 0
      ? [NO_WORDS]
      : input.frequent.map(
          ({ word, units }, index) =>
            `${index + 1}. ${displayOf(word, displays)} (${units}回)`
        )
  const volume =
    input.volume.length === 0
      ? [NO_SPEAKERS]
      : input.volume.map(
          ({ speaker, messages, chars }, index) =>
            `${index + 1}. ${speakerName(speaker)} (${locale(chars)}字 / ${locale(messages)}件)`
        )
  const habits =
    input.habits.length === 0
      ? [NO_SPEAKERS]
      : input.habits.map(
          ({ speaker, words }) =>
            `- ${speakerName(speaker)}: ${words
              .map(
                ({ word, lift }) =>
                  `${displayOf(word, displays)} (${lift.toFixed(1)}倍)`
              )
              .join(' / ')}`
        )

  return pack([
    `:microphone: __**${input.month} の VC 単語ランキング**__ :microphone:`,
    ['**よく使われた単語**', ...frequent].join('\n'),
    ['**発言量**', ...volume].join('\n'),
    ['**口癖** (他の人より何倍多く使うか)', ...habits].join('\n'),
  ])
}
