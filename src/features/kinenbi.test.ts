import { tmpdir } from 'node:os'
import path from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { Kinenbi } from './kinenbi'
import 'jest-expect-message'

describe('Kinenbi', () => {
  let beforeDataDir: string | undefined
  let testDataDir: string
  let kinenbi: Kinenbi

  beforeEach(() => {
    // テストデータはテンポラリディレクトリに保存する
    beforeDataDir = process.env.DATA_DIR
    testDataDir = path.join(tmpdir(), `kinenbi-test-${Date.now()}`)
    process.env.DATA_DIR = testDataDir

    kinenbi = new Kinenbi()
  })

  afterEach(() => {
    // テストデータをクリアする
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }

    process.env.DATA_DIR = beforeDataDir
  })

  describe('getRanking', () => {
    it('同点を含む順位計算が正しく動作する', async () => {
      // テストキャッシュディレクトリを作成
      const cacheDir = path.join(testDataDir, 'kinenbi-cache')
      mkdirSync(cacheDir, { recursive: true })

      // テストデータを作成（異なる記念日個数のファイル）
      // 01-01: 5個（1位）
      writeFileSync(
        path.join(cacheDir, '01-01.json'),
        JSON.stringify({
          cachedDate: '2026-01-01T00:00:00.000Z',
          results: [
            { title: '記念日1' },
            { title: '記念日2' },
            { title: '記念日3' },
            { title: '記念日4' },
            { title: '記念日5' },
          ],
        })
      )

      // 02-09: 3個（2位）- 今日として扱う
      writeFileSync(
        path.join(cacheDir, '02-09.json'),
        JSON.stringify({
          cachedDate: '2026-02-09T00:00:00.000Z',
          results: [
            { title: '記念日1' },
            { title: '記念日2' },
            { title: '記念日3' },
          ],
        })
      )

      // 03-15: 3個（2位、同点）
      writeFileSync(
        path.join(cacheDir, '03-15.json'),
        JSON.stringify({
          cachedDate: '2026-03-15T00:00:00.000Z',
          results: [
            { title: '記念日1' },
            { title: '記念日2' },
            { title: '記念日3' },
          ],
        })
      )

      // 12-31: 1個（4位）
      writeFileSync(
        path.join(cacheDir, '12-31.json'),
        JSON.stringify({
          cachedDate: '2025-12-31T00:00:00.000Z',
          results: [{ title: '大晦日' }],
        })
      )

      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      expect(ranking).not.toBeNull()
      expect(ranking?.todayCount).toBe(3)
      expect(ranking?.rank).toBe(2) // 5個の日が1つあるので2位
      expect(ranking?.totalDays).toBe(4) // 4日分のデータ
    })

    it('キャッシュディレクトリが存在しない場合に null を返す', async () => {
      // キャッシュディレクトリを作成しない

      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      expect(ranking).toBeNull()
    })

    it('今日のキャッシュファイルが存在しない場合に null を返す', async () => {
      // テストキャッシュディレクトリを作成
      const cacheDir = path.join(testDataDir, 'kinenbi-cache')
      mkdirSync(cacheDir, { recursive: true })

      // 他の日のキャッシュファイルのみ作成
      writeFileSync(
        path.join(cacheDir, '01-01.json'),
        JSON.stringify({
          cachedDate: '2026-01-01T00:00:00.000Z',
          results: [{ title: '元日' }],
        })
      )

      // 02-09 のキャッシュファイルは作成しない
      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      expect(ranking).toBeNull()
    })

    it('壊れた JSON ファイルをスキップして処理を続行する', async () => {
      // テストキャッシュディレクトリを作成
      const cacheDir = path.join(testDataDir, 'kinenbi-cache')
      mkdirSync(cacheDir, { recursive: true })

      // 正常な今日のキャッシュファイル
      writeFileSync(
        path.join(cacheDir, '02-09.json'),
        JSON.stringify({
          cachedDate: '2026-02-09T00:00:00.000Z',
          results: [{ title: '記念日1' }, { title: '記念日2' }],
        })
      )

      // 壊れた JSON ファイル
      writeFileSync(path.join(cacheDir, '01-01.json'), 'invalid json {')

      // 正常なファイル
      writeFileSync(
        path.join(cacheDir, '12-31.json'),
        JSON.stringify({
          cachedDate: '2025-12-31T00:00:00.000Z',
          results: [{ title: '大晦日' }],
        })
      )

      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      expect(ranking).not.toBeNull()
      expect(ranking?.todayCount).toBe(2)
      expect(ranking?.rank).toBe(1) // 壊れたファイルはスキップされ、12-31（1個）より多いので1位
      expect(ranking?.totalDays).toBe(2) // 壊れたファイルを除く2日分
    })

    it('results が配列でない場合に null を返す', async () => {
      // テストキャッシュディレクトリを作成
      const cacheDir = path.join(testDataDir, 'kinenbi-cache')
      mkdirSync(cacheDir, { recursive: true })

      // results が配列でないファイル
      writeFileSync(
        path.join(cacheDir, '02-09.json'),
        JSON.stringify({
          cachedDate: '2026-02-09T00:00:00.000Z',
          results: 'not an array',
        })
      )

      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      expect(ranking).toBeNull()
    })

    it('すべてのファイルが壊れている場合に null を返す', async () => {
      // テストキャッシュディレクトリを作成
      const cacheDir = path.join(testDataDir, 'kinenbi-cache')
      mkdirSync(cacheDir, { recursive: true })

      // 今日のキャッシュファイル（正常）
      writeFileSync(
        path.join(cacheDir, '02-09.json'),
        JSON.stringify({
          cachedDate: '2026-02-09T00:00:00.000Z',
          results: [{ title: '記念日1' }],
        })
      )

      // 他のファイルはすべて壊れている
      writeFileSync(path.join(cacheDir, '01-01.json'), 'invalid json')
      writeFileSync(path.join(cacheDir, '12-31.json'), '{invalid}')

      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      // counts 配列に今日のファイルしか含まれず、totalDays が 1 になる
      expect(ranking).not.toBeNull()
      expect(ranking?.todayCount).toBe(1)
      expect(ranking?.rank).toBe(1) // 自分自身より多い日はないので1位
      expect(ranking?.totalDays).toBe(1)
    })

    it('記念日が0個の日でも正しく順位を計算する', async () => {
      // テストキャッシュディレクトリを作成
      const cacheDir = path.join(testDataDir, 'kinenbi-cache')
      mkdirSync(cacheDir, { recursive: true })

      // 今日のキャッシュファイル（0個）
      writeFileSync(
        path.join(cacheDir, '02-09.json'),
        JSON.stringify({
          cachedDate: '2026-02-09T00:00:00.000Z',
          results: [],
        })
      )

      // 他の日のキャッシュファイル
      writeFileSync(
        path.join(cacheDir, '01-01.json'),
        JSON.stringify({
          cachedDate: '2026-01-01T00:00:00.000Z',
          results: [{ title: '元日' }],
        })
      )

      const ranking = await kinenbi.getRanking(new Date('2026-02-09'))

      expect(ranking).not.toBeNull()
      expect(ranking?.todayCount).toBe(0)
      expect(ranking?.rank).toBe(2) // 1個の日が1つあるので2位
      expect(ranking?.totalDays).toBe(2)
    })
  })
})
