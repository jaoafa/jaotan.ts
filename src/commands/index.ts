import { Discord } from '@/discord'
import { Message, PermissionResolvable } from 'discord.js'

interface UserPermission {
  readonly identifier: string
  readonly type: 'USER'
}

interface RolePermission {
  readonly identifier: string
  readonly type: 'ROLE'
}

interface PermissionPermission {
  readonly identifier: PermissionResolvable
  readonly type: 'PERMISSION'
}

export type Permission = UserPermission | RolePermission | PermissionPermission

export abstract class BaseCommand {
  /** 名前: コマンドの名前 */
  abstract get name(): string

  /** 権限: コマンドの実行に必要なユーザー・ロール・パーミッション。NULLが指定された場合はすべて許可 */
  abstract get permissions(): Permission[] | null

  /** 実行: コマンドの実行定義 */
  abstract execute(discord: Discord, message: Message): Promise<void>
}
