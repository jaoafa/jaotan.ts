import { tmpdir } from 'node:os'
import { Birthday, IBirthdayDateWithYear } from './birthday'
import 'jest-expect-message'

describe('Birthday', () => {
  let beforeDataDir: string | undefined
  let birthday: Birthday

  beforeEach(() => {
    // テストデータはテンポラリディレクトリに保存する
    beforeDataDir = process.env.DATA_DIR
    process.env.DATA_DIR = tmpdir()

    birthday = new Birthday()
  })

  afterEach(() => {
    // テストデータをクリアする
    birthday.delete('testUser')

    process.env.DATA_DIR = beforeDataDir
  })

  it('ファイルから誕生日データを追加して読み込む', () => {
    // テストユーザーを追加
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // データを再読込
    birthday.load()

    // テストユーザーが存在するか確認
    const testUser = birthday.getByUser('testUser')
    expect(testUser).toBeDefined()
    expect(testUser?.birthday).toEqual({ month: 1, day: 1, year: 2000 })
  })

  it('指定された誕生日のユーザーを取得する', () => {
    // 異なる誕生日を持つテストユーザーを追加
    birthday.set('user1', { month: 1, day: 1, year: 2000 })
    birthday.set('user2', { month: 2, day: 2, year: 2001 })
    birthday.set('user3', { month: 3, day: 3, year: 2002 })

    // 指定された誕生日のユーザーを取得
    const users = birthday.get({ month: 1, day: 1 })

    // 正しいユーザーが返されるか確認
    expect(users.length).toBe(1)
    expect(users[0].discordId).toBe('user1')
    expect(users[0].birthday).toEqual({ month: 1, day: 1, year: 2000 })
  })

  it('指定されたユーザーの誕生日を取得する', () => {
    // テストユーザーを追加
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // テストユーザーの誕生日を取得
    const testUserBirthday = birthday.getByUser('testUser')

    // 正しい誕生日が返されるか確認
    expect(testUserBirthday).toBeDefined()
    expect(testUserBirthday?.birthday).toEqual({ month: 1, day: 1, year: 2000 })
  })

  it('指定されたユーザーの誕生日を設定する', () => {
    // テストユーザーの誕生日を設定
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // テストユーザーの誕生日を取得
    const testUserBirthday = birthday.getByUser('testUser')

    // 誕生日が正しく設定されているか確認
    expect(testUserBirthday).toBeDefined()
    expect(testUserBirthday?.birthday).toEqual({ month: 1, day: 1, year: 2000 })
  })

  it('指定されたユーザーの誕生日を異常な値で設定して例外が発生する', () => {
    // テストユーザーの誕生日を異常な値（13月32日）で設定
    // 「不正な日付」として例外が発生することを確認
    expect(() => {
      birthday.set('testUser', { month: 13, day: 32, year: 2000 })
    }).toThrow('不正な日付')
  })

  it('指定されたユーザーの誕生日を異常な値で設定して例外が発生する (その他)', () => {
    // テストユーザーを追加
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // 異常な値の誕生日を設定
    const ages = [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      -1,
    ]

    for (const age of ages) {
      // テストユーザーの強制年齢を異常な値で設定
      // 「不正な年齢」として例外が発生することを確認
      expect(() => {
        birthday.force('testUser', age)
      }).toThrow(TypeError)
    }
  })

  it('指定されたユーザーの年齢を強制する', () => {
    // テストユーザーの誕生日を設定
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // テストユーザーの年齢を強制する
    birthday.force('testUser', 30)

    // テストユーザーの誕生日を取得
    const testUserBirthday = birthday.getByUser('testUser')

    // 年齢が正しく強制されているか確認
    expect(testUserBirthday).toBeDefined()
    expect(testUserBirthday?.age).toBe(30)
  })

  it('指定されたユーザーの誕生日を削除する', () => {
    // テストユーザーを追加
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // テストユーザーの誕生日を削除
    birthday.delete('testUser')

    // テストユーザーの誕生日を取得
    const testUserBirthday = birthday.getByUser('testUser')

    // 誕生日が削除されているか確認
    expect(testUserBirthday).toBeUndefined()
  })

  it('指定された誕生日ユーザーの年齢を取得する (01/01)', () => {
    const date = { month: 1, day: 1, year: 2000 }
    // テストユーザーを追加
    birthday.set('testUser', date)

    // テストユーザーの年齢を取得
    const age = Birthday.getAge({
      discordId: 'testUser',
      birthday: date,
    })

    // 期待される年齢を計算
    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const isBirthdayPassed =
      todayMonth > date.month ||
      (todayMonth === date.month && today.getDate() >= date.day)
    const expectedAge = today.getFullYear() - 2000 - (isBirthdayPassed ? 0 : 1)

    // 正しい年齢が返されるか確認
    expect(age).toBe(expectedAge)
  })

  it('指定された誕生日ユーザーの年齢を取得する (実行日当日)', () => {
    const today = new Date()
    const date = {
      month: today.getMonth() + 1,
      day: today.getDate(),
      year: 2000,
    }
    // テストユーザーを追加
    birthday.set('testUser', date)

    // テストユーザーの年齢を取得
    const age = Birthday.getAge({
      discordId: 'testUser',
      birthday: date,
    })

    // 期待される年齢を計算
    const todayMonth = today.getMonth() + 1
    const isBirthdayPassed =
      todayMonth > date.month ||
      (todayMonth === date.month && today.getDate() >= date.day)

    const expectedAge = today.getFullYear() - 2000 - (isBirthdayPassed ? 0 : 1)

    // 正しい年齢が返されるか確認
    expect(age).toBe(expectedAge)
  })

  it('指定された誕生日ユーザーの年齢を取得する (12/31)', () => {
    const date = { month: 12, day: 31, year: 2000 }
    // テストユーザーを追加
    birthday.set('testUser', date)

    // テストユーザーの年齢を取得
    const age = Birthday.getAge({
      discordId: 'testUser',
      birthday: date,
    })

    // 期待される年齢を計算
    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const isBirthdayPassed =
      todayMonth > date.month ||
      (todayMonth === date.month && today.getDate() >= date.day)
    const expectedAge = today.getFullYear() - 2000 - (isBirthdayPassed ? 0 : 1)

    // 正しい年齢が返されるか確認
    expect(age).toBe(expectedAge)
  })

  it('年のない誕生日ユーザーの年齢はnullである', () => {
    // テストユーザーの年齢を取得
    const age = Birthday.getAge({
      discordId: 'testUser',
      birthday: { month: 1, day: 1, year: null },
    })

    // 年齢がnullであるか確認
    expect(age).toBeNull()
  })

  it('年ありの入力日付を正しく解析する', () => {
    const dates = [
      '2000-01-01',
      '2000-1-1',
      '2000/01/01',
      '2000/1/1',
      '2000.01.01',
      '2000.1.1',
      '2000年01月01日',
      '2000年1月1日',
      '20000101',
      '2000 01 01',
    ]

    const expectedDate = { month: 1, day: 1, year: 2000 }

    for (const date of dates) {
      // 年ありの入力日付を解析
      const parsedDate = Birthday.parseInputDate(date)

      // 日付が正しく解析されているか確認
      expect(parsedDate, date).toEqual(expectedDate)
    }
  })

  it('年なしの入力日付を正しく解析する', () => {
    const dates = [
      '01-01',
      '1-1',
      '01/01',
      '1/1',
      '01.01',
      '1.1',
      '0101',
      '01 01',
    ]

    const expectedDate = { month: 1, day: 1, year: null }

    for (const date of dates) {
      // 年なしの入力日付を解析
      const parsedDate = Birthday.parseInputDate(date)

      // 日付が正しく解析されているか確認
      expect(parsedDate, date).toEqual(expectedDate)
    }
  })

  it('不正な入力日付を解析するとnullが返される', () => {
    const dates = ['1', 'test', '0123456789', 'あ', '0x1']

    for (const date of dates) {
      // 不正な入力日付を解析
      const parsedDate = Birthday.parseInputDate(date)

      // nullが返されるか確認
      expect(parsedDate, date).toBeNull()
    }
  })

  it('年ありの誕生日を正しくフォーマットする', () => {
    // 年ありの誕生日をフォーマット
    const formattedBirthday = Birthday.format({ month: 1, day: 1, year: 2000 })

    // 誕生日が正しくフォーマットされているか確認
    expect(formattedBirthday).toBe('2000/01/01')
  })

  it('年なしの誕生日を正しくフォーマットする', () => {
    // 年なしの誕生日をフォーマット
    const formattedBirthday = Birthday.format({ month: 1, day: 1, year: null })

    // 誕生日が正しくフォーマットされているか確認
    expect(formattedBirthday).toBe('01/01')
  })

  it('指定された日付が正しいかどうかを判定する', () => {
    // 正しい日付を入力
    const validDate: IBirthdayDateWithYear = { month: 1, day: 1, year: 2000 }
    const isValid = Birthday.isValidDate(validDate)

    // 正しい日付であることを確認
    expect(isValid).toBe(true)
  })

  it('指定された日付が正しくない場合はfalseを返す', () => {
    // 不正な日付を入力
    const invalidDate: IBirthdayDateWithYear = {
      month: 13,
      day: 32,
      year: 2000,
    }
    const isValid = Birthday.isValidDate(invalidDate)

    // 不正な日付であることを確認
    expect(isValid).toBe(false)
  })
})
