---
title: Cache
description: Where findByKeywords caches its results and what invalidates them.
---

Results are cached so that repeated calls skip the dependency walk.

## Where the cache lives

The cache is one JSON file, `.find-installed-packages.cache`, in the system temp folder. It is shared
by every project on the machine; entries are kept apart by their key.

If the file cannot be parsed, it is treated as empty and rebuilt.

## The cache key

Each entry is keyed by:

- **`cwd`**, resolved to an absolute path, and
- **the keywords**, sorted.

Because the keywords are sorted, `['b', 'a']` and `['a', 'b']` share one entry.

## What invalidates an entry

Each entry stores a stamp of the installed tree: the latest modification time among these files.

- `package.json` in `cwd`.
- `node_modules` in `cwd`.
- The lockfiles in the nearest folder at or above `cwd` that has any. Because the lookup walks
  upwards, a workspace package picks up the lockfile at the repository root.
- The install markers in `cwd` and in each folder above it, up to and including the lockfile's
  folder. A workspace package therefore also sees the store at the repository root.

An entry is discarded and recomputed when the current stamp is newer than the stored one. Installing,
removing, or updating packages changes the lockfile, so the next call walks the graph again. An
install that leaves the lockfile alone, such as `npm install --no-save`, still rewrites an install
marker, so it invalidates the entry too.

### Lockfile names

The lockfile names come from
[`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector), so a new
package manager is covered by a dependency update. They include `bun.lock`, `pnpm-lock.yaml`,
`yarn.lock`, `deno.lock`, `nub.lock`, and `aube-lock.yaml`.

Yarn PnP's `.pnp.cjs` and `.pnp.data.json` are watched too. They are not lockfiles, but they change
with the installed tree.

### Install markers

Install markers are files and folders a package manager writes when it installs. Their names come from
`package-manager-detector` too (its `INSTALL_METADATA`): `node_modules/.pnpm/`, `node_modules/.deno/`,
`node_modules/.aube/`, `node_modules/.upm/`, `node_modules/.package-lock.json`,
`node_modules/.yarn-state.yml`, `node_modules/.yarn_integrity`, and `.pnp.js`. A folder's
modification time changes when an entry is added to or removed from it. An install marker never ends
the lockfile lookup, so the lockfiles watched are the same with or without one.

If no lockfile exists in `cwd` or any folder above it, the stamp comes from `cwd`'s `package.json`,
its `node_modules`, and the install markers found on the way up.

## Clearing the cache

There is no API for clearing the cache. To force a fresh walk, delete
`.find-installed-packages.cache` from the system temp folder.
