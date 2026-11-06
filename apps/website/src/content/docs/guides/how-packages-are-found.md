---
title: How packages are found
description: The dependency walk, the node_modules fallback, and what each one reports.
---

`findByKeywords` collects package manifests in one of two ways, depending on what it finds at `cwd`.

## The dependency walk

When `cwd` has a readable `package.json` that declares dependencies, `findByKeywords` walks the
declared dependency graph:

1. Read the dependency names from the project's `package.json`.
2. Ask the host runtime's module resolver where each one is installed, as seen from the package that
   declares it.
3. Read that package's `package.json`, and repeat from step 2 with its dependencies.

Each package folder is visited once, so a dependency shared by several packages, or a cycle, does not
cause repeated work or duplicate results.

### Which dependencies are followed

| Field | In the project's `package.json` | In an installed package's `package.json` |
| --- | --- | --- |
| `dependencies` | followed | followed |
| `optionalDependencies` | followed | followed |
| `peerDependencies` | followed | followed |
| `devDependencies` | followed | skipped |

`devDependencies` are only installed for the project itself, so they are skipped below the root.

A dependency that is declared but not installed is skipped. It does not cause an error.

### Why ask the resolver

Because each location comes from the resolver, the walk works on layouts a folder scan cannot read:

- **Workspaces.** The tree is hoisted to the repository root, so a workspace package has no
  `node_modules` of its own. Calling `findByKeywords` with `cwd` set to the workspace package still
  finds its dependencies.
- **Isolated stores** (pnpm, `bun --linker=isolated`). Transitive dependencies sit in their own store
  folders and are reachable only through their dependents. The walk follows them there.
- **Yarn Plug'n'Play.** There is no `node_modules` at all. Under PnP, Yarn's `pnpapi` is asked first.
- **Packages whose `exports` hide `package.json`.** Such a package is still found. Under Yarn PnP,
  `pnpapi` locates the package folder without consulting `exports`.

### Only declared dependencies are reported

The walk reaches only what the graph declares. A package that sits in `node_modules` without being a
dependency of anything is not returned.

## The fallback scan

When `cwd` has no readable `package.json`, or its `package.json` declares no dependencies, there is
nothing to walk. `findByKeywords` then scans folders instead:

- It reads the `node_modules` folder under `cwd`, including scoped folders such as
  `node_modules/@some-scope/plugin-a`.
- It descends into each package's own nested `node_modules`.
- It skips the `@types` scope and ignores plain files inside `node_modules`.

If `cwd` does not exist or has no `node_modules`, the result is an empty array.

## Yarn Plug'n'Play

Under Yarn PnP this must run inside the PnP-enabled process, the normal case for a library loaded by
your app. A separate plain `node` process finds nothing. Inside the PnP process the running process's
own `pnpapi` is used; outside PnP it is not loaded at all.

Bun does not provide Yarn's PnP runtime, so under Bun a PnP-only project finds nothing.
