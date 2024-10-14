---
title: reply
template: feature.html
---

jaotan に対してリプライされた場合、[miibo](https://miibo.ai/) を用いて返信します。

なお、サーバのテキストチャンネル・スレッドのみで動作します（アナウンスチャンネルなどでは利用不可）。

## チャットの仕様

jaotan.ts が起動している最中は、そのユーザーとの会話を記憶しています。記憶用 ID は返信時に `meboUserId` として表示されます。
この記憶は、`reset` や `clear` と返信することでリセットできます。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/events/reply.ts)
