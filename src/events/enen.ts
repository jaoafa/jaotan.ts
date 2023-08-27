import { Message } from 'discord.js'
import { BaseDiscordEvent } from '.'

export class EnenEvent extends BaseDiscordEvent<'messageCreate'> {
  get eventName(): 'messageCreate' {
    return 'messageCreate'
  }

  async execute(message: Message<boolean>): Promise<void> {
    if (message.content.includes('えんえん')) {
      await message.react('🥲')
    }
  }
}
