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

  public save() {
    const path = this.getPath()

    fs.writeFileSync(path, JSON.stringify(this.birthdays, null, 2), 'utf8')
  }

  public get(date: Date): IBirthday[] {
    return this.birthdays.filter(
      (birthday) =>
        birthday.birthday.getMonth() === date.getMonth() &&
        birthday.birthday.getDate() === date.getDate()
    )
  }

  public getByUser(discordId: string): IBirthday | undefined {
    return this.birthdays.find((birthday) => birthday.discordId === discordId)
  }

  public set(discordId: string, birthday: Date) {
    // 削除したうえで追加
    this.delete(discordId)
    this.birthdays.push({ discordId, birthday })
    this.save()
  }

  public force(discordId: string, age: number | undefined) {
    const index = this.birthdays.findIndex((b) => b.discordId === discordId)
    if (index >= 0) {
      this.birthdays[index].age = age
    } else {
      this.birthdays.push({ discordId, birthday: new Date(), age })
    }
    this.save()
  }

  public delete(discordId: string) {
    // 複数ある場合はすべて削除
    this.birthdays = this.birthdays.filter(
      (birthday) => birthday.discordId !== discordId
    )
    this.save()
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
