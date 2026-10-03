import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import {
  TranslationLimitError,
  TranslationUsageStore,
} from '@/features/translation-usage-store'

describe('TranslationUsageStore', () => {
  let dataDirectory: string

  beforeEach(() => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'translator-usage-'))
  })

  afterEach(() => {
    fs.rmSync(dataDirectory, { recursive: true, force: true })
  })

  function readUsage(): { month: string; characters: number } {
    const database = new DatabaseSync(
      path.join(dataDirectory, 'translator', 'usage.sqlite')
    )
    try {
      return database
        .prepare('SELECT month, characters FROM usage WHERE id = 1')
        .get() as { month: string; characters: number }
    } finally {
      database.close()
    }
  }

  it('serializes reservations from independent instances sharing /data', async () => {
    const first = new TranslationUsageStore(dataDirectory)
    const second = new TranslationUsageStore(dataDirectory)

    const results = await Promise.allSettled([
      first.reserveAndAcquireRequest(1_500_000),
      second.reserveAndAcquireRequest(500_001),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      TranslationLimitError
    )
  })

  it('serializes reservations across Node processes', async () => {
    const tsxPath = path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs')
    const script = `import { TranslationUsageStore } from '@/features/translation-usage-store.ts'; new TranslationUsageStore().reserveAndAcquireRequest(1_100_000).then(() => process.exit(0), () => process.exit(2))`
    const children = [1, 2].map(() =>
      spawn(process.execPath, [tsxPath, '--eval', script], {
        cwd: process.cwd(),
        env: { ...process.env, DATA_DIR: dataDirectory },
        stdio: 'ignore',
      })
    )
    const exitCodes = await Promise.all(
      children.map(
        (child) =>
          new Promise<number | null>((resolve) => {
            child.once('close', resolve)
          })
      )
    )

    expect(exitCodes.filter((code) => code === 0)).toHaveLength(1)
    expect(exitCodes.filter((code) => code === 2)).toHaveLength(1)
    expect(readUsage().characters).toBe(1_100_000)
  })

  it('resets monthly usage at a UTC month boundary', async () => {
    const store = new TranslationUsageStore(dataDirectory)
    const lease = await store.reserveAndAcquireRequest(
      2_000_000,
      Date.UTC(2026, 8, 30, 22, 59)
    )
    await store.releaseRequest(lease, Date.UTC(2026, 8, 30, 22, 59))

    const nextMonthLease = await store.reserveAndAcquireRequest(
      1,
      Date.UTC(2026, 9, 1, 0, 0)
    )
    await store.releaseRequest(nextMonthLease, Date.UTC(2026, 9, 1, 0, 0))

    const state = readUsage()
    expect(state).toMatchObject({ month: '2026-10', characters: 1 })
  })

  it('keeps a reservation after an uncertain request outcome', async () => {
    const store = new TranslationUsageStore(dataDirectory)
    const lease = await store.reserveAndAcquireRequest(42)
    await store.releaseRequest(lease)

    const state = readUsage()
    expect(state.characters).toBe(42)
  })

  it('applies the hourly rate limit across requests', async () => {
    const store = new TranslationUsageStore(dataDirectory)
    const now = Date.UTC(2026, 9, 1)
    const firstLease = await store.reserveAndAcquireRequest(2_000_000, now)
    await store.releaseRequest(firstLease, now)
    const database = new DatabaseSync(
      path.join(dataDirectory, 'translator', 'usage.sqlite')
    )
    database.prepare('UPDATE usage SET characters = 100 WHERE id = 1').run()
    database.close()

    await expect(
      store.reserveAndAcquireRequest(1, now + 30_000)
    ).rejects.toThrow('Hourly translation limit reached')

    const laterLease = await store.reserveAndAcquireRequest(
      1,
      now + 61 * 60_000
    )
    await store.releaseRequest(laterLease, now + 61 * 60_000)
  })

  it('expires crashed request leases without clearing their reservations', async () => {
    const store = new TranslationUsageStore(dataDirectory)
    const now = Date.UTC(2026, 9, 1)
    await store.reserveAndAcquireRequest(10, now)
    await store.reserveAndAcquireRequest(10, now + 31_000)

    expect(readUsage().characters).toBe(20)
    const database = new DatabaseSync(
      path.join(dataDirectory, 'translator', 'usage.sqlite')
    )
    const leases = database
      .prepare('SELECT COUNT(*) AS count FROM request_leases')
      .get() as { count: number }
    database.close()
    expect(leases.count).toBe(1)
  })

  it('shares user cooldowns between instances', async () => {
    const first = new TranslationUsageStore(dataDirectory)
    const second = new TranslationUsageStore(dataDirectory)
    const now = Date.UTC(2026, 9, 1)
    await first.startCommand('user-1', now)

    await expect(second.startCommand('user-1', now + 1000)).rejects.toThrow(
      TranslationLimitError
    )
    await expect(
      second.startCommand('user-1', now + 5000)
    ).resolves.toBeUndefined()
  })

  it('fails closed when the usage state is malformed', async () => {
    const directory = path.join(dataDirectory, 'translator')
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'usage.sqlite'), '{broken')

    await expect(
      new TranslationUsageStore(dataDirectory).reserveAndAcquireRequest(1)
    ).rejects.toThrow()
  })
})
