import { ChildProcess, fork } from 'node:child_process'
import path from 'node:path'
import {
  AccumulatedResult,
  WordMessage,
  WorkerRequest,
  WorkerResponse,
} from './types'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

export interface WordWorkerOptions {
  dictPath: string
  stopwords: readonly string[]
  /** 子プロセスで実行するスクリプト。既定は同じディレクトリの tokenizer-worker.ts */
  scriptPath?: string
  execArgv?: string[]
  timeoutMs?: number
}

interface Waiter {
  type: WorkerResponse['type']
  resolve: (response: WorkerResponse) => void
  reject: (error: Error) => void
}

/**
 * 形態素解析と集計を行う子プロセスを制御する。
 * 子プロセスの異常終了、エラー応答、タイムアウトは、以降の操作の例外になる。
 * 使い終わったら必ず kill を呼ぶこと。
 */
export class WordWorker {
  private waiter: Waiter | undefined
  private error: Error | undefined
  private finished = false
  private readonly timer: NodeJS.Timeout

  private constructor(
    private readonly child: ChildProcess,
    timeoutMs: number
  ) {
    this.timer = setTimeout(() => {
      this.fail(new Error(`Word worker timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    this.timer.unref()

    child.on('message', (response: WorkerResponse) => {
      this.onMessage(response)
    })
    child.on('error', (error) => {
      this.fail(new Error(`Word worker failed to run: ${error.message}`))
    })
    child.on('exit', (code, signal) => {
      clearTimeout(this.timer)
      if (!this.finished) {
        this.fail(
          new Error(
            `Word worker exited unexpectedly (code=${code}, signal=${signal})`
          )
        )
      }
    })
  }

  static async start(options: WordWorkerOptions): Promise<WordWorker> {
    const child = fork(
      // eslint-disable-next-line unicorn/prefer-module -- CommonJS として実行されるため import.meta は使えない
      options.scriptPath ?? path.join(__dirname, 'tokenizer-worker.ts'),
      [],
      {
        execArgv: options.execArgv ?? ['--import', 'tsx'],
        env: {
          SUDACHI_DICT_PATH: options.dictPath,
          ...(process.env.NODE_ENV !== undefined && {
            NODE_ENV: process.env.NODE_ENV,
          }),
        },
      }
    )
    const worker = new WordWorker(
      child,
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    )
    try {
      const ready = worker.expect('ready')
      await worker.request({
        type: 'init',
        stopwords: [...options.stopwords],
      })
      await ready
    } catch (error) {
      worker.kill()
      throw error
    }
    return worker
  }

  async send(messages: WordMessage[]): Promise<void> {
    await this.request({ type: 'messages', messages })
  }

  async finish(): Promise<AccumulatedResult> {
    const response = this.expect('result')
    await this.request({ type: 'finish' })
    const result = await response
    if (result.type !== 'result') {
      throw new Error(`Unexpected worker response: ${result.type}`)
    }
    return result.result
  }

  kill(): void {
    clearTimeout(this.timer)
    this.child.kill('SIGKILL')
  }

  private expect(type: WorkerResponse['type']): Promise<WorkerResponse> {
    if (this.error) return Promise.reject(this.error)
    return new Promise((resolve, reject) => {
      this.waiter = { type, resolve, reject }
    })
  }

  private request(request: WorkerRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.error) {
        reject(this.error)
        return
      }
      this.child.send(request, (error: Error | null) => {
        if (error) {
          reject(this.error ?? error)
          return
        }
        resolve()
      })
    })
  }

  private onMessage(response: WorkerResponse): void {
    if (response.type === 'error') {
      this.fail(new Error(`Word worker reported an error: ${response.message}`))
      return
    }
    if (this.waiter?.type !== response.type) {
      this.fail(
        new Error(
          `Unexpected worker response: ${JSON.stringify(response.type)}`
        )
      )
      return
    }
    if (response.type === 'result') this.finished = true
    const { resolve } = this.waiter
    this.waiter = undefined
    resolve(response)
  }

  private fail(error: Error): void {
    this.error ??= error
    clearTimeout(this.timer)
    const { waiter } = this
    this.waiter = undefined
    waiter?.reject(this.error)
    this.child.kill('SIGKILL')
  }
}
