---
title: searchimg
template: command.html
---

[Google Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) を利用して、Google 画像検索を行います。

## 使い方

このコマンドは、`/search <検索ワード>` と実行します。指定された検索ワードを用いて Google 画像検索し、最上位の結果の画像を添付し、上位 3 件を表示します。

## 制限事項

- API 無料枠の都合により、search コマンドと searchimg コマンド共通で、実行回数を一日あたり 100 件に制限しています。制限は米国太平洋標準時（PST）の 0 時にリセットされます。

## 必要な権限

誰でも利用できます。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/searchimg.ts)
