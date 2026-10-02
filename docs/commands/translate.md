---
title: translate
template: command.html
---

入力したテキストを、指定した言語から別の言語へ翻訳します。

## 使い方

`/translate <翻訳元の言語コード> <翻訳先の言語コード> <テキスト>` の形式で入力します。言語コードには、[Azure AI Translator の対応言語一覧](https://learn.microsoft.com/azure/ai-services/translator/language-support)に掲載されたコードを指定してください。

```text
/translate ja en こんにちは、今日は晴れです。
/translate en ru Hello, how are you?
```

最初の言語コードが翻訳元、次のコードが翻訳先です。テキストには空白を含められます。翻訳元の言語も指定してください。自動判定は行いません。

### 利用上の制限

- 1 回に入力できるテキストは 10,000 文字までです。
- 同じ利用者は、続けて翻訳するとき 5 秒以上あけてください。
- 利用状況によって一時的に翻訳できない場合があります。その場合は、Bot の案内に従って時間をおいて再度お試しください。

## 必要な権限

誰でも利用できます。

## 関連情報

- [Azure AI Translator の対応言語一覧](https://learn.microsoft.com/azure/ai-services/translator/language-support)
- [ソースコード](https://github.com/jaoafa/jaotan.ts/blob/master/src/commands/translate.ts)
