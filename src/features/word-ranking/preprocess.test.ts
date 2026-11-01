import { isTemplateMessage, preprocessText } from './preprocess'

const visible = (text: string) =>
  preprocessText(text).replaceAll(/\s+/g, ' ').trim()

describe('preprocessText', () => {
  it('removes code blocks and inline code', () => {
    expect(visible('前 ```js\nconst a = 1\n``` 後 `code` 末')).toBe('前 後 末')
  })

  it('removes quote lines but keeps the other lines', () => {
    expect(visible('> 引用\n本文')).toBe('本文')
  })

  it('removes URLs', () => {
    expect(visible('見て https://x.com/a/status/1?s=20 ね')).toBe('見て ね')
  })

  it('removes user, role, channel mentions and timestamps', () => {
    expect(visible('<@123> <@!456> <@&789> <#101> <t:1700000000:R> 本文')).toBe(
      '本文'
    )
  })

  it('removes custom emoji and unicode emoji', () => {
    expect(visible('<a:supertada:709339908967366757> 🎉 ✨ 本文 <:ok:1>')).toBe(
      '本文'
    )
  })

  it('removes TTS parameters', () => {
    expect(
      visible('こんにちは emotion:sadness speaker:santa pitch:200 speed:50')
    ).toBe('こんにちは')
  })

  it('removes command lines starting with / or !', () => {
    expect(visible('/origin 9\n!play song\n本文')).toBe('本文')
  })

  it('keeps a slash in the middle of a line', () => {
    expect(visible('AとB/Cの話')).toBe('AとB/Cの話')
  })
})

describe('isTemplateMessage', () => {
  it('detects a Wordle result share', () => {
    expect(isTemplateMessage('Wordle 1,915 5/6\n\n🟨🟨⬛⬛⬛')).toBe(true)
  })

  it('detects a bot-like score line', () => {
    expect(
      isTemplateMessage('`sanamarunandesuyone`: `行き過ぎ 幾三 を` (91.00%)')
    ).toBe(true)
  })

  it('does not flag ordinary text', () => {
    expect(isTemplateMessage('Wordle 難しい')).toBe(false)
    expect(isTemplateMessage('今日の天気 (晴れ)')).toBe(false)
  })
})
