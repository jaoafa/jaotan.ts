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

  // メンバーキャッシュを全メンバー取得で充填済みかどうか
  private cacheWarmed = false

  get interval(): number {
    return GreetingTimeoutTask.INTERVAL_SECONDS
  }

  async execute(): Promise<void> {
    const logger = Logger.configure('GreetingTimeoutTask.execute')
    const config = this.discord.getConfig()
    const guildId = config.get('discord').guildId ?? '1138605145660326040'

    try {
      // ギルドを取得
      const guild = await this.discord.client.guilds.fetch(guildId)

      // 全メンバー取得 (Gateway opcode 8) はレート制限があり NitrotanProfileTask と衝突するため、初回のみ行いキャッシュを使う
      if (!this.cacheWarmed) {
        await guild.members.fetch()
        this.cacheWarmed = true
      }
      const now = Date.now()

      let checkedCount = 0
      let kickedCount = 0

      for (const member of guild.members.cache.values()) {
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

        if (!(elapsedMs >= GreetingTimeoutTask.GREETING_TIMEOUT_MS)) {
          continue
        }

        // キック可能か確認
        if (!member.kickable) {
          logger.warn(
            `⚠️ Cannot kick ${member.user.tag} (${member.id}): not kickable`
          )
          continue
        }

        // キャッシュはイベントでのみ更新され、Gateway 再接続中のロール付与を取りこぼし得るため、キック直前に対象 1 人だけ最新化する
        try {
          const latest = await guild.members.fetch({
            user: member.id,
            force: true,
          })
          if (latest.roles.cache.some((role) => role.id !== guild.id)) {
            continue
          }

          await member.kick(
            '挨拶タイムアウト: 参加から10分以内に #greeting で jao→afa が完了しませんでした'
          )
          logger.info(
            `✅ Kicked ${member.user.tag} (${member.id}) for greeting timeout`
          )
          kickedCount++
        } catch (error) {
          logger.error(
            `❌ Failed to refresh or kick ${member.user.tag} (${member.id})`,
            error as Error
          )
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
