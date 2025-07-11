---
title: nitrotan
template: feature.html
---

Discord Nitro の有料機能を利用したユーザーを自動で検出し、`Nitrotan` ロールを付与する機能です。

この機能は、ユーザーが Discord Nitro でのみ利用可能な機能を使用した際に、自動的にそのユーザーを Nitro ユーザーとして認識し、専用のロールを付与します。また、Nitro の利用をやめたと思われるユーザーからは自動的にロールを外す機能も含まれています。

## 検出対象の機能

### メッセージ投稿時の検出

以下の Nitro 限定機能を使用したメッセージを投稿した場合に検出されます。

- **アニメーション絵文字の使用**
  - メッセージ内でアニメーション絵文字（GIF 絵文字）を使用した場合
- **他サーバーの絵文字の使用**
  - 現在のサーバーに存在しない、他のサーバーの絵文字を使用した場合
- **他サーバーのスタンプの使用**
  - 現在のサーバーに存在しない、他のサーバーのカスタムスタンプを使用した場合
- **大容量ファイルの送信**
  - サーバーのブーストレベルによる上限を超えるファイルサイズのファイルを送信した場合
    - 通常・ブースト Lv1: 25MB 超
    - ブースト Lv2: 50MB 超
    - ブースト Lv3: 100MB 超
- **長文メッセージの投稿**
  - 2000 文字を超えるメッセージを投稿した場合

### リアクション追加時の検出

以下の Nitro 限定機能を使用したリアクションを最初に追加した場合に検出されます：

- **アニメーション絵文字のリアクション**
  - アニメーション絵文字でリアクションした場合
- **他サーバーの絵文字のリアクション**
  - 現在のサーバーに存在しない、他のサーバーの絵文字でリアクションした場合

### プロフィール設定の検出

定期的にサーバー内のユーザーのプロフィールをチェックし、以下の Nitro 限定機能を使用している場合に検出されます：

- **アニメーションアバターの設定**
  - プロフィール画像に GIF ファイルを設定している場合
- **サーバー独自アバターの設定**
  - 全体のアカウントアバターとは異なる、サーバー専用のアバターを設定している場合
- **バナー画像の設定**
  - プロフィールにバナー画像を設定している場合
- **プロフィールテーマの設定**
  - プロフィールにカスタムテーマカラーを設定している場合

## 自動管理機能

### ロール付与

上記の機能を検出した際に、自動的に `Nitrotan` ロールがユーザーに付与されます。ロール付与時には、以下の情報がログチャンネルに送信されます：

- ユーザー名と Discord ID
- 検出された理由

### ロール削除

定期的な最適化処理により、以下の条件を満たすユーザーからは `Nitrotan` ロールが自動的に削除されます：

- 最後に Nitro 機能の使用が確認されてから 1 週間以上経過している
- サーバーから退出している

### 検出理由

各ユーザーがなぜ Nitrotan として認識されたかの理由が記録され、以下のような理由コードで管理されます：

| 理由コード | 説明 |
|------------|------|
| `USE_ANIMATION_EMOJI_MESSAGE` | アニメーション絵文字を使用したメッセージを送信した |
| `USE_ANIMATION_EMOJI_REACTION` | アニメーション絵文字をリアクションした |
| `USE_OTHER_SERVER_EMOJI_MESSAGE` | 他サーバーの絵文字を使用したメッセージを送信した |
| `USE_OTHER_SERVER_EMOJI_REACTION` | 他サーバーの絵文字をリアクションした |
| `USE_OTHER_SERVER_STICKER` | 他サーバーのスタンプを使用した |
| `SEND_LARGE_FILE` | ブーストによる上限値より大きなファイルを送信した |
| `AVATAR_ANIME` | アニメーションアイコンを設定した |
| `SERVER_ORIGINAL_AVATAR` | サーバ独自のアバターを設定した |
| `BANNER` | バナーを設定した |
| `PROFILE_THEME` | プロフィールテーマを設定した |
| `SEND_LARGE_MESSAGE` | 2000 文字より多い文章を投稿した |

## 実行タイミング

### リアルタイム検出

- メッセージ投稿時: 即座に検出・ロール付与
- リアクション追加時: 即座に検出・ロール付与

### 定期実行

- **プロフィールチェック**: 30 分毎に全ユーザーのプロフィールをチェック
- **最適化処理**: 3 時間毎にロールの整理を実行

## 設定

以下の設定項目で動作をカスタマイズできます：

- `discord.channel.other`: ログを送信するチャンネル ID（デフォルト: `1149857948089192448`）
- `discord.role.nitrotan`: 付与するロール ID（デフォルト: `1149583556138508328`）

## データ保存

Nitrotan として認識されたユーザーの情報は、以下の形式で JSON ファイルに保存されます：

```json
{
  "discordId": "ユーザーの Discord ID",
  "since": "Nitrotan として認識された日時",
  "lastChecked": "最後に確認された日時",
  "reason": "検出理由"
}
```

ファイルの保存場所は環境変数 `DATA_DIR` で指定でき、未設定の場合は `data/nitrotan.json` に保存されます。

## 関連情報

- ソースコード
  - [nitrotan.ts](https://github.com/jaoafa/jaotan.ts/blob/master/src/features/nitrotan.ts) - メイン機能
  - [nitrotan-message.ts](https://github.com/jaoafa/jaotan.ts/blob/master/src/events/nitrotan-message.ts) - メッセージ投稿時の検出
  - [nitrotan-reaction.ts](https://github.com/jaoafa/jaotan.ts/blob/master/src/events/nitrotan-reaction.ts) - リアクション追加時の検出
  - [nitrotan-profile.ts](https://github.com/jaoafa/jaotan.ts/blob/master/src/tasks/nitrotan-profile.ts) - プロフィールチェック
  - [nitrotan-optimize.ts](https://github.com/jaoafa/jaotan.ts/blob/master/src/tasks/nitrotan-optimize.ts) - 最適化処理