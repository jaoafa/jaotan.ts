import { tmpdir } from 'node:os'
import { Birthday, IBirthdayDateWithYear } from './birthday'

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

  it('指定された誕生日ユーザーの年齢を取得する', () => {
    // 知られた年齢を持つテストユーザーを追加
    birthday.set('testUser', { month: 1, day: 1, year: 2000 })

    // テストユーザーの年齢を取得
    const age = Birthday.getAge({
      discordId: 'testUser',
      birthday: { month: 1, day: 1, year: 2000 },
    })

    // 期待される年齢を計算
    const today = new Date()
    const expectedAge = today.getFullYear() - 2000 - 1

    // 正しい年齢が返されるか確認
    expect(age).toBe(expectedAge)
  })

  it('年のない誕生日ユーザーの年齢はnullである', () => {
    // 年のないテストユーザーを追加
    birthday.set('testUser', { month: 1, day: 1, year: 0 })

    // テストユーザーの年齢を取得
    const age = Birthday.getAge({
      discordId: 'testUser',
      birthday: { month: 1, day: 1, year: 0 },
    })

    // 年齢がnullであるか確認
    expect(age).toBeNull()
  })

  it('年ありの入力日付を正しく解析する', () => {
    // 年ありの入力日付を解析
    const parsedDate = Birthday.parseInputDate('2000-01-01')

    // 日付が正しく解析されているか確認
    expect(parsedDate).toEqual({ month: 1, day: 1, year: 2000 })
  })

  it('年なしの入力日付を正しく解析する', () => {
    // 年なしの入力日付を解析
    const parsedDate = Birthday.parseInputDate('01-01')

    // 日付が正しく解析されているか確認
    expect(parsedDate).toEqual({ month: 1, day: 1, year: 0 })
  })

  it('年ありの誕生日を正しくフォーマットする', () => {
    // 年ありの誕生日をフォーマット
    const formattedBirthday = Birthday.format({ month: 1, day: 1, year: 2000 })

    // 誕生日が正しくフォーマットされているか確認
    expect(formattedBirthday).toBe('2000/01/01')
  })

  it('年なしの誕生日を正しくフォーマットする', () => {
    // 年なしの誕生日をフォーマット
    const formattedBirthday = Birthday.format({ month: 1, day: 1, year: 0 })

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
