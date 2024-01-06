---
title: tochaos
template: command.html
---

Google Translate サービスを利用して、複数回翻訳を行った上で、日本語に翻訳します。

## 使い方

このコマンドは、`/tochaos <テキスト>` と実行します。  
`<テキスト>` には翻訳したい文字列を指定します。

実行すると、3回～5回ランダムに翻訳したうえで日本語に翻訳します。

## 必要な権限

誰でも利用できます。

## 関連情報

- 元言語の判定には、[Detect Language API](https://detectlanguage.com/) を使用しています。
- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/tochaos.ts)
