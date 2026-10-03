import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { GoogleSearch } from '@/features/google-search'

describe('GoogleSearch', () => {
  let dataDirectory: string
  let previousDataDirectory: string | undefined
  const fetchMock = jest.fn()
  const originalFetch = fetch

  beforeEach(() => {
    previousDataDirectory = process.env.DATA_DIR
    dataDirectory = path.join(tmpdir(), `google-search-${randomUUID()}`)
    fs.mkdirSync(dataDirectory, { recursive: true })
    process.env.DATA_DIR = dataDirectory
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    fs.rmSync(dataDirectory, { recursive: true, force: true })
    if (previousDataDirectory === undefined) delete process.env.DATA_DIR
    else process.env.DATA_DIR = previousDataDirectory
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('decodes result text, uses image context links, and records the request', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            searchInformation: {
              formattedSearchTime: '0.2',
              formattedTotalResults: '1',
            },
            items: [
              {
                title: 'title',
                htmlTitle: '<b>猫</b> &amp; &#128049;',
                link: 'https://example.com/image.png',
                htmlLink: 'https://example.com/search',
                htmlSnippet: 'a&nbsp;b &#39; &#60;',
                image: { contextLink: 'https://example.com/article' },
              },
            ],
          })
        ),
    })

    const result = await new GoogleSearch('key', 'cx').search('cats', 'image')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/customsearch/v1?key=key&cx=cx&q=cats&searchType=image'
    )
    expect(result).toEqual({
      searchTime: '0.2',
      totalResult: '1',
      items: [
        {
          title: 'title',
          htmlTitle: '<b>猫</b> &amp; &#128049;',
          decodedTitle: '**猫** & 🐱',
          link: 'https://example.com/article',
          htmlLink: 'https://example.com/search',
          htmlSnippet: 'a&nbsp;b &#39; &#60;',
          decodedSnippet: "a b ' <",
          imageLink: 'https://example.com/image.png',
        },
      ],
    })
    expect(new GoogleSearch('key', 'cx').getRequestCount()).toBe(1)
    expect(Object.values(GoogleSearch.getPastRequestCounts())).toEqual([1])
  })

  it('rejects an unsupported search type before making a request', async () => {
    await expect(
      new GoogleSearch('key', 'cx').search('cats', 'invalid')
    ).rejects.toThrow('Invalid searchType')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects malformed API responses and non-200 statuses', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{}'),
    })
    await expect(new GoogleSearch('key', 'cx').search('cats')).rejects.toThrow(
      'Invalid response'
    )

    fetchMock.mockResolvedValue({
      status: 503,
      text: () => Promise.resolve('unavailable'),
    })
    await expect(new GoogleSearch('key', 'cx').search('cats')).rejects.toThrow(
      'Google Custom Search API failed: 503'
    )
  })

  it('stops after the daily request limit', async () => {
    fs.mkdirSync(dataDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(dataDirectory, 'google-search-limit.json'),
      JSON.stringify({
        [new Date().toLocaleDateString('en-CA', {
          timeZone: 'America/Los_Angeles',
        })]: 100,
      })
    )

    await expect(new GoogleSearch('key', 'cx').search('cats')).rejects.toThrow(
      'Google Custom Search API request limit exceeded'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
