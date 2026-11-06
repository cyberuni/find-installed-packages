---
name: pm-gap-scan
description: Use this skill when checking the supported package managers for new releases that change where installed packages land or how they resolve, surveying package managers find-installed-packages does not yet support, recording verified versions and verdicts, and filing gap issues.
metadata:
  internal: true
---

# Package Manager Gap Scan

Apply when asked to check the latest package manager releases against `find-installed-packages`,
find layouts it mishandles, survey package managers it does not yet support, or file gap issues.
This skill is for this repo only.

The skill has **two axes**. Run both unless the request names one:

- **Depth.** New releases of the managers already supported (steps 1–10).
- **Breadth.** Managers or install layouts not supported at all (steps 11–15).

## What this package depends on

Read these before judging any candidate, because a candidate matters only if it touches one of them:

- **Resolution.** `packages/find-installed-packages/src/resolvePackagesInfo.ts` walks the declared
  dependency graph and asks the runtime where each package lives: Yarn's `pnpapi` first under PnP
  (`src/getPnpApi.ts`), then `createRequire(issuer).resolve('<name>/package.json')`, then
  `require.resolve.paths(name)`, then the entry point walked up to its manifest. It then reads each
  `package.json` with `fs`. With no manifest at `cwd` it scans `node_modules` (`src/findPackagesInfo.ts`).
- **Cache.** `src/getFingerprint.ts` stamps the cache with the mtime of `package-manager-detector`'s
  `LOCKS` plus `.pnp.cjs` and `.pnp.data.json`, looked up from `cwd` upward, and of `package.json`
  and the top-level `node_modules`. A lockfile it does not watch means stale results after an install.

## Where the records live

| Record | File | Rule |
| --- | --- | --- |
| Verified versions (depth) | `.agents/skills/pm-gap-scan/baselines.md` | Append-only. One dated section per scan. |
| Breadth verdicts | `.agents/skills/pm-gap-scan/verdicts.md` | Append-only. One dated section per sweep. |
| Support matrix (user-facing) | `apps/website/src/content/docs/package-managers.md` | Updated in place to match the latest baselines. |
| Weekly live check | `.github/workflows/pm-latest-watch.yml` running `tools/pm-watch` | Default cells only. Not changed by this skill. |

## Supported managers and modes

Derive the list from `tools/pm-watch/src/cells.ts` (the default cells) and the latest section of
`baselines.md` (every mode verified so far), not from this table, which will rot:

| Manager | npm package | Upstream releases | Modes beyond the default cell |
| --- | --- | --- | --- |
| npm | `npm` | `gh release list --repo npm/cli` | `--install-strategy=linked` |
| pnpm | `pnpm` | `gh release list --repo pnpm/pnpm` | `nodeLinker: hoisted`, `enableGlobalVirtualStore`, `nodeLinker: { type: loaded }`, `nodePackageMap` |
| Yarn classic | `yarn` | `gh release list --repo yarnpkg/yarn` | none |
| Yarn berry | `@yarnpkg/cli-dist` | `gh release list --repo yarnpkg/berry` | `nodeLinker: pnpm` |
| Bun | `bun` | `gh release list --repo oven-sh/bun` | workspace default (`configVersion`), `install.globalStore` |
| Node (runtime) | — | `https://nodejs.org/dist/index.json` | the resolver every `node_modules` layout relies on |

## Workflow

1. **Read the baseline per manager and mode** from the latest section of `baselines.md` that names
   it. Baselines come from evidence in this repo only: that log, a past PR body that quotes a real
   install, or a pm-watch run (`gh run list --workflow pm-latest-watch.yml`, then the run's step
   summary). Never from memory. A manager or mode with no recorded version has **no baseline**: the
   probe in step 5 establishes one.

2. **Resolve the latest stable release** per manager: `npm view <npm package> dist-tags --json`, and
   cross-check the release source above. Skip pre-releases, canaries, and release candidates (Yarn 6
   is `yarnpkg/zpm`, still rc at the first scan).

3. **Report managers where latest equals the baseline as up to date**, and skip steps 4–5 for them.

4. **Read the changelog between baseline and latest** (`gh api repos/<o>/<r>/releases --paginate`,
   `CHANGELOG.md`, the release blog post when the release body only links one). With no baseline,
   read the current and previous major lines. This is reading whose answer is far smaller than the
   text, so delegate it to a subagent with the two dependency notes above. Extract every change to
   **where installed packages land or how they resolve**:
   - new or changed linkers and modes, and default-mode changes;
   - store moves, such as a global virtual store, or symlink vs hardlink vs copy;
   - loader-based or virtual-file-system installs where package paths do not exist on disk;
   - `exports` and `package.json` resolution changes, and PnP API or `.pnp.*` file changes;
   - new, renamed, or dropped lockfiles and install-state files;
   - workspace layout changes;
   - Node or Bun resolver changes: `require.resolve`, `require.resolve.paths`, `createRequire`,
     package maps, module hooks.

5. **Probe every default cell and every candidate mode.** Install a real fixture and run the built
   package against it. Build first: `bun run --filter find-installed-packages build`.
   - **Default cells: `tools/pm-watch`**, the same check CI runs weekly. Put the release on `PATH`
     from a scratch prefix, not a global install:

     ```sh
     npm install --prefix <scratch>/pnpm --no-audit --no-fund pnpm@<latest>
     PATH=<scratch>/pnpm/node_modules/.bin:$PATH node tools/pm-watch/src/check.ts pnpm --out <dir>/pnpm.json
     node tools/pm-watch/src/report.ts <dir>
     ```

   - **Other modes and breadth candidates: `probe.mjs`** in this folder. It installs through a
     throwaway local registry and depends on the packed package, so the package is loaded the way a
     consumer loads it:

     ```sh
     node .agents/skills/pm-gap-scan/probe.mjs --install "<install command>" [--run "<runtime>"] \
       [--layout single|workspace] [--file <path>=<content, \n for newlines>]... [--keep]
     ```

     It prints `pass`, `found`, `missing`, and `created`: each root entry the install wrote, marked
     with whether the cache fingerprint watches it. Recipes from past scans:

     | Mode | Arguments |
     | --- | --- |
     | npm linked | `--install "npx -y npm@<v> install --install-strategy=linked"` |
     | pnpm hoisted | `--file 'pnpm-workspace.yaml=nodeLinker: hoisted' --install "npx -y pnpm@<v> install"` |
     | pnpm global virtual store | `--file 'pnpm-workspace.yaml=enableGlobalVirtualStore: true' …` |
     | pnpm loaded | `--file 'pnpm-workspace.yaml=nodeLinker:\n  type: loaded' --run "npx -y pnpm@<v> exec node" …` |
     | pnpm package map | `--layout workspace --file 'pnpm-workspace.yaml=packages:\n  - packages/*\nnodePackageMap:\n  mode: load' --run "npx -y pnpm@<v> exec node" …` |
     | Bun global store | `--file 'bunfig.toml=[install]\nlinker = "isolated"\nglobalStore = true' --run <bun> --install "<bun> install"` |
     | Deno, no `node_modules` | `--file 'deno.json={"nodeModulesDir": "none"}' --run "<deno> run -A" --install "<deno> install"` |

   Known environment traps, so a probe failure is not misread as a gap:
   - **Yarn berry through `probe.mjs`** fails in the fetch step with
     `ERR_SOCKET_CLOSED_BEFORE_CONNECTION` (seen on 4.18.1, cause not found). Use pm-watch for the
     Yarn berry cells. For `nodeLinker: pnpm`, keep a pm-watch fixture (`--keep`), switch its
     `.yarnrc.yml`, reinstall, and run `tools/pm-watch/src/probe.mjs` by hand.
   - **Yarn's pnpm linker hardlinks from its global folder.** When the fixture is on another
     filesystem (`/tmp` is often tmpfs), the install dies with `EXDEV`. Set `YARN_GLOBAL_FOLDER`
     and `YARN_CACHE_FOLDER` inside the fixture.
   - **pnpm 12 reads the registry from `.npmrc` only**, so `probe.mjs` writes one.
   - **The `bun` npm package needs its postinstall**, which npm 12 blocks: run
     `node install.js` in its package folder.
   - **A failure before this package's code runs** is upstream, not a gap. For example, Node failing
     to import `find-installed-packages` itself from the project root under a package map.
   - **Downloaded binaries need the user's approval to run.** If a run is denied, record the
     candidate as not probed and ask. Do not route around the denial.

6. **Classify each candidate.** It is a **gap** only when all of these hold:
   - this package mishandles it, as a probe shows: a missing or extra package, or a lockfile or
     state file the fingerprint should watch and does not;
   - no open or closed issue tracks it (`gh issue list --state all --search "<keyword>"`);
   - the cause is in this package's reach, not a failure before its code runs.

   Tag each gap by kind (**resolution** or **cache**) and by reach (**default**, **opt-in**, or
   **experimental** upstream). Name the smallest change that would fix it, without making it: gaps
   are report items, not fixes.

7. **Confirm the gap list with the user before filing.** Issue creation is outward-facing. Present
   the classified list, and file only what they approve, or all of it if they said to proceed.

8. **File one issue per approved gap** with the `repobuddy:issue` skill, which searches for
   duplicates first. Body: what the probe ran and printed (the `found`/`missing` lines), the cause
   traced to a line in `src/`, a `## Proposed` section, and the reach tag. Label `bug` for a default
   layout and `enhancement` otherwise. End with `*Filed by pm-gap-scan against <manager> <version>.*`

9. **Append a section to `baselines.md`** with every cell and mode probed, pass or fail: manager
   version, runtime version, layout, and the probe that ran it. Then update the versions and any
   changed rows in `apps/website/src/content/docs/package-managers.md`.

10. **Report a summary table**: manager, baseline → latest, cells and modes probed, gaps found,
    issues filed with URLs, and candidates skipped (already tracked, not in reach, or declined).

## Breadth: managers not yet supported

Depth never finds a manager with no baseline to beat.

11. **Read `verdicts.md` before probing anything.** Re-probe a recorded verdict only when its
    recheck trigger has fired:
    - **`unsupported`** and **`not-a-package-manager`**: durable. Re-probe only if the project
      changes what it is.
    - **`blocked-upstream`**: re-probe when the named missing feature may have landed. Check that
      feature, not everything.
    - **`viable`**: confirm its issue or its matrix row. Do not re-file.
    - **`not probed`**: probe it, which is what the entry asks for.

12. **Sweep for candidates.** Query; do not recall:
    - the agents `package-manager-detector` names (`AGENTS`, `LOCKS`, `INSTALL_METADATA` in its
      `dist/constants.mjs`) and the managers `unjs/nypm` wraps;
    - GitHub, with several phrasings, since projects describe themselves inconsistently:

      ```sh
      gh api "search/repositories?q=javascript+package+manager+stars:%3E500&sort=stars&per_page=15" \
        -q '.items[]|"\(.stargazers_count)\t\(.full_name)\t\(.pushed_at[0:10])\t\(.description)"'
      ```

      Also try `node package manager`, `npm alternative package manager`, `pnpm alternative`.
    - runtimes that install npm packages themselves (Deno, Bun), in each of their layouts.

    The star filter decides what to look at, not what is possible. Drop version managers, registries,
    and wrappers that delegate to another manager (corepack, nypm, upm), recording them as
    `not-a-package-manager`.

13. **Gate each candidate, in this order, and stop at the first gate it fails:**
    1. **Obtainable and runnable here**: an npm package, or a release asset with a verified checksum,
       in a scratch folder.
    2. **Found from inside a process running there**: `probe.mjs` with the candidate's install
       command and its runtime as `--run`, in single and workspace layouts. Every expected package is
       found, including the `exports`-hidden one.
    3. **Cache stays correct**: the lockfile it writes is in the fingerprint's watched set
       (`created[].watched`). Check upstream `package-manager-detector` too, since that is where the
       name should come from.

    Where gate 1 is not permitted, read the candidate's own layout docs (not its README) and record
    a docs-read verdict marked **not probed**.

14. **File a prospective-support issue per viable candidate** that needs a change here, under the
    same confirmation rule as step 7. Footer: `*Filed by pm-gap-scan (breadth sweep).*`

15. **Append one section to `verdicts.md` for every candidate gated**, including the ones you file
    nothing for:

    ```markdown
    ## Sweep YYYY-MM-DD

    - **<project> — VERDICT: viable | blocked-upstream | unsupported | not-a-package-manager [| not probed].**
      <home URL>, <stars> stars on <date>, version <exact version> probed <date> (or docs-read <URL>).
      Gate 1: … Gate 2: <found/missing per layout> … Gate 3: <lockfile, watched or not> …
      <blocked-upstream: RECHECK TRIGGER — the feature whose arrival changes this.>
      <viable: the issue URL, or the gap it raises.>
    ```

    A verdict without its date and version cannot be trusted later. Verdicts describe what was true
    at that date. They close nothing.

## Anti-patterns

- Taking a baseline from memory, or from "it probably still works", instead of from the log or a probe.
- Treating a probe's environment failure (registry, filesystem, permissions) as a gap.
- Filing a gap that an open or closed issue already tracks, or filing without the user's approval.
- Fixing a gap in `src/` during a scan. Gaps are report items.
- Changing `.github/workflows/pm-latest-watch.yml` or adding a scheduled job. A scheduled scan is
  undecided.
- Gating a candidate and recording nothing because it failed.
- Editing an existing section of `baselines.md` or `verdicts.md` instead of appending one.
- Installing managers globally, or running a downloaded binary the user has not allowed.

## References

- Layout table: `packages/find-installed-packages/readme.md`, "How packages are found".
- Weekly check: `tools/pm-watch/README.md`.
- Model skill: cyber-mux's `mux-gap-scan`.
