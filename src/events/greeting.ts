import { Message } from 'discord.js'
import { BaseDiscordEvent } from '.'
import { Configuration } from '@/config'

/**
 * #greeting チャンネルでの挨拶を処理するイベント
 *
 * - jao -> afa の順番で挨拶すると MailVerified ロールを付与する。
 * - jao を投稿する
 *   - MailVerifiedがついている: \u274C をリアクション
 *   - MailVerifiedがついていない: \u27A1 をリアクション、jaoPostedUsersに追加
 * - afa を投稿する
 *   - MailVerifiedがついている: \u274C をリアクション
 *   - MailVerifiedがついていない
 *     - jaoPostedUsersに投稿者が含まれている: \u2B55 をリアクション、jaoPostedUsersから削除
 *     - jaoPostedUsersに投稿者が含まれていない: \u274C をリアクション
 * - それ以外
 *  - メッセージを削除
 */
export class GreetingEvent extends BaseDiscordEvent<'messageCreate'> {
  private jaoPostedUsers = new Set<string>()

  readonly eventName = 'messageCreate'

  async execute(message: Message<true>): Promise<void> {
    const config: Configuration = this.discord.getConfig()
    const greetingChannelId =
      config.get('discord').channel?.greeting ?? '1149587870273773569'
    const verifiedRoleId =
      config.get('discord').role?.verified ?? '1149583365708709940'

    // #greeting チャンネル以外は無視
    if (message.channel.id !== greetingChannelId) return
    // メンバーが取得できない場合は無視
    if (!message.member) return
    // Botは無視
    if (message.author.bot) return

    // jao, afa 以外はメッセージを削除
    if (message.content !== 'jao' && message.content !== 'afa') {
      await message.delete()
      return
    }

    const member = message.member
    const isMailVerified = member.roles.cache.has(verifiedRoleId)

    // jao メッセージの場合
    if (message.content === 'jao') {
      // 既に投稿済みの場合は無視
      if (!this.jaoPostedUsers.has(message.author.id)) {
        this.jaoPostedUsers.add(message.author.id)
      }

      const emoji = isMailVerified ? '\u274C' : '\u27A1'
      await message.react(emoji)
      return
    }

    // afa メッセージの場合
    if (isMailVerified) {
      // MailVerifiedがついている: \u274C をリアクション
      await message.react('\u274C')
      return
    }

    // MailVerifiedがついていない
    if (!this.jaoPostedUsers.has(message.author.id)) {
      // jaoPostedUsersに投稿者が含まれていない: \u274C をリアクション
      await message.react('\u274C')
      return
    }

    // jaoPostedUsersに投稿者が含まれている: \u2B55 をリアクション、jaoPostedUsersから削除
    this.jaoPostedUsers.delete(message.author.id)
    await message.react('\u2B55')

    const roles = message.member.roles
    const hasMainRole =
      roles.cache.filter((_, key) => this.mainRoleIds.includes(key)).size > 0

    if (!hasMainRole) {
      await roles.add(verifiedRoleId)
    }

    await message.reply(
      [
        'あいさつしていただきありがとうございます！これにより、多くのチャンネルを閲覧できるようになりました。',
        '**<#1149584912836472882>に記載されているメッセージをお読みください！**',
        'コミュニティのメンバーと仲良くなる第一歩として、<#1150062130280796190> で自己紹介をしてみませんか？',
        '',
        'jao Gamers ClubではDiscordサービス利用規約に基づき**13歳未満の利用を禁止**しています。あなたが13歳以上でない場合は当サーバから退出してください。',
      ].join('\n')
    )
  }

  private readonly mainRoleIds = [
    '1138605444600963163', // Admin
    '1149581338043756654', // Ekusas
    '1149581969676578846', // Developer
    '1149583306816491631', // Regular
    '1149583365708709940', // Verified
  ]
}
