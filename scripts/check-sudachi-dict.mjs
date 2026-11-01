import fs from 'node:fs'
import { SudachiStateless } from 'sudachi-wasm333'

const dictPath = process.env.SUDACHI_DICT_PATH
if (!dictPath) {
  throw new Error('SUDACHI_DICT_PATH is not set')
}

try {
  await new SudachiStateless().initialize_node(fs.promises.readFile, dictPath)
} catch (error) {
  throw new Error(
    `Failed to load Sudachi dictionary ${dictPath}: ${JSON.stringify(error)}`
  )
}
