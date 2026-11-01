import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WordWorker } from './worker-client'

const MESSAGE = {
  channelId: 'c1',
  authorId: 'u1',
  timestamp: 1_700_000_000_000,
  content: 'こんにちは',
}

describe('WordWorker', () => {
  let directory: string
  let fixtureCount = 0
  const workers: WordWorker[] = []

  const fixture = (source: string): string => {
    const file = path.join(directory, `worker-${fixtureCount++}.js`)
    fs.writeFileSync(file, source)
    return file
  }
  const start = async (source: string, timeoutMs?: number) => {
    const worker = await WordWorker.start({
      dictPath: '/unused',
      stopwords: ['the'],
      scriptPath: fixture(source),
      execArgv: [],
      timeoutMs,
    })
    workers.push(worker)
    return worker
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'word-worker-'))
  })

  afterEach(() => {
    for (const worker of workers.splice(0)) worker.kill()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const HAPPY = `
    let stopwords
    let count = 0
    process.on('message', (request) => {
      if (request.type === 'init') {
        stopwords = request.stopwords
        process.send({ type: 'ready' })
      }
      if (request.type === 'messages') count += request.messages.length
      if (request.type === 'finish') {
        process.send(
          { type: 'result', result: { months: [['2026-10', [[stopwords.join(','), count, 1]]]], displays: [] } },
          () => process.disconnect()
        )
      }
    })
  `

  it('passes the stopwords and messages to the child and returns its result', async () => {
    const worker = await start(HAPPY)

    await worker.send([MESSAGE, MESSAGE])
    await worker.send([MESSAGE])

    await expect(worker.finish()).resolves.toEqual({
      months: [['2026-10', [['the', 3, 1]]]],
      displays: [],
    })
  })

  it('rejects start when the child reports an error', async () => {
    await expect(
      start(
        `process.on('message', () => process.send({ type: 'error', message: 'boom' }))`
      )
    ).rejects.toThrow('Word worker reported an error: boom')
  })

  it('rejects when the child sends a response of an unexpected type', async () => {
    await expect(
      start(
        `process.on('message', () => process.send({ type: 'result', result: { months: [], displays: [] } }))`
      )
    ).rejects.toThrow('Unexpected worker response: "result"')
  })

  it('rejects finish when the child exits before sending the result', async () => {
    const worker = await start(`
      process.on('message', (request) => {
        if (request.type === 'init') process.send({ type: 'ready' })
        if (request.type === 'finish') process.exit(3)
      })
    `)

    await expect(worker.finish()).rejects.toThrow(
      'Word worker exited unexpectedly (code=3, signal=null)'
    )
  })

  it('rejects start when the child never becomes ready within the timeout', async () => {
    await expect(start(`setInterval(() => {}, 1000)`, 200)).rejects.toThrow(
      'Word worker timed out after 200ms'
    )
  })

  it('kills the child process', async () => {
    const pidFile = path.join(directory, 'pid')
    const worker = await start(`
      require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))
      process.on('message', () => process.send({ type: 'ready' }))
    `)
    const pid = Number(fs.readFileSync(pidFile, 'utf8'))

    worker.kill()

    let alive = true
    for (let i = 0; alive && i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      try {
        process.kill(pid, 0)
      } catch {
        alive = false
      }
    }
    expect(alive).toBe(false)
  })
})
