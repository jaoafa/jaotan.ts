import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Logger } from '@book000/node-utils'

/**
 * JSON を同じディレクトリの一時ファイルに書いてから rename し、読み手に書きかけを見せない。
 * 失敗した場合は一時ファイルを消して例外を投げる。
 */
export async function writeJsonAtomically(
  filePath: string,
  data: unknown
): Promise<void> {
  const directory = path.dirname(filePath)
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await fs.promises.mkdir(directory, { recursive: true })
  try {
    const handle = await fs.promises.open(temporaryPath, 'w')
    try {
      await handle.writeFile(JSON.stringify(data, null, 2) + '\n')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await fs.promises.rename(temporaryPath, filePath)
  } catch (error) {
    await fs.promises
      .rm(temporaryPath, { force: true })
      .catch((removeError: unknown) => {
        Logger.configure('writeJsonAtomically').warn(
          `⚠️ failed to remove ${temporaryPath}`,
          removeError as Error
        )
      })
    throw error
  }
}

/** 渡された処理を 1 つずつ順番に実行する。先の処理が失敗しても後続は実行される。 */
export class SerialQueue {
  private queue: Promise<unknown> = Promise.resolve()

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
