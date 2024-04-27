import { Configuration } from '@/config'
import axios from 'axios'
import DetectLanguage from 'detectlanguage'
import {
  BaseMessageOptions,
  Colors,
  EmbedBuilder,
  EmbedField,
  Message,
} from 'discord.js'

export interface TranslateResult {
  beforeLanguage: string
  afterLanguage: string
  result: string
}

interface TranslateResponse {
  request: {
    before: string
    after: string
    text: string
  }
  response: {
    status: boolean
    result: string
    text: string
  }
}

export class Translate {
  private readonly translateGasUrl: string
  private readonly detectLanguageApiToken: string | null

  private readonly languages: Record<string, string> = {
    af: 'アフリカーンス語',
    sq: 'アルバニア語',
    am: 'アムハラ語',
    ar: 'アラビア文字',
    hy: 'アルメニア語',
    az: 'アゼルバイジャン語',
    eu: 'バスク語',
    be: 'ベラルーシ語',
    bn: 'ベンガル文字',
    bs: 'ボスニア語',
    bg: 'ブルガリア語',
    ca: 'カタロニア語',
    ceb: 'セブ語',
    zh: '中国語（簡体）',
    'zh-cn': '中国語（簡体）',
    'zh-tw': '中国語（繁体）',
    co: 'コルシカ語',
    hr: 'クロアチア語',
    cs: 'チェコ語',
    da: 'デンマーク語',
    nl: 'オランダ語',
    en: '英語',
    eo: 'エスペラント語',
    et: 'エストニア語',
    fi: 'フィンランド語',
    fr: 'フランス語',
    fy: 'フリジア語',
    gl: 'ガリシア語',
    ka: 'グルジア語',
    de: 'ドイツ語',
    el: 'ギリシャ語',
    gu: 'グジャラト語',
    ht: 'クレオール語（ハイチ）',
    ha: 'ハウサ語',
    haw: 'ハワイ語',
    he: 'ヘブライ語',
    iw: 'ヘブライ語',
    hi: 'ヒンディー語',
    hmn: 'モン語',
    hu: 'ハンガリー語',
    is: 'アイスランド語',
    ig: 'イボ語',
    id: 'インドネシア語',
    ga: 'アイルランド語',
    it: 'イタリア語',
    ja: '日本語',
    jv: 'ジャワ語',
    kn: 'カンナダ語',
    kk: 'カザフ語',
    km: 'クメール語',
    rw: 'キニヤルワンダ語',
    ko: '韓国語',
    ku: 'クルド語',
    ky: 'キルギス語',
    lo: 'ラオ語',
    lv: 'ラトビア語',
    lt: 'リトアニア語',
    lb: 'ルクセンブルク語',
    mk: 'マケドニア語',
    mg: 'マラガシ語',
    ms: 'マレー語',
    ml: 'マラヤーラム文字',
    mt: 'マルタ語',
    mi: 'マオリ語',
    mr: 'マラーティー語',
    mn: 'モンゴル語',
    my: 'ミャンマー語（ビルマ語）',
    ne: 'ネパール語',
    no: 'ノルウェー語',
    ny: 'ニャンジャ語（チェワ語）',
    or: 'オリヤ語',
    ps: 'パシュト語',
    fa: 'ペルシャ語',
    pl: 'ポーランド語',
    pt: 'ポルトガル語（ポルトガル、ブラジル）',
    pa: 'パンジャブ語',
    ro: 'ルーマニア語',
    ru: 'ロシア語',
    sm: 'サモア語',
    gd: 'スコットランド ゲール語',
    sr: 'セルビア語',
    st: 'セソト語',
    sn: 'ショナ語',
    sd: 'シンド語',
    si: 'シンハラ語',
    sk: 'スロバキア語',
    sl: 'スロベニア語',
    so: 'ソマリ語',
    es: 'スペイン語',
    su: 'スンダ語',
    sw: 'スワヒリ語',
    sv: 'スウェーデン語',
    tl: 'タガログ語（フィリピン語）',
    tg: 'タジク語',
    ta: 'タミル語',
    tt: 'タタール語',
    te: 'テルグ語',
    th: 'タイ語',
    tr: 'トルコ語',
    tk: 'トルクメン語',
    uk: 'ウクライナ語',
    ur: 'ウルドゥー語',
    ug: 'ウイグル語',
    uz: 'ウズベク語',
    vi: 'ベトナム語',
    cy: 'ウェールズ語',
    xh: 'コーサ語',
    yi: 'イディッシュ語',
    yo: 'ヨルバ語',
    zu: 'ズールー語',
  }

  constructor(config: Configuration) {
    const translateGasUrl = config.get('translateGasUrl')
    const detectLanguageApiToken = config.get('detectLanguageApiToken')
    if (!translateGasUrl) {
      throw new Error('translateGasUrl is required')
    }

    this.translateGasUrl = translateGasUrl
    this.detectLanguageApiToken = detectLanguageApiToken ?? null
  }

  async translate(
    beforeLanguage: string,
    afterLanguage: string,
    text: string
  ): Promise<TranslateResult> {
    if (!this.isValidateLanguage(beforeLanguage)) {
      throw new Error('Invalid before language')
    }
    if (!this.isValidateLanguage(afterLanguage)) {
      throw new Error('Invalid after language')
    }

    const response = await axios.post<TranslateResponse>(
      this.translateGasUrl,
      {
        before: beforeLanguage,
        after: afterLanguage,
        text,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    )
    if (response.status !== 200) {
      throw new Error('Failed to translate')
    }

    const data = response.data
    return {
      beforeLanguage,
      afterLanguage,
      result: data.response.result,
    }
  }

  async detectLanguage(text: string): Promise<string> {
    if (!this.detectLanguageApiToken) {
      throw new Error('detectLanguageApiToken is required')
    }
    const detectLanguage = new DetectLanguage(this.detectLanguageApiToken)
    const result = await detectLanguage.detect(text)
    if (result.length === 0) {
      throw new Error('Failed to detect language')
    }

    return result[0].language
  }

  public async execute(
    message: Message,
    beforeLanguage: string,
    afterLanguages: string[],
    text: string
  ) {
    // 翻訳前の言語、翻訳後の言語、翻訳するテキストが正しいか確認
    if (!this.isValidateLanguage(beforeLanguage)) {
      await message.reply(
        this.getEmbedMessage(
          'ERROR',
          '翻訳失敗',
          `\`${beforeLanguage}\` はサポートされていないか、無効な言語です。`
        )
      )
      return
    }
    if (afterLanguages.length === 0) {
      await message.reply(
        this.getEmbedMessage(
          'ERROR',
          '翻訳失敗',
          '翻訳後の言語が指定されていません。'
        )
      )
      return
    }
    for (const language of afterLanguages) {
      if (!this.isValidateLanguage(language)) {
        await message.reply(
          this.getEmbedMessage(
            'ERROR',
            '翻訳失敗',
            `\`${language}\` はサポートされていないか、無効な言語です。`
          )
        )
        return
      }
    }
    if (!text) {
      await message.reply(
        this.getEmbedMessage(
          'ERROR',
          '翻訳失敗',
          '翻訳するテキストがありません。'
        )
      )
      return
    }

    // 翻訳処理前にメッセージを送信
    const reply = await message.reply(
      this.getEmbedMessage('PENDING', '翻訳中', '翻訳しています...')
    )

    // 翻訳処理
    // afterLanguagesの順番で翻訳。翻訳後の言語が複数ある場合は、翻訳後の言語の数だけ繰り返す
    const fields: EmbedField[] = []
    for (let i = 0; i < afterLanguages.length; i++) {
      const language = afterLanguages[i]

      if (beforeLanguage === language) {
        await reply.edit(
          this.getEmbedMessage(
            'ERROR',
            '翻訳失敗',
            `\`${beforeLanguage}\` から \`${language}\` への翻訳はできません。`
          )
        )
        return
      }

      const result = await this.translate(beforeLanguage, language, text)
      // 言語の日本語名を取得
      const beforeLanguageName = this.getLanguageName(beforeLanguage)
      const afterLanguageName = this.getLanguageName(language)

      // 翻訳結果をフィールドに追加
      fields.push({
        name: `\`${beforeLanguageName}\` -> \`${afterLanguageName}\``,
        value: `\`\`\`\n${result.result}\n\`\`\``,
        inline: true,
      })

      // 翻訳結果を送信
      const type = i === afterLanguages.length - 1 ? 'SUCCESS' : 'PENDING'
      const title =
        i === afterLanguages.length - 1
          ? '翻訳完了'
          : `翻訳中 (${i + 1}/${afterLanguages.length})`

      await reply.edit(this.getEmbedMessage(type, title, null, fields))

      // 翻訳後の言語を翻訳前の言語に、翻訳結果を翻訳前のテキストに設定
      beforeLanguage = language
      text = result.result
    }
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
          : Colors.Yellow
    const emoji =
      type === 'SUCCESS'
        ? ':white_check_mark:'
        : type === 'ERROR'
          ? ':x:'
          : ':hourglass_flowing_sand:'

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

  public isValidateLanguage(language: string): boolean {
    return Object.keys(this.languages).includes(language)
  }

  public randomLanguage(excluded: string[] = []): string {
    const languages = Object.keys(this.languages).filter(
      (language) => !excluded.includes(language)
    )
    return languages[Math.floor(Math.random() * languages.length)]
  }

  public getLanguageName(language: string): string {
    return this.languages[language]
  }
}
