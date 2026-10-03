import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Configuration } from '@/config'
import { Translate } from '@/features/translate'

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

describe('Translate', () => {
  interface EditOptions {
    embeds: { data: { title: string | null } }[]
  }

  let dataDirectory: string
  let previousDataDirectory: string | undefined
  let previousFetch: typeof fetch
  let fetcher: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>

  beforeEach(() => {
    previousDataDirectory = process.env.DATA_DIR
    previousFetch = fetch
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-command-'))
    process.env.DATA_DIR = dataDirectory
    fetcher = jest.fn()
    globalThis.fetch = fetcher
  })

  afterEach(() => {
    if (previousDataDirectory === undefined) {
      delete process.env.DATA_DIR
    } else {
      process.env.DATA_DIR = previousDataDirectory
    }
    globalThis.fetch = previousFetch
    fs.rmSync(dataDirectory, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  it('executes multi-step translations sequentially', async () => {
    fetcher
      .mockResolvedValueOnce(
        response({
          translation: {
            en: { name: 'English' },
            ja: { name: 'Japanese' },
            fr: { name: 'French' },
          },
        })
      )
      .mockResolvedValueOnce(
        response([{ translations: [{ text: 'こんにちは', to: 'ja' }] }])
      )
      .mockResolvedValueOnce(
        response([{ translations: [{ text: 'bonjour', to: 'fr' }] }])
      )
    const config = {
      get: () => ({
        translator: {
          endpoint: 'https://api.cognitive.microsofttranslator.com',
          apikey: 'test-key',
        },
      }),
    } as unknown as Configuration
    const translate = new Translate(config)
    const edit: jest.Mock<Promise<void>, [EditOptions]> = jest.fn()
    edit.mockResolvedValue(undefined)
    const message = {
      author: { id: 'user-1' },
      reply: jest.fn().mockResolvedValue({ edit }),
    }

    await translate.execute(message as never, 'en', ['ja', 'fr'], 'Hello')

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual([
      { text: 'Hello' },
    ])
    expect(JSON.parse(fetcher.mock.calls[2][1]?.body as string)).toEqual([
      { text: 'こんにちは' },
    ])
    expect((fetcher.mock.calls[1][0] as URL).href).toContain('from=en')
    expect((fetcher.mock.calls[1][0] as URL).href).toContain('to=ja')
    expect((fetcher.mock.calls[2][0] as URL).href).toContain('from=ja')
    expect((fetcher.mock.calls[2][0] as URL).href).toContain('to=fr')
    expect(edit).toHaveBeenCalledTimes(2)
    const successfulEdit = edit.mock.calls[1][0]
    expect(successfulEdit.embeds[0].data.title).toContain('翻訳完了')
  })

  it('replaces a pending response with an error after a later step fails', async () => {
    fetcher
      .mockResolvedValueOnce(
        response({
          translation: {
            en: { name: 'English' },
            ja: { name: 'Japanese' },
            fr: { name: 'French' },
          },
        })
      )
      .mockResolvedValueOnce(
        response([{ translations: [{ text: 'こんにちは', to: 'ja' }] }])
      )
      .mockResolvedValueOnce(response({ error: { code: 403_001 } }, 403))
    const config = {
      get: () => ({
        translator: {
          endpoint: 'https://api.cognitive.microsofttranslator.com',
          apikey: 'test-key',
        },
      }),
    } as unknown as Configuration
    const translate = new Translate(config)
    const edit: jest.Mock<Promise<void>, [EditOptions]> = jest.fn()
    edit.mockResolvedValue(undefined)
    const message = {
      author: { id: 'user-1' },
      reply: jest.fn().mockResolvedValue({ edit }),
    }

    await translate.execute(message as never, 'en', ['ja', 'fr'], 'Hello')

    expect(edit).toHaveBeenCalledTimes(2)
    const failedEdit = edit.mock.calls[1][0]
    expect(failedEdit.embeds[0].data.title).toContain('翻訳失敗')
  })

  it('replaces a response that Discord rejects with a display error', async () => {
    fetcher
      .mockResolvedValueOnce(
        response({
          translation: { en: { name: 'English' }, ja: { name: 'Japanese' } },
        })
      )
      .mockResolvedValueOnce(
        response([{ translations: [{ text: 'こんにちは', to: 'ja' }] }])
      )
    const config = {
      get: () => ({
        translator: {
          endpoint: 'https://api.cognitive.microsofttranslator.com',
          apikey: 'test-key',
        },
      }),
    } as unknown as Configuration
    const translate = new Translate(config)
    const edit: jest.Mock<Promise<void>, [EditOptions]> = jest.fn()
    edit
      .mockRejectedValueOnce(new Error('Discord rejected an oversized embed'))
      .mockResolvedValueOnce(undefined)
    const message = {
      author: { id: 'user-1' },
      reply: jest.fn().mockResolvedValue({ edit }),
    }

    await translate.execute(message as never, 'en', ['ja'], 'Hello')

    expect(edit).toHaveBeenCalledTimes(2)
    const displayError = edit.mock.calls[1][0]
    expect(displayError.embeds[0].data.title).toContain('翻訳失敗')
  })
})
