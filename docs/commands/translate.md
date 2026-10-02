---
title: translate
template: command.html
---

Azure AI Translator を利用して、翻訳をします。

## 使い方

このコマンドは、`/translate <翻訳元の言語> <翻訳後の言語> <テキスト>` と実行します。  
`<` `>` の箇所は以下を参考に入力します。

- `<翻訳元の言語>`: [言語一覧](#language-list) にある、言語コードを用いてテキストの言語を指定します。
- `<翻訳後の言語>`: [言語一覧](#language-list) にある、言語コードを用いて翻訳後のテキストの言語を指定します。
- `<テキスト>`: 翻訳したい文字列を指定します。

!!! tip "例えば…"
「こんにちは 今日の天気は晴れです。」という日本語の文章を英語に翻訳する場合は、以下のように実行します。
`     /translate ja en こんにちは 今日の天気は晴れです。
    `

<span id="language-list"></span>

### 対応言語

対応する言語コードは [Azure AI Translator の言語一覧](https://learn.microsoft.com/azure/ai-services/translator/language-support) で確認できます。言語の対応状況は Azure から動的に取得するため、一覧にない言語コードや Azure 非対応のコードは指定できません。

従来のコード `zh` / `zh-cn` / `zh-tw` / `iw` / `no` / `ny` / `tl` は、Azure の対応コードへ変換します。

翻訳は 10,000 文字以内、最大 6 段階です。利用者ごとに 5 秒の cooldown があり、Bot 全体で同時に 2 件まで処理します。

### 設定と無料枠

`data/config.json` の `azure.translator.endpoint` と `azure.translator.apikey` に Azure Translator の endpoint と API key を設定します。global endpoint では region は不要です。地域 endpoint を使う場合は `azure.translator.region` も設定してください。

アプリは `/data/translator/usage.sqlite` に翻訳利用量を保存し、UTC 月ごとに最大 2,000,000 文字、1 時間あたり最大 2,000,000 文字まで送信します。1 時間あたりの利用量は分単位で集計するため、上限判定が直近 60 分より最大約 1 分厳しくなる場合があります。翻訳要求ごと、再試行ごとに送信する原文の文字数を予約します。不明な結果や失敗時にも予約は返却しません。保存に失敗した場合は翻訳要求を停止します。すべての Bot instance が同じ永続 `/data` filesystem を共有し、SQLite の file locking をサポートする必要があります。

Azure Portal で対象リソースが Translator F0 であり、この Bot 専用であることを確認してください。endpoint と API key だけでは SKU や他の利用者の消費量を確認できません。利用量は Azure Monitor の `TextCharactersTranslated` metric でも監視してください。F0 枠到達時は翻訳を停止し、有料 tier へ自動切替しません。

## 必要な権限

誰でも利用できます。

## 関連情報

- 翻訳コマンドは、他に `/to` から始まるコマンドでいくつか実装されています。
- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/translate.ts)
