---
title: setbanner
template: command.html
---

画像テンプレートに引数で指定された文字列を合成し、サーバのバナー画像として設定します。

## 使い方

このコマンドは、`/setbanner <テキスト>` と実行します。

フォントサイズは、144px を最大サイズとして、計算式 `500 / (テキストの長さ * 1.3)` で計算されます。  
フォントは [Noto Serif JP Black](https://fonts.google.com/noto/specimen/Noto+Serif+JP) と [Noto Color Emoji](https://fonts.google.com/noto/specimen/Noto+Color+Emoji) を利用しています。

## 必要な権限

誰でも利用できます。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/setbanner.ts)
