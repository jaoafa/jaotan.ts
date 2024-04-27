import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand } from '.'

export class SuperCommand implements BaseCommand {
  readonly name = 'super'
  readonly permissions = null

  async execute(_discord: Discord, message: Message): Promise<void> {
    await message.channel.send(
      'ｽｩ( ᐛ👐) パァwﾍｸｻｺﾞｫﾝwwﾋﾞｷﾞｨﾝwﾃﾚﾚﾚﾚﾚﾚﾚﾃﾚﾚﾚﾚﾚﾚﾚﾃﾚﾚﾚﾚﾚﾚﾚwwﾃﾚｯﾃﾚｯﾃﾚｯwwʅ(´-౪-)ʃﾃﾞ─ﾝwwｹﾞｪｪﾑｵｰｳﾞｧｰwwwʅ(◜◡‾)ʃ?'
    )
  }
}
