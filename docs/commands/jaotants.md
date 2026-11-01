---
title: jaotants
template: command.html
---

jaotan の設定を Discord 上から管理します。[vc-speech-log-url](../features/vc-speech-log-url.md) の引用対象チャンネルと、[word-ranking](../features/word-ranking.md) の集計対象チャンネル・ストップワードの設定に対応しています。

このコマンドは、メッセージで実行する他のコマンドとは異なり、Discord のスラッシュコマンド（`/jaotants`）として実行します。実行結果とエラーは、実行した本人にだけ表示されます。

## 使い方

### `/jaotants vc-speech-log add channel:<チャンネル>`

指定したテキストチャンネルを引用対象に追加します。すでに登録済みの場合は変更しません。次の条件を満たさないチャンネルは追加できません。

- このサーバのテキストチャンネルであること
- jaotan がチャンネルの閲覧とメッセージ履歴の参照をできること

### `/jaotants vc-speech-log remove [channel:<チャンネル>] [channel-id:<ID>]`

指定したチャンネルを引用対象から登録解除します。登録されていない場合は変更しません。

- `channel` と `channel-id` のどちらか一方だけを指定してください（両方、またはどちらもなしはエラーです）。
- 削除済みのチャンネルなど、`channel` で選択できないチャンネルは、`channel-id` に 17〜20 桁のチャンネル ID を指定します。

### `/jaotants vc-speech-log list`

現在登録されているチャンネルを一覧で表示します。削除済みなどで解決できないチャンネルは ID で表示します。

### `/jaotants word-ranking add channel:<チャンネル>`

指定したテキストチャンネルを、月次の単語ランキングの集計対象に追加します。条件と挙動は `vc-speech-log add` と同じです。集計結果は `#general` に投稿されるため、追加したチャンネルの閲覧範囲が `#general` に含まれることを確認してください。

### `/jaotants word-ranking remove [channel:<チャンネル>] [channel-id:<ID>]`

指定したチャンネルを集計対象から登録解除します。指定方法は `vc-speech-log remove` と同じです。

### `/jaotants word-ranking list`

現在の集計対象のチャンネルを一覧で表示します。

### `/jaotants stopword add word:<単語>`

ランキングから除外する単語を追加します。標準のストップワードから除外していた単語を指定した場合は、除外を解除して標準のストップワードに戻します。すでにストップワードの場合は変更しません。

- 単語は、ランキングに載る単語と同じ規則（全角・半角の統一、小文字化、小書きカナや伸ばした表記の統一）で正規化してから登録します。
- 空白を含む単語と、100 文字を超える単語は登録できません。

### `/jaotants stopword remove word:<単語>`

ストップワードから単語を外します。追加した単語は削除し、標準のストップワードの単語は標準のリストから除外します。ストップワードでない単語を指定した場合は変更しません。

### `/jaotants stopword list`

追加した単語と、標準のリストから除外した単語を一覧で表示します。表示が長い場合は、末尾を省略して残りの件数を表示します。

## 必要な権限

Admin ロール（設定ファイルの `discord.role.admin`、未設定の場合は既定の Admin ロール）を持つメンバーだけが実行できます。Developer ロールなど、Admin ロールを持たないメンバーは、Discord の Administrator 権限があっても実行できません。

サーバ内でのみ実行できます。設定ファイルに `discord.guildId` がある場合は、そのサーバ以外では実行できません。

## 設定の保存先

登録内容は `DATA_DIR/channel-config.json`（環境変数 `DATA_DIR` が未設定の場合は `data/channel-config.json`）に保存され、再起動後も維持されます。

```json
{
  "vc-speech-log": ["1149606247314767993", "1555541589164560415"],
  "word-ranking": ["1149606247314767993"]
}
```

- チャンネル ID は文字列で、重複できません。空の配列 `[]` は「対象なし」の正しい設定で、再起動しても初期値には戻りません。
- ファイルが存在しない初回の起動時だけ、従来の対象チャンネル（設定ファイルの `discord.channel.vcSpeechLog`、未設定の場合は既定のチャンネル、および固定の 2 チャンネル）が自動で登録されます。以後、`discord.channel.vcSpeechLog` は参照されません。
- `word-ranking` の初期値は空（集計対象なし）です。キーが無いファイルは、空として扱います。
- ファイルの JSON が不正な場合は、自動では修復せず、引用機能とこのコマンドの操作を停止してログに出力します。ファイルを修正して再起動してください。

ストップワードは `DATA_DIR/word-stopwords.json` に保存されます。ファイルが無い場合は、追加も除外もない状態として扱います。

```json
{
  "added": ["追加した単語"],
  "removed": ["標準から除外した単語"]
}
```

- 単語は正規化済みの文字列で、重複できません。`added` と `removed` に同じ単語を入れることもできません。
- ファイルの JSON が不正な場合は、自動では修復せず、月次のランキングとストップワードの操作を停止してログに出力します。ファイルを修正して再起動してください。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/interactions/jaotants.ts)
