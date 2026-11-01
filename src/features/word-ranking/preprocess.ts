const COMMAND_LINE = /^\s*[/!][\w-]+/
const WORDLE_RESULT = /^Wordle [\d,]+/
const BOT_LIKE_OUTPUT = /^\s*`[^`]+`:\s*`[^`]*`\s*\(\d/

/**
 * 集計の妨げになる記法を空白に置き換える。
 * コードブロック、インラインコード、引用行、URL、各種メンション、
 * カスタム絵文字、Unicode 絵文字、TTS 構文、コマンド行が対象。
 */
export function preprocessText(text: string): string {
  return text
    .replaceAll(/```[\S\s]*?```/g, ' ')
    .replaceAll(/`[^`]*`/g, ' ')
    .replaceAll(/^>.*$/gm, ' ')
    .replaceAll(/https?:\/\/\S+/g, ' ')
    .replaceAll(/<a?:\w+:\d+>/g, ' ')
    .replaceAll(/<(@[!&]?|#)\d+>/g, ' ')
    .replaceAll(/\b(?:emotion|speaker|emotion_level|pitch|speed):\S+/g, ' ')
    .replaceAll(/<t:\d+(:\w)?>/g, ' ')
    .replaceAll(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, ' ')
    .split('\n')
    .filter((line) => !COMMAND_LINE.test(line))
    .join('\n')
}

/** 結果共有や Bot の出力に似た定型文で、集計から除外すべきメッセージかどうか */
export function isTemplateMessage(text: string): boolean {
  return WORDLE_RESULT.test(text) || BOT_LIKE_OUTPUT.test(text)
}
