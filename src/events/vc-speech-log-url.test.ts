import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ChannelType, EmbedBuilder, Message } from 'discord.js'
import { Discord } from '@/discord'
import { ChannelConfigStore } from '@/features/channel-config-store'
import { VCSpeechLogMessageUrlEvent } from '@/events/vc-speech-log-url'

const GUILD_ID = '1138605145660326040'
const REGISTERED_CHANNEL = '1149606247314767993'
const OTHER_CHANNEL = '1555541589164560415'
const SOURCE_MESSAGE_ID = '1300000000000000001'

describe('VCSpeechLogMessageUrlEvent', () => {
  let directory: string
  let store: ChannelConfigStore
  const send = jest.fn()
  const fetchMessage = jest.fn()
  const fetchChannel = jest.fn()

  const createMessage = (channelId: string) =>
    ({
      member: {},
      author: { bot: false },
      content: `https://discord.com/channels/${GUILD_ID}/${channelId}/${SOURCE_MESSAGE_ID}`,
      guild: { channels: { fetch: fetchChannel } },
      channel: { send },
    }) as unknown as Message<true>

  const execute = (message: Message<true>) =>
    new VCSpeechLogMessageUrlEvent({
      getChannelConfigStore: () => store,
    } as unknown as Discord).execute(message)

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-speech-log-url-'))
    store = new ChannelConfigStore({
      dataDirectory: directory,
      legacyChannelIds: () => [REGISTERED_CHANNEL],
    })
    send.mockReset()
    fetchMessage.mockReset().mockResolvedValue({
      content: 'quoted text',
      createdAt: new Date('2026-10-28T00:00:00Z'),
    })
    fetchChannel.mockReset().mockResolvedValue({
      type: ChannelType.GuildText,
      name: 'vc-speech-log',
      messages: { fetch: fetchMessage },
    })
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('quotes a message linked from a registered channel', async () => {
    await store.init()

    const message = createMessage(REGISTERED_CHANNEL)

    await execute(message)

    expect(fetchChannel).toHaveBeenCalledWith(REGISTERED_CHANNEL)
    expect(fetchMessage).toHaveBeenCalledWith(SOURCE_MESSAGE_ID)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: { messageReference: message, failIfNotExists: false },
      })
    )
    const [{ embeds }] = send.mock.calls[0] as [{ embeds: EmbedBuilder[] }]
    const embed = embeds[0].toJSON()
    expect(embed.description).toBe('quoted text')
    expect(embed.footer).toEqual({ text: '#vc-speech-log' })
  })

  it('ignores a link to a channel that is not registered', async () => {
    await store.init()

    await execute(createMessage(OTHER_CHANNEL))

    expect(fetchChannel).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing while the store is unavailable', async () => {
    await execute(createMessage(REGISTERED_CHANNEL))

    expect(fetchChannel).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('reflects add and remove immediately', async () => {
    await store.init()

    await execute(createMessage(OTHER_CHANNEL))
    expect(send).not.toHaveBeenCalled()

    await store.add('vc-speech-log', OTHER_CHANNEL)
    await execute(createMessage(OTHER_CHANNEL))
    expect(send).toHaveBeenCalledTimes(1)

    await store.remove('vc-speech-log', OTHER_CHANNEL)
    await execute(createMessage(OTHER_CHANNEL))
    expect(send).toHaveBeenCalledTimes(1)
  })
})
