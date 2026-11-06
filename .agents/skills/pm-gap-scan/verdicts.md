# Breadth verdicts

Feasibility verdicts for package managers and install layouts `find-installed-packages` does not yet
support, one dated section per sweep. Append-only: add a section, never edit one. Read this before
probing anything (see `SKILL.md`, step 11).

Verdicts: `viable`, `blocked-upstream`, `unsupported`, `not-a-package-manager`. A verdict marked
`not probed` was read from the project's own docs, because its binary could not be run in that
sweep. The next sweep probes it.

## Sweep 2026-11-06

Package `find-installed-packages` 4.0.2 from `main` at `6f7d640`, Node 26.7.0. Candidates came from
`package-manager-detector` 1.8.0's `AGENTS` and `LOCKS`, `unjs/nypm`'s description, and
`gh api search/repositories` for `javascript package manager`, `node package manager`,
`npm alternative package manager`, and `pnpm alternative`, all above 500 stars.

- **Deno — VERDICT: viable.** https://deno.com, `denoland/deno` 108,834 stars on 2026-11-06,
  version 2.9.8 probed 2026-11-06 from the GitHub release asset (checksum verified). Gate 1:
  cleared. Gate 2: with `node_modules` (the default for a `package.json` project, and
  `nodeModulesDir: "auto"`), single and workspace, run under `deno run -A` and under Node: all four
  found. With `nodeModulesDir: "none"` (packages served from `DENO_DIR`), under `deno run -A`:
  `plugin-a`, `plugin-b` and `@fip-probe/plugin-s` found, **`plugin-hidden` missing**. Cause:
  `require.resolve.paths('plugin-hidden')` returns the package's own cache folder
  (`<DENO_DIR>/npm/<host>/plugin-hidden/1.0.0`), not a `node_modules` parent, so
  `resolvePackageDir` strategy 2 looks for `<that folder>/plugin-hidden` and misses. Gate 3:
  `deno.lock` is written and watched. Raises gap G2 in the 2026-11-06 scan report. No issue.
- **vlt — VERDICT: viable, not probed.** https://github.com/vltpkg/vltpkg, 564 stars on 2026-11-06,
  latest 1.6.4 (2026-11-05). Gate 1: running the `vlt` binary was not permitted in this session.
  Docs-read https://docs.vlt.io/client/commands/install.md: installs into `node_modules`, with a
  `node_modules/.vlt/` store, so gate 2 is expected to clear the way pnpm's isolated layout does.
  Gate 3 **fails on the docs**: `vlt install` writes `vlt-lock.json`, which is not in
  `package-manager-detector`'s `LOCKS` (no `vlt` entry upstream, no issue or PR there on 2026-11-06)
  and not watched here. Under vlt the cache would notice only `package.json` and the top-level
  `node_modules`. Raises gap G3. No issue.
- **aube — VERDICT: viable, not probed.** https://aube.sh, `aubepkg/aube` 2,059 stars on 2026-11-06,
  latest 2.9.0 (2026-11-02). Gate 1: running the binary was not permitted in this session. Docs-read
  https://aube.sh/package-manager/global-virtual-store: `node_modules` entries are symlinks, into a
  global virtual store under `<cacheDir>/virtual-store/v1/` by default for local installs, or into
  `node_modules/.aube/` without it. That is the shape the pnpm and Bun global-store probes pass on.
  Gate 3: `aube-lock.yaml` and `aube-workspace.yaml` are in `LOCKS`. The docs say aube writes an
  existing npm, pnpm, Yarn, or Bun lockfile in place, and each of those is watched.
- **nub — VERDICT: viable, not probed.** https://nubjs.com, `nubjs/nub` 4,431 stars on 2026-11-06,
  latest 0.9.7 (2026-10-19). Gate 1: running the binary was not permitted in this session. Docs-read
  https://nubjs.com/docs/install: isolated `node_modules` with direct dependencies at the top level
  and the rest linked from a virtual store, or `node-linker=hoisted`. Gate 3: writes `nub.lock`, which
  is in `LOCKS`, or the existing manager's lockfile.
- **Rush with pnpm (`pnpm-rush`) — not gated.** Named in `package-manager-detector`'s `AGENTS`. A
  probe needs a `rush.json` monorepo scaffold that `probe.mjs` does not build. Rush installs with
  pnpm into `common/temp` and links each project's `node_modules`, so the pnpm verdicts are the
  nearest evidence. Gate it next sweep.
- **ultra — VERDICT: unsupported.** `nachoaldamav/ultra`, 546 stars on 2026-11-06, archived, last push
  2023-02-23. Not probed: abandoned upstream.
- **ied — VERDICT: unsupported.** `alexanderGugel/ied`, 1,984 stars on 2026-11-06, last push
  2017-01-10. Not probed: abandoned upstream.
- **corepack — VERDICT: not-a-package-manager.** `nodejs/corepack`, 3,847 stars. It fetches and runs
  another manager, which is the one that installs.
- **nypm — VERDICT: not-a-package-manager.** `unjs/nypm`, 713 stars. A wrapper that delegates to
  npm, pnpm, Yarn, Bun, Deno, nub, or aube.
- **upm — VERDICT: not-a-package-manager.** `replit/upm`, 1,173 stars. A front-end that delegates to
  each language's own manager.

Dropped from the searches as not installing npm packages: `bower/bower` and `caolan/jam` (browser
package managers with their own registries), and `simogeo/Filemanager` (a file manager).
