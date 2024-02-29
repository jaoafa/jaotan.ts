import axios from 'axios'

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

    let url = `https://www.googleapis.com/customsearch/v1?key=${this.gcpKey}&cx=${this.cx}&q=${text}`
    if (searchType) {
      url += `&searchType=${searchType}`
    }

    const response = await axios.get(url, {
      validateStatus: () => true,
    })
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
}
