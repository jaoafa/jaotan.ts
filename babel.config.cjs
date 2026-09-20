// emoji-regex v11 は ESM 専用パッケージ (CJS ビルドなし) で、
// Jest (CommonJS 実行環境) からそのままでは読み込めない。
// Jest 実行時のみ babel-jest でこのファイルを CJS に変換する
// (jest.config 側の transformIgnorePatterns と対になる設定)。
module.exports = {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}
