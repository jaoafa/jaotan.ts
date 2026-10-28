import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Logger } from '@book000/node-utils'

export type ChannelConfigFeature = 'vc-speech-log'

type ChannelConfigData = Record<string, string[]>

export class ChannelConfigUnavailableError extends Error {}

export function isValidChannelId(channelId: string): boolean {
  return /^\d{17,20}$/.test(channelId)
}

function parseChannelConfig(source: unknown): ChannelConfigData {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw new TypeError('Root must be an object')
  }
  const data: ChannelConfigData = {}
  for (const [feature, value] of Object.entries(source)) {
    if (!Array.isArray(value)) {
      throw new TypeError(`"${feature}" must be an array`)
    }
    const channelIds: string[] = []
    for (const channelId of value as unknown[]) {
      if (typeof channelId !== 'string' || !isValidChannelId(channelId)) {
        throw new TypeError(
          `"${feature}" contains an invalid channel id: ${String(channelId)}`
        )
      }
      if (channelIds.includes(channelId)) {
        throw new TypeError(`"${feature}" contains a duplicate: ${channelId}`)
      }
      channelIds.push(channelId)
    }
    data[feature] = channelIds
  }
  return data
}

/**
 * 機能ごとの対象チャネル ID を channel-config.json に保存・管理する。
 * 読み込みや検証に失敗した場合はエラー状態になり、get は undefined を返す。
 */
export class ChannelConfigStore {
  private readonly filePath: string
  private readonly legacyChannelIds: () => string[]
  private data: ChannelConfigData | undefined
  private queue: Promise<unknown> = Promise.resolve()

  constructor(options: {
    dataDirectory?: string
    legacyChannelIds: () => string[]
  }) {
    this.filePath = path.join(
      options.dataDirectory ?? process.env.DATA_DIR ?? 'data',
      'channel-config.json'
    )
    this.legacyChannelIds = options.legacyChannelIds
  }

  /**
   * 設定を読み込む。ファイルが存在しない初回のみ、旧実装の対象集合を移行する。
   * 失敗してもスローせず、エラー状態になる。
   */
  async init(): Promise<void> {
    const logger = Logger.configure('ChannelConfigStore.init')
    this.data = undefined
    try {
      let source: string | undefined
      try {
        source = await fs.promises.readFile(this.filePath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }

      if (source === undefined) {
        const migrated = parseChannelConfig({
          'vc-speech-log': [...new Set(this.legacyChannelIds())],
        })
        await this.write(migrated)
        this.data = migrated
        logger.info(`👌 migrated legacy channels to ${this.filePath}`)
        return
      }

      this.data = parseChannelConfig(JSON.parse(source))
    } catch (error) {
      logger.error(
        `❌ failed to load ${this.filePath}; features using it are disabled`,
        error as Error
      )
    }
  }

  get(feature: ChannelConfigFeature): readonly string[] | undefined {
    return this.data ? [...(this.data[feature] ?? [])] : undefined
  }

  add(
    feature: ChannelConfigFeature,
    channelId: string
  ): Promise<'added' | 'exists'> {
    return this.enqueue(async () => {
      const data = this.requireData()
      const channelIds = data[feature] ?? []
      if (channelIds.includes(channelId)) return 'exists'

      const next = { ...data, [feature]: [...channelIds, channelId] }
      await this.write(next)
      this.data = next
      return 'added'
    })
  }

  remove(
    feature: ChannelConfigFeature,
    channelId: string
  ): Promise<'removed' | 'absent'> {
    return this.enqueue(async () => {
      const data = this.requireData()
      const channelIds = data[feature] ?? []
      if (!channelIds.includes(channelId)) return 'absent'

      const next = {
        ...data,
        [feature]: channelIds.filter((id) => id !== channelId),
      }
      await this.write(next)
      this.data = next
      return 'removed'
    })
  }

  private requireData(): ChannelConfigData {
    if (!this.data) {
      throw new ChannelConfigUnavailableError(
        `Channel config is unavailable: ${this.filePath}`
      )
    }
    return this.data
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  // 一時ファイルを同じディレクトリに書いて rename し、読み手に書きかけを見せない
  private async write(data: ChannelConfigData): Promise<void> {
    const directory = path.dirname(this.filePath)
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`
    await fs.promises.mkdir(directory, { recursive: true })
    try {
      const handle = await fs.promises.open(temporaryPath, 'w')
      try {
        await handle.writeFile(JSON.stringify(data, null, 2) + '\n')
        await handle.sync()
      } finally {
        await handle.close()
      }
      await fs.promises.rename(temporaryPath, this.filePath)
    } catch (error) {
      await fs.promises
        .rm(temporaryPath, { force: true })
        .catch((removeError: unknown) => {
          Logger.configure('ChannelConfigStore.write').warn(
            `⚠️ failed to remove ${temporaryPath}`,
            removeError as Error
          )
        })
      throw error
    }
  }
}
