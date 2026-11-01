import { WordWorker } from './worker-client'

const dictPath = process.env.SUDACHI_DICT_PATH ?? ''
const describeWithDictionary = dictPath === '' ? describe.skip : describe

describeWithDictionary(
  'tokenizer-worker with a real Sudachi dictionary',
  () => {
    jest.setTimeout(60_000)
    const base = Date.UTC(2026, 9, 5, 3)

    it('tokenizes, filters and aggregates messages in a child process', async () => {
      const worker = await WordWorker.start({
        dictPath,
        stopwords: ['虫'],
      })
      try {
        await worker.send([
          {
            channelId: 'c1',
            authorId: 'u1',
            timestamp: base,
            content: 'マイクラのサーバを再起動しました',
          },
          {
            channelId: 'c1',
            authorId: 'u2',
            timestamp: base + 1,
            content: 'https://example.com <@123> 虫 `code` ナニィイイイ',
          },
          {
            channelId: 'c1',
            authorId: 'u3',
            timestamp: base + 2,
            content: '/origin 9\nナニィ',
          },
        ])

        await expect(worker.finish()).resolves.toEqual({
          months: [
            [
              '2026-10',
              [
                ['サーバ', 1, 1],
                ['ナニイ', 2, 2],
                ['マイクラ', 1, 1],
                ['再起動', 1, 1],
              ],
            ],
          ],
          displays: [
            ['サーバ', 'サーバ'],
            ['ナニイ', 'ナニィ'],
            ['マイクラ', 'マイクラ'],
            ['再起動', '再起動'],
          ],
        })
      } finally {
        worker.kill()
      }
    })

    it('rejects start when the dictionary cannot be loaded', async () => {
      await expect(
        WordWorker.start({
          dictPath: '/nonexistent/system_core.dic',
          stopwords: [],
        })
      ).rejects.toThrow('Word worker reported an error:')
    })
  }
)
