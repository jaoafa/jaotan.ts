import {
  ChannelType,
  ChatInputCommandInteraction,
  Guild,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RESTPostAPIApplicationGuildCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  escapeMarkdown,
} from 'discord.js'
import { Logger } from '@book000/node-utils'
import { Discord } from '@/discord'
import {
  ChannelConfigFeature,
  ChannelConfigUnavailableError,
  isValidChannelId,
} from '@/features/channel-config-store'
import {
  addStopword,
  normalizeStopwordInput,
  removeStopword,
} from '@/features/word-ranking/stopwords'

const DEFAULT_ADMIN_ROLE_ID = '1138605444600963163'
const CHANNEL_FEATURES: readonly ChannelConfigFeature[] = [
  'vc-speech-log',
  'word-ranking',
]
const STOPWORD_GROUP = 'stopword'
const MAX_WORD_LENGTH = 100
const MAX_LIST_LENGTH = 1900

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
  wordRankingNotice:
    '集計結果は #general に投稿されます。このチャンネルの閲覧範囲が #general に含まれることを確認してください。',
  invalidWord: `\`word\` は空白を含まない 1〜${MAX_WORD_LENGTH} 文字で指定してください。`,
  stopwordAdded: (word: string) =>
    `「${escapeMarkdown(word)}」をストップワードに追加しました。`,
  stopwordRestored: (word: string) =>
    `「${escapeMarkdown(word)}」の除外を解除し、標準のストップワードに戻しました。`,
  stopwordExists: (word: string) =>
    `「${escapeMarkdown(word)}」は既にストップワードです。`,
  stopwordRemoved: (word: string) =>
    `「${escapeMarkdown(word)}」をストップワードから削除しました。`,
  stopwordExcluded: (word: string) =>
    `「${escapeMarkdown(word)}」を標準のストップワードから除外しました。`,
  stopwordAbsent: (word: string) =>
    `「${escapeMarkdown(word)}」はストップワードではありません。`,
  stopwordListEmpty: '独自に追加・除外したストップワードはありません。',
  stopwordListAdded: '追加したストップワード:',
  stopwordListRemoved: '標準から除外したストップワード:',
  stopwordListRest: (count: number) => `…ほか ${count} 件`,
} as const

const channelGroup =
  (name: ChannelConfigFeature, description: string, target: string) =>
  (group: SlashCommandSubcommandGroupBuilder) =>
    group
      .setName(name)
      .setDescription(description)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription(`${target}のチャンネルを追加します`)
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
          .setDescription(`${target}のチャンネルを登録解除します`)
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

const stopwordGroup = (group: SlashCommandSubcommandGroupBuilder) =>
  group
    .setName(STOPWORD_GROUP)
    .setDescription('月次の単語ランキングから除外する語を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('ストップワードに語を追加します')
        .addStringOption((option) =>
          option
            .setName('word')
            .setDescription('追加する語')
            .setMinLength(1)
            .setMaxLength(MAX_WORD_LENGTH)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('ストップワードから語を外します')
        .addStringOption((option) =>
          option
            .setName('word')
            .setDescription('外す語')
            .setMinLength(1)
            .setMaxLength(MAX_WORD_LENGTH)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('独自に追加・除外したストップワードを表示します')
    )

const baseCommand = new SlashCommandBuilder()
  .setName('jaotants')
  .setDescription('jaotan の設定を管理します (Admin 専用)')
  .addSubcommandGroup(
    channelGroup(
      'vc-speech-log',
      '#vc-speech-log のメッセージリンク引用対象を管理します',
      '引用対象'
    )
  )
  .addSubcommandGroup(
    channelGroup(
      'word-ranking',
      '月次の単語ランキングの集計対象を管理します',
      '集計対象'
    )
  )
  .addSubcommandGroup(stopwordGroup)

// contexts はグローバルコマンド専用で、ギルドコマンドの登録 API には送れない
export const jaotantsGuildCommandData: RESTPostAPIApplicationGuildCommandsJSONBody =
  baseCommand.toJSON()

export const jaotantsCommandData: RESTPostAPIChatInputApplicationCommandsJSONBody =
  { ...baseCommand.toJSON(), contexts: [InteractionContextType.Guild] }

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
  guild: Guild,
  feature: ChannelConfigFeature
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

  const result = await discord.getChannelConfigStore().add(feature, channelId)
  if (result !== 'added') {
    return jaotantsMessages.alreadyRegistered(channelId)
  }
  return feature === 'word-ranking'
    ? `${jaotantsMessages.added(channelId)}\n${jaotantsMessages.wordRankingNotice}`
    : jaotantsMessages.added(channelId)
}

async function removeChannel(
  discord: Discord,
  interaction: ChatInputCommandInteraction,
  feature: ChannelConfigFeature
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
    .remove(feature, channelId)
  return result === 'removed'
    ? jaotantsMessages.removed(label)
    : jaotantsMessages.notRegistered(label)
}

async function listChannels(
  discord: Discord,
  guild: Guild,
  feature: ChannelConfigFeature
): Promise<string> {
  const channelIds = discord.getChannelConfigStore().get(feature)
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

async function changeStopword(
  discord: Discord,
  interaction: ChatInputCommandInteraction,
  subcommand: 'add' | 'remove'
): Promise<string> {
  const word = normalizeStopwordInput(
    interaction.options.getString('word', true)
  )
  if (word === undefined) {
    return jaotantsMessages.invalidWord
  }

  const store = discord.getStopwordStore()
  if (subcommand === 'add') {
    const result = await store.update((data) => addStopword(data, word))
    switch (result) {
      case 'added': {
        return jaotantsMessages.stopwordAdded(word)
      }
      case 'restored': {
        return jaotantsMessages.stopwordRestored(word)
      }
      case 'exists': {
        return jaotantsMessages.stopwordExists(word)
      }
    }
  }
  const result = await store.update((data) => removeStopword(data, word))
  switch (result) {
    case 'removed': {
      return jaotantsMessages.stopwordRemoved(word)
    }
    case 'excluded': {
      return jaotantsMessages.stopwordExcluded(word)
    }
    case 'absent': {
      return jaotantsMessages.stopwordAbsent(word)
    }
  }
}

function formatWordList(heading: string, words: readonly string[]): string[] {
  return words.length === 0
    ? []
    : [heading, ...words.map((word) => `- ${escapeMarkdown(word)}`)]
}

function listStopwords(discord: Discord): string {
  const data = discord.getStopwordStore().get()
  if (!data) {
    throw new ChannelConfigUnavailableError('Stopword config is unavailable')
  }
  const lines = [
    ...formatWordList(jaotantsMessages.stopwordListAdded, data.added),
    ...formatWordList(jaotantsMessages.stopwordListRemoved, data.removed),
  ]
  if (lines.length === 0) {
    return jaotantsMessages.stopwordListEmpty
  }

  const kept: string[] = []
  let length = 0
  for (const line of lines) {
    if (length + line.length + 1 > MAX_LIST_LENGTH) break
    kept.push(line)
    length += line.length + 1
  }
  return kept.length === lines.length
    ? kept.join('\n')
    : [
        ...kept,
        jaotantsMessages.stopwordListRest(lines.length - kept.length),
      ].join('\n')
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
  const group = interaction.options.getSubcommandGroup(false)
  const channelFeature = CHANNEL_FEATURES.find((feature) => feature === group)
  if (
    (channelFeature === undefined && group !== STOPWORD_GROUP) ||
    !['add', 'remove', 'list'].includes(subcommand)
  ) {
    await deny(jaotantsMessages.unknownSubcommand)
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  let content: string
  try {
    if (channelFeature === undefined) {
      content =
        subcommand === 'list'
          ? listStopwords(discord)
          : await changeStopword(
              discord,
              interaction,
              subcommand === 'add' ? 'add' : 'remove'
            )
    } else {
      switch (subcommand) {
        case 'add': {
          content = await addChannel(
            discord,
            interaction,
            guild,
            channelFeature
          )
          break
        }
        case 'remove': {
          content = await removeChannel(discord, interaction, channelFeature)
          break
        }
        default: {
          content = await listChannels(discord, guild, channelFeature)
        }
      }
    }
    logger.info(
      `👌 ${interaction.user.tag}: ${group} ${subcommand} -> ${content}`
    )
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
    const guildId = discord.getConfig().get('discord').guildId
    await (guildId
      ? application.commands.create(jaotantsGuildCommandData, guildId)
      : application.commands.create(jaotantsCommandData))
    logger.info('👌 registered /jaotants')
  } catch (error) {
    logger.error('❌ failed to register /jaotants', error as Error)
  }
}
