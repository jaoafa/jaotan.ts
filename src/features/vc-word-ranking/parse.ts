export interface SpeechLog {
  speaker: string
  text: string
  /** 信頼度 (%)。付いていない投稿では undefined */
  confidence: number | undefined
}

const SPEECH_LOG = /^`([^`]+)`: `([\S\s]*?)`(?: \((\d+)%\))?$/
const NOTICE_SPEAKER = 'VCWatcher'

/**
 * VC 音声認識 Bot の投稿から、話者と本文を取り出す。
 * 書式に合わない投稿と、入退室などの通知 (VCWatcher) は undefined を返す。
 * 本文が空の投稿は、呼び出し側で除外すること。
 */
export function parseSpeechLog(content: string): SpeechLog | undefined {
  const match = SPEECH_LOG.exec(content)
  if (!match || match[1] === NOTICE_SPEAKER) return undefined
  return {
    speaker: match[1],
    text: match[2],
    confidence: match[3] ? Number(match[3]) : undefined,
  }
}
