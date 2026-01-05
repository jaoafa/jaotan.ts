import { BaseDiscordTask } from '.'
import { Logger } from '@book000/node-utils'

/**
 * 挨拶タイムアウト処理
 *
 * 参加から10分経過しても #greeting で jao -> afa が完了していないメンバーをキックする
 * - 対象: @everyone 以外のロールが付いていないメンバーのみ
 * - 1分間隔でメンバーを走査
 */
export class GreetingTimeoutTask extends BaseDiscordTask {
  // 挨拶タイムアウトの時間（ミリ秒）
  private static readonly GREETING_TIMEOUT_MS = 10 * 60 * 1000 // 10分

  // タスク実行間隔（秒）
  private static readonly INTERVAL_SECONDS = 60 // 1分

  get interval(): number {
    return GreetingTimeoutTask.INTERVAL_SECONDS
  }

  async execute(): Promise<void> {
    const logger = Logger.configure('GreetingTimeoutTask.execute')
    const config = this.discord.getConfig()
    const guildId = config.get('discord').guildId

    try {
      // Guild ID が未設定の場合は処理を中止
      if (!guildId) {
        logger.warn('⚠️ Guild ID is not configured')
        return
      }

      // ギルドを取得
      const guild = await this.discord.client.guilds.fetch(guildId)

      // メンバー一覧を取得
      // Note: guild.members.fetch() は全メンバーを取得するため、大規模サーバでは負荷が高くなる可能性がある
      const members = await guild.members.fetch()
      const now = Date.now()

      let checkedCount = 0
      let kickedCount = 0

      for (const member of members.values()) {
        // Botは除外
        if (member.user.bot) {
          continue
        }

        // 参加日時が取得できない場合はスキップ
        if (!member.joinedAt) {
          continue
        }

        // @everyone 以外のロールを持っているか確認
        const extraRoles = member.roles.cache.filter(
          (role) => role.id !== guild.id
        )
        const hasOnlyEveryoneRole = extraRoles.size === 0

        // @everyone 以外のロールを持っている場合はスキップ
        if (!hasOnlyEveryoneRole) {
          continue
        }

        checkedCount++

        // 参加から10分以上経過しているか確認
        const joinedAtMs = member.joinedAt.getTime()
        const elapsedMs = now - joinedAtMs

        if (elapsedMs >= GreetingTimeoutTask.GREETING_TIMEOUT_MS) {
          // キック可能か確認
          if (!member.kickable) {
            logger.warn(
              `⚠️ Cannot kick ${member.user.tag} (${member.id}): not kickable`
            )
            continue
          }

          // キック実行
          try {
            await member.kick(
              '挨拶タイムアウト: 参加から10分以内に #greeting で jao→afa が完了しませんでした'
            )
            logger.info(
              `✅ Kicked ${member.user.tag} (${member.id}) for greeting timeout`
            )
            kickedCount++
          } catch (error) {
            logger.error(
              `❌ Failed to kick ${member.user.tag} (${member.id})`,
              error as Error
            )
          }
        }
      }

      logger.info(
        `✅ Greeting timeout check completed: checked ${checkedCount} members, kicked ${kickedCount}`
      )
    } catch (error) {
      logger.error('❌ Error in greeting timeout task', error as Error)
    }
  }
}
