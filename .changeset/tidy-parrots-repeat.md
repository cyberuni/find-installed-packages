---
'find-installed-packages': minor
---

Find packages by resolving the dependency graph instead of scanning `node_modules`.

Packages are now located by walking the declared dependency graph from `cwd` and
asking the host runtime's module resolver where each one lives. This fixes layouts
the folder scan could not handle:

- **Workspaces** (npm, yarn, bun, pnpm) — the tree is hoisted to the repo root, so
  scanning from a workspace package found nothing at all.
- **Yarn Plug'n'Play** — there is no `node_modules` to scan.
- **pnpm and `bun --linker=isolated`** — previously these worked only by stumbling
  into undocumented store internals, and over-reported the whole virtual store.

When `cwd` has no readable `package.json`, or one that declares no dependencies,
the previous `node_modules` scan is still used as a fallback.

Two behaviour notes:

- Only **declared** dependencies are reported now. A package sitting in
  `node_modules` without being listed in anyone's `dependencies`, `devDependencies`
  (root only), `peerDependencies`, or `optionalDependencies` used to be returned as
  a side effect of how the folders were walked, and no longer is.
- Under Yarn PnP this must run inside the PnP-enabled process, which is the normal
  case for a library loaded by your app.

Also fixes the cache stamp: it is now derived from the lockfile, `package.json`, and
top-level `node_modules` instead of the `ctime` of every installed package, so the
cache can skip the walk entirely rather than only the manifest reads. Lockfiles are
looked up from `cwd` upwards so workspaces are handled.
