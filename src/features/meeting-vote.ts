import { Collection, Message, TextChannel, User } from 'discord.js'

/**
 * 否認理由
 */
const DisapprovalReason = {
  /**
   * 投票による否認
   */
  Vote: '投票による否認',
  /**
   * 期限による否認
   */
  Limit: '期限による否認',
} as const

/**
 * meeting_voteチャンネルの機能
 */
export class MeetingVote {
  /** 投票権利を有するメンバー */
  private readonly memberIds = [
        "206692134991036416", // zakuro
        "221498004505362433", // hiratake
        "221991565567066112", // tomachi
        "222337959087702016", // omelet
        "492088741167366144" // yuua
  ]

  /** メッセージテキストの境界値正規表現 */
  private readonly borderRegex = /\[Border:(\d+)]/

  /** 投票チャンネル */
  private readonly channel: TextChannel

  /**
   * コンストラクタ
   * 
   * @param channel 投票チャンネル
   */
  constructor(channel: TextChannel) {
    this.channel = channel
  }

  /**
   * 新しい投票メッセージを処理します。
   * 
   * @param message メッセージ
   */
  public async newVoteMessage(message: Message) {
    if (message.channel.id !== this.channel.id) {
      throw new Error('This message is not in the vote channel.')
    }
    // TODO
  }

  /**
   * ピン留めされているすべての投票メッセージをチェック処理します。
   */
  public async run() {
    const pinnedMessages = await this.channel.messages.fetchPinned()
    for (const message of pinnedMessages.values()) {
      await this.runMessage(message)
    }
  }

  /**
   * 投票メッセージをチェック処理します。
   * 
   * @param message メッセージ
   */
  public async runMessage(message: Message) {
    if (message.channel.id !== this.channel.id) {
      throw new Error('This message is not in the vote channel.')
    }
    const goodUsers = await VoteReactionType.Good.getUsers(message)
    const badUsers = await VoteReactionType.Bad.getUsers(message)
    const whiteUsers = await VoteReactionType.White.getUsers(message)

    const border = this.calculateBorder(message, whiteUsers)
    if(goodUsers.size >= border) {
      await this.approval(message, goodUsers, badUsers, whiteUsers)
      return
    } else if (badUsers.size >= border) {
      await this.disapproval(message, goodUsers, badUsers, whiteUsers, DisapprovalReason.Vote)
      return
    }

    // 投票開始から2週間が経過していて、それまでに確定しなかった場合、投票を締め切り否認とする
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    
    if (message.createdAt < twoWeeksAgo) {
      await this.disapproval(message, goodUsers, badUsers, whiteUsers, DisapprovalReason.Limit)
      return
    }

    // 投票開始から1週間が経過していて、リマインド済みでない場合、リマインドする
    // リマインドした場合、Bot自身がリアクションをつける
    const reminded = await VoteReactionType.Remind.isReacted(message, message.client.user.id)
    if (!reminded) {
      await this.remind(message, goodUsers, badUsers, whiteUsers)
    }
  }

  /**
   * 投票メッセージを承認します。
   * 
   * @param message メッセージ
   * @param goodUsers 賛成票を投票したユーザーのコレクション
   * @param badUsers 反対票を投票したユーザーのコレクション
   * @param whiteUsers 白票を投票したユーザーのコレクション
   */
  private async approval(
    message: Message,
    goodUsers: Collection<string, User>,
    badUsers: Collection<string, User>,
    whiteUsers: Collection<string, User>
  ) {
    // TODO
  }

  /**
   * 投票メッセージを否認します。
   * 
   * @param message メッセージ
   * @param goodUsers 賛成票を投票したユーザーのコレクション
   * @param badUsers 反対票を投票したユーザーのコレクション
   * @param whiteUsers 白票を投票したユーザーのコレクション
   * @param reason 否認理由
   */
  private async disapproval(
    message: Message,
    goodUsers: Collection<string, User>,
    badUsers: Collection<string, User>,
    whiteUsers: Collection<string, User>,
    reason: (typeof DisapprovalReason)[keyof typeof DisapprovalReason]
  ) {
    // TODO
  }

  /**
   * 投票メッセージをリマインドします。
   * 
   * @param message メッセージ
   * @param goodUsers 賛成票を投票したユーザーのコレクション
   * @param badUsers 反対票を投票したユーザーのコレクション
   * @param whiteUsers 白票を投票したユーザーのコレクション
   */
  private async remind(
    message: Message,
    goodUsers: Collection<string, User>,
    badUsers: Collection<string, User>,
    whiteUsers: Collection<string, User>
  ) {
    // TODO
  }

  /**
   * 承認・否認が確定する境界値を計算します。
   * 
   * 投票権利を有するユーザー数の半数以上が承認した場合、確定します。
   * 但し、白票は投票権利を有するユーザー数に含まれません。
   * 
   * @param message メッセージ
   * @param whiteUsers 白票を投票したユーザーのコレクション
   */
  private calculateBorder(message: Message, whiteUsers: Collection<string, User>) {
    const match = message.content.match(this.borderRegex)
    if (match && match.length > 1) {
      return Number.parseInt(match[1])
    }

    const whiteCount = whiteUsers.size
    const totalCount = this.memberIds.length

    return ((totalCount - whiteCount) / 2) + 1
  }
}

/**
 * 投票用リアクション
 */
class VoteReaction {
  public unicode: string

  /**
   * コンストラクタ
   * 
   * @param unicode リアクションのUnicode
   */
  constructor(unicode: string) {
    this.unicode = unicode
  }

  /**
   * メッセージにリアクションを付与します。
   * 
   * @param message メッセージ
   */
  public async addReaction(message: Message): Promise<void> {
    await message.react(this.unicode)
  }

  /**
   * 指定したメッセージでこのリアクションをつけたユーザーを取得します。
   * 
   * @param message メッセージ
   * @param excludeBot Botを除外するかどうか
   * @returns ユーザーのコレクション
   */
  public async getUsers(
    message: Message,
    excludeBot = false
  ): Promise<Collection<string, User>> {
    const reactions = message.reactions.cache.find(
      (reaction) => reaction.emoji.name === this.unicode
    )
    if (!reactions) {
      return new Collection<string, User>()
    }
    const users = await reactions.users.fetch()
    return excludeBot ? users.filter((user: User) => !user.bot) : users
  }

  /**
   * ユーザーが指定したメッセージにこのリアクションをつけているかどうかを取得します。
   * 
   * @param message メッセージ
   * @param userId ユーザーID
   * @returns リアクションをつけているかどうか
   */
  public async isReacted(message: Message, userId: string): Promise<boolean> {
    const users = await this.getUsers(message)
    return users.some((user: User) => user.id === userId)
  }
}

/**
 * 投票に利用するリアクション種別
 */
export const VoteReactionType = {
  /**
   * 賛成
   */
  Good: new VoteReaction('\uD83D\uDC4D'),
  /**
   * 反対
   */
  Bad: new VoteReaction('\uD83D\uDC4E'),
  /**
   * 白票
   */
  White: new VoteReaction('\uD83C\uDFF3'),
  /**
   * リマインド済み
   */
  Remind: new VoteReaction('\uD83D\uDCF3'),
} as const