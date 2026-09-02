# find-installed-packages

## 4.0.1

### Patch Changes

- 9f54c4f: Include the `LICENSE` file in the published package. Previously the package declared `"license": "MIT"` but shipped no license text because the root `LICENSE` file was never copied into the package directory.
- 25d73e8: Upgrade `@changesets/cli` to v3, the version matched to the `changesets/action@v2`
  pinned by the shared release workflow.

## 4.0.0

### Major Changes

- dc80869: ESM only, Node >= 20.19, and take lockfile names from `package-manager-detector`.

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

## 3.2.0

### Minor Changes

- b6b687a: Find packages by resolving the dependency graph instead of scanning `node_modules`.

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

## 3.1.2

### Patch Changes

- 1bad1eb: Point `repository`, `homepage` and `bugs` at `cyberuni/find-installed-packages`.

  `repository` is read when generating provenance attestations, so it has to be correct
  at publish time — not merely correct in the repo.

## 3.1.1

### Patch Changes

- 8c1e930: Restore missing readme file.

# [3.1.0](https://github.com/unional/find-installed-packages/compare/v3.0.4...v3.1.0) (2026-05-07)

### Features

- add source field to exports and update files configuration ([e18253c](https://github.com/unional/find-installed-packages/commit/e18253c14b59717d75ee3ae43904e89fe9be5f14))

## [3.0.4](https://github.com/unional/find-installed-packages/compare/v3.0.3...v3.0.4) (2026-05-07)

### Performance Improvements

- convert file system operations to async and add memory cache ([71990e7](https://github.com/unional/find-installed-packages/commit/71990e7b4ed9dc2d4e211ba36014b98509d65ca0))

## [3.0.3](https://github.com/unional/find-installed-packages/compare/v3.0.2...v3.0.3) (2023-06-03)

### Bug Fixes

- **deps:** update dependency unpartial to v1.0.5 ([#197](https://github.com/unional/find-installed-packages/issues/197)) ([e218017](https://github.com/unional/find-installed-packages/commit/e21801780f1d7ec13d49f8e58d1b12d075790362))

## [3.0.2](https://github.com/unional/find-installed-packages/compare/v3.0.1...v3.0.2) (2023-03-15)

### Bug Fixes

- **deps:** update dependency unpartial to v1.0.4 ([#156](https://github.com/unional/find-installed-packages/issues/156)) ([24d462f](https://github.com/unional/find-installed-packages/commit/24d462f73337031bb92cd3206148f04f48ed179a))

## [3.0.1](https://github.com/unional/find-installed-packages/compare/v3.0.0...v3.0.1) (2022-09-08)

### Bug Fixes

- improve recursive case ([8783ed3](https://github.com/unional/find-installed-packages/commit/8783ed38243844f02cc0d1a092d357490270da2e))

# [3.0.0](https://github.com/unional/find-installed-packages/compare/v2.1.8...v3.0.0) (2022-09-08)

### Bug Fixes

- drop nodejs 12 support ([f4d1970](https://github.com/unional/find-installed-packages/commit/f4d197039ae8c9853bdb5374cf275cd1b05e6fe0))

### BREAKING CHANGES

- drop nodejs 12 support

## [2.1.8](https://github.com/unional/find-installed-packages/compare/v2.1.7...v2.1.8) (2022-09-08)

### Bug Fixes

- should return unique list ([#56](https://github.com/unional/find-installed-packages/issues/56)) ([c8a4647](https://github.com/unional/find-installed-packages/commit/c8a4647411efc040ba0cc6ba85c5954004781481))

## [2.1.7](https://github.com/unional/find-installed-packages/compare/v2.1.6...v2.1.7) (2022-09-07)

### Bug Fixes

- skip over permission denied ([489c8ef](https://github.com/unional/find-installed-packages/commit/489c8ef329c782f38480ef88ae547bf30287ad9a))
