import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { AzureTranslator } from '@/features/azure-translator'
import { TranslationUsageStore } from '@/features/translation-usage-store'

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

describe('AzureTranslator', () => {
  let dataDirectory: string
  let usageStore: TranslationUsageStore

  beforeEach(() => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-translator-'))
    usageStore = new TranslationUsageStore(dataDirectory)
  })

  afterEach(() => {
    fs.rmSync(dataDirectory, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  function readCharacters(): number {
    const database = new DatabaseSync(
      path.join(dataDirectory, 'translator', 'usage.sqlite')
    )
    try {
      return (
        database.prepare('SELECT characters FROM usage WHERE id = 1').get() as {
          characters: number
        }
      ).characters
    } finally {
      database.close()
    }
  }

  it('maps supported aliases and sends a valid Translate request', async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        response({
          translation: {
            en: { name: 'English' },
            'zh-Hans': { name: 'Chinese Simplified' },
          },
        })
      )
      .mockResolvedValueOnce(
        response([{ translations: [{ text: '你好', to: 'zh-Hans' }] }])
      )
    const translator = new AzureTranslator(
      {
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        apikey: 'test-key',
      },
      usageStore,
      fetcher
    )

    await expect(translator.translate('en', 'zh', 'hello😀')).resolves.toBe(
      '你好'
    )
    const request = fetcher.mock.calls[1]
    expect((request[0] as URL).href).toContain('from=en')
    expect((request[0] as URL).href).toContain('to=zh-Hans')
    expect(request[1]?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'test-key',
    })
    expect(JSON.parse(request[1]?.body as string)).toEqual([
      { text: 'hello😀' },
    ])

    expect(readCharacters()).toBe('hello😀'.length)
  })

  it('does not send an unsupported target language', async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        response({ translation: { en: { name: 'English' } } })
      )
    const translator = new AzureTranslator(
      {
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        apikey: 'test-key',
      },
      usageStore,
      fetcher
    )

    await expect(translator.translate('en', 'jv', 'hello')).rejects.toThrow(
      'Unsupported target language'
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fails safely on malformed language results', async () => {
    const translator = new AzureTranslator(
      {
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        apikey: 'test-key',
      },
      usageStore,
      jest
        .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
        .mockResolvedValueOnce(response({ translation: [] }))
    )

    await expect(translator.getSupportedLanguages()).rejects.toThrow(
      'invalid language list'
    )
  })

  it('uses Azure detection without reserving translation characters', async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(response([{ language: 'zh-Hans', score: 0.99 }]))
      .mockResolvedValueOnce(
        response({ translation: { 'zh-Hans': { name: 'Chinese Simplified' } } })
      )
    const translator = new AzureTranslator(
      {
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        apikey: 'test-key',
      },
      usageStore,
      fetcher
    )

    await expect(translator.detectLanguage('你好')).resolves.toBe('zh')
    expect(readCharacters()).toBe(0)
  })

  it('reserves quota for each retry attempt', async () => {
    const failureResponse = new Response('{}', {
      status: 503,
      headers: { 'Retry-After': '0' },
    })
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        response({
          translation: {
            en: { name: 'English' },
            fr: { name: 'French' },
          },
        })
      )
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(
        response([{ translations: [{ text: 'bonjour', to: 'fr' }] }])
      )
    const translator = new AzureTranslator(
      {
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        apikey: 'test-key',
      },
      usageStore,
      fetcher
    )

    await expect(translator.translate('en', 'fr', 'hello')).resolves.toBe(
      'bonjour'
    )
    expect(readCharacters()).toBe(10)
    expect(failureResponse.bodyUsed).toBe(true)
  })
})
