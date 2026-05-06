/**
 * Rsbuild SSR decode implementation.
 *
 * Bundler-owned rsbuild virtual modules re-export this module for SSR-side
 * Flight decode.
 */

import { createFromReadableStream } from 'react-server-dom-rspack/client.node'

type ResolvedAssetDeps = {
  js: Array<string>
  css: Array<string>
}

type OnClientReference = (reference: {
  id: string
  deps: ResolvedAssetDeps
  runtime: 'rsbuild'
}) => void

declare const __rspack_rsc_manifest__:
  | {
      moduleLoading?: {
        prefix?: string
      }
    }
  | undefined

let onClientReference: OnClientReference | undefined

const FLIGHT_IMPORT_ROW_TAG = 'I'.charCodeAt(0)
const FLIGHT_IMPORT_METADATA_START_OFFSET = 2
const FLIGHT_ROW_SEPARATOR = ':'
const FLIGHT_ROW_TERMINATOR = '\n'
const FIRST_CHUNK_FILE_INDEX = 1
const CHUNK_PAIR_SIZE = 2

function getModuleLoadingPrefix() {
  if (typeof __rspack_rsc_manifest__ === 'undefined') return ''
  return __rspack_rsc_manifest__.moduleLoading?.prefix ?? ''
}

function emitClientReferencePreloads(
  emit: OnClientReference,
  id: string,
  chunks: Array<unknown>,
  prefix: string,
) {
  let js: Array<string> | undefined

  for (let i = FIRST_CHUNK_FILE_INDEX; i < chunks.length; i += CHUNK_PAIR_SIZE) {
    const chunkFile = chunks[i]
    if (typeof chunkFile === 'string') {
      if (!js) js = []
      js.push(prefix + chunkFile)
    }
  }

  if (!js) return

  emit({
    id,
    deps: { js, css: [] },
    runtime: 'rsbuild',
  })
}

function getFlightImportMetadataStart(row: string) {
  const colonIndex = row.indexOf(FLIGHT_ROW_SEPARATOR)
  if (
    colonIndex === -1 ||
    row.charCodeAt(colonIndex + 1) !== FLIGHT_IMPORT_ROW_TAG
  ) {
    return -1
  }

  return colonIndex + FLIGHT_IMPORT_METADATA_START_OFFSET
}

function processFlightRowForPreloads(
  row: string,
  prefix: string,
  emit: OnClientReference,
) {
  const metadataStart = getFlightImportMetadataStart(row)
  if (metadataStart === -1) return

  try {
    const metadata = JSON.parse(row.slice(metadataStart))
    if (!Array.isArray(metadata)) return

    const [id, chunks] = metadata
    if (typeof id !== 'string' || !Array.isArray(chunks)) return

    emitClientReferencePreloads(emit, id, chunks, prefix)
  } catch {
    // Ignore Flight rows that are not plain JSON import metadata.
  }
}

function processBufferedFlightRows(
  buffer: string,
  prefix: string,
  emit: OnClientReference,
) {
  let rowStart = 0
  let newlineIndex = buffer.indexOf(FLIGHT_ROW_TERMINATOR, rowStart)

  while (newlineIndex !== -1) {
    processFlightRowForPreloads(
      buffer.slice(rowStart, newlineIndex),
      prefix,
      emit,
    )
    rowStart = newlineIndex + 1
    newlineIndex = buffer.indexOf(FLIGHT_ROW_TERMINATOR, rowStart)
  }

  return rowStart === 0 ? buffer : buffer.slice(rowStart)
}

async function collectClientReferencePreloads(
  stream: ReadableStream<Uint8Array>,
  prefix: string,
  emit: OnClientReference,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffered = ''

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      buffered += decoder.decode(value, { stream: true })
      buffered = processBufferedFlightRows(buffered, prefix, emit)
    }

    buffered += decoder.decode()
    if (buffered) processFlightRowForPreloads(buffered, prefix, emit)
  } finally {
    reader.releaseLock()
  }
}

function setOnClientReference(callback: OnClientReference | undefined) {
  onClientReference = callback
}

async function createFromReadableStreamWithPreloadCollection<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  options?: object,
): Promise<T> {
  const emit = onClientReference

  if (!emit || typeof stream.tee !== 'function') {
    return createFromReadableStream<T>(stream, options)
  }

  const prefix = getModuleLoadingPrefix()
  const [decodeStream, preloadStream] = stream.tee()
  const preloadPromise = collectClientReferencePreloads(
    preloadStream,
    prefix,
    emit,
  )

  const result = await createFromReadableStream<T>(decodeStream, options)
  await preloadPromise
  return result
}

export {
  setOnClientReference,
  createFromReadableStreamWithPreloadCollection as createFromReadableStream,
}
