import { Discord } from '@/discord'
import {
  BaseMessageOptions,
  Colors,
  EmbedBuilder,
  EmbedField,
  Message,
} from 'discord.js'
import { BaseCommand, Permission } from '.'
import { Translate } from '@/features/translate'

export class TranslateCommand implements BaseCommand {
  get name(): string {
    return 'translate'
  }

  get permissions(): Permission[] | null {
    return null
  }

  async execute(
    discord: Discord,
    message: Message<boolean>,
    args: string[]
  ): Promise<void> {
    // 引数は最低3つ必要
    if (args.length < 3) {
      await message.reply(
        ':x: 引数が足りません。`/translate <before> <after> <text>` の形式で入力してください。'
      )
      return
    }

    // 翻訳前の言語、翻訳後の言語、翻訳するテキストを取得
    const beforeLanguage = args[0]
    const afterLanguage = args[1]
    const text = args.slice(2).join(' ')

    const config = discord.getConfig()
    const translate = new Translate(config)

    // 翻訳前の言語、翻訳後の言語、翻訳するテキストが正しいか確認
    if (!translate.isValidateLanguage(beforeLanguage)) {
      await message.reply(
        this.getEmbedMessage(
          'ERROR',
          '翻訳失敗',
          `\`${beforeLanguage}\` は無効な言語です。`
        )
      )
      return
    }
    if (!translate.isValidateLanguage(afterLanguage)) {
      this.getEmbedMessage(
        'ERROR',
        '翻訳失敗',
        `\`${afterLanguage}\` は無効な言語です。`
      )
      return
    }
    if (beforeLanguage === afterLanguage) {
      this.getEmbedMessage(
        'ERROR',
        '翻訳失敗',
        '翻訳前の言語と翻訳後の言語が同じです。'
      )
      return
    }
    if (!text) {
      this.getEmbedMessage(
        'ERROR',
        '翻訳失敗',
        '翻訳するテキストがありません。'
      )
      return
    }

    // 翻訳処理前にメッセージを送信
    const reply = await message.reply(
      this.getEmbedMessage('PENDING', '翻訳中', '翻訳しています...')
    )

    // 翻訳処理
    const result = await translate.translate(
      beforeLanguage,
      afterLanguage,
      text
    )
    // 言語の日本語名を取得
    const beforeLanguageName = translate.getLanguageName(beforeLanguage)
    const afterLanguageName = translate.getLanguageName(afterLanguage)

    // 翻訳結果を送信
    await reply.edit(
      this.getEmbedMessage('SUCCESS', '翻訳が完了しました', null, [
        {
          name: `\`${beforeLanguageName}\` -> \`${afterLanguageName}\``,
          value: `\`\`\`${result.result}\`\`\``,
          inline: true,
        },
      ])
    )
  }

  /**
   * 埋め込みメッセージ（Embed）を取得
   *
   * @param type メッセージの種類（成功、失敗、処理中）
   * @param title タイトル
   * @param description 説明
   * @param fields フィールド
   * @returns 埋め込みメッセージ
   */
  private getEmbedMessage(
    type: 'SUCCESS' | 'ERROR' | 'PENDING',
    title: string,
    description: string | null = null,
    fields: EmbedField[] = []
  ): BaseMessageOptions {
    const color =
      type === 'SUCCESS'
        ? Colors.Green
        : type === 'ERROR'
        ? Colors.Red
        : type === 'PENDING'
        ? Colors.Yellow
        : Colors.Grey
    const emoji =
      type === 'SUCCESS'
        ? ':white_check_mark:'
        : type === 'ERROR'
        ? ':x:'
        : type === 'PENDING'
        ? ':hourglass_flowing_sand:'
        : ':grey_question:'

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${title}`)
      .setDescription(description)
      .setColor(color)
      .setFields(fields)
      .setTimestamp(Date.now())
    return {
      embeds: [embed],
    }
  }
}
