---
title: Package managers
description: The package managers and install layouts find-installed-packages is verified against, and what it does where a layout falls short.
---

`findByKeywords` finds packages by asking the runtime's resolver where each declared dependency lives,
so it does not depend on one `node_modules` shape. But package managers lay packages out very
differently: hoisted folders, symlinks into a store, a store outside the project, or no
`node_modules` at all. This page maps which of those layouts are verified, against which release, and
what happens where one falls short.

## At a glance

| Layout or capability | npm | pnpm | Yarn classic | Yarn berry | Bun | Deno (not listed as supported) |
| --- | --- | --- | --- | --- | --- | --- |
| Verified against | 12.2.2 | 12.18.0 | 1.22.22 | 4.18.1 | 1.4.4 | 2.9.8 |
| Default layout | ✓ hoisted | ✓ isolated store | ✓ hoisted | ✓ Plug'n'Play | ✓ hoisted; isolated in a workspace | ✓ `node_modules` |
| Hoisted folders | ✓ default | ✓ `nodeLinker: hoisted` | ✓ default | ✓ `nodeLinker: node-modules` | ✓ `--linker=hoisted` | — |
| Symlinks into a store | ✓ `--install-strategy=linked` | ✓ default | — | ✓ `nodeLinker: pnpm` | ✓ `--linker=isolated` | ✓ `node_modules/.deno` |
| Store outside the project | — | ✓ `enableGlobalVirtualStore` | — | — | ✓ `globalStore = true` | ⚠ `nodeModulesDir: "none"` |
| No package folders on disk | — | ✗ `nodeLinker: { type: loaded }` | — | ✓ Plug'n'Play, inside `yarn node` | — | ⚠ `nodeModulesDir: "none"` |
| Workspaces, from a member package | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| A package whose `exports` hides `package.json` | ✓ | ✓ (✗ under `loaded`) | ✓ | ✓ | ✓ | ✓ (✗ under `"none"`) |
| Lockfile the cache watches | `package-lock.json` | `pnpm-lock.yaml` | `yarn.lock` | `yarn.lock`, `.pnp.cjs`, `.pnp.data.json` | `bun.lock`, `bun.lockb` | `deno.lock` |

✓ verified with a real install. ⚠ partly works, see the manager's section. ✗ verified not to work.
— the manager has no such layout.

### How this stays current

The default layouts are checked every week against each manager's latest release by the
[`pm-latest-watch`](https://github.com/cyberuni/find-installed-packages/actions/workflows/pm-latest-watch.yml)
job ([workflow](https://github.com/cyberuni/find-installed-packages/blob/main/.github/workflows/pm-latest-watch.yml)).
It covers npm, pnpm, Yarn classic, Yarn berry with `node-modules` and Plug'n'Play, and Bun hoisted and
isolated. It opens an issue when one breaks. Treat its latest green run as the live version of the
"Verified against" row for those layouts.

The other layouts on this page were verified by hand on 2026-11-06. The versions and the exact probe
for each are in the
[scan log](https://github.com/cyberuni/find-installed-packages/blob/main/.agents/skills/pm-gap-scan/baselines.md).

## npm

- **Hoisted (default) and `--install-strategy=linked`** both work, from a single package and from a
  workspace member. The linked strategy puts packages in `node_modules/.store` and symlinks them;
  the resolver follows the links.
- npm 12 no longer reads `npm-shrinkwrap.json`. The cache still watches it, which costs one `stat`
  and changes nothing.

## pnpm

- **Isolated (default), `nodeLinker: hoisted`, and the global virtual store** all work. With
  `enableGlobalVirtualStore`, packages live in pnpm's store outside the project, and the resolver
  still finds them through the project's `node_modules` links.
- **Package maps** (`nodePackageMap: { mode: load }`, run through `pnpm exec node`) work in a
  workspace. In a single-package project, Node 26.7.0 could not import `find-installed-packages`
  itself from the project root, so nothing in this package ran.
- **`nodeLinker: { type: loaded }` finds nothing.** This experimental linker (pnpm 12.10 and later)
  writes no package folders. Packages load from pnpm's store through a loader that
  `pnpm exec` registers. The resolver answers with paths under `node_modules/.pnpm/.pnpm-loader/`
  that exist only inside that loader, and `findByKeywords` reads each `package.json` from disk, so
  every read fails and no package is reported. Under plain `node`, without `pnpm exec`, the package
  cannot even be imported. Use another `nodeLinker` in projects that rely on `findByKeywords`.

## Yarn classic

Hoisted `node_modules`, single package and workspaces. Yarn 1 is in maintenance mode.

## Yarn berry

- **Plug'n'Play (default).** Run inside Yarn's PnP runtime (`yarn node`, or a process Yarn starts).
  Packages are located through Yarn's `pnpapi`, which ignores `exports`, so an `exports`-hidden
  package is found too. Under plain `node` or under Bun, which have no PnP runtime, a PnP-only project
  resolves nothing.
- **`nodeLinker: node-modules` and `nodeLinker: pnpm`** both work, under Node and Bun.

## Bun

- **Hoisted and isolated** both work, under Node and under Bun. A new workspace installs isolated by
  default.
- **Global store** (`globalStore = true` in `bunfig.toml`) works. Packages resolve into Bun's cache,
  outside the project.

## Deno

Deno is not listed as a supported runtime. These results are from probing it, not a promise.

- **With `node_modules`** (the default for a `package.json` project, or `nodeModulesDir: "auto"`), it
  works from a single package and a workspace, run under Deno or Node.
- **With `nodeModulesDir: "none"`**, packages are served from Deno's global cache. Ordinary packages
  are found, but a package whose `exports` hides `./package.json` is missed, even when it has a
  `require` entry: Deno's `require.resolve.paths` returns the package's own folder rather than a
  `node_modules` folder above it. Use `nodeModulesDir: "auto"` or `"manual"` if you need such a package.

## Not yet supported

These were surveyed from their documentation but not installed, so none of this is verified:

- **[vlt](https://github.com/vltpkg/vltpkg)** installs into `node_modules` with a
  `node_modules/.vlt` store, which resolution should handle. Its lockfile, `vlt-lock.json`, is not one
  the cache watches, so after a `vlt install` that changes only transitive packages, a cached result
  can be stale.
- **[aube](https://aube.sh)** symlinks `node_modules` into a global virtual store by default. Its
  lockfiles (`aube-lock.yaml`, `aube-workspace.yaml`) are watched.
- **[nub](https://nubjs.com)** uses an isolated `node_modules` with a virtual store. Its lockfile
  (`nub.lock`) is watched.

See [How packages are found](/find-installed-packages/guides/how-packages-are-found/) for the
resolution steps, and [Cache](/find-installed-packages/guides/cache/) for what the cache watches.
