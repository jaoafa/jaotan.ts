import { Collection, Message, User } from 'discord.js'

/**
 * meeting_voteチャンネルの機能
 */
export class MeetingVote {
  // TODO: つくる
}

/**
 * 投票用リアクション
 */
class VoteReaction {
  public unicode: string

  constructor(unicode: string) {
    this.unicode = unicode
  }

  public async addReaction(message: Message): Promise<void> {
    await message.react(this.unicode)
  }

  public async getUsers(
    message: Message,
    botOnly = true
  ): Promise<Collection<string, User>> {
    const reactions = message.reactions.cache.find(
      (reaction) => reaction.emoji.name === this.unicode
    )
    if (!reactions) {
      return new Collection<string, User>()
    }
    const users = await reactions.users.fetch()
    return botOnly ? users.filter((user: User) => user.bot) : users
  }

  public async isReacted(message: Message, userId: string): Promise<boolean> {
    const users = await this.getUsers(message)
    return users.some((user: User) => user.id === userId)
  }
}

/**
 * 投票に利用するリアクション種別
 */
export const VoteReactionType = {
  Good: new VoteReaction('\uD83D\uDC4D'),
  Bad: new VoteReaction('\uD83D\uDC4E'),
  White: new VoteReaction('\uD83C\uDFF3'),
  Remind: new VoteReaction('\uD83D\uDCF3'),
} as const
