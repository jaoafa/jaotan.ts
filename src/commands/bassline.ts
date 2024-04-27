import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class BasslineCommand implements BaseCommand {
  readonly name = 'bassline'
  readonly permissions = null

  getBasslineText(text = '221498004505362433'): string {
    const suspectName = /^\d+$/.test(text) ? `<@${text}>` : text
    return [
      'ベースラインパーティーの途中ですが、ここで臨時ニュースをお伝えします。今日昼頃、わりとキモく女性にナンパをしたうえ、路上で爆睡をしたとして、',
      '道の上で寝たり、女の子に声をかけたりしたらいけないんだよ罪の容疑で、',
      `自称優良物件、${suspectName} 容疑者が逮捕されました。`,
    ].join('\n')
  }

  async execute(
    _discord: Discord,
    message: Message,
    args: string[]
  ): Promise<void> {
    await message.channel.send(
      args.length > 0
        ? this.getBasslineText(args.join(' '))
        : this.getBasslineText()
    )
  }
}
