---
title: jaotants
template: command.html
---

jaotan の設定を Discord 上から管理します。現在は [vc-speech-log-url](../features/vc-speech-log-url.md) の引用対象チャンネルの設定に対応しています。

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

## 必要な権限

Admin ロール（設定ファイルの `discord.role.admin`、未設定の場合は既定の Admin ロール）を持つメンバーだけが実行できます。Developer ロールなど、Admin ロールを持たないメンバーは、Discord の Administrator 権限があっても実行できません。

サーバ内でのみ実行できます。設定ファイルに `discord.guildId` がある場合は、そのサーバ以外では実行できません。

## 設定の保存先

登録内容は `DATA_DIR/channel-config.json`（環境変数 `DATA_DIR` が未設定の場合は `data/channel-config.json`）に保存され、再起動後も維持されます。

```json
{
  "vc-speech-log": ["1149606247314767993", "1555541589164560415"]
}
```

- チャンネル ID は文字列で、重複できません。空の配列 `[]` は「対象なし」の正しい設定で、再起動しても初期値には戻りません。
- ファイルが存在しない初回の起動時だけ、従来の対象チャンネル（設定ファイルの `discord.channel.vcSpeechLog`、未設定の場合は既定のチャンネル、および固定の 2 チャンネル）が自動で登録されます。以後、`discord.channel.vcSpeechLog` は参照されません。
- ファイルの JSON が不正な場合は、自動では修復せず、引用機能とこのコマンドの操作を停止してログに出力します。ファイルを修正して再起動してください。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/interactions/jaotants.ts)
