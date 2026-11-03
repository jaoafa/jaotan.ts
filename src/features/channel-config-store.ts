import fs from 'node:fs'
import path from 'node:path'
import { Logger } from '@book000/node-utils'
import { SerialQueue, writeJsonAtomically } from './atomic-json'

export type ChannelConfigFeature =
  'vc-speech-log' | 'word-ranking' | 'vc-word-ranking'

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
  private readonly queue = new SerialQueue()

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
        await writeJsonAtomically(this.filePath, migrated)
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
    return this.queue.enqueue(async () => {
      const data = this.requireData()
      const channelIds = data[feature] ?? []
      if (channelIds.includes(channelId)) return 'exists'

      const next = { ...data, [feature]: [...channelIds, channelId] }
      await writeJsonAtomically(this.filePath, next)
      this.data = next
      return 'added'
    })
  }

  remove(
    feature: ChannelConfigFeature,
    channelId: string
  ): Promise<'removed' | 'absent'> {
    return this.queue.enqueue(async () => {
      const data = this.requireData()
      const channelIds = data[feature] ?? []
      if (!channelIds.includes(channelId)) return 'absent'

      const next = {
        ...data,
        [feature]: channelIds.filter((id) => id !== channelId),
      }
      await writeJsonAtomically(this.filePath, next)
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
}
