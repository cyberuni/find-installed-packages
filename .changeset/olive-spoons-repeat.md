---
'find-installed-packages': major
---

ESM only, Node >= 20.19, and take lockfile names from `package-manager-detector`.

BREAKING CHANGES:

- **The package is now ESM only.** The CJS build is gone, so
  `require('find-installed-packages')` no longer resolves on Node versions without
  `require(esm)`. Use `import`, or stay on 3.x.
- **`engines.node` is now `>=20.19`**, up from `>=14`.

The cache stamp now takes its lockfile names from
[`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector)
instead of a list maintained here. That list was missing `nub.lock`,
`aube-lock.yaml` and `aube-workspace.yaml`, so under those package managers the
stamp fell back to `package.json` and top-level `node_modules` alone — an install
that changed a transitive package without touching either would not invalidate the
cache. New package managers now arrive with a dependency bump.

Yarn PnP's `.pnp.cjs` and `.pnp.data.json` are still watched separately, as they
change with the installed tree but are not lockfiles.
