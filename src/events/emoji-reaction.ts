import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js'
import { BaseDiscordEvent } from '.'
import { EmojiInput, EmojiRanking } from '@/features/emoji-ranking'

/**
 * リアクションに使われた絵文字を、集計用の情報に変換する
 *
 * @param reaction リアクション
 * @returns 集計用の絵文字情報
 */
function toEmojiInput(reaction: MessageReaction): EmojiInput {
  const name = reaction.emoji.name ?? 'unknown'

  if (reaction.emoji.id) {
    const prefix = reaction.emoji.animated ? 'a' : ''
    return {
      kind: 'custom',
      key: `${name}:${reaction.emoji.id}`,
      display: `<${prefix}:${name}:${reaction.emoji.id}>`,
    }
  }

  return { kind: 'unicode', key: name, display: name }
}

/**
 * リアクション追加によって使われた絵文字を集計するイベントハンドラー
 */
export class EmojiReactionAddEvent extends BaseDiscordEvent<'messageReactionAdd'> {
  readonly eventName = 'messageReactionAdd'

  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    reaction = reaction.partial ? await reaction.fetch() : reaction
    user = user.partial ? await user.fetch() : user

    if (user.bot) return

    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message
    if (!message.inGuild()) return

    new EmojiRanking().addReaction(toEmojiInput(reaction))
  }
}

/**
 * リアクション取消によって使われなくなった絵文字を集計するイベントハンドラー
 */
export class EmojiReactionRemoveEvent extends BaseDiscordEvent<'messageReactionRemove'> {
  readonly eventName = 'messageReactionRemove'

  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    reaction = reaction.partial ? await reaction.fetch() : reaction
    user = user.partial ? await user.fetch() : user

    if (user.bot) return

    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message
    if (!message.inGuild()) return

    new EmojiRanking().removeReaction(toEmojiInput(reaction))
  }
}
