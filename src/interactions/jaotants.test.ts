import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js'
import { Discord } from '@/discord'
import { ChannelConfigStore } from '@/features/channel-config-store'
import {
  handleJaotantsInteraction,
  jaotantsCommandData,
  jaotantsMessages,
  registerJaotantsCommand,
} from '@/interactions/jaotants'

const GUILD_ID = '1138605145660326040'
const ADMIN_ROLE_ID = '1138605444600963163'
const DEVELOPER_ROLE_ID = '1138605444600963164'
const CHANNEL_A = '1149606247314767993'
const CHANNEL_B = '1555541589164560415'
const CHANNEL_NEW = '1200000000000000002'

interface InteractionOptions {
  subcommand: 'add' | 'remove' | 'list'
  group?: string
  channelId?: string
  channelIdString?: string
  roles?: string[] | { cache: Map<string, unknown> }
  inGuild?: boolean
  guildId?: string
}

describe('jaotants command', () => {
  let directory: string
  let store: ChannelConfigStore
  let discordConfig: {
    guildId?: string
    role?: { admin?: string }
  }
  let channels: Record<string, unknown>
  let botMember: unknown
  const create = jest.fn()

  const createChannel = (
    id: string,
    overrides: Record<string, unknown> = {}
  ) => ({
    id,
    type: ChannelType.GuildText,
    guildId: GUILD_ID,
    permissionsFor: () => ({
      has: (permissions: bigint[]) =>
        permissions.includes(PermissionFlagsBits.ViewChannel) &&
        permissions.includes(PermissionFlagsBits.ReadMessageHistory),
    }),
    ...overrides,
  })

  const deleteChannel = (id: string) => {
    channels = Object.fromEntries(
      Object.entries(channels).filter(([key]) => key !== id)
    )
  }

  const createDiscord = () =>
    ({
      getConfig: () => ({ get: () => discordConfig }),
      getChannelConfigStore: () => store,
      client: { application: { commands: { create } } },
    }) as unknown as Discord

  const createInteraction = (options: InteractionOptions) => {
    const interaction = {
      inGuild: () => options.inGuild ?? true,
      guildId: options.guildId ?? GUILD_ID,
      guild: {
        id: options.guildId ?? GUILD_ID,
        channels: {
          fetch: jest.fn((id: string) =>
            Object.hasOwn(channels, id)
              ? Promise.resolve(channels[id])
              : Promise.reject(new Error('Unknown Channel'))
          ),
        },
        members: { me: botMember },
      },
      member: { roles: options.roles ?? [ADMIN_ROLE_ID] },
      user: { tag: 'user#0001' },
      options: {
        getSubcommandGroup: () => options.group ?? 'vc-speech-log',
        getSubcommand: () => options.subcommand,
        getChannel: () =>
          options.channelId === undefined ? null : { id: options.channelId },
        getString: () => options.channelIdString ?? null,
      },
      reply: jest.fn(),
      deferReply: jest.fn(),
      editReply: jest.fn(),
    }
    return interaction
  }

  const run = async (options: InteractionOptions) => {
    const interaction = createInteraction(options)
    await handleJaotantsInteraction(
      createDiscord(),
      interaction as unknown as ChatInputCommandInteraction
    )
    return interaction
  }

  const expectEphemeralReply = (
    interaction: ReturnType<typeof createInteraction>,
    content: string
  ) => {
    expect(interaction.editReply).toHaveBeenCalledWith({
      content,
      allowedMentions: { parse: [] },
    })
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    })
  }

  const expectDenied = (
    interaction: ReturnType<typeof createInteraction>,
    content: string
  ) => {
    expect(interaction.reply).toHaveBeenCalledWith({
      content,
      flags: MessageFlags.Ephemeral,
    })
    expect(interaction.deferReply).not.toHaveBeenCalled()
  }

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jaotants-'))
    store = new ChannelConfigStore({
      dataDirectory: directory,
      legacyChannelIds: () => [CHANNEL_A],
    })
    await store.init()
    discordConfig = {}
    channels = {
      [CHANNEL_A]: createChannel(CHANNEL_A),
      [CHANNEL_B]: createChannel(CHANNEL_B),
      [CHANNEL_NEW]: createChannel(CHANNEL_NEW),
    }
    botMember = { id: 'bot' }
    create.mockReset()
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  describe('command definition', () => {
    it('defines vc-speech-log add / remove / list under /jaotants', () => {
      const data = jaotantsCommandData
      const group = data.options?.[0] as {
        name: string
        options: { name: string; options?: { name: string }[] }[]
      }

      expect(data.name).toBe('jaotants')
      expect(data.default_member_permissions).toBeUndefined()
      expect(group.name).toBe('vc-speech-log')
      expect(
        group.options.map((subcommand) => [
          subcommand.name,
          (subcommand.options ?? []).map((option) => option.name),
        ])
      ).toEqual([
        ['add', ['channel']],
        ['remove', ['channel', 'channel-id']],
        ['list', []],
      ])
    })
  })

  describe('authorization', () => {
    it('allows a member with the default Admin role', async () => {
      const interaction = await run({ subcommand: 'list' })

      expect(interaction.reply).not.toHaveBeenCalled()
      expectEphemeralReply(
        interaction,
        jaotantsMessages.list(`- <#${CHANNEL_A}>`)
      )
    })

    it('uses discord.role.admin when it is configured', async () => {
      discordConfig = { role: { admin: 'custom-admin' } }

      const denied = await run({ subcommand: 'list' })
      const allowed = await run({
        subcommand: 'list',
        roles: ['custom-admin'],
      })

      expectDenied(denied, jaotantsMessages.forbidden)
      expect(allowed.deferReply).toHaveBeenCalled()
    })

    it('supports GuildMember roles managers', async () => {
      const interaction = await run({
        subcommand: 'list',
        roles: { cache: new Map([[ADMIN_ROLE_ID, {}]]) },
      })

      expect(interaction.deferReply).toHaveBeenCalled()
    })

    it.each([
      ['a Developer-only member', [DEVELOPER_ROLE_ID]],
      ['a member without roles', []],
    ])('denies %s', async (_name, roles) => {
      for (const subcommand of ['add', 'remove', 'list'] as const) {
        const interaction = await run({
          subcommand,
          roles,
          channelId: CHANNEL_NEW,
        })

        expectDenied(interaction, jaotantsMessages.forbidden)
      }
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('does not grant access from the Administrator permission alone', async () => {
      const interaction = createInteraction({
        subcommand: 'list',
        roles: [DEVELOPER_ROLE_ID],
      })
      ;(interaction.member as Record<string, unknown>).permissions = {
        has: () => true,
      }

      await handleJaotantsInteraction(
        createDiscord(),
        interaction as unknown as ChatInputCommandInteraction
      )

      expectDenied(interaction, jaotantsMessages.forbidden)
    })

    it('denies execution outside a guild', async () => {
      const interaction = await run({ subcommand: 'list', inGuild: false })

      expectDenied(interaction, jaotantsMessages.guildOnly)
    })

    it('denies a guild other than discord.guildId', async () => {
      discordConfig = { guildId: GUILD_ID }

      const interaction = await run({
        subcommand: 'list',
        guildId: 'other-guild',
      })

      expectDenied(interaction, jaotantsMessages.guildOnly)
    })

    it('allows the configured guild', async () => {
      discordConfig = { guildId: GUILD_ID }

      const interaction = await run({ subcommand: 'list' })

      expect(interaction.deferReply).toHaveBeenCalled()
    })
  })

  describe('add', () => {
    it('adds a channel and reflects it in the store immediately', async () => {
      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(interaction, jaotantsMessages.added(CHANNEL_NEW))
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A, CHANNEL_NEW])
    })

    it('reports a duplicate without changing the store', async () => {
      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_A,
      })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.alreadyRegistered(CHANNEL_A)
      )
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('rejects a non-text channel', async () => {
      channels[CHANNEL_NEW] = createChannel(CHANNEL_NEW, {
        type: ChannelType.GuildVoice,
      })

      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(interaction, jaotantsMessages.notTextChannel)
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('rejects a channel of another guild', async () => {
      channels[CHANNEL_NEW] = createChannel(CHANNEL_NEW, {
        guildId: 'other-guild',
      })

      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(interaction, jaotantsMessages.otherGuild)
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('rejects a channel the bot cannot read', async () => {
      channels[CHANNEL_NEW] = createChannel(CHANNEL_NEW, {
        permissionsFor: () => ({ has: () => false }),
      })

      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.noBotPermission(CHANNEL_NEW)
      )
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('rejects when the bot member cannot be resolved', async () => {
      botMember = null

      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.noBotPermission(CHANNEL_NEW)
      )
    })
  })

  describe('remove', () => {
    it('removes a channel selected with the channel option', async () => {
      const interaction = await run({
        subcommand: 'remove',
        channelId: CHANNEL_A,
      })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.removed(`<#${CHANNEL_A}>`)
      )
      expect(store.get('vc-speech-log')).toEqual([])
    })

    it('removes a deleted channel by id', async () => {
      await store.add('vc-speech-log', CHANNEL_NEW)
      deleteChannel(CHANNEL_NEW)

      const interaction = await run({
        subcommand: 'remove',
        channelIdString: CHANNEL_NEW,
      })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.removed(`\`${CHANNEL_NEW}\``)
      )
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('reports an unregistered channel without changing the store', async () => {
      const interaction = await run({
        subcommand: 'remove',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.notRegistered(`<#${CHANNEL_NEW}>`)
      )
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('rejects both channel and channel-id', async () => {
      const interaction = await run({
        subcommand: 'remove',
        channelId: CHANNEL_A,
        channelIdString: CHANNEL_A,
      })

      expectEphemeralReply(interaction, jaotantsMessages.removeNeedsOne)
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })

    it('rejects neither channel nor channel-id', async () => {
      const interaction = await run({ subcommand: 'remove' })

      expectEphemeralReply(interaction, jaotantsMessages.removeNeedsOne)
    })

    it('rejects a malformed channel-id', async () => {
      const interaction = await run({
        subcommand: 'remove',
        channelIdString: 'abc',
      })

      expectEphemeralReply(interaction, jaotantsMessages.invalidChannelId)
      expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
    })
  })

  describe('list', () => {
    it('lists channels as mentions and unresolved ones as ids', async () => {
      await store.add('vc-speech-log', CHANNEL_NEW)
      deleteChannel(CHANNEL_NEW)

      const interaction = await run({ subcommand: 'list' })

      expectEphemeralReply(
        interaction,
        jaotantsMessages.list(`- <#${CHANNEL_A}>\n- \`${CHANNEL_NEW}\``)
      )
    })

    it('reports an empty list', async () => {
      await store.remove('vc-speech-log', CHANNEL_A)

      const interaction = await run({ subcommand: 'list' })

      expectEphemeralReply(interaction, jaotantsMessages.listEmpty)
    })
  })

  describe('store failures', () => {
    it('reports that the config is unavailable when the store is broken', async () => {
      fs.writeFileSync(path.join(directory, 'channel-config.json'), '{broken')
      store = new ChannelConfigStore({
        dataDirectory: directory,
        legacyChannelIds: () => [],
      })
      await store.init()

      for (const subcommand of ['add', 'remove', 'list'] as const) {
        const interaction = await run({
          subcommand,
          channelId: CHANNEL_NEW,
        })

        expectEphemeralReply(interaction, jaotantsMessages.unavailable)
      }
    })

    it('does not report success when saving fails', async () => {
      jest.spyOn(store, 'add').mockRejectedValue(new Error('disk full'))

      const interaction = await run({
        subcommand: 'add',
        channelId: CHANNEL_NEW,
      })

      expectEphemeralReply(interaction, jaotantsMessages.failed)
      jest.restoreAllMocks()
    })
  })

  describe('unknown subcommand group', () => {
    it('replies with an error without touching the store', async () => {
      const interaction = await run({
        subcommand: 'list',
        group: 'unknown',
      })

      expectDenied(interaction, jaotantsMessages.unknownSubcommand)
    })
  })

  describe('registerJaotantsCommand', () => {
    it('registers as a global command when guildId is not configured', async () => {
      await registerJaotantsCommand(createDiscord())

      expect(create).toHaveBeenCalledWith(jaotantsCommandData, undefined)
    })

    it('registers as a guild command when guildId is configured', async () => {
      discordConfig = { guildId: GUILD_ID }

      await registerJaotantsCommand(createDiscord())

      expect(create).toHaveBeenCalledWith(jaotantsCommandData, GUILD_ID)
    })

    it('does not throw when registration fails', async () => {
      create.mockRejectedValue(new Error('api error'))

      await expect(
        registerJaotantsCommand(createDiscord())
      ).resolves.toBeUndefined()
    })
  })
})
