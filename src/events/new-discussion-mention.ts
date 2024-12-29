import { AnyThreadChannel, ChannelType, MessageFlags } from 'discord.js'
import { BaseDiscordEvent } from '.'

/**
 * discussionフォーラムチャンネルでスレッドが新規作成された場合、Adminにメンションする
 */
export class NewDiscussionMention extends BaseDiscordEvent<'threadCreate'> {
  readonly eventName = 'threadCreate'

  async execute(
    thread: AnyThreadChannel,
    newlyCreated: boolean
  ): Promise<void> {
    const config = this.discord.getConfig()
    const discussionChannelId =
      config.get('discord').channel?.discussion ?? '1149596420207284234'

    // discussionフォーラムチャンネル以外は無視
    if (thread.parentId !== discussionChannelId) return
    // Botは無視
    if (thread.isThread() && thread.type !== ChannelType.PublicThread) {
      return
    }
    // 新規作成でない場合は無視
    if (!newlyCreated) return

    const adminRoleId =
      config.get('discord').role?.admin ?? '1138605444600963163'

    // メッセージを送信する
    await thread.send({
      content: `<@&${adminRoleId}>`,
      flags: MessageFlags.SuppressNotifications,
    })
  }
}
