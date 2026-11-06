# Verified package manager versions

The versions `find-installed-packages` has been checked against with a real install, one dated
section per scan. Append-only: add a section, never edit one. The latest section naming a manager
and mode is its baseline for the next depth scan (see `SKILL.md`, step 1).

## Before the first scan

Recorded in pull request bodies, not by this skill:

- **Yarn 4.5.3, `nodeLinker: pnp`**, run with `yarn node` against `npm pack` of the branch, on Node
  20.19.0 and 26.7.0: finds plain and `exports`-hidden packages after the `pnpapi` change. Source:
  [#298](https://github.com/cyberuni/find-installed-packages/pull/298).
- **`bun install --linker=isolated`**, with whatever Bun CI runs, is a test in
  `packages/find-installed-packages/src/resolvePackagesInfo.spec.ts` since
  [#299](https://github.com/cyberuni/find-installed-packages/pull/299). No version is recorded.

## Scan 2026-11-06

First scan. Every manager had no recorded baseline, so each was probed at its latest stable release.
Package: `find-installed-packages` 4.0.2 built from `main` at `6f7d640`. Runtimes: Node 26.7.0,
Bun 1.4.4 (Bun cells) and 1.4.2 (other `--run bun` runs), and Deno 2.9.8 with its Node compat
layer reporting 26.5.1.

### Default cells (`tools/pm-watch`)

Each cell checks a standalone and a workspace project, cold, cached, and after a reinstall that drops
a dependency.

| Cell | Version | Result | Runtimes |
| --- | --- | --- | --- |
| `npm` | 12.2.2 | pass | Node |
| `pnpm` | 12.18.0 | pass | Node |
| `yarn-classic` | 1.22.22 | pass | Node |
| `yarn-berry-node-modules` | 4.18.1 | pass | Node |
| `yarn-berry-pnp` | 4.18.1 | pass | `yarn node` |
| `bun-hoisted` | 1.4.4 | pass | Node, Bun |
| `bun-isolated` | 1.4.4 | pass | Node, Bun |

### Other modes (`probe.mjs`, unless noted)

"Pass" means all four keyword packages were found: a direct one, a transitive one, a scoped one, and
an ESM-only one whose `exports` hides `./package.json`.

| Manager | Version | Mode | Layout | Runtime | Result |
| --- | --- | --- | --- | --- | --- |
| npm | 12.2.2 | default (hoisted) | single, workspace | Node; Bun (single) | pass |
| npm | 12.2.2 | `--install-strategy=linked` | single, workspace | Node | pass |
| pnpm | 12.18.0 | default (isolated) | single, workspace | Node | pass |
| pnpm | 12.18.0 | `nodeLinker: hoisted` | single | Node | pass |
| pnpm | 12.18.0 | `enableGlobalVirtualStore: true` | single | Node | pass |
| pnpm | 12.18.0 | `nodePackageMap.mode: load` | workspace | `pnpm exec node` | pass |
| pnpm | 12.18.0 | `nodePackageMap.mode: load` | single | `pnpm exec node` | not reached: Node cannot import `find-installed-packages` from the root file (`ERR_PACKAGE_MAP_EXTERNAL_FILE`) |
| pnpm | 12.18.0 | `nodeLinker: { type: loaded }` | single, workspace | `pnpm exec node` | **fail: finds none** |
| pnpm | 12.18.0 | `nodeLinker: { type: loaded }` | single | plain `node` | not reached: no package folders exist outside pnpm's loader |
| Yarn | 1.22.22 | classic | single, workspace | Node | pass |
| Yarn | 4.18.1 | `nodeLinker: node-modules` | single | Node | pass |
| Yarn | 4.18.1 | `nodeLinker: pnp` | single | `yarn node` | pass (one run; later runs hit the probe's Yarn fetch failure, see `SKILL.md`) |
| Yarn | 4.18.1 | `nodeLinker: pnpm` | standalone, workspace | Node, Bun | pass (by hand on a kept pm-watch fixture) |
| Bun | 1.4.4 | default for a workspace | workspace | Node | pass |
| Bun | 1.4.4 | `globalStore = true`, isolated | single, workspace | Node, Bun | pass (packages resolve into `<cache>/links`) |

Cache coverage seen in `created`: every manager above wrote a lockfile the fingerprint watches
(`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `.pnp.cjs`). The unwatched entries were
install-state files inside `node_modules` (`.package-lock.json`, `.modules.yaml`, `.yarn-state.yml`,
`.bun`, `.store`, `.package-map.json`), `.yarn/`, and `.pnp.loader.mjs`, each of which changes together
with a watched file.
