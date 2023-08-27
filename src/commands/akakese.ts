import { Discord } from '@/discord'
import { Message } from 'discord.js'
import { BaseCommand, Permission } from '.'

export class AkakeseCommand implements BaseCommand {
  get name(): string {
    return 'akakese'
  }

  get permissions(): Permission[] | null {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(
    _discord: Discord,
    message: Message<boolean>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: string[]
  ): Promise<void> {
    await message.reply(
      'なンだおまえ!!!!帰れこのやろう!!!!!!!!人間の分際で!!!!!!!!寄るな触るな近づくな!!!!!!!!垢消せ!!!!垢消せ!!!!!!!! ┗(‘o’≡’o’)┛!!!!!!!!!!!!!!!! https://twitter.com/settings/accounts/confirm_deactivation https://media.discordapp.net/attachments/623153228267388958/1145366955218448404/akakese.gif'
    )
  }
}
