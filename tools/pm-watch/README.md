# pm-watch

Checks `findByKeywords` against a real install made by each package manager's latest release.
A manager release can change where packages land without a changelog line that says so.
This tool notices by installing and looking.

The [`pm-latest-watch`](../../.github/workflows/pm-latest-watch.yml) workflow runs it every Monday.
It runs one matrix cell per manager and mode, and opens one issue when any cell fails.

## Cells

| Cell | Manager | Install | Run under |
| --- | --- | --- | --- |
| `npm` | npm | `npm install --install-links` | Node |
| `pnpm` | pnpm | `pnpm install` (isolated) | Node |
| `yarn-classic` | Yarn 1 | `yarn install` | Node |
| `yarn-berry-node-modules` | Yarn 2+ | `nodeLinker: node-modules` | Node |
| `yarn-berry-pnp` | Yarn 2+ | `nodeLinker: pnp` | `yarn node` (Yarn's PnP runtime) |
| `bun-hoisted` | Bun | `bun install --linker=hoisted` | Node and Bun |
| `bun-isolated` | Bun | `bun install --linker=isolated` | Node and Bun |
| `deno-none` | Deno | `deno install`, `nodeModulesDir: "none"` | Deno |
| `deno-auto` | Deno | `deno install`, `nodeModulesDir: "auto"` | Node and Deno |

npm gets `--install-links` because by default it symlinks a `file:` folder and never installs that package's own dependencies.
With the flag, npm packs each folder and installs it the way it installs a registry package.

The Deno cells cannot use `file:` packages, which `deno install` skips without an error.
They install from a throwaway registry (`registry.mjs`) that serves the fixture packages and this package, and forwards every other name to npm.
They run a probe copied into the project that imports `find-installed-packages` by name, because Deno resolves a package's own imports from the project, not from where the file sits.
`deno-none` leaves out `plugin-ws`: with no `node_modules`, `require.resolve` cannot reach a workspace sibling.

## What one cell checks

`check.ts` writes a throwaway project in a temp folder.
Every dependency is a local `file:` package, so nothing comes from a registry:

- `plugin-a`: tagged with the keyword, a direct dependency.
- `plugin-b`: tagged, reachable only through `plugin-a`.
- `plugin-c`: not tagged, so it must not be reported.
- `plugin-d`: tagged, and its `exports` hides `./package.json` and has no `require` entry.
- `plugin-e`: tagged, and its `exports` hides `./package.json` but has a `require` entry.
- `plugin-ws`: tagged, a sibling workspace (workspace variant only).

It checks two variants, a standalone project and a workspace (`findByKeywords` runs from `packages/app`).
For each variant it:

1. Installs with the manager, and fails the cell if the install fails.
2. Checks the install has the layout the cell is meant to test: plain folders in `node_modules`, symlinks into a store, or PnP with no `node_modules`.
3. Runs the built `dist/index.mjs` under each runtime, twice: once cold and once from the cache. Each must return exactly the expected set.
4. Removes `plugin-d`, reinstalls, and runs again, so a stale cache entry shows up as a failure.

## Run it locally

Build the package, put the manager release you want first on `PATH`, and name the cell:

```sh
bun run --filter find-installed-packages build
node tools/pm-watch/src/check.ts pnpm
node tools/pm-watch/src/check.ts bun-isolated --keep   # keep the fixture to inspect it
```

The check exits 1 when anything fails and prints a JSON result, or writes it with `--out <file>`.
The Yarn cells check that the `yarn` on `PATH` is the right release line, 1 for classic and 2 or later for berry.

`node tools/pm-watch/src/report.ts <dir>` reads every result file under `<dir>` and prints the issue body.
A cell with no result file counts as failed.

## The workflow

- Runs every Monday at 09:00 UTC, on `workflow_dispatch`, and on pull requests that change this tool or the workflow.
- Fetches each manager with `npm install --global <name>@latest`, `oven-sh/setup-bun` with `bun-version: latest`, or `denoland/setup-deno` with `deno-version: latest`. The resolved version is in each cell's log, step summary and the issue.
- Opens an issue titled `chore: package manager latest-release check failed`, labelled `pm-watch` and `maintenance`, only on the schedule or on a dispatch with `dry_run` off. It skips opening one while an issue with that title is open.
- A dispatch with `dry_run` on, and every pull request run, print the issue body instead.
- The run stays red while any cell fails.
