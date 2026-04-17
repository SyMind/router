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
}) => void

function setOnClientReference(_callback: OnClientReference | undefined) {
  // Rsbuild does not need this hook, so this is intentionally a no-op.
}

export { setOnClientReference, createFromReadableStream }
