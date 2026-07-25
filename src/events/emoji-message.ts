import { Message } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { EmojiRanking, extractMessageEmojis } from '@/features/emoji-ranking'

/**
 * メッセージ投稿に使われた絵文字を集計するイベントハンドラー
 */
export class EmojiMessageEvent extends BaseDiscordEvent<'messageCreate'> {
  readonly eventName = 'messageCreate'

  execute(message: Message): Promise<void> {
    if (message.author.bot) return Promise.resolve()
    if (!message.inGuild()) return Promise.resolve()

    const emojis = extractMessageEmojis(message.content)
    if (emojis.length > 0) {
      new EmojiRanking().addMessageEmojis(emojis)
    }

    return Promise.resolve()
  }
}
