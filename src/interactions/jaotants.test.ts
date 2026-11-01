import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js'
import { Discord } from '@/discord'
import { ChannelConfigStore } from '@/features/channel-config-store'
import { StopwordStore } from '@/features/stopword-store'
import {
  handleJaotantsInteraction,
  jaotantsCommandData,
  jaotantsGuildCommandData,
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
  word?: string
  roles?: string[] | { cache: Map<string, unknown> }
  inGuild?: boolean
  guildId?: string
}

describe('jaotants command', () => {
  let directory: string
  let store: ChannelConfigStore
  let stopwordStore: StopwordStore
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
      getStopwordStore: () => stopwordStore,
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
        getString: (name: string) =>
          (name === 'word' ? options.word : options.channelIdString) ?? null,
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
    stopwordStore = new StopwordStore({ dataDirectory: directory })
    await stopwordStore.init()
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

  describe('word-ranking and stopword groups', () => {
    const stopwordsOf = () => stopwordStore.get()

    it('defines the word-ranking and stopword groups after vc-speech-log', () => {
      const groups = jaotantsCommandData.options as unknown as {
        name: string
        options: {
          name: string
          options?: {
            name: string
            required?: boolean
            min_length?: number
            max_length?: number
          }[]
        }[]
      }[]

      expect(groups.map((group) => group.name)).toEqual([
        'vc-speech-log',
        'word-ranking',
        'vc-word-ranking',
        'stopword',
      ])
      for (const channelGroup of [groups[1], groups[2]]) {
        expect(
          channelGroup.options.map((subcommand) => [
            subcommand.name,
            (subcommand.options ?? []).map((option) => option.name),
          ])
        ).toEqual([
          ['add', ['channel']],
          ['remove', ['channel', 'channel-id']],
          ['list', []],
        ])
      }
      expect(groups[3].options.map((subcommand) => subcommand.name)).toEqual([
        'add',
        'remove',
        'list',
      ])
      expect(groups[3].options[0].options).toEqual([
        expect.objectContaining({
          name: 'word',
          required: true,
          min_length: 1,
          max_length: 100,
        }),
      ])
    })

    describe('word-ranking channels', () => {
      it('adds a channel to word-ranking only, with a reminder about the audience', async () => {
        const interaction = await run({
          group: 'word-ranking',
          subcommand: 'add',
          channelId: CHANNEL_NEW,
        })

        expectEphemeralReply(
          interaction,
          `${jaotantsMessages.added(CHANNEL_NEW)}\n${jaotantsMessages.wordRankingNotice}`
        )
        expect(store.get('word-ranking')).toEqual([CHANNEL_NEW])
        expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
      })

      it('does not add the reminder to vc-speech-log', async () => {
        const interaction = await run({
          subcommand: 'add',
          channelId: CHANNEL_NEW,
        })

        expectEphemeralReply(interaction, jaotantsMessages.added(CHANNEL_NEW))
      })

      it('reports a duplicate without a reminder', async () => {
        await store.add('word-ranking', CHANNEL_NEW)

        const interaction = await run({
          group: 'word-ranking',
          subcommand: 'add',
          channelId: CHANNEL_NEW,
        })

        expectEphemeralReply(
          interaction,
          jaotantsMessages.alreadyRegistered(CHANNEL_NEW)
        )
      })

      it('rejects a channel the bot cannot read', async () => {
        botMember = null

        const interaction = await run({
          group: 'word-ranking',
          subcommand: 'add',
          channelId: CHANNEL_NEW,
        })

        expectEphemeralReply(
          interaction,
          jaotantsMessages.noBotPermission(CHANNEL_NEW)
        )
        expect(store.get('word-ranking')).toEqual([])
      })

      it('removes and lists channels independently of vc-speech-log', async () => {
        await store.add('word-ranking', CHANNEL_B)

        const listed = await run({ group: 'word-ranking', subcommand: 'list' })
        expectEphemeralReply(listed, jaotantsMessages.list(`- <#${CHANNEL_B}>`))

        const removed = await run({
          group: 'word-ranking',
          subcommand: 'remove',
          channelId: CHANNEL_B,
        })
        expectEphemeralReply(
          removed,
          jaotantsMessages.removed(`<#${CHANNEL_B}>`)
        )
        expect(store.get('word-ranking')).toEqual([])
        expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
      })

      it('shows the empty message when nothing is registered', async () => {
        const interaction = await run({
          group: 'word-ranking',
          subcommand: 'list',
        })

        expectEphemeralReply(interaction, jaotantsMessages.listEmpty)
      })
    })

    describe('vc-word-ranking channels', () => {
      it('adds a channel to vc-word-ranking only, without the audience reminder', async () => {
        const interaction = await run({
          group: 'vc-word-ranking',
          subcommand: 'add',
          channelId: CHANNEL_NEW,
        })

        expectEphemeralReply(interaction, jaotantsMessages.added(CHANNEL_NEW))
        expect(store.get('vc-word-ranking')).toEqual([CHANNEL_NEW])
        expect(store.get('vc-speech-log')).toEqual([CHANNEL_A])
        expect(store.get('word-ranking')).toEqual([])
      })

      it('removes and lists channels independently of the other features', async () => {
        await store.add('vc-word-ranking', CHANNEL_B)
        await store.add('word-ranking', CHANNEL_NEW)

        const listed = await run({
          group: 'vc-word-ranking',
          subcommand: 'list',
        })
        expectEphemeralReply(listed, jaotantsMessages.list(`- <#${CHANNEL_B}>`))

        const removed = await run({
          group: 'vc-word-ranking',
          subcommand: 'remove',
          channelId: CHANNEL_B,
        })
        expectEphemeralReply(
          removed,
          jaotantsMessages.removed(`<#${CHANNEL_B}>`)
        )
        expect(store.get('vc-word-ranking')).toEqual([])
        expect(store.get('word-ranking')).toEqual([CHANNEL_NEW])
      })

      it('shows the empty message when nothing is registered', async () => {
        const interaction = await run({
          group: 'vc-word-ranking',
          subcommand: 'list',
        })

        expectEphemeralReply(interaction, jaotantsMessages.listEmpty)
      })
    })

    describe('stopword', () => {
      it('adds a new word', async () => {
        const interaction = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ケツ',
        })

        expectEphemeralReply(
          interaction,
          jaotantsMessages.stopwordAdded('ケツ')
        )
        expect(stopwordsOf()).toEqual({ added: ['ケツ'], removed: [] })
      })

      it('normalizes the word like extracted words', async () => {
        const interaction = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ＡＢＣ',
        })

        expectEphemeralReply(interaction, jaotantsMessages.stopwordAdded('abc'))
        expect(stopwordsOf()).toEqual({ added: ['abc'], removed: [] })
      })

      it('reports a word that is already a stopword', async () => {
        await run({ group: 'stopword', subcommand: 'add', word: 'ケツ' })

        const duplicate = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ケツ',
        })
        const standard = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ゲーム',
        })

        expectEphemeralReply(duplicate, jaotantsMessages.stopwordExists('ケツ'))
        expectEphemeralReply(
          standard,
          jaotantsMessages.stopwordExists('ゲーム')
        )
        expect(stopwordsOf()).toEqual({ added: ['ケツ'], removed: [] })
      })

      it('excludes a standard stopword and restores it', async () => {
        const excluded = await run({
          group: 'stopword',
          subcommand: 'remove',
          word: 'ゲーム',
        })
        expectEphemeralReply(
          excluded,
          jaotantsMessages.stopwordExcluded('ゲーム')
        )
        expect(stopwordsOf()).toEqual({ added: [], removed: ['ゲーム'] })

        const again = await run({
          group: 'stopword',
          subcommand: 'remove',
          word: 'ゲーム',
        })
        expectEphemeralReply(again, jaotantsMessages.stopwordAbsent('ゲーム'))

        const restored = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ゲーム',
        })
        expectEphemeralReply(
          restored,
          jaotantsMessages.stopwordRestored('ゲーム')
        )
        expect(stopwordsOf()).toEqual({ added: [], removed: [] })
      })

      it('removes a custom word and reports an unknown word', async () => {
        await run({ group: 'stopword', subcommand: 'add', word: 'ケツ' })

        const removed = await run({
          group: 'stopword',
          subcommand: 'remove',
          word: 'ケツ',
        })
        const unknown = await run({
          group: 'stopword',
          subcommand: 'remove',
          word: 'ケツ',
        })

        expectEphemeralReply(removed, jaotantsMessages.stopwordRemoved('ケツ'))
        expectEphemeralReply(unknown, jaotantsMessages.stopwordAbsent('ケツ'))
        expect(stopwordsOf()).toEqual({ added: [], removed: [] })
      })

      it.each(['a b', ' ', 'a\tb'])(
        'rejects a word containing whitespace: %j',
        async (word) => {
          const interaction = await run({
            group: 'stopword',
            subcommand: 'add',
            word,
          })

          expectEphemeralReply(interaction, jaotantsMessages.invalidWord)
          expect(stopwordsOf()).toEqual({ added: [], removed: [] })
        }
      )

      it('rejects a word longer than 100 characters', async () => {
        const word = Array.from({ length: 101 }, (_, index) =>
          String.fromCodePoint(0x4e_00 + index)
        ).join('')

        const interaction = await run({
          group: 'stopword',
          subcommand: 'add',
          word,
        })

        expectEphemeralReply(interaction, jaotantsMessages.invalidWord)
        expect(stopwordsOf()).toEqual({ added: [], removed: [] })
      })

      it('shows a message when nothing is customized', async () => {
        const interaction = await run({ group: 'stopword', subcommand: 'list' })

        expectEphemeralReply(interaction, jaotantsMessages.stopwordListEmpty)
      })

      it('lists the added and excluded words', async () => {
        await run({ group: 'stopword', subcommand: 'add', word: 'ケツ' })
        await run({ group: 'stopword', subcommand: 'add', word: 'a*b' })
        await run({ group: 'stopword', subcommand: 'remove', word: 'ゲーム' })

        const interaction = await run({ group: 'stopword', subcommand: 'list' })

        expectEphemeralReply(
          interaction,
          [
            jaotantsMessages.stopwordListAdded,
            '- ケツ',
            '- a\\*b',
            jaotantsMessages.stopwordListRemoved,
            '- ゲーム',
          ].join('\n')
        )
      })

      it('cuts a long list and reports how many lines were left out', async () => {
        const words = Array.from(
          { length: 200 },
          (_, index) => `word${String(index).padStart(3, '0')}`
        )
        await stopwordStore.update(() => ({
          data: { added: words, removed: [] },
          result: undefined,
        }))

        const interaction = await run({ group: 'stopword', subcommand: 'list' })

        const [{ content }] = interaction.editReply.mock.calls[0] as [
          { content: string },
        ]
        const lines = content.split('\n')
        expect(lines[0]).toBe(jaotantsMessages.stopwordListAdded)
        expect(lines[1]).toBe('- word000')
        expect(lines.at(-2)).toBe('- word187')
        expect(lines.at(-1)).toBe(jaotantsMessages.stopwordListRest(12))
        expect(content.length).toBeLessThanOrEqual(2000)
      })

      it('reports an unavailable config', async () => {
        fs.writeFileSync(path.join(directory, 'word-stopwords.json'), '{broken')
        stopwordStore = new StopwordStore({ dataDirectory: directory })
        await stopwordStore.init()

        const add = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ケツ',
        })
        const list = await run({ group: 'stopword', subcommand: 'list' })

        expectEphemeralReply(add, jaotantsMessages.unavailable)
        expectEphemeralReply(list, jaotantsMessages.unavailable)
      })

      it('denies a member without the Admin role', async () => {
        const interaction = await run({
          group: 'stopword',
          subcommand: 'add',
          word: 'ケツ',
          roles: [DEVELOPER_ROLE_ID],
        })

        expectDenied(interaction, jaotantsMessages.forbidden)
        expect(stopwordsOf()).toEqual({ added: [], removed: [] })
      })
    })
  })

  describe('registerJaotantsCommand', () => {
    it('registers as a global command with contexts when guildId is not configured', async () => {
      await registerJaotantsCommand(createDiscord())

      expect(create).toHaveBeenCalledTimes(1)
      const [payload, guildId] = create.mock.calls[0] as [
        Record<string, unknown>,
        string | undefined,
      ]
      expect(guildId).toBeUndefined()
      expect(payload).toEqual(jaotantsCommandData)
      expect(payload.contexts).toEqual([InteractionContextType.Guild])
    })

    it('registers as a guild command without contexts when guildId is configured', async () => {
      discordConfig = { guildId: GUILD_ID }

      await registerJaotantsCommand(createDiscord())

      expect(create).toHaveBeenCalledTimes(1)
      const [payload, guildId] = create.mock.calls[0] as [
        Record<string, unknown>,
        string | undefined,
      ]
      expect(guildId).toBe(GUILD_ID)
      expect(payload).toEqual(jaotantsGuildCommandData)
      const sentKeys = Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key)
      expect(sentKeys).not.toContain('contexts')
      expect(sentKeys).not.toContain('integration_types')
      expect(payload.name).toBe(jaotantsCommandData.name)
      expect(payload.options).toEqual(jaotantsCommandData.options)
    })

    it('does not throw when registration fails', async () => {
      create.mockRejectedValue(new Error('api error'))

      await expect(
        registerJaotantsCommand(createDiscord())
      ).resolves.toBeUndefined()
    })
  })
})
