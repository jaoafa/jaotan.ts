import { Discord } from '@/discord'
import { Colors, EmbedBuilder, Message } from 'discord.js'
import { BaseCommand } from '.'
import { GoogleSearch } from '@/features/google-search'

export class SearchCommand implements BaseCommand {
  readonly name = 'search'
  readonly permissions = null

  async execute(
    discord: Discord,
    message: Message<true>,
    arguments_: string[]
  ): Promise<void> {
    // 引数がない場合はエラーを返す
    if (arguments_.length === 0) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ 検索ワードが指定されていません')
            .setDescription('検索ワードを指定してください')
            .setTimestamp(new Date())
            .setColor(Colors.Red),
        ],
      })
      return
    }
    const text = arguments_.join(' ')

    // APIキーの取得
    const googleSearchConfig = discord.getConfig().get('googleSearch')
    if (!googleSearchConfig.gcpKey || !googleSearchConfig.cx) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ 必要な情報が不足')
            .setDescription(
              'Google Cloud Platform Key または Custom Search 検索エンジン API が定義されていないため、このコマンドを使用できません。'
            )
            .setTimestamp(new Date())
            .setColor(Colors.Red),
        ],
      })
      return
    }

    const gcpKey = googleSearchConfig.gcpKey
    const cx = googleSearchConfig.cx

    // 検索処理
    const googleSearch = new GoogleSearch(gcpKey, cx)
    const result = await googleSearch.search(text)

    const fields = result.items
      .map((item) => {
        return {
          name: item.decodedTitle,
          value: `${item.decodedSnippet}\n[ページリンク](${item.link})`,
          inline: true,
        }
      })
      .slice(0, 5)

    const requestedCount = googleSearch.getRequestCount()
    const requestLimit = googleSearch.getRequestLimit()
    const remainingRequests = requestLimit - requestedCount

    const embed = new EmbedBuilder()
      .setTitle(`🔍 「${text}」の検索結果`)
      .setDescription(
        `検索時間: ${result.searchTime}, 累計件数: ${result.totalResult}`
      )
      .setFooter({
        text: `リクエスト残り回数: ${remainingRequests} / ${requestLimit}`,
      })
      .setTimestamp(new Date())
      .setColor(Colors.Green)
      .addFields(fields)

    await message.reply({ embeds: [embed] })
  }
}
