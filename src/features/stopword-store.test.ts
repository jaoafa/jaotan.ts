import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ChannelConfigUnavailableError } from '@/features/channel-config-store'
import { parseStopwordData, StopwordStore } from '@/features/stopword-store'
import { addStopword, removeStopword } from '@/features/word-ranking/stopwords'

describe('parseStopwordData', () => {
  it('accepts a valid file', () => {
    expect(
      parseStopwordData({ added: ['ケツ', 'abc'], removed: ['ゲーム'] })
    ).toEqual({ added: ['ケツ', 'abc'], removed: ['ゲーム'] })
  })

  it.each([
    [null, 'Root must be an object'],
    [[], 'Root must be an object'],
    [{ added: [], removed: [], extra: [] }, 'Unknown keys: extra'],
    [{ removed: [] }, '"added" must be an array'],
    [{ added: [] }, '"removed" must be an array'],
    [{ added: 'x', removed: [] }, '"added" must be an array'],
    [{ added: [1], removed: [] }, '"added" contains a non-string value: 1'],
    [{ added: [''], removed: [] }, '"added" contains an invalid word: ""'],
    [
      { added: ['a b'], removed: [] },
      '"added" contains an invalid word: "a b"',
    ],
    [
      { added: [], removed: ['ＡＢＣ'] },
      '"removed" contains a word that is not normalized: ＡＢＣ',
    ],
    [
      { added: ['ケツ', 'ケツ'], removed: [] },
      '"added" contains a duplicate: ケツ',
    ],
    [
      { added: ['ケツ'], removed: ['ケツ'] },
      '"ケツ" is in both "added" and "removed"',
    ],
  ])('rejects %j', (source, message) => {
    expect(() => parseStopwordData(source)).toThrow(message)
  })

  it('rejects a word longer than 100 characters', () => {
    const word = Array.from({ length: 101 }, (_, index) =>
      String.fromCodePoint(0x4e_00 + index)
    ).join('')
    expect(() => parseStopwordData({ added: [word], removed: [] })).toThrow(
      `"added" contains an invalid word: ${JSON.stringify(word)}`
    )
  })
})

describe('StopwordStore', () => {
  let directory: string
  let filePath: string

  const createStore = () => new StopwordStore({ dataDirectory: directory })
  const readFile = (): unknown => JSON.parse(fs.readFileSync(filePath, 'utf8'))

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stopword-store-'))
    filePath = path.join(directory, 'word-stopwords.json')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('starts empty without creating a file when none exists', async () => {
    const store = createStore()
    await store.init()

    expect(store.get()).toEqual({ added: [], removed: [] })
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('loads an existing file', async () => {
    fs.writeFileSync(filePath, JSON.stringify({ added: ['ケツ'], removed: [] }))
    const store = createStore()
    await store.init()

    expect(store.get()).toEqual({ added: ['ケツ'], removed: [] })
  })

  it('persists updates and reloads them', async () => {
    const store = createStore()
    await store.init()

    await expect(
      store.update((data) => addStopword(data, 'ケツ'))
    ).resolves.toBe('added')
    await expect(
      store.update((data) => removeStopword(data, 'ゲーム'))
    ).resolves.toBe('excluded')

    expect(readFile()).toEqual({ added: ['ケツ'], removed: ['ゲーム'] })
    const reloaded = createStore()
    await reloaded.init()
    expect(reloaded.get()).toEqual({ added: ['ケツ'], removed: ['ゲーム'] })
  })

  it('does not write when nothing changes', async () => {
    const store = createStore()
    await store.init()
    const rename = jest.spyOn(fs.promises, 'rename')

    await expect(
      store.update((data) => removeStopword(data, 'ケツ'))
    ).resolves.toBe('absent')

    expect(rename).not.toHaveBeenCalled()
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('serializes concurrent updates without losing any', async () => {
    const store = createStore()
    await store.init()

    await Promise.all(
      ['a1', 'b2', 'c3', 'd4'].map((word) =>
        store.update((data) => addStopword(data, word))
      )
    )

    expect(store.get()).toEqual({
      added: ['a1', 'b2', 'c3', 'd4'],
      removed: [],
    })
    expect(readFile()).toEqual({ added: ['a1', 'b2', 'c3', 'd4'], removed: [] })
  })

  it('keeps the previous data when saving fails', async () => {
    const store = createStore()
    await store.init()
    jest
      .spyOn(fs.promises, 'rename')
      .mockRejectedValueOnce(new Error('rename failed'))

    await expect(
      store.update((data) => addStopword(data, 'ケツ'))
    ).rejects.toThrow('rename failed')

    expect(store.get()).toEqual({ added: [], removed: [] })
    expect(fs.readdirSync(directory)).toEqual([])
  })

  describe('error state', () => {
    it.each([
      ['invalid JSON', '{not json'],
      ['an invalid schema', JSON.stringify({ added: [1], removed: [] })],
    ])(
      'is entered for %s and leaves the file untouched',
      async (_, content) => {
        fs.writeFileSync(filePath, content)
        const store = createStore()
        await store.init()

        expect(store.get()).toBeUndefined()
        await expect(
          store.update((data) => addStopword(data, 'ケツ'))
        ).rejects.toThrow(
          new ChannelConfigUnavailableError(
            `Stopword config is unavailable: ${filePath}`
          )
        )
        expect(fs.readFileSync(filePath, 'utf8')).toBe(content)
      }
    )

    it('rejects updates before init', async () => {
      const store = createStore()

      expect(store.get()).toBeUndefined()
      await expect(
        store.update((data) => addStopword(data, 'ケツ'))
      ).rejects.toBeInstanceOf(ChannelConfigUnavailableError)
    })
  })
})
