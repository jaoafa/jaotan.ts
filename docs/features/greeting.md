---
title: greeting
template: feature.html
---

`#greeting` でのチャットを管理します。

- `jao` `afa` 以外のメッセージ投稿が行われた場合、削除
- `jao` → `afa` の順番でメッセージ投稿を行った場合、MailVerified 権限を付与

## メッセージに付くリアクション

メッセージには、jaotan によって以下の条件でリアクションが付きます。

- :x:
  - MailVerified ロールをすでに付与されている場合
  - `jao` を投稿せずに `afa` を投稿した場合
- :arrow_right:
  - MailVerified ロールが付与されておらず、`afa` を投稿した場合
- :o:
  - MailVerified ロールが付与されておらず、`jao` を投稿した後に `afa` を投稿した場合

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/events/greeting.ts)
