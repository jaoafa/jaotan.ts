import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ChannelConfigUnavailableError } from '@/features/channel-config-store'
import {
  parseVcWordStats,
  RETAINED_MONTHS,
  VcWordStatsStore,
} from '@/features/vc-word-stats-store'

describe('parseVcWordStats', () => {
  it('accepts a valid file', () => {
    expect(
      parseVcWordStats({
        months: {
          '2026-09': [['ケツ', 5, 3]],
          '2026-10': [
            ['ケツ', 12, 4],
            ['虫', 5, 5],
          ],
        },
      })
    ).toEqual({
      '2026-09': [['ケツ', 5, 3]],
      '2026-10': [
        ['ケツ', 12, 4],
        ['虫', 5, 5],
      ],
    })
  })

  it.each([
    [null, 'Root must be an object'],
    [[], 'Root must be an object'],
    [{}, '"months" must be an object'],
    [{ months: [] }, '"months" must be an object'],
    [{ months: { '2026-1': [] } }, 'Invalid month key: 2026-1'],
    [{ months: { '2026-13': [] } }, 'Invalid month key: 2026-13'],
    [{ months: { '2026-10': {} } }, '"2026-10" must be an array'],
    [
      { months: { '2026-10': ['ケツ'] } },
      '"2026-10" contains an invalid entry: "ケツ"',
    ],
    [
      { months: { '2026-10': [['ケツ', 1]] } },
      '"2026-10" contains an invalid entry: ["ケツ",1]',
    ],
    [
      { months: { '2026-10': [['', 1, 1]] } },
      '"2026-10" contains an invalid entry: ["",1,1]',
    ],
    [
      { months: { '2026-10': [['ケツ', 0, 0]] } },
      '"2026-10" contains an invalid entry: ["ケツ",0,0]',
    ],
    [
      { months: { '2026-10': [['ケツ', 1.5, 1]] } },
      '"2026-10" contains an invalid entry: ["ケツ",1.5,1]',
    ],
    [
      { months: { '2026-10': [['ケツ', 2, 3]] } },
      '"2026-10" contains an invalid entry: ["ケツ",2,3]',
    ],
    [
      {
        months: {
          '2026-10': [
            ['ケツ', 2, 1],
            ['ケツ', 3, 1],
          ],
        },
      },
      '"2026-10" contains a duplicate: ケツ',
    ],
  ])('rejects %j', (source, message) => {
    expect(() => parseVcWordStats(source)).toThrow(message)
  })
})

describe('VcWordStatsStore', () => {
  let directory: string
  let filePath: string

  const createStore = () => new VcWordStatsStore({ dataDirectory: directory })
  const readFile = (): unknown => JSON.parse(fs.readFileSync(filePath, 'utf8'))

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-word-stats-'))
    filePath = path.join(directory, 'vc-word-stats.json')
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('starts empty when the file does not exist', async () => {
    const store = createStore()
    await store.init()

    expect(store.get()).toEqual(new Map())
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('persists a month and reads it back after a restart', async () => {
    const store = createStore()
    await store.init()
    await store.save('2026-10', [
      ['ケツ', 12, 4],
      ['虫', 5, 5],
    ])

    expect(readFile()).toEqual({
      months: {
        '2026-10': [
          ['ケツ', 12, 4],
          ['虫', 5, 5],
        ],
      },
    })
    const restarted = createStore()
    await restarted.init()
    expect(restarted.get()).toEqual(
      new Map([
        [
          '2026-10',
          new Map([
            ['ケツ', { units: 12, users: 4 }],
            ['虫', { units: 5, users: 5 }],
          ]),
        ],
      ])
    )
  })

  it('overwrites a month that is saved again', async () => {
    const store = createStore()
    await store.init()
    await store.save('2026-10', [['ケツ', 12, 4]])
    await store.save('2026-10', [['虫', 5, 5]])

    expect(readFile()).toEqual({ months: { '2026-10': [['虫', 5, 5]] } })
  })

  it('keeps only the most recent months', async () => {
    const store = createStore()
    await store.init()
    const months = Array.from(
      { length: RETAINED_MONTHS + 1 },
      (_, index) => `2026-${String(index + 1).padStart(2, '0')}`
    )
    for (const month of months) await store.save(month, [['ケツ', 1, 1]])

    expect(Object.keys((readFile() as { months: object }).months)).toEqual(
      months.slice(1)
    )
    expect([...(store.get()?.keys() ?? [])]).toEqual(months.slice(1))
  })

  it('serializes concurrent saves', async () => {
    const store = createStore()
    await store.init()
    await Promise.all([
      store.save('2026-08', [['a語', 1, 1]]),
      store.save('2026-09', [['b語', 1, 1]]),
      store.save('2026-10', [['c語', 1, 1]]),
    ])

    expect(Object.keys((readFile() as { months: object }).months)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('rejects an invalid month key without writing', async () => {
    const store = createStore()
    await store.init()

    await expect(store.save('2026-1', [['ケツ', 1, 1]])).rejects.toThrow(
      'Invalid month key: 2026-1'
    )
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('enters the error state and keeps the file when it cannot be parsed', async () => {
    fs.writeFileSync(filePath, '{broken')
    const store = createStore()
    await store.init()

    expect(store.get()).toBeUndefined()
    await expect(store.save('2026-10', [['ケツ', 1, 1]])).rejects.toThrow(
      ChannelConfigUnavailableError
    )
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{broken')
  })

  it('enters the error state when the content is invalid', async () => {
    fs.writeFileSync(filePath, JSON.stringify({ months: { x: [] } }))
    const store = createStore()
    await store.init()

    expect(store.get()).toBeUndefined()
  })
})
