// sudachi-wasm333 の型定義がブラウザ向けの型を参照しており、lib に DOM を含めない本プロジェクトでは解決できない。
// 型検査を通すための最小限の宣言で、実行時の挙動には影響しない。
type RequestInfo = string | URL
type BufferSource = ArrayBufferView | ArrayBuffer

declare namespace WebAssembly {
  type Module = object
  type Memory = object
  type Table = object
}
