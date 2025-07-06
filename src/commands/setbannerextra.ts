import { Discord } from '@/discord'
import { Colors, EmbedBuilder, Message } from 'discord.js'
import { BaseCommand } from '.'
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  CanvasRenderingContext2D,
  Image,
} from '@napi-rs/canvas'

interface ParsedEmoji {
  image: Image | null
  text: string | null
}

export class SetbannerExtraCommand implements BaseCommand {
  readonly name = 'setbannerextra'
  readonly permissions = null

  private emojiRegex = /<(?<animated>a?):(?<name>\w+):(?<id>\d+)>/

  async execute(
    _discord: Discord,
    message: Message<true>,
    args: string[]
  ): Promise<void> {
    const { author } = message

    // テンプレートファイルのパス
    const assetDirectory = process.env.ASSETS_DIR ?? 'assets'
    const templateBaseImagePath = `${assetDirectory}/setbanner-template-base.png`
    const templateOverlayImagePath = `${assetDirectory}/setbanner-template-overlay.png`

    // 左側テキストの描画位置
    const leftX = 100
    const leftY = 265

    // 左側絵文字の描画位置
    const leftEmojiX = 300
    const leftEmojiY = 300

    // 右側絵文字の描画位置
    const rightEmojiX = 600
    const rightEmojiY = 300

    // 右側テキストの描画位置
    const rightX = 845
    const rightY = 265

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
    const templateImage = await loadImage(templateBaseImagePath)
    ctx.drawImage(templateImage, 0, 0, 960, 540)

    // 引数を処理
    // 1: 左側テキスト
    // 2: 左側絵文字
    // 3: 右側絵文字
    // 4: 右側テキスト
    args = args.map((arg) => arg.trim())
    if (args.length < 4) {
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ 引数が足りません')
            .setDescription(
              'このコマンドは4つの引数を必要とします。\n1: 左側テキスト\n2: 左側絵文字\n3: 右側絵文字\n4: 右側テキスト'
            )
            .setColor(Colors.Red),
        ],
      })
      return
    }

    // 左側テキストと絵文字
    const leftText = args[0]
    const leftEmoji = args[1]
    // 右側絵文字とテキスト
    const rightEmoji = args[2]
    const rightText = args[3]

    // 絵文字文字列をパース
    const leftEmojiParsed = await this.parseEmojiText(leftEmoji)
    const rightEmojiParsed = await this.parseEmojiText(rightEmoji)

    // 絵文字を描画
    if (leftEmojiParsed.image) {
      ctx.drawImage(
        leftEmojiParsed.image,
        leftEmojiX - 70,
        leftEmojiY - 70,
        200,
        200
      )
    } else {
      this.drawText(
        ctx,
        leftEmojiParsed.text ?? leftEmoji,
        leftEmojiX + 32,
        leftEmojiY + 32,
        fonts
      )
    }
    if (rightEmojiParsed.image) {
      ctx.drawImage(
        rightEmojiParsed.image,
        rightEmojiX - 70,
        rightEmojiY - 70,
        200,
        200
      )
    } else {
      this.drawText(
        ctx,
        rightEmojiParsed.text ?? rightEmoji,
        rightEmojiX + 32,
        rightEmojiY + 32,
        fonts
      )
    }

    // テキストを描画
    this.drawText(ctx, leftText, leftX, leftY, fonts)
    this.drawText(ctx, rightText, rightX, rightY, fonts)

    // オーバーレイ画像を描画
    const overlayImage = await loadImage(templateOverlayImagePath)
    ctx.drawImage(overlayImage, 0, 0, 960, 540)

    // 画像をバナー画像として設定
    const buffer = canvas.toBuffer('image/png')
    await message.guild.setBanner(
      buffer,
      `Updated by setbannerextra command : ${author.tag}`
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

  async parseEmojiText(emojiText: string): Promise<ParsedEmoji> {
    // URLの場合は、loadImageで読み込む
    if (emojiText.startsWith('http')) {
      try {
        const image = await loadImage(emojiText)
        return { image, text: null }
      } catch (error) {
        console.error(`Failed to load image from URL: ${emojiText}`, error)
        return { image: null, text: emojiText }
      }
    }

    // <:emoji_name:id> or <a:emoji_name:id> の場合は、絵文字を画像として読み込む
    const match = emojiText.match(this.emojiRegex)
    if (match) {
      const { groups } = match
      if (groups?.id) {
        try {
          const image = await loadImage(
            `https://cdn.discordapp.com/emojis/${groups.id}.png`
          )
          return { image, text: null }
        } catch (error) {
          console.error(`Failed to load emoji image: ${emojiText}`, error)
          return { image: null, text: emojiText }
        }
      }
    }

    // それ以外は、テキストとして扱う
    return { image: null, text: emojiText }
  }

  drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fonts: { name: string; fontFilename: string }[]
  ) {
    // 自動でフォントサイズを調整。フォントサイズ144pxを最大として、縦幅500pxに収まるようにする
    const textLength = text.length
    const fontSize = Math.min(144, 500 / (textLength * 1.3))
    const fontNames = fonts.map((font) => `'${font.name}'`).join(', ')
    ctx.font = `${fontSize * 1.4}px ${fontNames}`
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- unicorn/prefer-spread と競合
    const characters = [...text]
    const lineHeight = fontSize * 1.4
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]
      const yOffset = (i - (characters.length - 1) / 2) * lineHeight
      ctx.fillText(char, x, y + yOffset)
    }
  }
}
