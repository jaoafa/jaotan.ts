import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class SuperCommand implements BaseCommand {
  get name(): string {
    return 'super'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(_discord: Discord, message: Message<boolean>): Promise<void> {
    await message.channel.send(
      'ｽｩ( ᐛ👐) パァwﾍｸｻｺﾞｫﾝwwﾋﾞｷﾞｨﾝwﾃﾚﾚﾚﾚﾚﾚﾚﾃﾚﾚﾚﾚﾚﾚﾚﾃﾚﾚﾚﾚﾚﾚﾚwwﾃﾚｯﾃﾚｯﾃﾚｯwwʅ(´-౪-)ʃﾃﾞ─ﾝwwｹﾞｪｪﾑｵｰｳﾞｧｰwwwʅ(◜◡‾)ʃ?'
    )
  }
}
