import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MessageReaction, User } from 'discord.js'
import { Discord } from '@/discord'
import { EmojiRanking } from '@/features/emoji-ranking'
import {
  EmojiReactionAddEvent,
  EmojiReactionRemoveEvent,
} from '@/events/emoji-reaction'

describe('Emoji reaction events', () => {
  let beforeDataDir: string | undefined
  let dataDir: string

  beforeEach(() => {
    beforeDataDir = process.env.DATA_DIR
    dataDir = fs.mkdtempSync(path.join(tmpdir(), 'emoji-reaction-test-'))
    process.env.DATA_DIR = dataDir
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
    if (beforeDataDir === undefined) {
      delete process.env.DATA_DIR
    } else {
      process.env.DATA_DIR = beforeDataDir
    }
  })

  it('records custom emoji reactions from human guild members', async () => {
    const add = jest
      .spyOn(EmojiRanking.prototype, 'addReaction')
      .mockImplementation(() => undefined)
    const reaction = {
      partial: false,
      emoji: { name: 'dance', id: '123', animated: true },
      message: { partial: false, inGuild: () => true },
    } as unknown as MessageReaction

    await new EmojiReactionAddEvent({} as Discord).execute(reaction, {
      partial: false,
      bot: false,
    } as User)

    expect(add).toHaveBeenCalledWith({
      kind: 'custom',
      key: 'dance:123',
      display: '<a:dance:123>',
    })
  })

  it('removes a Unicode reaction from the ranking', async () => {
    const remove = jest
      .spyOn(EmojiRanking.prototype, 'removeReaction')
      .mockImplementation(() => undefined)
    const reaction = {
      partial: false,
      emoji: { name: '🎉', id: null },
      message: { partial: false, inGuild: () => true },
    } as unknown as MessageReaction

    await new EmojiReactionRemoveEvent({} as Discord).execute(reaction, {
      partial: false,
      bot: false,
    } as User)

    expect(remove).toHaveBeenCalledWith({
      kind: 'unicode',
      key: '🎉',
      display: '🎉',
    })
  })
})
