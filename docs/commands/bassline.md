---
title: bassline
template: command.html
---

ベースラインパーティー中の臨時ニュースを投稿します。

## 使い方

引数で指定した値に応じて、下記の `<容疑者名>` の内容が変わります。

```text
ベースラインパーティーの途中ですが、ここで臨時ニュースをお伝えします。今日昼頃、わりとキモく女性にナンパをしたうえ、路上で爆睡をしたとして、
道の上で寝たり、女の子に声をかけたりしたらいけないんだよ罪の容疑で、
自称優良物件、<容疑者名> 容疑者が逮捕されました。
```

- 何も指定しない場合: hiratake（DiscordID: `221498004505362433`）へメンション
- 数値を指定した場合: 入力値を DiscordID として扱い、当該ユーザにメンション
- それ以外の場合: 文字列として扱い、そのまま表示

## 必要な権限

誰でも利用できます。

## 関連情報

- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/bassline.ts)