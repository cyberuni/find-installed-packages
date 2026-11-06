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

An entry is discarded and recomputed when the current stamp is newer than the stored one. Installing,
removing, or updating packages changes the lockfile, so the next call walks the graph again.

### Lockfile names

The lockfile names come from
[`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector), so a new
package manager is covered by a dependency update. They include `bun.lock`, `pnpm-lock.yaml`,
`yarn.lock`, `deno.lock`, `nub.lock`, and `aube-lock.yaml`.

Yarn PnP's `.pnp.cjs` and `.pnp.data.json` are watched too. They are not lockfiles, but they change
with the installed tree.

If no lockfile exists in `cwd` or any folder above it, the stamp comes from `cwd`'s `package.json`
and `node_modules` alone.

## Clearing the cache

There is no API for clearing the cache. To force a fresh walk, delete
`.find-installed-packages.cache` from the system temp folder.
