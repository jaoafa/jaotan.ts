import {
  Collection,
  Colors,
  EmbedBuilder,
  Message,
  MessageFlags,
  MessageType,
  TextChannel,
  User,
} from 'discord.js'

/**
 * 否認理由
 */
const DisapprovalReason = {
  /**
   * 反対投票による否認
   */
  Vote: '反対投票による否認',
  /**
   * 白票投票による否認
   */
  VoteWhite: '白票投票による否認',
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
    '206692134991036416', // zakuro
    '221498004505362433', // hiratake
    '221991565567066112', // tomachi
    '222337959087702016', // omelet
    '492088741167366144', // yuua
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
    if (message.type !== MessageType.Default) {
      throw new Error('This message is not default type.')
    }
    if (message.author.bot) {
      throw new Error('This message is bot message.')
    }
    if (message.pinned) {
      throw new Error('This message is pinned.')
    }

    await message.pin()

    await VoteReactionType.Good.addReaction(message)
    await VoteReactionType.Bad.addReaction(message)
    await VoteReactionType.White.addReaction(message)

    const voteEndDateTime = this.getVoteEndDateTime(message)

    const embed = new EmbedBuilder()
      .setTitle(':new: 新しい投票')
      .setDescription(`<@${message.author.id}> からの新しい審議投票です。`)
      .addFields(
        {
          name: '賛成の場合',
          value:
            '**投票メッセージに対して**:thumbsup:リアクションを付けてください。',
          inline: false,
        },
        {
          name: '反対の場合',
          value:
            '**投票メッセージに対して**:thumbsdown:リアクションを付けてください。\n' +
            '反対の場合は意見理由を必ず書いてください。',
          inline: false,
        },
        {
          name: '白票の場合',
          value:
            '**投票メッセージに対して**:flag_white:リアクションを付けてください。\n' +
            '(白票の場合投票権利を放棄し他の人に投票を委ねます)',
        },
        {
          name: '有効審議期限',
          value: `投票の有効会議期限は2週間(${this.formatDateTime(
            voteEndDateTime
          )}まで)です。`,
          inline: false,
        },
        {
          name: '決議ボーダー',
          value: `この投票の決議ボーダーは ${this.calculateBorder(
            message
          )} です。`,
          inline: false,
        }
      )
      .setColor(Colors.Yellow)
      .setTimestamp(new Date())

    this.channel.send({
      embeds: [embed],
      reply: {
        messageReference: message,
        failIfNotExists: false,
      },
      flags: MessageFlags.SuppressNotifications,
    })
  }

  /**
   * 複数のリアクション投票（賛成・反対・白票）をしていないかどうかを取得します。
   *
   * @param message
   * @param user
   */
  public async isMultipleVote(message: Message, user: User) {
    const goodUsers = await VoteReactionType.Good.getUsers(message, true)
    const badUsers = await VoteReactionType.Bad.getUsers(message, true)
    const whiteUsers = await VoteReactionType.White.getUsers(message, true)

    const isGood = goodUsers.has(user.id)
    const isBad = badUsers.has(user.id)
    const isWhite = whiteUsers.has(user.id)

    return [isGood, isBad, isWhite].filter(Boolean).length > 1
  }

  /**
   * 指定されたユーザーが投票権を有するかどうかを取得します。
   */
  public hasVoteRight(user: User) {
    return this.memberIds.includes(user.id)
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
    const goodUsers = await VoteReactionType.Good.getUsers(message, true)
    const badUsers = await VoteReactionType.Bad.getUsers(message, true)
    const whiteUsers = await VoteReactionType.White.getUsers(message, true)

    const border = this.calculateBorder(message, whiteUsers)
    // 賛成が過半数を超えた場合、投票を承認とする
    if (goodUsers.size >= border) {
      await this.approval(message, goodUsers, badUsers, whiteUsers)
      return
    }
    // 反対が過半数を超えた場合、投票を否認とする
    if (badUsers.size >= border) {
      await this.disapproval(
        message,
        goodUsers,
        badUsers,
        whiteUsers,
        DisapprovalReason.Vote
      )
      return
    }
    // 投票権利を有する全員が白票を投票した場合、投票を否認とする
    if (whiteUsers.size === this.memberIds.length) {
      await this.disapproval(
        message,
        goodUsers,
        badUsers,
        whiteUsers,
        DisapprovalReason.VoteWhite
      )
      return
    }

    // 投票開始から2週間が経過していて、それまでに確定しなかった場合、投票を締め切り否認とする
    const voteEndDateTime = this.getVoteEndDateTime(message)

    if (voteEndDateTime < new Date()) {
      await this.disapproval(
        message,
        goodUsers,
        badUsers,
        whiteUsers,
        DisapprovalReason.Limit
      )
      return
    }

    // 投票開始から1週間が経過していて、リマインド済みでない場合、リマインドする
    // リマインドした場合、Bot自身がリアクションをつける
    const voteRemindDateTime = this.getVoteRemindDateTime(message)
    const reminded = await VoteReactionType.Remind.isReacted(
      message,
      message.client.user.id
    )
    if (voteRemindDateTime < new Date() && !reminded) {
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
    await this.sendEndMessage(
      message,
      goodUsers,
      badUsers,
      whiteUsers,
      true,
      null
    )

    await message.unpin()
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
    await this.sendEndMessage(
      message,
      goodUsers,
      badUsers,
      whiteUsers,
      false,
      reason
    )

    await message.unpin()
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
    const unvotedUsers = this.memberIds.filter((id) => {
      return !goodUsers.has(id) && !badUsers.has(id) && !whiteUsers.has(id)
    })
    const unvotedMentions = unvotedUsers.map((id) => `<@${id}>`).join(' ')
    const voteEndDateTime = this.getVoteEndDateTime(message)

    const embed = new EmbedBuilder()
      .setTitle(':bangbang: 有効審議期限前のお知らせ')
      .setDescription(
        `有効審議期限が1週間を切った投票があります！投票をお願いします。`
      )
      .addFields(
        {
          name: '有効審議期限',
          value: this.formatDateTime(voteEndDateTime),
          inline: false,
        },
        {
          name: 'メッセージURL',
          value: message.url,
          inline: false,
        }
      )
      .setColor(Colors.Blue)
      .setTimestamp(new Date())

    await this.channel.send({
      content: unvotedMentions,
      embeds: [embed],
      reply: {
        messageReference: message,
        failIfNotExists: false,
      },
      flags: MessageFlags.SuppressNotifications,
    })
    await VoteReactionType.Remind.addReaction(message)
  }

  /**
   * 投票終了を通知します。
   *
   * @param message メッセージ
   * @param goodUsers 賛成票を投票したユーザーのコレクション
   * @param badUsers 反対票を投票したユーザーのコレクション
   * @param whiteUsers 白票を投票したユーザーのコレクション
   * @param isApproval 承認か否認か
   * @param reason 否認理由
   */
  private async sendEndMessage(
    message: Message,
    goodUsers: Collection<string, User>,
    badUsers: Collection<string, User>,
    whiteUsers: Collection<string, User>,
    isApproval: boolean,
    reason: (typeof DisapprovalReason)[keyof typeof DisapprovalReason] | null
  ) {
    const border = this.calculateBorder(message, whiteUsers)
    const goodCount = goodUsers.size
    const badCount = badUsers.size
    const whiteCount = whiteUsers.size

    const goodNames = this.getUserNames(goodUsers)
    const badNames = this.getUserNames(badUsers)
    const whiteNames = this.getUserNames(whiteUsers)

    const content =
      message.content.length > 1024
        ? message.content.slice(0, 1021) + '...'
        : message.content

    const title = isApproval ? '投票承認のお知らせ' : '投票否認のお知らせ'

    let description = null
    if (isApproval) {
      description =
        ':+1: 過半数が賛成したため、投票が承認されたことをお知らせします。'
    } else {
      switch (reason) {
        case DisapprovalReason.Vote: {
          description =
            ':-1: 過半数が反対したため、投票が否認されたことをお知らせします。'
          break
        }
        case DisapprovalReason.VoteWhite: {
          description =
            ':-1: 投票権利を有する全員が白票を投票したため、投票が否認されたことをお知らせします。'
          break
        }
        case DisapprovalReason.Limit: {
          description =
            ':-1: 有効審議期限を過ぎたため、投票が否認されたことをお知らせします。'
          break
        }
      }
    }

    const color = isApproval ? Colors.Green : Colors.Red

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .addFields(
        {
          name: '賛成 / 反対 / 白票',
          value: `${goodCount} / ${badCount} / ${whiteCount}`,
          inline: false,
        },
        {
          name: '決議ボーダー',
          value: border.toString(),
          inline: false,
        },
        {
          name: 'メンバー',
          value:
            `賛成: ${goodNames}\n` +
            `反対: ${badNames}\n` +
            `白票: ${whiteNames}`,
          inline: false,
        },
        {
          name: '内容',
          value: `\`\`\`\n${content}\n\`\`\``,
          inline: false,
        },
        {
          name: '投票メッセージ',
          value: message.url,
          inline: false,
        },
        {
          name: '投票開始日時',
          value: this.formatDateTime(message.createdAt),
          inline: false,
        }
      )
      .setColor(color)
      .setTimestamp(new Date())

    await this.channel.send({
      embeds: [embed],
      reply: {
        messageReference: message,
        failIfNotExists: false,
      },
      flags: MessageFlags.SuppressNotifications,
    })
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
  private calculateBorder(
    message: Message,
    whiteUsers: Collection<string, User> = new Collection<string, User>()
  ) {
    const match = message.content.match(this.borderRegex)
    if (match && match.length > 1) {
      return Number.parseInt(match[1])
    }

    const whiteCount = whiteUsers.size
    const totalCount = this.memberIds.length

    return Math.ceil((totalCount - whiteCount + 1) / 2)
  }

  /**
   * ユーザーのコレクションからユーザー名をカンマ区切りで取得します。
   *
   * @param users ユーザーのコレクション
   * @returns ユーザー名のカンマ区切り
   */
  private getUserNames(users: Collection<string, User>) {
    return users.map((user: User) => user.username).join(', ')
  }

  /**
   * 投票のリマインドを行う日時を取得します。
   *
   * @param message メッセージ
   * @returns リマインド日時
   */
  private getVoteRemindDateTime(message: Message) {
    const createdAt = message.createdAt
    createdAt.setDate(createdAt.getDate() + 7)
    return createdAt
  }

  /**
   * 投票の有効審議期限を取得します。
   *
   * @param message メッセージ
   * @returns 有効審議期限
   */
  private getVoteEndDateTime(message: Message) {
    const createdAt = message.createdAt
    createdAt.setDate(createdAt.getDate() + 14)
    return createdAt
  }

  /**
   * 日時をフォーマットします。
   *
   * @param date 日時
   * @returns フォーマット済み日時
   */
  private formatDateTime(date: Date) {
    return `${date.getFullYear()}/${
      date.getMonth() + 1
    }/${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
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
    message = await message.fetch()

    const reaction = message.reactions.resolve(this.unicode)
    if (!reaction) {
      return new Collection<string, User>()
    }
    const users = await reaction.users.fetch()
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
