import axios from 'axios'
import { load } from 'cheerio'

export interface KinenbiDetailOptions {
  filename: string
  query: URLSearchParams
}

export interface KinenbiResult {
  title: string
  detail: KinenbiDetailOptions
}

export interface KinenbiDetail {
  title: string
  description: string
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
   * @returns 記念日一覧
   */
  public async get(date: Date): Promise<KinenbiResult[]> {
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
      throw new Error('Failed to get today: ' + response.status)
    }

    const html = response.data
    const $ = load(html)
    const elements = $('div.today_kinenbilist a.winDetail')

    const results: KinenbiResult[] = []
    for (const element of elements) {
      const title = $(element).text()
      const href = $(element).attr('href')

      const kinenbiUrlObject = new URL(this.baseUrl + href)
      const filename = kinenbiUrlObject.pathname.split('/').pop()
      if (!filename) {
        continue
      }

      results.push({
        title,
        detail: {
          filename,
          query: kinenbiUrlObject.searchParams,
        },
      })
    }

    return results
  }

  public async getDetail(
    options: KinenbiDetailOptions
  ): Promise<KinenbiDetail> {
    const urlObject = new URL(this.baseUrl + options.filename)
    urlObject.search = options.query.toString()

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
}
