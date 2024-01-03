import fs from 'node:fs'

/**
 * 誕生日インターフェース（月と日のみ）
 */
export interface IBirthdayDate {
  /** 月 */
  month: number
  /** 日 */
  day: number
}

/**
 * 誕生日インターフェース（年と月と日）
 */
export type IBirthdayDateWithYear = IBirthdayDate & {
  /** 年 */
  year: number
}

/**
 * ユーザーの誕生日インターフェース
 */
export interface IBirthday {
  /** DiscordのユーザーID */
  discordId: string
  /** 誕生日 */
  birthday: IBirthdayDateWithYear
  /** 強制する年齢 */
  age?: number
}

/**
 * 誕生日クラス
 */
export class Birthday {
  private birthdays: IBirthday[] = []

  /**
   * コンストラクタ
   *
   * ファイルから誕生日データを読み込む
   */
  constructor() {
    this.load()
  }

  /**
   * ファイルから誕生日データを読み込む
   *
   * - ファイルパスは {@link getPath} で取得する
   * - ファイルが存在しない場合は何もしない
   */
  public load() {
    const path = this.getPath()

    if (!fs.existsSync(path)) {
      return
    }

    const data = fs.readFileSync(path, 'utf8')
    const birthdays = JSON.parse(data) as IBirthday[]
    this.birthdays = birthdays
  }

  /**
   * ファイルに誕生日データを保存する
   *
   * - ファイルパスは {@link getPath} で取得する
   */
  public save() {
    const path = this.getPath()

    fs.writeFileSync(path, JSON.stringify(this.birthdays, null, 2), 'utf8')
  }

  /**
   * 指定した日付が誕生日のユーザーを取得する
   *
   * @param date 誕生日
   * @returns 誕生日のユーザーの配列
   */
  public get(date: IBirthdayDate): IBirthday[] {
    return this.birthdays.filter(
      (birthday) =>
        birthday.birthday.month === date.month &&
        birthday.birthday.day === date.day
    )
  }

  /**
   * 指定したユーザーの誕生日を取得する
   *
   * @param discordId DiscordのユーザーID
   * @returns 誕生日。見つからない場合は undefined
   */
  public getByUser(discordId: string): IBirthday | undefined {
    return this.birthdays.find((birthday) => birthday.discordId === discordId)
  }

  /**
   * 指定したユーザーの誕生日を設定する
   *
   * - すでに設定されている場合は上書きする
   * - 誕生日が不正な場合は例外を発生する
   *
   * @param discordId DiscordのユーザーID
   * @param birthday 誕生日
   */
  public set(discordId: string, birthday: IBirthdayDateWithYear) {
    if (!Birthday.isValidDate(birthday)) {
      throw new Error('不正な日付')
    }
    // 削除したうえで追加
    this.delete(discordId)
    this.birthdays.push({ discordId, birthday })
    this.save()
  }

  /**
   * 強制する年齢を設定する
   *
   * - ユーザーの誕生年にかかわらず、毎年同じ年齢になる
   * - すでに設定されている場合は上書きする
   *
   * @param discordId DiscordのユーザーID
   * @param age 強制する年齢
   */
  public force(discordId: string, age: number | undefined) {
    const index = this.birthdays.findIndex((b) => b.discordId === discordId)
    if (index === -1) {
      throw new Error('Failed to find birthday')
    }
    this.birthdays[index].age = age

    this.save()
  }

  /**
   * 指定したユーザーの誕生日を削除する
   *
   * @param discordId DiscordのユーザーID
   */
  public delete(discordId: string) {
    // 複数ある場合はすべて削除
    this.birthdays = this.birthdays.filter(
      (birthday) => birthday.discordId !== discordId
    )
    this.save()
  }

  /**
   * 指定した誕生日ユーザーの年齢を取得する
   *
   * @param birthday 誕生日ユーザー
   * @returns 年齢。年齢が強制されている場合は強制された年齢を返す。年齢が強制されていない場合は誕生日から計算した年齢を返す。誕生日が設定されていない場合は null を返す
   */
  public static getAge(birthday: IBirthday): number | null {
    if (birthday.age) {
      return birthday.age
    }
    if (!birthday.birthday.year) {
      return null
    }
    const today = new Date()
    const age = today.getFullYear() - birthday.birthday.year
    if (
      today.getMonth() < birthday.birthday.month ||
      (today.getMonth() === birthday.birthday.month &&
        today.getDate() < birthday.birthday.day)
    ) {
      return age - 1
    }
    return age
  }

  /**
   * 誕生日データのファイルパスを取得する
   *
   * - 環境変数 DATA_DIR が設定されている場合はそのディレクトリを使用する
   * - 環境変数 DATA_DIR が設定されていない場合は data/ ディレクトリを使用する
   * - ファイル名は birthday.json とする
   *
   * @returns ファイルパス
   */
  private getPath() {
    const dataDir = process.env.DATA_DIR ?? 'data/'

    return `${dataDir}/birthday.json`
  }

  /**
   * 入力された文字列から誕生日を取得する
   *
   * - 年付きと年なしの両方に対応
   * - 年付きの場合は年月日を、年なしの場合は月日を返す
   * - 年付きの場合は年月日がすべて取得できないと null を返す
   * - 年なしの場合は月日がすべて取得できないと null を返す
   *
   * @param input 入力された文字列
   * @returns 誕生日。取得できない場合は null
   */
  public static parseInputDate(input: string): IBirthdayDateWithYear | null {
    // 年付き
    // 2000-01-01
    // 2000/01/01
    // 2000.01.01
    // 2000年01月01日
    // 20000101

    // 年なし
    // 01-01
    // 01/01
    // 01.01
    // 01月01日
    // 0101

    const patternsWithYear = [
      /(?<year>\d{4})[./年-](?<month>\d{1,2})[./月-](?<day>\d{1,2})日?/,
      /(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})/,
      /(?<year>\d{4}) (?<month>\d{1,2}) (?<day>\d{1,2})/,
    ]

    const patternsWithoutYear = [
      /(?<month>\d{1,2})[./月-](?<day>\d{1,2})日?/,
      /(?<month>\d{2})(?<day>\d{2})/,
      /(?<month>\d{1,2}) (?<day>\d{1,2})/,
    ]

    for (const pattern of patternsWithYear) {
      const match = input.match(pattern)
      if (match) {
        const month = Number.parseInt(match.groups?.month ?? '')
        const day = Number.parseInt(match.groups?.day ?? '')

        if (month && day) {
          const year = Number.parseInt(match.groups?.year ?? '')
          return { month, day, year }
        }
      }
    }

    for (const pattern of patternsWithoutYear) {
      const match = input.match(pattern)
      if (match) {
        const month = Number.parseInt(match.groups?.month ?? '')
        const day = Number.parseInt(match.groups?.day ?? '')
        if (month && day) {
          return { month, day, year: 0 }
        }
      }
    }

    return null
  }

  /**
   * 誕生日を文字列に変換する
   *
   * - 年付きの場合は年月日を、年なしの場合は月日を返す
   *
   * @param birthday 誕生日
   * @returns 誕生日を表す文字列
   */
  public static format(birthday: IBirthdayDateWithYear): string {
    const month = this.getZeroPadding(birthday.month)
    const day = this.getZeroPadding(birthday.day)
    if (birthday.year) {
      return `${birthday.year}/${month}/${day}`
    }
    return `${month}/${day}`
  }

  /**
   * 日付が正しいかどうかを判定する
   *
   * @param date 日付
   * @returns 正しい場合は true、正しくない場合は false
   */
  public static isValidDate(date: IBirthdayDateWithYear): boolean {
    const month = date.month
    const day = date.day
    const year = date.year

    // 月は1〜12であること
    if (month < 1 || month > 12) {
      return false
    }

    // 日は1〜31であること
    if (day < 1 || day > 31) {
      return false
    }

    // 年は0以上であること
    if (year < 0) {
      return false
    }

    // 2月は閏年を考慮して28日または29日であること
    if (month === 2) {
      if (year % 4 === 0) {
        if (day > 29) {
          return false
        }
      } else {
        if (day > 28) {
          return false
        }
      }
    }

    // 4, 6, 9, 11月は30日であること
    if ([4, 6, 9, 11].includes(month) && day > 30) {
      return false
    }

    // すべてのチェックを通過したら正しい日付である
    return true
  }

  /**
   * 数値を2桁の0埋めした文字列に変換する
   *
   * @param num 数値
   * @returns 2桁の0埋めした文字列
   */
  private static getZeroPadding(num: number): string {
    return num.toString().padStart(2, '0')
  }
}
