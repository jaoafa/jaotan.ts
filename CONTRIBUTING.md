# 貢献する - Contributing

jaotan.ts の開発に興味を持っていただきありがとうございます！  
私たちのプロジェクトにコントリビュートする前に、以下の文書をお読みください。

## 開発予定 - Development schedule

- 基本は、[Javajaotan](https://github.com/jaoafa/Javajaotan/tree/master/src/main/java/com/jaoafa/Javajaotan) / [Javajaotan2](https://github.com/jaoafa/Javajaotan2/tree/master/src/main/java/com/jaoafa/javajaotan2) のコマンドとイベント駆動機能を実装予定です。
  - Java なので基礎知識がない場合は読めないかもしれませんが、実際の動作を考えながら実装するとよいです。
  - 足りないものについてはプルリクエストのレビューにて指摘するようにします。
- Discord サーバのリニューアルに合わせて稼働開始したいと思っています。

## 開発環境 - Development environments

- プログラミング言語は TypeScript です。
- Node.js v18 + pnpm で開発しています。
- Visual Studio Code での開発を推奨しています。
- 依存パッケージは [`package.json`](package.json) で定義しています。
  - Discord API との通信に [discord.js](https://discord.js.org/) というライブラリを使っています。
  - コードのフォーマッタに [prettier](https://prettier.io/) を、Lintに [eslint](https://eslint.org/) を使っています。
    - 自動で動いたり動かなかったりするので、適宜 `pnpm fix` すると良いです
  - 設定ファイルの読み込みと、コンソール（標準出力）へのライブラリとして [@book000/node-utils](https://www.npmjs.com/package/@book000/node-utils) を使っています。
- Dockerfile がありますが、これは本番環境での実行用であり、開発用ではありません。
  - devcontainer を書く予定はあります。

## Requirement - 必須要件

- 開発・実行には以下が必要です。
  - 上記に示した開発環境
  - 有効な Discord Bot トークン
  - Bot が参加している Discord サーバ
- 設定ファイルはJSONC形式、ファイルパスは `data/config.json` です。
  - `CONFIG_PATH` または `CONFIG_FILE` 環境変数で設定ファイルのパスを変更できます。
- 設定ファイルの JSON schema は [`schema/Configuration.json`](schema/Configuration.json) にあります。
  - 手動で書いているので、実装と異なっていたら Issue または Pull Request をください。

## 仕様 - Specifications

- コマンドは BaseCommand クラスを実装する `<コマンド名>Command` クラスで作ります。（例: `ping` コマンドなら `PingCommand`）
- イベント駆動の機能は BaseDiscordEvent クラスを実装するクラスで作ります。（クラス名検討中）
- コマンドのサンプルは [`src/commands/ping.ts`](src/commands/ping.ts) があるので、それを見てください。
- コマンドもイベント駆動の機能も、[`src/discord.ts`](src/discord.ts) の `commands`, `events` 配列変数にインスタンスを追加する必要があります。
- `pnpm start` で実行できます。
  - `pnpm dev` でコード変更に合わせて自動再起動ができますが、ログイン回数多すぎって言われてトークンリセットされることがあるので、あんまりお勧めしません。

## ディレクトリ構造 - Directory structure

- ソースファイルは `src` ディレクトリの中に置いています。
- コマンド駆動（`/` から始まる**テキスト**コマンド）のものは [`src/commands`](src/commands) に置くようにしています。
- イベント駆動（サーバへの参加とか）は [`src/events`](src/events) に置くようにしています。

## Git

- `upstream` とは `jaoafa/jaotan.ts` のことです（オリジナルリポジトリとも呼びます）。
- フォークしている場合、`origin` とはあなたのアカウント以下にある jaotan.ts のフォークリポジトリのことです（フォークリポジトリとも呼びます）。
- ローカルリポジトリとは、あなたのコンピュータ上にある jaotan.ts のリポジトリのことです。

### Commit

- 発生しているエラーなどはコミット・プルリクエスト前にすべて修正してください。
- コミットメッセージやプルリクエストのタイトルは **[CommitLint のルール](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional#rules) である以下に沿っていることを期待しますが、必須ではありません。**
  - 次の形式でコミットメッセージを指定してください: `type(scope): subject` (e.g. `fix(home): message`)
    - `type`, `subject` は必須、 `scope` は必須ではありません
  - `type-enum`: `type` は必ず次のいずれかにしなければなりません
    - `build`: ビルド関連
    - `ci`: CI 関連
    - `chore`: いろいろ
    - `docs`: ドキュメント関連
    - `feat`: 新機能
    - `fix`: 修正
    - `perf`: パフォーマンス改善
    - `refactor`: リファクタリング
    - `revert`: コミットの取り消し
    - `style`: コードスタイルの修正
    - `test`: テストコミット
  - `type-case`: `type` は必ず小文字でなければなりません (NG: `FIX` / OK: `fix`)
  - `type-empty`: `type` は必ず含めなければなりません (NG: `test message` / OK: `test: message`)
  - `scope-case`: `scope` は必ず小文字でなければなりません (NG: `fix(HOME): message` / OK: `fix:(home): message`)
  - `subject-case`: `subject` は必ず次のいずれかの書式でなければなりません `sentence-case`, `start-case`, `pascal-case`, `upper-case`
  - `subject-empty`: `subject` は必ず含めなければなりません (NG: `fix:` / OK: `fix: message`)
  - `subject-full-stop`: `subject` は `.` 以外で終えてください (NG: `fix: message.` / OK: `fix: message`)
- プルリクエスト発行後、レビューを受けた修正は対象ブランチで新規にコミット・プッシュすることでプルリクエストへ追加更新されます。

### Branch rule

- 必ずフォークして開発してください
- ブランチは機能追加・修正などに応じて分けて作成してください。一つのプルリクエストに複数の変更事項をまとめるとレビュアーの負担が増えます。
- ブランチ名は機能追加・修正の内容を示す言葉で構成することをお勧めします。（例: `feat/test-command`, `fix/test-command-api-url`）
  - 開発者自身が自分で「何のために作ったブランチか」を把握できればどんな名前でも構いません。
- upstream の master ブランチへの直接コミットはできません。
- 原則、全てのコード編集はプルリクエストを必要とします。
- レビュアーに指定されていなくても気になることがあればレビューして構いません。

## その他 - Other

不明な点は jMS Gamers Club の `#development` チャンネルなどで質問してください。  
プロジェクトにコントリビュートするすべての人々は、[行動規範](CODE_OF_CONDUCT.md) を読み遵守しなければならないことを忘れないでください。
