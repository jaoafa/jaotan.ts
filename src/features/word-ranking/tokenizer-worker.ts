import fs from 'node:fs'
import { SudachiStateless, TokenizeMode } from 'sudachi-wasm333'
import { UnitAccumulator } from './aggregate'
import { preprocessText } from './preprocess'
import { WorkerRequest, WorkerResponse } from './types'
import { extractWords } from './words'

let accumulator: UnitAccumulator | undefined

function send(response: WorkerResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error('IPC channel is not available'))
      return
    }
    process.send(response, (error: Error | null) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

async function createAccumulator(
  stopwords: readonly string[],
  trackAuthors: boolean
): Promise<UnitAccumulator> {
  const dictPath = process.env.SUDACHI_DICT_PATH
  if (!dictPath) {
    throw new Error('SUDACHI_DICT_PATH is not set')
  }
  const sudachi = new SudachiStateless()
  await sudachi.initialize_node(fs.promises.readFile, dictPath)
  const stopwordSet = new Set(stopwords)

  return new UnitAccumulator(
    (content) => {
      const text = preprocessText(content)
      if (text.trim() === '') return []
      const tokens = sudachi.tokenize_raw(text, TokenizeMode.C)
      return extractWords(
        tokens.map((token) => ({
          dictionaryForm: token.dictionary_form,
          poses: token.poses,
        })),
        stopwordSet
      )
    },
    undefined,
    trackAuthors
  )
}

async function handle(request: WorkerRequest): Promise<void> {
  switch (request.type) {
    case 'init': {
      accumulator = await createAccumulator(
        request.stopwords,
        request.trackAuthors ?? false
      )
      await send({ type: 'ready' })
      break
    }
    case 'messages': {
      if (!accumulator) {
        throw new Error('Received messages before init')
      }
      for (const message of request.messages) accumulator.add(message)
      break
    }
    case 'finish': {
      if (!accumulator) {
        throw new Error('Received finish before init')
      }
      await send({ type: 'result', result: accumulator.finish() })
      process.disconnect?.()
    }
  }
}

process.on('message', (request: WorkerRequest) => {
  handle(request).catch(async (error: unknown) => {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error)
    await send({ type: 'error', message }).catch((sendError: unknown) => {
      process.stderr.write(`failed to report error: ${String(sendError)}\n`)
    })
    process.exitCode = 1
    process.disconnect?.()
  })
})
