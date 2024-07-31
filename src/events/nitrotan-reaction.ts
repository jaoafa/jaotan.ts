import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js'
import { BaseDiscordEvent } from '.'
import {
  Nitrotan,
  NitrotanReason,
  NitrotanReasonType,
} from '@/features/nitrotan'

/**
 * Nitrotan判別で、メッセージ投稿に関するイベントのハンドラー
 */
export class NitrotanReactionEvent extends BaseDiscordEvent<'messageReactionAdd'> {
  readonly eventName = 'messageReactionAdd'

  // アニメーション絵文字をリアクションした
  // 他サーバーの絵文字をリアクションした
  // スーパーリアクションを使用した

  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    // 部分的なオブジェクトをフェッチ
    reaction = reaction.partial ? await reaction.fetch() : reaction
    user = user.partial ? await user.fetch() : user

    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message
    if (!message.guild) return

    const nitrotan = await Nitrotan.of(this.discord)
    if (nitrotan.isNitrotan(user.id)) return

    const reason = this.getNitrotanReason(reaction)
    if (!reason) return

    await nitrotan.add(user.id, reason)
  }

  /**
   * Nitroユーザーが取れる行動かどうか。かつどんな操作であるか
   */
  private getNitrotanReason(
    reaction: MessageReaction
  ): NitrotanReasonType | null {
    if (this.isAnimationEmojiReaction(reaction)) {
      return NitrotanReason.USE_ANIMATION_EMOJI_REACTION
    }
    if (this.isOtherServerEmojiReaction(reaction)) {
      return NitrotanReason.USE_OTHER_SERVER_EMOJI_REACTION
    }

    return null
  }

  /**
   * アニメーション絵文字を最初にリアクションしたか
   *
   * @param reaction リアクション
   * @returns アニメーション絵文字を最初にリアクションしたか
   */
  private isAnimationEmojiReaction(reaction: MessageReaction): boolean {
    if (reaction.count !== 1) return false

    return reaction.emoji.animated ?? false
  }

  /**
   * 他サーバーの絵文字を最初にリアクションしたか
   *
   * @param reaction リアクション
   * @returns 他サーバーの絵文字を最初にリアクションしたか
   */
  private isOtherServerEmojiReaction(reaction: MessageReaction): boolean {
    if (reaction.count !== 1) return false

    return (
      'guild' in reaction.emoji &&
      reaction.emoji.guild.id === reaction.message.guild?.id
    )
  }
}
