import axios from 'axios'
import { load } from 'cheerio'
import fs from 'node:fs'

export interface KinenbiDetailOptions {
  filename: string
  query: Record<string, string>
}

export interface KinenbiResult {
  title: string
  detail: KinenbiDetailOptions
}

export interface KinenbiResultWithCustom extends KinenbiResult {
  foundDate: Date
  isNew: boolean
}

export interface KinenbiDetail {
  title: string
  description: string
}

interface KinenbiCache {
  cachedDate: string
  results: KinenbiResultWithCustom[]
}

/**
 * 一般社団法人 日本記念日協会による記念日の機能
 */
export class Kinenbi {
  private readonly baseUrl = 'https://www.kinenbi.gr.jp/'

  /**
   * 指定した日付の記念日一覧を取得します。
   *
   * @param date 日付
   * @param force キャッシュを無視して強制的に取得するかどうか
   * @returns 記念日一覧
   */
  public async get(
    date: Date,
    force = false
  ): Promise<KinenbiResultWithCustom[]> {
    const cachePath = this.getCachePath(date)
    const prevData: KinenbiCache | null = fs.existsSync(cachePath)
      ? JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      : null

    if (!force && prevData) {
      return prevData.results
    }

    const response = await axios.post<string>(
      this.baseUrl,
      {
        MD: '1',
        M: date.getMonth() + 1,
        D: date.getDate(),
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        validateStatus: () => true,
      }
    )
    if (response.status !== 200) {
      throw new Error('Failed to get today: ' + response.status.toString())
    }

    const html = response.data
    const $ = load(html)
    const elements = $('div.today_kinenbilist a.winDetail')

    const results: KinenbiResultWithCustom[] = []
    for (const element of elements) {
      const title = $(element).text()
      const href = $(element).attr('href')
      if (!href) {
        continue
      }

      const kinenbiUrlObject = new URL(this.baseUrl + href)
      const filename = kinenbiUrlObject.pathname.split('/').pop()
      if (!filename) {
        continue
      }

      const searchParamsObject = this.searchParamsToObject(
        kinenbiUrlObject.searchParams
      )
      const lastFoundDate = prevData?.results.find(
        (result) =>
          result.detail.filename === filename &&
          result.detail.query.TYPE === searchParamsObject.TYPE &&
          result.detail.query.MD === searchParamsObject.MD &&
          result.detail.query.NM === searchParamsObject.NM
      )?.foundDate
      const foundDate = lastFoundDate ?? date // キャッシュがある場合は前回の日付を使う
      const isNew = prevData !== null && lastFoundDate === undefined // キャッシュがある場合は新規かどうかを判定

      results.push({
        title,
        detail: {
          filename,
          query: searchParamsObject,
        },
        foundDate,
        isNew,
      })
    }

    const cacheData: KinenbiCache = {
      cachedDate: date.toISOString(),
      results,
    }
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8')

    return results
  }

  public async getDetail(
    options: KinenbiDetailOptions
  ): Promise<KinenbiDetail> {
    const urlObject = new URL(this.baseUrl + options.filename)
    urlObject.search = this.objectToSearchParams(options.query).toString()

    const response = await axios.get<string>(urlObject.toString(), {
      validateStatus: () => true,
    })
    // 正しくても404が返ってくることがある

    const html = response.data
    const $ = load(html)

    const title = $('td[nowarp] > font:nth-child(1)').text()
    const description = $('tr > td > p').text()
    if (!title || !description) {
      throw new Error('Failed to get detail')
    }

    return {
      title,
      description,
    }
  }

  private getCachePath(date: Date): string {
    const dataDir = process.env.DATA_DIR ?? 'data/'
    const cacheDir = `${dataDir}/kinenbi-cache/`
    const cacheFile = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.json`

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    return `${cacheDir}${cacheFile}`
  }

  private searchParamsToObject(
    searchParams: URLSearchParams
  ): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of searchParams) {
      result[key] = value
    }
    return result
  }

  private objectToSearchParams(obj: Record<string, string>): URLSearchParams {
    const searchParams = new URLSearchParams()
    for (const key in obj) {
      searchParams.append(key, obj[key])
    }
    return searchParams
  }
}
