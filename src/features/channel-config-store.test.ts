import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  ChannelConfigStore,
  ChannelConfigUnavailableError,
  isValidChannelId,
} from '@/features/channel-config-store'

const ID_1 = '1149606247314767993'
const ID_2 = '1555541589164560415'
const ID_3 = '1555864863052398632'
const ID_CUSTOM = '1100000000000000001'
const ID_NEW = '1200000000000000002'

describe('ChannelConfigStore', () => {
  let directory: string
  let filePath: string

  const createStore = (legacyChannelIds: () => string[] = () => [ID_1, ID_2]) =>
    new ChannelConfigStore({ dataDirectory: directory, legacyChannelIds })
  const readFile = (): unknown => JSON.parse(fs.readFileSync(filePath, 'utf8'))

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'channel-config-'))
    filePath = path.join(directory, 'channel-config.json')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  describe('isValidChannelId', () => {
    it('accepts 17 to 20 digit strings only', () => {
      expect(isValidChannelId('1'.repeat(17))).toBe(true)
      expect(isValidChannelId('1'.repeat(20))).toBe(true)
      expect(isValidChannelId('1'.repeat(16))).toBe(false)
      expect(isValidChannelId('1'.repeat(21))).toBe(false)
      expect(isValidChannelId('11111111111111111a')).toBe(false)
    })
  })

  describe('init: first-time migration', () => {
    it('migrates the legacy channel ids when the file does not exist', async () => {
      const store = createStore(() => [ID_1, ID_2, ID_3])
      await store.init()

      expect(store.get('vc-speech-log')).toEqual([ID_1, ID_2, ID_3])
      expect(readFile()).toEqual({ 'vc-speech-log': [ID_1, ID_2, ID_3] })
    })

    it('removes duplicates from the legacy channel ids', async () => {
      const store = createStore(() => [ID_1, ID_2, ID_1])
      await store.init()

      expect(store.get('vc-speech-log')).toEqual([ID_1, ID_2])
    })

    it('creates the data directory when it does not exist', async () => {
      const nested = path.join(directory, 'nested')
      const store = new ChannelConfigStore({
        dataDirectory: nested,
        legacyChannelIds: () => [ID_1],
      })
      await store.init()

      expect(
        JSON.parse(
          fs.readFileSync(path.join(nested, 'channel-config.json'), 'utf8')
        )
      ).toEqual({ 'vc-speech-log': [ID_1] })
    })

    it('enters the error state without creating a file when a legacy id is invalid', async () => {
      const store = createStore(() => ['not-an-id'])
      await store.init()

      expect(store.get('vc-speech-log')).toBeUndefined()
      expect(fs.existsSync(filePath)).toBe(false)
    })

    it('enters the error state when the migration cannot be saved', async () => {
      jest
        .spyOn(fs.promises, 'rename')
        .mockRejectedValue(new Error('rename failed'))
      const store = createStore()
      await store.init()

      expect(store.get('vc-speech-log')).toBeUndefined()
      expect(fs.existsSync(filePath)).toBe(false)
    })
  })

  describe('init: existing file', () => {
    it('loads the existing content as the only source', async () => {
      fs.writeFileSync(
        filePath,
        JSON.stringify({ 'vc-speech-log': [ID_CUSTOM] })
      )
      const store = createStore(() => [ID_1, ID_2, ID_3])
      await store.init()

      expect(store.get('vc-speech-log')).toEqual([ID_CUSTOM])
    })

    it('keeps an empty array empty after re-initialization', async () => {
      fs.writeFileSync(filePath, JSON.stringify({ 'vc-speech-log': [] }))
      const first = createStore(() => [ID_1, ID_2, ID_3])
      await first.init()
      const second = createStore(() => [ID_1, ID_2, ID_3])
      await second.init()

      expect(first.get('vc-speech-log')).toEqual([])
      expect(second.get('vc-speech-log')).toEqual([])
      expect(readFile()).toEqual({ 'vc-speech-log': [] })
    })

    it('treats a missing vc-speech-log key as an empty list', async () => {
      fs.writeFileSync(filePath, JSON.stringify({}))
      const store = createStore(() => [ID_1, ID_2, ID_3])
      await store.init()

      expect(store.get('vc-speech-log')).toEqual([])
      expect(readFile()).toEqual({})
    })

    it.each([
      ['invalid JSON', '{not json'],
      ['a non-object root', JSON.stringify([ID_1])],
      ['a non-array value', JSON.stringify({ 'vc-speech-log': ID_1 })],
      ['a non-string element', JSON.stringify({ 'vc-speech-log': [123] })],
      ['an invalid channel id', JSON.stringify({ 'vc-speech-log': ['abc'] })],
      [
        'duplicate channel ids',
        JSON.stringify({ 'vc-speech-log': [ID_1, ID_1] }),
      ],
    ])(
      'enters the error state and leaves the file untouched for %s',
      async (_name, content) => {
        fs.writeFileSync(filePath, content)
        const store = createStore()
        await store.init()

        expect(store.get('vc-speech-log')).toBeUndefined()
        expect(fs.readFileSync(filePath, 'utf8')).toBe(content)
        await expect(store.add('vc-speech-log', ID_NEW)).rejects.toBeInstanceOf(
          ChannelConfigUnavailableError
        )
        await expect(
          store.remove('vc-speech-log', ID_NEW)
        ).rejects.toBeInstanceOf(ChannelConfigUnavailableError)
        expect(fs.readFileSync(filePath, 'utf8')).toBe(content)
      }
    )
  })

  describe('before init', () => {
    it('returns undefined and rejects updates', async () => {
      const store = createStore()

      expect(store.get('vc-speech-log')).toBeUndefined()
      await expect(store.add('vc-speech-log', ID_NEW)).rejects.toBeInstanceOf(
        ChannelConfigUnavailableError
      )
    })
  })

  describe('add / remove', () => {
    it('reports added, exists, removed and absent', async () => {
      const store = createStore(() => [ID_1])
      await store.init()

      await expect(store.add('vc-speech-log', ID_NEW)).resolves.toBe('added')
      await expect(store.add('vc-speech-log', ID_NEW)).resolves.toBe('exists')
      expect(store.get('vc-speech-log')).toEqual([ID_1, ID_NEW])
      await expect(store.remove('vc-speech-log', ID_NEW)).resolves.toBe(
        'removed'
      )
      await expect(store.remove('vc-speech-log', ID_NEW)).resolves.toBe(
        'absent'
      )
      expect(store.get('vc-speech-log')).toEqual([ID_1])
      expect(readFile()).toEqual({ 'vc-speech-log': [ID_1] })
    })

    it('does not write the file when nothing changes', async () => {
      const store = createStore(() => [ID_1])
      await store.init()
      const rename = jest.spyOn(fs.promises, 'rename')

      await store.add('vc-speech-log', ID_1)
      await store.remove('vc-speech-log', ID_NEW)

      expect(rename).not.toHaveBeenCalled()
    })

    it('persists changes across store instances', async () => {
      const first = createStore(() => [ID_1])
      await first.init()
      await first.add('vc-speech-log', ID_NEW)
      const second = createStore(() => [ID_2])
      await second.init()

      expect(second.get('vc-speech-log')).toEqual([ID_1, ID_NEW])
    })

    it('persists an empty list after removing the last channel', async () => {
      const first = createStore(() => [ID_1])
      await first.init()
      await first.remove('vc-speech-log', ID_1)
      const second = createStore(() => [ID_1])
      await second.init()

      expect(second.get('vc-speech-log')).toEqual([])
    })

    it('returns a copy that cannot mutate the stored state', async () => {
      const store = createStore(() => [ID_1])
      await store.init()
      ;(store.get('vc-speech-log') as string[]).push(ID_NEW)

      expect(store.get('vc-speech-log')).toEqual([ID_1])
    })

    it('keeps the file valid and consistent under concurrent updates', async () => {
      const store = createStore(() => [])
      await store.init()
      const ids = Array.from(
        { length: 20 },
        (_, index) => `12000000000000000${String(index).padStart(2, '0')}`
      )

      const results = await Promise.all([
        ...ids.map((id) => store.add('vc-speech-log', id)),
        store.add('vc-speech-log', ids[0]),
        store.remove('vc-speech-log', ids[1]),
      ])

      expect(results.filter((result) => result === 'added')).toHaveLength(20)
      expect(results[20]).toBe('exists')
      expect(results[21]).toBe('removed')
      const expected = ids.filter((id) => id !== ids[1])
      expect(store.get('vc-speech-log')).toEqual(expected)
      expect(readFile()).toEqual({ 'vc-speech-log': expected })
    })

    it('keeps unknown feature keys when writing', async () => {
      fs.writeFileSync(
        filePath,
        JSON.stringify({ 'vc-speech-log': [ID_1], other: [ID_2] })
      )
      const store = createStore()
      await store.init()
      await store.add('vc-speech-log', ID_NEW)

      expect(readFile()).toEqual({
        'vc-speech-log': [ID_1, ID_NEW],
        other: [ID_2],
      })
    })
  })

  describe('write failure', () => {
    it('throws and keeps the previous memory, file and temp files', async () => {
      const store = createStore(() => [ID_1])
      await store.init()
      const before = fs.readFileSync(filePath, 'utf8')
      jest
        .spyOn(fs.promises, 'rename')
        .mockRejectedValueOnce(new Error('rename failed'))

      await expect(store.add('vc-speech-log', ID_NEW)).rejects.toThrow(
        'rename failed'
      )

      expect(store.get('vc-speech-log')).toEqual([ID_1])
      expect(fs.readFileSync(filePath, 'utf8')).toBe(before)
      expect(fs.readdirSync(directory)).toEqual(['channel-config.json'])
    })

    it('keeps working after a failed update', async () => {
      const store = createStore(() => [ID_1])
      await store.init()
      jest
        .spyOn(fs.promises, 'rename')
        .mockRejectedValueOnce(new Error('rename failed'))
      await expect(store.add('vc-speech-log', ID_NEW)).rejects.toThrow()

      await expect(store.add('vc-speech-log', ID_NEW)).resolves.toBe('added')

      expect(store.get('vc-speech-log')).toEqual([ID_1, ID_NEW])
      expect(readFile()).toEqual({ 'vc-speech-log': [ID_1, ID_NEW] })
    })
  })
})
