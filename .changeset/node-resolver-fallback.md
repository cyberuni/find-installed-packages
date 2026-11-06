---
"find-installed-packages": patch
---

Under Node, a package whose `exports` hide its `package.json` is now followed into its own dependencies in a pnpm-style isolated store. Previously the lookup returned the symlink in `node_modules` rather than the store folder, so that package's dependencies were not found.

The resolver no longer tries a third "resolve the entry point and walk up" lookup. No supported layout needed it.

`dist/` now ships source maps (`dist/index.mjs.map`) next to the build.
