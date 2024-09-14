import { Discord } from '@/discord'
import { EmbedBuilder, Message } from 'discord.js'
import { BaseCommand } from '.'
import { Birthday } from '@/features/birthday'

export class BirthdayCommand implements BaseCommand {
  readonly name = 'birthday'

  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    // birthday: 設定されている誕生日を表示
    // birthday set 2000-01-01: 誕生日を設定
    // birthday force 20: 強制する年齢を設定
    // birthday delete: 誕生日を削除
    // それ以外: ヘルプを表示

    if (args.length === 0) {
      await this.executeGet(discord, message)
      return
    }

    const subCommand = args[0]
    switch (subCommand) {
      case 'set': {
        await this.executeSet(discord, message, args.slice(1))
        break
      }
      case 'force': {
        await this.executeForce(discord, message, args.slice(1))
        break
      }
      case 'delete': {
        await this.executeDelete(discord, message)
        break
      }
      default: {
        await this.executeHelp(discord, message)
        break
      }
    }
  }

  async executeGet(_discord: Discord, message: Message<true>): Promise<void> {
    const birthday = new Birthday()

    const userBirthday = birthday.getByUser(message.author.id)
    if (!userBirthday) {
      const embed = this.createEmbed(
        'error',
        '誕生日未設定',
        new EmbedBuilder().setDescription(
          '誕生日を設定するには `/birthday set 2000-01-01` のように入力してください'
        )
      )
      await message.channel.send({ embeds: [embed] })
      return
    }

    const embed = this.createEmbed(
      'info',
      '誕生日設定',
      new EmbedBuilder()
        .addFields([
          {
            name: '誕生日',
            value: Birthday.format(userBirthday.birthday),
            inline: true,
          },
          {
            name: '強制する年齢',
            value: userBirthday.age?.toString() ?? '未設定',
            inline: true,
          },
        ])
        .setFooter({
          text: '誕生日を設定するには /birthday set 2000-01-01 のように、強制する年齢を設定するには /birthday force 20 のように、誕生日を削除するには /birthday delete のように実行してください',
        })
    )
    await message.channel.send({ embeds: [embed] })
  }

  async executeSet(
    _discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    // birthday set 2000-01-01
    const inputDate = Birthday.parseInputDate(args.join(' '))

    if (!inputDate) {
      const embed = this.createEmbed(
        'error',
        '誕生日設定に失敗',
        new EmbedBuilder()
          .setDescription('誕生日を解析できませんでした')
          .setFooter({
            text: '誕生日を設定するには `/birthday set 2000-01-01` のように入力してください',
          })
      )
      await message.channel.send({ embeds: [embed] })
      return
    }

    if (!Birthday.isValidDate(inputDate)) {
      const embed = this.createEmbed(
        'error',
        '誕生日設定に失敗',
        new EmbedBuilder()
          .setDescription('入力された日付が不正です')
          .setFooter({
            text: '誕生日を設定するには `/birthday set 2000-01-01` のように入力してください',
          })
      )
      await message.channel.send({ embeds: [embed] })
      return
    }

    const birthday = new Birthday()
    birthday.set(message.author.id, inputDate)

    const embed = this.createEmbed(
      'success',
      '誕生日設定に成功',
      new EmbedBuilder()
        .setDescription(
          `誕生日を ${Birthday.format(
            inputDate
          )} に設定しました。\n強制する年齢を登録していた場合はリセットされていますので、再設定ください。`
        )
        .setFooter({
          text: '強制する年齢を設定するには /birthday force 20 のように、誕生日を削除するには /birthday delete のように実行してください',
        })
    )
    await message.channel.send({ embeds: [embed] })
  }

  async executeForce(
    _discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    // birthday force 20

    const age = Number.parseInt(args[0])
    if (!age) {
      const embed = this.createEmbed(
        'error',
        '強制する年齢の設定に失敗',
        new EmbedBuilder().setDescription(
          '強制する年齢を設定するには `/birthday force 20` のように入力してください'
        )
      )
      await message.channel.send({ embeds: [embed] })
      return
    }
    if (Number.isNaN(age) || Number.isFinite(age) || age < 0) {
      const embed = this.createEmbed(
        'error',
        '強制する年齢の設定に失敗',
        new EmbedBuilder().setDescription('年齢は正の整数で指定してください')
      )
      await message.channel.send({ embeds: [embed] })
      return
    }

    const birthday = new Birthday()
    if (!birthday.getByUser(message.author.id)) {
      const embed = this.createEmbed(
        'error',
        '強制する年齢の設定に失敗',
        new EmbedBuilder().setDescription(
          '誕生日が設定されていません。誕生日を設定するには `/birthday set 2000-01-01` のように入力してください'
        )
      )
      await message.channel.send({ embeds: [embed] })
      return
    }

    birthday.force(message.author.id, age)

    const embed = this.createEmbed(
      'success',
      '強制する年齢の設定に成功',
      new EmbedBuilder()
        .setDescription(`強制する年齢を ${age} に設定しました。`)
        .setFooter({
          text: '誕生日を設定するには /birthday set 2000-01-01 のように、誕生日を削除するには /birthday delete のように実行してください',
        })
    )
    await message.channel.send({ embeds: [embed] })
  }

  async executeDelete(
    _discord: Discord,
    message: Message<true>
  ): Promise<void> {
    // birthday delete

    const birthday = new Birthday()
    birthday.delete(message.author.id)

    const embed = this.createEmbed(
      'success',
      '誕生日削除に成功',
      new EmbedBuilder().setDescription(`誕生日を削除しました。`)
    )
    await message.channel.send({ embeds: [embed] })
  }

  async executeHelp(_discord: Discord, message: Message<true>): Promise<void> {
    const embed = this.createEmbed(
      'info',
      '誕生日コマンドヘルプ',
      new EmbedBuilder().addFields([
        {
          name: '/birthday',
          value: '誕生日を設定しているか確認します',
        },
        {
          name: '/birthday set 2000-01-01',
          value: '誕生日を設定します。月・日のみで指定することもできます',
        },
        {
          name: '/birthday force 20',
          value: '強制する年齢を設定します',
        },
        {
          name: '/birthday delete',
          value: '誕生日を削除します',
        },
      ])
    )
    await message.channel.send({ embeds: [embed] })
  }

  createEmbed(
    embedType: 'success' | 'error' | 'info',
    title: string | null,
    builder: EmbedBuilder
  ): EmbedBuilder {
    const emojiMap = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
    }
    const emoji = emojiMap[embedType]

    const colorMap = {
      success: 0x00_ff_00, // green
      error: 0xff_00_00, // red
      info: 0x00_00_ff, // blue
    }
    const color = colorMap[embedType]

    return builder.setTitle(title ? `${emoji} ${title}` : null).setColor(color)
  }
}
