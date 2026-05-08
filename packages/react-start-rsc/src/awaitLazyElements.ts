import { ReactElement, ReactLazy, ReactSuspense } from './reactSymbols'

/**
 * Optional callback for collecting CSS hrefs during tree traversal.
 * Only called when processing explicitly marked RSC CSS stylesheet links.
 */
export type CssHrefCollector = (href: string) => void

/**
 * Yields pending lazy element payloads from a tree, stopping at Suspense boundaries.
 * Also collects CSS hrefs from explicitly marked RSC CSS stylesheet links.
 */
function* findPendingLazyPayloads(
  obj: unknown,
  seen = new Set(),
  cssCollector?: CssHrefCollector,
): Generator<PromiseLike<unknown>> {
  if (!obj || typeof obj !== 'object') return
  if (seen.has(obj)) return
  seen.add(obj)

  const el = obj as any

  // Stop at Suspense boundaries - lazy elements inside are intentionally deferred
  if (el.$$typeof === ReactElement && el.type === ReactSuspense) {
    return
  }

  // Collect CSS hrefs from explicit Start-managed CSS markers. Do not collect
  // ordinary React 19 stylesheet resources here: preiniting those before render
  // marks them inserted and bypasses React's suspensey stylesheet commit wait.
  if (
    el.$$typeof === ReactElement &&
    el.type === 'link' &&
    el.props?.rel === 'stylesheet'
  ) {
    let cssHref: string | undefined
    if ('data-rsc-css-href' in el.props) {
      cssHref = el.props.href
    }
    if (cssHref && cssCollector) {
      cssCollector(cssHref)
    }
  }

  // Yield pending lazy element payload
  if (el.$$typeof === ReactLazy) {
    const payload = el._payload
    if (
      payload &&
      typeof payload === 'object' &&
      (payload.status === 'pending' || payload.status === 'blocked') &&
      typeof payload.then === 'function'
    ) {
      yield payload
    }
  }

  // Recurse into children
  if (Array.isArray(obj)) {
    for (const item of obj) {
      yield* findPendingLazyPayloads(item, seen, cssCollector)
    }
  } else {
    for (const key of Object.keys(obj)) {
      if (key !== '_owner' && key !== '_store') {
        yield* findPendingLazyPayloads(el[key], seen, cssCollector)
      }
    }
  }
}

/**
 * Wait for all lazy elements in a tree to be resolved.
 * This ensures client component chunks are fully loaded before rendering,
 * preventing Suspense boundaries from flashing during SWR navigation.
 *
 * Also collects CSS hrefs from explicitly marked RSC CSS stylesheet links.
 *
 * @param tree - The tree to process
 * @param cssCollector - Optional callback to collect CSS hrefs (server-only)
 */
export async function awaitLazyElements(
  tree: unknown,
  cssCollector?: CssHrefCollector,
): Promise<void> {
  for (const payload of findPendingLazyPayloads(
    tree,
    new Set(),
    cssCollector,
  )) {
    await Promise.resolve(payload).catch(() => {})
  }
}
