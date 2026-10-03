import { Message } from 'discord.js'
import { Discord } from '@/discord'
import { EmojiRanking } from '@/features/emoji-ranking'
import { EmojiMessageEvent } from '@/events/emoji-message'

describe('EmojiMessageEvent', () => {
  it('records emojis in guild messages from non-bot users', async () => {
    const addMessageEmojis = jest
      .spyOn(EmojiRanking.prototype, 'addMessageEmojis')
      .mockImplementation(() => undefined)
    const event = new EmojiMessageEvent({} as Discord)
    const message = {
      author: { bot: false },
      inGuild: () => true,
      content: 'hello 🎉',
    } as unknown as Message

    await event.execute(message)

    expect(addMessageEmojis).toHaveBeenCalledWith([
      { kind: 'unicode', key: '🎉', display: '🎉' },
    ])
    addMessageEmojis.mockRestore()
  })

  it.each([
    [{ bot: true }, true],
    [{ bot: false }, false],
  ])('ignores bot or non-guild messages', async (author, inGuild) => {
    const addMessageEmojis = jest.spyOn(
      EmojiRanking.prototype,
      'addMessageEmojis'
    )
    const event = new EmojiMessageEvent({} as Discord)
    const message = {
      author,
      inGuild: () => inGuild,
      content: '🎉',
    } as unknown as Message

    await event.execute(message)

    expect(addMessageEmojis).not.toHaveBeenCalled()
    addMessageEmojis.mockRestore()
  })
})
