import fs from 'node:fs'

export interface IBirthday {
  /** DiscordのユーザーID */
  discordId: string
  /** 誕生日 */
  birthday: Date
  /** 強制する年齢 */
  age?: number
}

export class Birthday {
  private birthdays: IBirthday[] = []

  constructor() {
    this.load()
  }

  public load() {
    const path = this.getPath()

    if (!fs.existsSync(path)) {
      return
    }

    const data = fs.readFileSync(path, 'utf8')
    const birthdays = JSON.parse(data) as IBirthday[]
    this.birthdays = birthdays.map((birthday) => ({
      ...birthday,
      birthday: new Date(birthday.birthday),
    }))
  }

  public get(date: Date): IBirthday[] {
    return this.birthdays.filter(
      (birthday) =>
        birthday.birthday.getMonth() === date.getMonth() &&
        birthday.birthday.getDate() === date.getDate()
    )
  }

  public static getAge(birthday: IBirthday): number {
    if (birthday.age) {
      return birthday.age
    }
    const today = new Date()
    const age = today.getFullYear() - birthday.birthday.getFullYear()
    if (
      birthday.birthday.getMonth() > today.getMonth() ||
      (birthday.birthday.getMonth() === today.getMonth() &&
        birthday.birthday.getDate() > today.getDate())
    ) {
      return age - 1
    }
    return age
  }

  private getPath() {
    const dataDir = process.env.DATA_DIR ?? 'data/'

    return `${dataDir}/birthday.json`
  }
}
