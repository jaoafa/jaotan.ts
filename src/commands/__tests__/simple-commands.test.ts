/* eslint-disable @typescript-eslint/unbound-method */
import { Message } from 'discord.js'
import { AlphaCommand } from '@/commands/alpha'
import { ContorandjaCommand } from '@/commands/controrandja'
import { PotatoCommand } from '@/commands/potato'
import { PingCommand } from '@/commands/ping'
import { PowaCommand } from '@/commands/powa'
import { SuperCommand } from '@/commands/super'
import { TmttmtCommand } from '@/commands/tmttmt'
import { TranslateCommand } from '@/commands/translate'
import { ToarCommand } from '@/commands/toar'
import { ToarjaCommand } from '@/commands/toarja'
import { TochaosCommand } from '@/commands/tochaos'
import { ToenCommand } from '@/commands/toen'
import { ToheCommand } from '@/commands/tohe'
import { TohejaCommand } from '@/commands/toheja'
import { TojaCommand } from '@/commands/toja'
import { TojaenCommand } from '@/commands/tojaen'
import { TokojaCommand } from '@/commands/tokoja'
import { TorandCommand } from '@/commands/torandja'
import { ToswjaCommand } from '@/commands/toswja'
import { TozhCommand } from '@/commands/tozh'
import { TozhjaCommand } from '@/commands/tozhja'
import { Discord } from '@/discord'
import { BaseCommand } from '@/commands/index'

const mockTranslate = {
  beginCommand: jest.fn(),
  detectLanguage: jest.fn(),
  execute: jest.fn(),
  randomLanguage: jest.fn(),
}

jest.mock(
  '@/features/translate',
  () => ({
    Translate: jest.fn().mockImplementation(() => mockTranslate),
  }),
  { virtual: true }
)

const message = {
  channel: { send: jest.fn() },
  reply: jest.fn(),
} as unknown as Message<true>

const discord = {
  getConfig: jest.fn(() => ({})),
} as unknown as Discord

describe('simple commands', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each<[BaseCommand, string]>([
    [
      new AlphaCommand(),
      'オ、オオwwwwwwwwオレアルファwwwwwwww最近めっちょふぁぼられてんねんオレwwwwwwwwエゴサとかかけるとめっちょ人気やねんwwwwァァァァァァァwwwクソアルファを見下しながら食べるエビフィレオは一段とウメェなァァァァwwwwwwww',
    ],
    [new PotatoCommand(), '(╮╯╭)'],
    [new PowaCommand(), 'ポわ～～～～～～～ｗｗｗｗ！！！ｗ！ｗｗ！ｗ！ｗ'],
    [
      new SuperCommand(),
      'ｽｩ( ᐛ👐) パァwﾍｸｻｺﾞｫﾝwwﾋﾞｷﾞｨﾝwﾃﾚﾚﾚﾚﾚﾚﾚﾃﾚﾚﾚﾚﾚﾚﾚﾃﾚﾚﾚﾚﾚﾚﾚwwﾃﾚｯﾃﾚｯﾃﾚｯwwʅ(´-౪-)ʃﾃﾞ─ﾝwwｹﾞｪｪﾑｵｰｳﾞｧｰwwwʅ(◜◡‾)ʃ?',
    ],
    [
      new TmttmtCommand(),
      'とまとぉwとまとぉw ( https://youtu.be/v372aagNItc )',
    ],
  ])('%s sends its configured response', async (command, response) => {
    await command.execute(discord, message, [])
    expect(message.channel.send).toHaveBeenCalledWith(response)
  })

  it('PingCommand replies with pong', async () => {
    await new PingCommand().execute(discord, message)

    expect(message.reply).toHaveBeenCalledWith('pong!')
  })

  it('TranslateCommand rejects incomplete arguments', async () => {
    await new TranslateCommand().execute(discord, message, ['ja', 'en'])

    expect(message.reply).toHaveBeenCalledWith(
      ':x: 引数が足りません。`/translate <before> <after> <text>` の形式で入力してください。'
    )
  })

  it.each<[BaseCommand, string[]]>([
    [new ToarCommand(), ['ar']],
    [new ToarjaCommand(), ['ar', 'ja']],
    [new ToenCommand(), ['en']],
    [new ToheCommand(), ['he']],
    [new TohejaCommand(), ['he', 'ja']],
    [new TojaCommand(), ['ja']],
    [new TojaenCommand(), ['ja', 'en']],
    [new TokojaCommand(), ['ko', 'ja']],
    [new ToswjaCommand(), ['sw', 'ja']],
    [new TozhCommand(), ['zh']],
    [new TozhjaCommand(), ['zh', 'ja']],
  ])(
    'translation command delegates to its configured target languages',
    async (command, languages) => {
      mockTranslate.beginCommand.mockResolvedValue(true)
      mockTranslate.detectLanguage.mockResolvedValue('en')

      await command.execute(discord, message, ['hello', 'world'])

      expect(mockTranslate.beginCommand).toHaveBeenCalledWith(
        message,
        'hello world'
      )
      expect(mockTranslate.detectLanguage).toHaveBeenCalledWith('hello world')
      expect(mockTranslate.execute).toHaveBeenCalledWith(
        message,
        'en',
        languages,
        'hello world'
      )
    }
  )

  it('translation commands stop when beginCommand rejects the request', async () => {
    mockTranslate.beginCommand.mockResolvedValue(false)

    await new TojaCommand().execute(discord, message, ['hello'])

    expect(mockTranslate.detectLanguage).not.toHaveBeenCalled()
    expect(mockTranslate.execute).not.toHaveBeenCalled()
  })

  it('TorandCommand selects an intermediate language and finishes in Japanese', async () => {
    mockTranslate.beginCommand.mockResolvedValue(true)
    mockTranslate.detectLanguage.mockResolvedValue('en')
    mockTranslate.randomLanguage.mockResolvedValue('fr')

    await new TorandCommand().execute(discord, message, ['hello'])

    expect(mockTranslate.randomLanguage).toHaveBeenCalledWith(['en', 'ja'])
    expect(mockTranslate.execute).toHaveBeenCalledWith(
      message,
      'en',
      ['fr', 'ja'],
      'hello'
    )
  })

  it('TochaosCommand chooses three to five intermediate languages before Japanese', async () => {
    mockTranslate.beginCommand.mockResolvedValue(true)
    mockTranslate.detectLanguage.mockResolvedValue('en')
    mockTranslate.randomLanguage.mockResolvedValue('fr')
    jest.spyOn(Math, 'random').mockReturnValue(0)

    await new TochaosCommand().execute(discord, message, ['hello'])

    expect(mockTranslate.randomLanguage).toHaveBeenCalledTimes(3)
    expect(mockTranslate.execute).toHaveBeenCalledWith(
      message,
      'en',
      ['fr', 'fr', 'fr', 'ja'],
      'hello'
    )
    jest.restoreAllMocks()
  })

  it('Contorandja delegates to the chaos translation command', async () => {
    mockTranslate.beginCommand.mockResolvedValue(false)

    await new ContorandjaCommand().execute(discord, message, ['hello'])

    expect(mockTranslate.beginCommand).toHaveBeenCalledWith(message, 'hello')
  })
})
