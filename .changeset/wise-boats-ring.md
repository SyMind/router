---
'@tanstack/start-plugin-core': patch
---

Collect Rsbuild route preloads and stylesheets from tagged chunk group origins and their loading contexts. Avoid leaking sibling route assets through shared chunks, while retaining dependencies supplied by every parent and styles for deferred hydration.
