import { Discord } from '@/discord'
import { Colors, EmbedBuilder, Message } from 'discord.js'
import { BaseCommand } from '.'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

export class SetbannerCommand implements BaseCommand {
  readonly name = 'setbanner'
  readonly permissions = null

  async execute(
    _discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    const { author } = message

    // テンプレートファイルのパス
    const assetDirectory = process.env.ASSETS_DIR ?? 'assets'
    const templateImagePath = `${assetDirectory}/setbanner-template.png`

    // テキストの描画位置
    const x = 845
    const y = 265

    // 画像を生成
    const fonts = [
      { name: 'Noto Serif JP Black', fontFilename: 'NotoSerifJP-Black.otf' },
      {
        name: 'Noto Color Emoji',
        fontFilename: 'NotoColorEmoji-Regular.ttf',
      },
    ]
    for (const font of fonts) {
      const registerResult = GlobalFonts.registerFromPath(
        `${assetDirectory}/${font.fontFilename}`,
        font.name
      )
      if (!registerResult) {
        throw new Error(`フォントの登録に失敗しました: ${font.name}`)
      }
    }

    const canvas = createCanvas(960, 540)
    const ctx = canvas.getContext('2d')
    const templateImage = await loadImage(templateImagePath)
    ctx.drawImage(templateImage, 0, 0, 960, 540)

    // テキストを描画
    const text = args.join(' ')

    // 自動でフォントサイズを調整。フォントサイズ144pxを最大として、縦幅500pxに収まるようにする
    const textLength = text.length
    const fontSize = Math.min(144, 500 / (textLength * 1.3))
    const fontNames = fonts.map((font) => `'${font.name}'`).join(', ')
    ctx.font = `${fontSize * 1.4}px ${fontNames}`
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const characters = [...text]
    const lineHeight = fontSize * 1.4
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]
      const yOffset = (i - (characters.length - 1) / 2) * lineHeight
      ctx.fillText(char, x, y + yOffset)
    }

    // 画像をバナー画像として設定
    const buffer = canvas.toBuffer('image/png')
    await message.guild.setBanner(
      buffer,
      `Updated by setbanner command : ${author.tag}`
    )

    // 画像を送信
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ バナー画像を設定しました')
          .setDescription('サーバのバナー画像を更新しました')
          .setImage('attachment://banner.png')
          .setTimestamp(new Date())
          .setColor(Colors.Green),
      ],
      files: [
        {
          attachment: buffer,
          name: 'banner.png',
        },
      ],
    })
  }
}
