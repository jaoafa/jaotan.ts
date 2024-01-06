#!/bin/bash

# /docs/commands/ にあるコマンドの一覧を生成する
# テンプレートとして /docs/commands/.index-template.md を使用し、<!-- COMMANDS --> に一覧を挿入する
# 一覧は箇条書きで、コマンド名を表示する

# 一覧を生成する対象のディレクトリ
DIRS=(
  "docs/commands"
  "docs/features"
)

# テンプレートファイル
TEMPLATE_FILENAME=".index-template.md"

# 出力先のディレクトリ
OUTPUT_DIR="docs"

# 一覧を挿入する箇所
MARKER='<!-- COMMANDS -->'

# 一覧を生成する
# 引数: 一覧を生成する対象のディレクトリ
generate_list() {
  local dir=$1
  local list=$(ls $dir | grep -v $TEMPLATE_FILENAME | sed -e 's/\.md//g')
  local result=''
  for item in $list; do
    result="$result- [$item]($item.md)\n"
  done
  echo -e "$result"
}

# 一覧を生成する
# 引数: 一覧を挿入する箇所
generate() {
  local marker=$*
  for dir in "${DIRS[@]}"; do
    local template="$dir/$TEMPLATE_FILENAME"
    local output="$OUTPUT_DIR/$(basename $dir)/index.md"
    local list=$(generate_list $dir)
  
    # 一覧を一時ファイルに書き出す
    local tmpfile=$(mktemp)
    echo "$list" > $tmpfile

    # 一覧を挿入する
    cp $template $output
    sed -i -e "/$marker/r $tmpfile" -e "/$marker/d" $output
  done
}

# 一覧を生成する
generate $MARKER
