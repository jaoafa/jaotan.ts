const COMMAND_LINE = /^\s*[/!][\w-]+/
const WORDLE_RESULT = /^Wordle [\d,]+/
const BOT_LIKE_OUTPUT = /^\s*`[^`]+`:\s*`[^`]*`\s*\(\d/

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

export function isTemplateMessage(text: string): boolean {
  return WORDLE_RESULT.test(text) || BOT_LIKE_OUTPUT.test(text)
}
