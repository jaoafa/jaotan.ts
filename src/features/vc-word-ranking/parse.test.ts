import { parseSpeechLog } from './parse'

describe('parseSpeechLog', () => {
  it('parses a post with a confidence', () => {
    expect(parseSpeechLog('`speaker-a`: `今日はいい天気ですね` (97%)')).toEqual(
      {
        speaker: 'speaker-a',
        text: '今日はいい天気ですね',
        confidence: 97,
      }
    )
  })

  it('parses a post without a confidence', () => {
    expect(parseSpeechLog('`speaker-b`: `こんにちは`')).toEqual({
      speaker: 'speaker-b',
      text: 'こんにちは',
      confidence: undefined,
    })
  })

  it('parses a multi-line body', () => {
    expect(parseSpeechLog('`speaker-c`: `一行目\n二行目` (88%)')).toEqual({
      speaker: 'speaker-c',
      text: '一行目\n二行目',
      confidence: 88,
    })
  })

  it.each(['name.with.dot', 'name_with_underscore', '0digit-first'])(
    'accepts the speaker label %s',
    (speaker) => {
      expect(parseSpeechLog(`\`${speaker}\`: \`はい\` (100%)`)?.speaker).toBe(
        speaker
      )
    }
  )

  it('keeps an empty body so that the caller can drop it', () => {
    expect(parseSpeechLog('`speaker-a`: ``')).toEqual({
      speaker: 'speaker-a',
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
    ['a missing body', '`speaker-a`:'],
    ['text after the confidence', '`speaker-a`: `はい` (97%) 追記'],
    ['a non-numeric confidence', '`speaker-a`: `はい` (高%)'],
    ['an empty speaker', '``: `はい`'],
    ['a speaker label with a line break', '`name\n2. other`: `はい`'],
    ['a speaker label with a carriage return', '`name\r2. other`: `はい`'],
  ])('returns undefined for %s', (_name, content) => {
    expect(parseSpeechLog(content)).toBe(undefined)
  })
})
