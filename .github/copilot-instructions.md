# GitHub Copilot Instructions

このファイルは GitHub Copilot が jaotan.ts プロジェクトに適したコード提案を行うための指示書です。

## プロジェクト概要

jaotan.ts は jao Minecraft Server の公式 Discord サーバ「jao Gamers Club」で動作する Discord Bot です。TypeScript で開発され、discord.js ライブラリを使用しています。

## 開発環境と技術スタック

- **言語**: TypeScript 5.8+
- **ランタイム**: Node.js v18+
- **パッケージマネージャー**: pnpm
- **Discord ライブラリ**: discord.js v14
- **テストフレームワーク**: Jest
- **リンター**: ESLint (@book000/eslint-config)
- **フォーマッター**: Prettier
- **ユーティリティ**: @book000/node-utils

## アーキテクチャパターン

### ディレクトリ構造

```
src/
├── commands/     # スラッシュコマンド (/ping など)
├── events/       # イベント駆動機能 (サーバ参加など)
├── features/     # コア機能 (nitrotan, translate など)
├── tasks/        # 定期実行タスク
├── jobs/         # ジョブ処理
├── config.ts     # 設定管理
├── discord.ts    # Discord クライアント
├── main.ts       # エントリーポイント
└── types.d.ts    # 型定義
```

### 基底クラス

- **コマンド**: `BaseCommand` クラスを継承
- **イベント**: `BaseDiscordEvent` クラスを継承  
- **タスク**: `BaseDiscordTask` クラスを継承

### 命名規則

- **コマンドクラス**: `<コマンド名>Command` (例: `PingCommand`)
- **イベントクラス**: `<イベント名>Event` (例: `GuildMemberAddEvent`)
- **タスククラス**: `<タスク名>Task` (例: `NitrotanOptimizeTask`)

## コーディング規約

### TypeScript

- 厳密な型付けを使用
- インターface は `I` プレフィックスを使用する場合がある
- `const` assertions を適切に使用
- `as const` でオブジェクトを immutable にする

### Import/Export

- 相対パス import は `@/` エイリアスを使用
- named export を基本とする
- default export は主要クラスのみ

### エラーハンドリング

- `@book000/node-utils` の `Logger` クラスを使用
- 適切なログレベル (info, warn, error) を設定
- try-catch での例外処理を適切に実装

### Discord.js パターン

- `Interaction` の種類に応じた適切な処理
- `Guild`, `Channel`, `User` の null チェック
- 権限チェックの実装
- 適切な Discord API レート制限の考慮

## プロジェクト固有のパターン

### Configuration

```typescript
const config: Configuration = this.discord.getConfig()
const channelId = config.get('discord').channel?.general
```

### Nitrotan システム

Discord Nitro 利用者を自動判別するシステム。以下のパターンを検出:

- アニメーション絵文字の使用
- 他サーバ絵文字/スタンプの使用
- 大容量ファイルの送信
- プロフィール機能の使用

### 翻訳機能

Google Apps Script API と DetectLanguage API を使用した自動翻訳システム。

### 誕生日機能

ユーザーの誕生日を管理し、自動お祝いメッセージを送信。

## コメントとドキュメント

### 言語

- **コメント**: 日本語
- **変数名・関数名**: 英語 (camelCase)
- **クラス名**: 英語 (PascalCase)
- **ファイル名**: kebab-case

### JSDoc

```typescript
/**
 * Nitrotan の最適化処理を実行
 * @returns Promise<void>
 */
async optimize(): Promise<void> {
  // 実装
}
```

## Git とコミット

### Conventional Commits

- `feat:` 新機能
- `fix:` バグ修正  
- `docs:` ドキュメント
- `style:` コードスタイル
- `refactor:` リファクタリング
- `test:` テスト
- `chore:` その他

### 例

```
feat(commands): add toheja command for language translation
fix(nitrotan): improve animation emoji detection logic
docs: update API documentation
```

## テスト

### Jest パターン

```typescript
describe('Birthday', () => {
  let birthday: Birthday

  beforeEach(() => {
    birthday = new Birthday()
  })

  test('should register birthday correctly', () => {
    // テスト実装
  })
})
```

## 禁止事項

- `console.log` の使用 (Logger を使用)
- 直接的な Discord API 呼び出し (discord.js を経由)
- ハードコーディングされた ID やトークン
- 同期的な処理での long-running operation

## 推奨事項

- 適切な型安全性の確保
- エラーハンドリングの徹底
- Discord API のベストプラクティスに従う
- パフォーマンスを考慮した実装
- セキュリティを意識したコード
- 既存のパターンとの一貫性の保持

## コード例

### 基本的なコマンド

```typescript
export class ExampleCommand extends BaseCommand {
  constructor(discord: Discord) {
    super(discord, 'example', 'Example command description')
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const logger = Logger.configure('ExampleCommand.execute')
    
    try {
      await interaction.reply('Example response')
      logger.info('✅ Command executed successfully')
    } catch (error) {
      logger.error('❌ Command execution failed', error as Error)
      await interaction.reply('エラーが発生しました。')
    }
  }
}
```

### イベントハンドラー

```typescript
export class ExampleEvent extends BaseDiscordEvent {
  get eventName(): string {
    return Events.GuildMemberAdd
  }

  async execute(member: GuildMember): Promise<void> {
    const logger = Logger.configure('ExampleEvent.execute')
    
    try {
      // イベント処理
      logger.info(`✅ Member ${member.user.tag} joined`)
    } catch (error) {
      logger.error('❌ Event handling failed', error as Error)
    }
  }
}
```

このガイドラインに従って、jaotan.ts プロジェクトに適したコードを生成してください。