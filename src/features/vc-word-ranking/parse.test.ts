import { parseSpeechLog } from './parse'

describe('parseSpeechLog', () => {
  it('parses a post with a confidence', () => {
    expect(parseSpeechLog('`tomachi`: `いやいやそれは違う` (97%)')).toEqual({
      speaker: 'tomachi',
      text: 'いやいやそれは違う',
      confidence: 97,
    })
  })

  it('parses a post without a confidence', () => {
    expect(parseSpeechLog('`namahamu`: `帽子かぶせたことあったかな`')).toEqual({
      speaker: 'namahamu',
      text: '帽子かぶせたことあったかな',
      confidence: undefined,
    })
  })

  it('parses a multi-line body', () => {
    expect(parseSpeechLog('`s0rausa`: `一行目\n二行目` (88%)')).toEqual({
      speaker: 's0rausa',
      text: '一行目\n二行目',
      confidence: 88,
    })
  })

  it.each(['kaepi.', 'kokuto_', '0me1et'])(
    'accepts the speaker label %s',
    (speaker) => {
      expect(parseSpeechLog(`\`${speaker}\`: \`はい\` (100%)`)?.speaker).toBe(
        speaker
      )
    }
  )

  it('keeps an empty body so that the caller can drop it', () => {
    expect(parseSpeechLog('`tomachi`: ``')).toEqual({
      speaker: 'tomachi',
      text: '',
      confidence: undefined,
    })
  })

  it('ignores notices from VCWatcher', () => {
    expect(parseSpeechLog('`VCWatcher`: `お二人が参加しました` (100%)')).toBe(
      undefined
    )
  })

  it.each([
    ['plain text', 'こんにちは'],
    ['a missing body', '`tomachi`:'],
    ['text after the confidence', '`tomachi`: `はい` (97%) 追記'],
    ['a non-numeric confidence', '`tomachi`: `はい` (高%)'],
    ['an empty speaker', '``: `はい`'],
  ])('returns undefined for %s', (_name, content) => {
    expect(parseSpeechLog(content)).toBe(undefined)
  })
})
