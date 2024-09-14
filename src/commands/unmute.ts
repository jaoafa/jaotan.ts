import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class UnmuteCommand implements BaseCommand {
  readonly name = 'unmute'
  readonly permissions = null

  async execute(_discord: Discord, message: Message<true>): Promise<void> {
    // サーバミュートを解除する
    const member = message.member
    if (!member) {
      await message.reply({
        embeds: [
          {
            title: 'エラー',
            description: 'メンバー情報を取得できませんでした。',
            color: 0xff_00_00,
          },
        ],
      })
      return
    }

    await member.voice.setMute(false)
    await message.reply({
      embeds: [
        {
          title: 'サーバミュート解除成功',
          description: 'あなたのサーバミュートを解除しました。',
          color: 0x00_ff_00,
        },
      ],
    })
  }
}
