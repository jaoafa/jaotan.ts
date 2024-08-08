import { GuildMember } from 'discord.js'
import { BaseDiscordTask } from '.'
import {
  Nitrotan,
  NitrotanReason,
  NitrotanReasonType,
} from '@/features/nitrotan'

/**
 * Nitro判別で、プロフィールに関するチェック処理
 */
export class NitrotanProfileTask extends BaseDiscordTask {
  get interval(): number {
    // 30分毎
    return 30 * 60
  }

  async execute(): Promise<void> {
    const nitrotan = await Nitrotan.of(this.discord)
    const guild = nitrotan.getGuild()

    const members = await guild.members.fetch()
    for (const [, member] of members) {
      if (nitrotan.isNitrotan(member.id)) {
        nitrotan.check(member.id)
        continue
      }

      const reason = this.getNitrotanReason(member)
      if (!reason) continue

      await nitrotan.add(member.id, reason)
    }
  }

  /**
   * Nitroユーザーが取れる行動かどうか。かつどんな操作であるか
   */
  private getNitrotanReason(member: GuildMember): NitrotanReasonType | null {
    if (this.isGifAvatar(member)) {
      return NitrotanReason.AVATAR_ANIME
    }

    if (this.isDifferentAvatar(member)) {
      return NitrotanReason.SERVER_ORIGINAL_AVATAR
    }

    if (this.hasBanner(member)) {
      return NitrotanReason.BANNER
    }

    if (this.hasProfileTheme(member)) {
      return NitrotanReason.PROFILE_THEME
    }

    return null
  }

  /**
   * アバターがGIFであるかどうか
   */
  private isGifAvatar(member: GuildMember): boolean {
    const user = member.user
    return user.avatarURL()?.endsWith('.gif') ?? false
  }

  /**
   * アカウントのアバターとサーバのアバターが異なるかどうか
   */
  private isDifferentAvatar(member: GuildMember): boolean {
    const user = member.user
    return user.displayAvatarURL() !== member.displayAvatarURL()
  }

  /**
   * バナー画像を設定しているか
   */
  private hasBanner(member: GuildMember): boolean {
    return !!member.user.banner
  }

  /**
   * プロフィールテーマを設定しているか
   */
  private hasProfileTheme(member: GuildMember): boolean {
    return !!member.user.accentColor
  }
}
