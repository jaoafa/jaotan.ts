import { GuildPremiumTier, Message } from 'discord.js'
import { BaseDiscordEvent } from '.'
import {
  Nitrotan,
  NitrotanReason,
  NitrotanReasonType,
} from '@/features/nitrotan'

/**
 * Nitrotan判別で、メッセージ投稿に関するイベントのハンドラー
 */
export class NitrotanMessageEvent extends BaseDiscordEvent<'messageCreate'> {
  readonly eventName = 'messageCreate'

  private emojiRegex = /<(?<animated>a?):(?<name>\w+):(?<id>\d+)>/g

  async execute(message: Message): Promise<void> {
    if (!message.guild) return

    const userId = message.author.id

    const nitrotan = await Nitrotan.of(this.discord)
    if (nitrotan.isNitrotan(userId)) {
      nitrotan.check(userId)
      return
    }

    const reason = this.getNitrotanReason(message)
    if (!reason) return

    await nitrotan.add(userId, reason)
  }

  /**
   * Nitroユーザーが取れる行動かどうか。かつどんな操作であるか
   */
  private getNitrotanReason(message: Message): NitrotanReasonType | null {
    if (this.isAnimationEmojiMessage(message)) {
      return NitrotanReason.USE_ANIMATION_EMOJI_MESSAGE
    }
    if (this.isOtherServerEmojiMessage(message)) {
      return NitrotanReason.USE_OTHER_SERVER_EMOJI_MESSAGE
    }
    if (this.isCustomStickerMessage(message)) {
      return NitrotanReason.USE_OTHER_SERVER_STICKER
    }
    if (this.isOverBoostFileMessage(message)) {
      return NitrotanReason.SEND_LARGE_FILE
    }
    if (this.isOver2000CharactersMessage(message)) {
      return NitrotanReason.SEND_LARGE_MESSAGE
    }

    return null
  }

  /**
   * アニメーション絵文字を使用したメッセージを送信したか
   *
   * @param message メッセージ
   * @returns アニメーション絵文字を使用したメッセージを送信したか
   */
  private isAnimationEmojiMessage(message: Message): boolean {
    const matches = message.content.matchAll(this.emojiRegex)

    return [...matches].some((match) => match.groups?.animated === 'a')
  }

  /**
   * 他サーバーの絵文字を使用したメッセージを送信したか
   *
   * @param message メッセージ
   * @returns 他サーバーの絵文字を使用したメッセージを送信したか
   */
  private isOtherServerEmojiMessage(message: Message): boolean {
    const matches = message.content.matchAll(this.emojiRegex)

    const guildEmojis = message.guild?.emojis.cache ?? new Map<string, string>()

    return [...matches].some((match) => {
      const emojiId = match.groups?.id
      if (!emojiId) return false
      return !guildEmojis.has(emojiId)
    })
  }

  /**
   * サーバにないカスタムスタンプを使用したか
   *
   * @param message メッセージ
   * @returns サーバにないカスタムスタンプを使用したか
   */
  private isCustomStickerMessage(message: Message): boolean {
    const stickers = message.stickers

    const guildStickers =
      message.guild?.stickers.cache ?? new Map<string, string>()

    return stickers.some((sticker) => {
      const stickerId = sticker.id
      if (!stickerId) return false
      return !guildStickers.has(stickerId)
    })
  }

  /**
   * ブーストによる上限値より大きなファイルを送信したか
   *
   * @param message メッセージ
   * @returns ブーストによる上限値より大きなファイルを送信したか
   */
  private isOverBoostFileMessage(message: Message): boolean {
    const premiumTier = message.guild?.premiumTier ?? 0

    const maxFileSize = (() => {
      switch (premiumTier) {
        case GuildPremiumTier.Tier2: {
          return 50
        } // ブーストLv2
        case GuildPremiumTier.Tier3: {
          return 100
        } // ブーストLv3
        default: {
          return 25
        } // 通常、またはブーストLv1
      }
    })()

    return message.attachments.some(
      (attachment) => attachment.size > maxFileSize * 1024 * 1024
    )
  }

  /**
   * 2000文字より多い文章を投稿したか
   *
   * @param message メッセージ
   * @returns 2000文字より多い文章を投稿したか
   */
  private isOver2000CharactersMessage(message: Message): boolean {
    return message.content.length > 2000
  }
}
