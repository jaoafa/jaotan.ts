#!/bin/bash
# shellcheck disable=SC2010

# /src/commands/*.ts のコマンド実装と、/docs/commands/ にあるコマンドの一覧を比較する

# コマンド実装の一覧を取得する
# コマンド実装の一覧は、/src/commands/*.ts にあるファイル名を取得する
# ただし、index.ts は除外する

# コマンド実装の一覧
commands=$(ls src/commands/*.ts | grep -v index.ts | xargs -n 1 basename | sed -e 's/.ts//g')

# /docs/commands/ にあるコマンドの一覧を取得する
# /docs/commands/ にあるコマンドの一覧は、/docs/commands/* にあるコマンド名を取得する
# ただし、.index-template.md は除外する

# /docs/commands/ にあるコマンドの一覧
docs_commands=$(ls docs/commands/*.md | grep -v .index-template.md | xargs -n 1 basename | sed -e 's/.md//g')

# コマンド実装の一覧と /docs/commands/ にあるコマンドの一覧を比較する
# コマンド実装の一覧にあって /docs/commands/ にないコマンドがあればエラーとする
for command in $commands; do
  if ! echo "$docs_commands" | grep -q "$command"; then
    echo "Error: /docs/commands/$command.md が存在しません。"
    exit 1
  fi
done
