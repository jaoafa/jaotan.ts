import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const MONTHLY_CHARACTER_LIMIT = 2_000_000
const HOURLY_CHARACTER_LIMIT = 2_000_000
const COOLDOWN_MS = 5000
const MAX_CONCURRENT_REQUESTS = 2
const REQUEST_LEASE_MS = 30_000
const DATABASE_TIMEOUT_MS = 10_000

interface UsageRow {
  month: string
  characters: number
}

export class TranslationLimitError extends Error {}

/** Persists quota reservations and request coordination in a shared SQLite database. */
export class TranslationUsageStore {
  private readonly directory: string
  private readonly databasePath: string

  constructor(dataDirectory = process.env.DATA_DIR ?? 'data') {
    this.directory = path.join(dataDirectory, 'translator')
    this.databasePath = path.join(this.directory, 'usage.sqlite')
  }

  /** Starts a translation command and enforces the shared per-user cooldown. */
  async startCommand(userId: string, now = Date.now()): Promise<void> {
    await Promise.resolve()
    const limited = this.withTransaction((database) => {
      database
        .prepare('DELETE FROM cooldowns WHERE last_request <= ?')
        .run(now - COOLDOWN_MS)
      const lastRequest = database
        .prepare('SELECT last_request FROM cooldowns WHERE user_id = ?')
        .get(userId) as { last_request: number } | undefined
      if (lastRequest) {
        return true
      }
      database
        .prepare('INSERT INTO cooldowns (user_id, last_request) VALUES (?, ?)')
        .run(userId, now)
      return false
    }, now)
    if (limited) {
      throw new TranslationLimitError('Translation cooldown is active')
    }
  }

  /** Reserves characters and an active request slot before sending a request. */
  async reserveAndAcquireRequest(
    characters: number,
    now = Date.now()
  ): Promise<string> {
    await Promise.resolve()
    if (!Number.isSafeInteger(characters) || characters < 0) {
      throw new TranslationLimitError('Invalid translation character count')
    }

    const leaseId = randomUUID()
    const limitMessage = this.withTransaction((database) => {
      const month = this.getMonthKey(now)
      database
        .prepare(
          'UPDATE usage SET month = ?, characters = 0 WHERE id = 1 AND month < ?'
        )
        .run(month, month)
      const usage = database
        .prepare('SELECT month, characters FROM usage WHERE id = 1')
        .get() as UsageRow | undefined
      if (!usage) throw new Error('Translation usage state is missing')

      const minute = Math.floor(now / 60_000) * 60_000
      const hourStart = minute - 60 * 60_000
      database
        .prepare('DELETE FROM hourly_usage WHERE minute < ?')
        .run(hourStart)
      database
        .prepare('DELETE FROM request_leases WHERE expires_at <= ?')
        .run(now)

      if (usage.characters + characters > MONTHLY_CHARACTER_LIMIT) {
        return 'Monthly translation limit reached'
      }

      const hourlyUsage = database
        .prepare(
          'SELECT COALESCE(SUM(characters), 0) AS characters FROM hourly_usage'
        )
        .get() as { characters: number }
      if (hourlyUsage.characters + characters > HOURLY_CHARACTER_LIMIT) {
        return 'Hourly translation limit reached'
      }

      const activeRequests = database
        .prepare('SELECT COUNT(*) AS count FROM request_leases')
        .get() as { count: number }
      if (activeRequests.count >= MAX_CONCURRENT_REQUESTS) {
        return 'Translation concurrency limit reached'
      }

      if (characters > 0) {
        database
          .prepare('UPDATE usage SET characters = characters + ? WHERE id = 1')
          .run(characters)
        database
          .prepare(
            `INSERT INTO hourly_usage (minute, characters) VALUES (?, ?)
             ON CONFLICT(minute) DO UPDATE SET characters = characters + excluded.characters`
          )
          .run(minute, characters)
      }
      database
        .prepare(
          'INSERT INTO request_leases (lease_id, expires_at) VALUES (?, ?)'
        )
        .run(leaseId, now + REQUEST_LEASE_MS)
      return undefined
    }, now)

    if (limitMessage) throw new TranslationLimitError(limitMessage)
    return leaseId
  }

  /** Releases a request slot after its network request finishes. */
  async releaseRequest(leaseId: string, now = Date.now()): Promise<void> {
    await Promise.resolve()
    this.withTransaction((database) => {
      database
        .prepare('DELETE FROM request_leases WHERE lease_id = ?')
        .run(leaseId)
    }, now)
  }

  private withTransaction<T>(
    operation: (database: DatabaseSync) => T,
    now: number
  ): T {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    fs.chmodSync(this.directory, 0o700)
    const database = new DatabaseSync(this.databasePath, {
      timeout: DATABASE_TIMEOUT_MS,
    })
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS usage (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          month TEXT NOT NULL,
          characters INTEGER NOT NULL CHECK (characters >= 0)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS hourly_usage (
          minute INTEGER PRIMARY KEY,
          characters INTEGER NOT NULL CHECK (characters >= 0)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS cooldowns (
          user_id TEXT PRIMARY KEY,
          last_request INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS request_leases (
          lease_id TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL
        ) STRICT;
      `)
      fs.chmodSync(this.databasePath, 0o600)
      database.exec('BEGIN IMMEDIATE')
      try {
        database
          .prepare(
            'INSERT OR IGNORE INTO usage (id, month, characters) VALUES (1, ?, 0)'
          )
          .run(this.getMonthKey(now))
        const result = operation(database)
        database.exec('COMMIT')
        return result
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    } finally {
      database.close()
    }
  }

  private getMonthKey(now: number): string {
    return new Date(now).toISOString().slice(0, 7)
  }
}
