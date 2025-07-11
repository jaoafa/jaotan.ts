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

# Markdown description を生成する
# 引数: Markdownファイルのパス
get_description() {
  # description: から始まる行を抽出し、description: を削除する
  local description=$(cat $1 | grep '^description:' | sed -e 's/description://g')
  echo $description
}

# front matter を無視して1行目を取得する
# 引数: Markdownファイルのパス
get_first_line() {
  local file="$1"

  # front matter をすでに見つけている
  local found_front_matter=0
  # front matter の中にいる
  local in_front_matter=0
  # h1 をすでに見つけている
  local after_h1=0

  while IFS= read -r line; do
    # front matter
    if [ "$line" = "---" ]; then
      if [ $found_front_matter -eq 0 ]; then
        # front matter を見つけた
        found_front_matter=1
        in_front_matter=1
        continue
      fi

      # front matter の終わり
      in_front_matter=0
      continue
    fi

    # front matter の中にいる
    if [ $in_front_matter -eq 1 ]; then
      continue
    fi

    # front matter を見つけていて、その次の行
    if [ $found_front_matter -eq 1 ] && [ -n "$line" ]; then
      echo "$line"
      return
    fi

    # h1 をすでに見つけている
    if [ $after_h1 -eq 1 ] && [ -n "$line" ]; then
      echo "$line"
      return
    fi

    # h1 を見つけた
    if [ "${line:0:2}" = "# " ]; then
      after_h1=1
      continue
    fi
  done < "$file"

  # ファイルの最後まで検索しても見つからなかった場合
  echo ""
}

# 一覧を生成する
# 引数: 一覧を生成する対象のディレクトリ
generate_list() {
  local dir=$1
  #local list=$(ls $dir | grep -v $TEMPLATE_FILENAME | sed -e 's/\.md//g')
  local list=$(find $dir -maxdepth 1 -type f -name '*.md' | grep -v $TEMPLATE_FILENAME | grep -v 'index.md' | sed -e 's/\.md//g' | sed -e 's/.*\///g' | sort)
  local result=''
  for item in $list; do
    local description=$(get_description "$dir/$item.md")
    if [ -n "$description" ]; then
      result="$result- [$item]($item.md) - $description\n"
      continue
    fi
    local first_line=$(get_first_line "$dir/$item.md" | xargs)
    if [ -n "$first_line" ]; then
      result="$result- [$item]($item.md): $first_line\n"
      continue
    fi

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
