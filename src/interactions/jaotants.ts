import {
  ChannelType,
  ChatInputCommandInteraction,
  Guild,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js'
import { Logger } from '@book000/node-utils'
import { Discord } from '@/discord'
import {
  ChannelConfigFeature,
  ChannelConfigUnavailableError,
  isValidChannelId,
} from '@/features/channel-config-store'

const DEFAULT_ADMIN_ROLE_ID = '1138605444600963163'
const FEATURE: ChannelConfigFeature = 'vc-speech-log'

export const jaotantsMessages = {
  guildOnly: 'このコマンドはこのサーバでは使用できません。',
  forbidden: 'このコマンドを実行する権限がありません。',
  unknownSubcommand: '不明なサブコマンドです。',
  error: 'コマンドの実行中にエラーが発生しました。',
  unavailable: '設定ファイルを読み込めないため操作できません。',
  failed: '設定の保存に失敗しました。時間をおいて再度お試しください。',
  notTextChannel: 'テキストチャンネルのみ登録できます。',
  otherGuild: 'このサーバのチャンネルのみ登録できます。',
  removeNeedsOne:
    '`channel` と `channel-id` はどちらか一方のみ指定してください。',
  invalidChannelId: '`channel-id` は 17〜20 桁の数字で指定してください。',
  listEmpty: '登録されているチャンネルはありません。',
  added: (channelId: string) => `<#${channelId}> を追加しました。`,
  alreadyRegistered: (channelId: string) =>
    `<#${channelId}> は既に登録されています。`,
  noBotPermission: (channelId: string) =>
    `<#${channelId}> を Bot が閲覧・履歴参照できないため登録できません。`,
  removed: (label: string) => `${label} を登録解除しました。`,
  notRegistered: (label: string) => `${label} は登録されていません。`,
  list: (lines: string) => `登録中のチャンネル:\n${lines}`,
} as const

export const jaotantsCommandData: RESTPostAPIChatInputApplicationCommandsJSONBody =
  new SlashCommandBuilder()
    .setName('jaotants')
    .setDescription('jaotan の設定を管理します (Admin 専用)')
    .setContexts(InteractionContextType.Guild)
    .addSubcommandGroup((group) =>
      group
        .setName('vc-speech-log')
        .setDescription('#vc-speech-log のメッセージリンク引用対象を管理します')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setDescription('引用対象のチャンネルを追加します')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('追加するテキストチャンネル')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove')
            .setDescription('引用対象のチャンネルを登録解除します')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('登録解除するテキストチャンネル')
                .addChannelTypes(ChannelType.GuildText)
            )
            .addStringOption((option) =>
              option
                .setName('channel-id')
                .setDescription('削除済みなど選択できないチャンネルの ID')
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('list')
            .setDescription('登録中のチャンネルを表示します')
        )
    )
    .toJSON()

function hasRole(
  member: ChatInputCommandInteraction['member'],
  roleId: string
): boolean {
  if (!member) return false
  return Array.isArray(member.roles)
    ? member.roles.includes(roleId)
    : member.roles.cache.has(roleId)
}

async function addChannel(
  discord: Discord,
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<string> {
  const channelId = interaction.options.getChannel('channel', true).id
  const channel = await guild.channels.fetch(channelId).catch(() => null)
  if (channel?.type !== ChannelType.GuildText) {
    return jaotantsMessages.notTextChannel
  }
  if (channel.guildId !== guild.id) {
    return jaotantsMessages.otherGuild
  }
  const botMember = guild.members.me
  const readable =
    botMember !== null &&
    channel
      .permissionsFor(botMember)
      .has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ])
  if (!readable) {
    return jaotantsMessages.noBotPermission(channelId)
  }

  const result = await discord.getChannelConfigStore().add(FEATURE, channelId)
  return result === 'added'
    ? jaotantsMessages.added(channelId)
    : jaotantsMessages.alreadyRegistered(channelId)
}

async function removeChannel(
  discord: Discord,
  interaction: ChatInputCommandInteraction
): Promise<string> {
  const channel = interaction.options.getChannel('channel')
  const channelIdText = interaction.options.getString('channel-id')
  if ((channel === null) === (channelIdText === null)) {
    return jaotantsMessages.removeNeedsOne
  }

  let channelId: string
  let label: string
  if (channel) {
    channelId = channel.id
    label = `<#${channelId}>`
  } else {
    channelId = channelIdText ?? ''
    if (!isValidChannelId(channelId)) {
      return jaotantsMessages.invalidChannelId
    }
    label = `\`${channelId}\``
  }

  const result = await discord
    .getChannelConfigStore()
    .remove(FEATURE, channelId)
  return result === 'removed'
    ? jaotantsMessages.removed(label)
    : jaotantsMessages.notRegistered(label)
}

async function listChannels(discord: Discord, guild: Guild): Promise<string> {
  const channelIds = discord.getChannelConfigStore().get(FEATURE)
  if (!channelIds) {
    throw new ChannelConfigUnavailableError('Channel config is unavailable')
  }
  if (channelIds.length === 0) {
    return jaotantsMessages.listEmpty
  }

  const lines = await Promise.all(
    channelIds.map(async (channelId) => {
      const channel = await guild.channels.fetch(channelId).catch(() => null)
      return channel ? `- <#${channelId}>` : `- \`${channelId}\``
    })
  )
  return jaotantsMessages.list(lines.join('\n'))
}

/**
 * /jaotants を処理する。認可は実行のたびに Admin ロールの保持で判定し、
 * Discord の Administrator 権限による特例は設けない。
 */
export async function handleJaotantsInteraction(
  discord: Discord,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const logger = Logger.configure('handleJaotantsInteraction')
  const deny = (content: string) =>
    interaction.reply({ content, flags: MessageFlags.Ephemeral })

  const guild = interaction.inGuild() ? interaction.guild : null
  if (!guild) {
    await deny(jaotantsMessages.guildOnly)
    return
  }
  const discordConfig = discord.getConfig().get('discord')
  if (discordConfig.guildId && interaction.guildId !== discordConfig.guildId) {
    await deny(jaotantsMessages.guildOnly)
    return
  }
  const adminRoleId = discordConfig.role?.admin ?? DEFAULT_ADMIN_ROLE_ID
  if (!hasRole(interaction.member, adminRoleId)) {
    logger.warn(`🚫 permission denied: ${interaction.user.tag}`)
    await deny(jaotantsMessages.forbidden)
    return
  }

  const subcommand = interaction.options.getSubcommand()
  if (
    interaction.options.getSubcommandGroup(false) !== FEATURE ||
    !['add', 'remove', 'list'].includes(subcommand)
  ) {
    await deny(jaotantsMessages.unknownSubcommand)
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  let content: string
  try {
    switch (subcommand) {
      case 'add': {
        content = await addChannel(discord, interaction, guild)
        break
      }
      case 'remove': {
        content = await removeChannel(discord, interaction)
        break
      }
      default: {
        content = await listChannels(discord, guild)
      }
    }
    logger.info(`👌 ${interaction.user.tag}: ${subcommand} -> ${content}`)
  } catch (error) {
    if (error instanceof ChannelConfigUnavailableError) {
      content = jaotantsMessages.unavailable
    } else {
      logger.error(`❌ ${subcommand} failed`, error as Error)
      content = jaotantsMessages.failed
    }
  }
  await interaction.editReply({ content, allowedMentions: { parse: [] } })
}

export async function registerJaotantsCommand(discord: Discord): Promise<void> {
  const logger = Logger.configure('registerJaotantsCommand')
  try {
    const application = discord.client.application
    if (!application) {
      throw new Error('Client application is not available yet')
    }
    await application.commands.create(
      jaotantsCommandData,
      discord.getConfig().get('discord').guildId
    )
    logger.info('👌 registered /jaotants')
  } catch (error) {
    logger.error('❌ failed to register /jaotants', error as Error)
  }
}
