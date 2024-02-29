import axios from 'axios'
import fs from 'node:fs'

export interface CustomSearchResultItem {
  title: string
  htmlTitle: string
  decodedTitle: string
  link: string
  htmlLink: string
  htmlSnippet: string
  decodedSnippet: string
  imageLink?: string
}

export interface CustomSearchResult {
  searchTime: string
  totalResult: string
  items: CustomSearchResultItem[]
}

const SearchType = {
  IMAGE: 'image',
  NEWS: 'news',
  VIDEO: 'video',
  SHOPPING: 'shopping',
}
type SearchType = (typeof SearchType)[keyof typeof SearchType]

export class GoogleSearch {
  private gcpKey: string
  private cx: string

  private readonly requestLimit = 100

  constructor(gcpKey: string, cx: string) {
    this.gcpKey = gcpKey
    this.cx = cx
  }

  public async search(
    text: string,
    searchType?: SearchType
  ): Promise<CustomSearchResult> {
    // searchTypeが正しいか確認
    if (searchType && !Object.values(SearchType).includes(searchType)) {
      throw new Error('Invalid searchType')
    }

    if (this.isRequestLimitExceeded()) {
      throw new Error('Google Custom Search API request limit exceeded')
    }

    if (this.isRequestLimitExceeded()) {
      throw new Error('Google Custom Search API request limit exceeded')
    }

    let url = `https://www.googleapis.com/customsearch/v1?key=${this.gcpKey}&cx=${this.cx}&q=${text}`
    if (searchType) {
      url += `&searchType=${searchType}`
    }

    const response = await axios.get(url, {
      validateStatus: () => true,
    })
    this.incrementRequestCount()
    this.saveResponse(response.status, response.data)
    if (response.status !== 200) {
      throw new Error(`Google Custom Search API failed: ${response.status}`)
    }

    const data = response.data

    // searchInformation, itemsがあることを確認
    if (!data.searchInformation || !data.items) {
      throw new Error('Invalid response')
    }

    const items = data.items.map((item: any) => {
      return {
        title: item.title,
        htmlTitle: item.htmlTitle,
        decodedTitle: this.decodeHtml(item.htmlTitle),
        link: item.image?.contextLink ?? item.link,
        htmlLink: item.htmlLink,
        htmlSnippet: item.htmlSnippet,
        decodedSnippet: this.decodeHtml(item.htmlSnippet),
        imageLink: item.link,
      }
    })

    return {
      searchTime: data.searchInformation.formattedSearchTime,
      totalResult: data.searchInformation.formattedTotalResults,
      items,
    }
  }

  private saveResponse(statusCode: number, data: any) {
    const dataDirectory = process.env.DATA_DIR ?? 'data'
    const saveDirectory = `${dataDirectory}/google-search-response`
    if (!fs.existsSync(saveDirectory)) {
      fs.mkdirSync(saveDirectory, { recursive: true })
    }
    const filePath = `${saveDirectory}/${Date.now()}-${statusCode}.json`
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  }

  private decodeHtml(html: string): string {
    const pattern = /&#(\d+);|&#([\dA-Fa-f]+);/g
    const matches = html.matchAll(pattern)
    let result = html
    for (const match of matches) {
      const code = match[1]
        ? Number.parseInt(match[1], 10)
        : Number.parseInt(match[2], 16)
      result = result.replaceAll(match[0], String.fromCodePoint(code))
    }

    const replaceMap = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x60;': '`',
      '&nbsp;': ' ',
    }
    for (const [key, value] of Object.entries(replaceMap)) {
      result = result.replaceAll(key, value)
    }

    // 太字
    result = result.replaceAll('<b>', '**').replaceAll('</b>', '**')

    return result
  }

  private isRequestLimitExceeded() {
    const requestCount = this.getRequestCount()
    return requestCount >= this.requestLimit
  }

  private incrementRequestCount() {
    const dataDirectory = process.env.DATA_DIR ?? 'data'
    const filePath = `${dataDirectory}/google-search-limit.json`

    // リクエスト回数をカウントする
    // リセットタイミングはPST0時
    // タイムゾーンを考慮して日付を取得
    const date = this.getPstDate()
    let json: { [key: string]: number } = {}
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8')
      json = JSON.parse(data)
    }

    if (!(date in json)) {
      json[date] = 0
    }
    json[date]++

    fs.writeFileSync(filePath, JSON.stringify(json, null, 2))
  }

  public getRequestCount() {
    const dataDirectory = process.env.DATA_DIR ?? 'data'
    const filePath = `${dataDirectory}/google-search-limit.json`

    if (!fs.existsSync(filePath)) {
      return 0
    }

    const data = fs.readFileSync(filePath, 'utf8')
    const json = JSON.parse(data)

    // リセットタイミングはPST0時
    // タイムゾーンを考慮して日付を取得
    const date = this.getPstDate()
    if (!(date in json)) {
      return 0
    }

    return json[date]
  }

  public getRequestLimit() {
    return this.requestLimit
  }

  public static getPastRequestCounts(): { [key: string]: number } {
    const dataDirectory = process.env.DATA_DIR ?? 'data'
    const filePath = `${dataDirectory}/google-search-limit.json`

    if (!fs.existsSync(filePath)) {
      return {}
    }

    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  }

  private getPstDate() {
    // 現在の日付と時刻を取得する
    const currentDate = new Date()

    // 現在の日付と時刻をPSTに変換する
    const pstDate = new Date(
      currentDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    )

    // PSTの年、月、日を取得する
    const year = pstDate.getFullYear()
    const month = pstDate.getMonth() + 1 // 月は0から始まるため、1を加える
    const day = pstDate.getDate()

    // yyyy-MM-dd形式でPSTの日付を返す
    return (
      year +
      '-' +
      (month < 10 ? '0' : '') +
      month +
      '-' +
      (day < 10 ? '0' : '') +
      day
    )
  }
}
