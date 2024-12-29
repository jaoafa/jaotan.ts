import { Discord } from '@/discord'
import { Logger } from '@book000/node-utils'
import { Guild, Role, TextChannel } from 'discord.js'
import fs from 'node:fs'

export const NitrotanReason = {
  USE_ANIMATION_EMOJI_MESSAGE: 'USE_ANIMATION_EMOJI_MESSAGE',
  USE_ANIMATION_EMOJI_REACTION: 'USE_ANIMATION_EMOJI_REACTION',
  USE_OTHER_SERVER_EMOJI_MESSAGE: 'USE_OTHER_SERVER_EMOJI_MESSAGE',
  USE_OTHER_SERVER_EMOJI_REACTION: 'USE_OTHER_SERVER_EMOJI_REACTION',
  USE_OTHER_SERVER_STICKER: 'USE_OTHER_SERVER_STICKER',
  SEND_LARGE_FILE: 'SEND_LARGE_FILE',
  AVATAR_ANIME: 'AVATAR_ANIME',
  SERVER_ORIGINAL_AVATAR: 'SERVER_ORIGINAL_AVATAR',
  BANNER: 'BANNER',
  PROFILE_THEME: 'PROFILE_THEME',
  SEND_LARGE_MESSAGE: 'SEND_LARGE_MESSAGE',
} as const

/** Nitrotanの理由 */
export type NitrotanReasonType = keyof typeof NitrotanReason

const NitrotanReasonText: Record<NitrotanReasonType, string> = {
  USE_ANIMATION_EMOJI_MESSAGE:
    'アニメーション絵文字を使用したメッセージを送信した',
  USE_ANIMATION_EMOJI_REACTION: 'アニメーション絵文字をリアクションした',
  USE_OTHER_SERVER_EMOJI_MESSAGE:
    '他サーバーの絵文字を使用したメッセージを送信した',
  USE_OTHER_SERVER_EMOJI_REACTION: '他サーバーの絵文字をリアクションした',
  USE_OTHER_SERVER_STICKER: '他サーバーのスタンプを使用した',
  SEND_LARGE_FILE: 'ブーストによる上限値より大きなファイルを送信した',
  AVATAR_ANIME: 'アニメーションアイコンを設定した',
  SERVER_ORIGINAL_AVATAR: 'サーバ独自のアバターを設定した',
  BANNER: 'バナーを設定した',
  PROFILE_THEME: 'プロフィールテーマを設定した',
  SEND_LARGE_MESSAGE: '2000文字より多い文章を投稿した',
}

interface NitrotanUser {
  /** DiscordのユーザーID */
  discordId: string
  /** いつからNitroか */
  since: Date
  /** 最後に確認した日時 */
  lastChecked: Date
  /** 理由 */
  reason: NitrotanReasonType
}

/**
 * Nitroユーザーにロールをつけたり、Nitroではなくなったと思われるユーザーからロールを外す機能
 */
export class Nitrotan {
  private readonly guild: Guild
  private readonly role: Role
  private readonly channel: TextChannel

  private static nitrotans: NitrotanUser[] = []
  private static lastLoadAt: Date | null = null

  private constructor(guild: Guild, role: Role, channel: TextChannel) {
    this.guild = guild
    this.role = role
    this.channel = channel

    this.load()
  }

  public static async of(discord: Discord) {
    const config = discord.getConfig()

    const channelId =
      config.get('discord').channel?.other ?? '1149857948089192448'
    const channel =
      discord.client.channels.cache.get(channelId) ??
      (await discord.client.channels.fetch(channelId).catch(() => null))
    if (!channel) {
      throw new Error('Channel not found')
    }
    if (!(channel instanceof TextChannel)) {
      throw new TypeError('Channel is not a TextChannel')
    }

    let guild: Guild
    let guildId = config.get('discord').guildId
    if (guildId) {
      guild =
        discord.client.guilds.cache.get(guildId) ??
        (await discord.client.guilds.fetch(guildId))
    } else {
      guildId = channel.guild.id
      guild = channel.guild
    }

    const roleId = config.get('discord').role?.nitrotan ?? '1149583556138508328'
    const role =
      guild.roles.cache.get(roleId) ??
      (await guild.roles.fetch(roleId).catch(() => null))

    if (!role) {
      throw new Error('Role not found')
    }

    return new Nitrotan(guild, role, channel)
  }

  /**
   * ファイルからNitroユーザーデータを読み込む。
   * 最終読み込み日時から30分以上経過している場合は読み込む。
   *
   * @param force 最終読み込み日時を無視して強制的に読み込むか
   */
  public load(force = false) {
    if (!force && Nitrotan.lastLoadAt) {
      const now = new Date()
      const diff = now.getTime() - Nitrotan.lastLoadAt.getTime()
      if (diff < 30 * 60 * 1000) {
        return
      }
    }
    const path = this.getPath()

    if (!fs.existsSync(path)) {
      Nitrotan.nitrotans = []
      Nitrotan.lastLoadAt = new Date()

      this.save()
      return
    }

    const data = fs.readFileSync(path, 'utf8')
    const nitrotans = JSON.parse(data) as NitrotanUser[]
    // Date型に変換
    Nitrotan.nitrotans = nitrotans.map((nitrotan: NitrotanUser) => {
      nitrotan.since = new Date(nitrotan.since)
      nitrotan.lastChecked = new Date(nitrotan.lastChecked)
      return nitrotan
    })

    Nitrotan.lastLoadAt = new Date()
  }

  /**
   * ファイルにNitroユーザーデータを保存する
   */
  public save() {
    const path = this.getPath()
    fs.writeFileSync(path, JSON.stringify(Nitrotan.nitrotans, null, 2), 'utf8')
  }

  /**
   * ユーザーがNitroとして認識しているか
   */
  public isNitrotan(discordId: string) {
    this.load()
    return Nitrotan.nitrotans.some(
      (nitrotan) => nitrotan.discordId === discordId
    )
  }

  /**
   * ユーザーをNitroとして認識する
   */
  public async add(discordId: string, reason: NitrotanReasonType) {
    const logger = Logger.configure('Nitrotan.add')
    if (this.isNitrotan(discordId)) {
      return
    }

    Nitrotan.nitrotans.push({
      discordId,
      since: new Date(),
      lastChecked: new Date(),
      reason,
    })
    this.save()

    const member = await this.getMember(discordId)
    if (!member) {
      return
    }

    await member.roles.add(
      this.role,
      `Nitrotanとして認識されたため (${reason})`
    )

    const reasonText = NitrotanReasonText[reason]
    await this.channel.send({
      embeds: [
        {
          title: 'Nitrotanロールを付与',
          description: `<@${discordId}> を Nitrotan として認識しました。`,
          fields: [
            {
              name: '理由',
              value: reasonText,
            },
          ],
          color: 0x00_ff_00,
        },
      ],
    })

    logger.info(`Added role ${member.user.username} [${discordId}] (${reason})`)
  }

  /**
   * Nitroとして認識しているユーザーを整理する
   *
   * - 最後に確認した日時から1週間以上経過しているユーザーはNitroではなくなったとみなす
   * - Nitroではなくなったユーザーからロールを外す
   * - ファイルに保存する
   * - Nitroとして認識しているにもかかわらず、ロールがついていないユーザーにロールをつける
   */
  public async optimize() {
    const logger = Logger.configure('Nitrotan.optimize')
    this.load()

    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const nolongerNitrotans = Nitrotan.nitrotans.filter(
      (nitrotan) => nitrotan.lastChecked < oneWeekAgo
    )
    const stillNitrotans = Nitrotan.nitrotans.filter(
      (nitrotan) => nitrotan.lastChecked >= oneWeekAgo
    )

    Nitrotan.nitrotans = stillNitrotans
    this.save()

    logger.info(
      `Optimizing - no longer: ${nolongerNitrotans.length} / still: ${stillNitrotans.length}`
    )

    // Nitroではなくなったユーザーからロールを外す
    for (const nitrotan of nolongerNitrotans) {
      const member = await this.getMember(nitrotan.discordId)
      if (!member) {
        logger.warn(`Member not found: ${nitrotan.discordId}`)
        continue
      }

      await member.roles.remove(
        this.role,
        'Nitroではなくなったと見なされたため'
      )

      await this.channel.send({
        embeds: [
          {
            title: 'Nitrotanロールを剥奪',
            description: `<@${nitrotan.discordId}> は Nitro が行える操作を1週間以上行っていないため、Nitrotan ではなくなったと見なされました。`,
            color: 0x00_ff_00,
          },
        ],
      })

      logger.info(
        `Removed role ${member.user.username} [${nitrotan.discordId}] (${nitrotan.reason})`
      )
    }

    // Nitroとして認識しているにもかかわらず、ロールがついていないユーザーにロールをつける
    for (const nitrotan of stillNitrotans) {
      const member = await this.getMember(nitrotan.discordId)
      if (!member) {
        logger.warn(`Member not found: ${nitrotan.discordId}`)
        continue
      }

      if (member.roles.cache.has(this.role.id)) {
        continue
      }

      await member.roles.add(
        this.role,
        `Nitrotanとして認識されたため (${nitrotan.reason})`
      )

      logger.info(
        `Added role ${member.user.username} [${nitrotan.discordId}] (${nitrotan.reason})`
      )
    }
  }

  public check(discordId: string) {
    this.load()

    const nitrotan = Nitrotan.nitrotans.find(
      (nitrotan) => nitrotan.discordId === discordId
    )
    if (!nitrotan) {
      return
    }

    nitrotan.lastChecked = new Date()
    this.save()
  }

  /**
   * Nitrotanの一覧を取得する
   */
  public getUsers() {
    this.load()
    return Nitrotan.nitrotans
  }

  public getGuild() {
    return this.guild
  }

  private async getMember(discordId: string) {
    const cacheMember = this.guild.members.cache.get(discordId)
    if (cacheMember) {
      return cacheMember
    }

    return await this.guild.members.fetch(discordId).catch(() => null)
  }

  /**
   * Nitroユーザーデータのファイルパスを取得する
   *
   * - 環境変数 DATA_DIR が設定されている場合はそのディレクトリを使用する
   * - 環境変数 DATA_DIR が設定されていない場合は data/ ディレクトリを使用する
   * - ファイル名は nitrotan.json とする
   *
   * @returns ファイルパス
   */
  private getPath() {
    const dataDir = process.env.DATA_DIR ?? 'data/'

    return `${dataDir}/nitrotan.json`
  }
}
