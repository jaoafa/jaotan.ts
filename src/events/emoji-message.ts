import { Message } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { EmojiRanking, extractMessageEmojis } from '@/features/emoji-ranking'

/**
 * メッセージ投稿に使われた絵文字を集計するイベントハンドラー
 */
export class EmojiMessageEvent extends BaseDiscordEvent<'messageCreate'> {
  readonly eventName = 'messageCreate'

  async execute(message: Message): Promise<void> {
    if (message.author.bot) return
    if (!message.inGuild()) return

    const emojis = extractMessageEmojis(message.content)
    if (emojis.length === 0) return

    new EmojiRanking().addMessageEmojis(emojis)
  }
}
