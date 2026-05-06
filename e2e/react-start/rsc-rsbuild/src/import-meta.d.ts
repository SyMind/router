import type { ReactNode } from 'react'

declare global {
  interface ImportMeta {
    readonly rspackRsc: {
      loadCss: () => ReactNode
    }
  }
}

export {}
