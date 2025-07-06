---
title: setbannerextra
template: command.html
---

画像テンプレートに引数で指定された文字列を複数合成し、サーバのバナー画像として設定します。  
[setbanner](setbanner.md) の高機能版で、左右のテキストと絵文字を変更することが可能です。

## 使い方

このコマンドは、`/setbannerextra <左側テキスト> <左側絵文字> <右側絵文字> <右側テキスト>` と実行します。

フォントサイズは、144px を最大サイズとして、計算式 `500 / (テキストの長さ * 1.3)` で計算されます。  
フォントは [Noto Serif JP Black](https://fonts.google.com/noto/specimen/Noto+Serif+JP) と [Noto Color Emoji](https://fonts.google.com/noto/specimen/Noto+Color+Emoji) を利用しています。

`<左側絵文字>`, `<右側絵文字>` については、以下について特殊処理されます。

- 絵文字文字列 (`<:emoji_name:1234567890>`): 文字列とではなく、絵文字画像として扱う。アニメーション絵文字は1フレーム目の画像が使用される
- URL: 画像として読み込み、画像として扱う。画像として処理できない場合は、URL をそのまま文字列として扱う
- その他: 文字列として扱う

## 必要な権限

誰でも利用できます。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/setbannerextra.ts)
