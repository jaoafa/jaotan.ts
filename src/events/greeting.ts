import { Message } from 'discord.js'
import { BaseDiscordEvent } from '.'

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
  private jaoPostedUsers: Set<string> = new Set()

  get eventName(): 'messageCreate' {
    return 'messageCreate'
  }

  async execute(message: Message<boolean>): Promise<void> {
    const config = this.discord.getConfig()
    const greetingChannelId =
      config.get('discord').channel?.greeting || '603841992404893707'
    const mailVerifiedRoleId =
      config.get('discord').role?.mailVerified || '597421078817669121'

    // #greeting チャンネル以外は無視
    if (message.channel.id !== greetingChannelId) return
    // サーバ以外は無視 & メンバーが取得できない場合は無視
    if (!message.guild || !message.member) return
    // Botは無視
    if (message.author.bot) return

    // jao, afa 以外はメッセージを削除
    if (message.content !== 'jao' && message.content !== 'afa') {
      await message.delete()
      return
    }

    const member = message.member
    const isMailVerified = member.roles.cache.has(mailVerifiedRoleId)

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

    await message.member.roles.add(mailVerifiedRoleId)

    await message.reply(
      [
        'あいさつしていただきありがとうございます！これにより、多くのチャンネルを閲覧できるようになりました。',
        '**<#706818240759988224>に記載されているメッセージをお読みください！**',
        '',
        'jMS Gamers ClubではDiscordサービス利用規約に基づき**13歳未満の利用を禁止**しています。あなたが13歳以上でない場合は当サーバから退出してください。',
      ].join('\n')
    )
  }
}
