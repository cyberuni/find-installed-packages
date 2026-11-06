---
title: Introduction
description: What find-installed-packages does, and why scanning node_modules is not enough.
---

`find-installed-packages` returns the names of the installed packages whose `package.json` declares
every keyword you ask for.

```ts
import { findByKeywords } from 'find-installed-packages'

const packages = await findByKeywords(['some-keyword']) // ['pkg-a', 'pkg-b']

// or from somewhere other than the current directory
await findByKeywords(['some-keyword'], { cwd: './packages/app' })
```

A typical use is plugin discovery: plugins tag themselves with a keyword, and the host asks which of
them the project has installed.

## Why not scan `node_modules`?

Node.js has no API that lists installed packages. The usual substitute is to read the folders under
`node_modules`. That only works when every package sits in a `node_modules` folder below the project,
and several common layouts break that assumption.

`find-installed-packages` walks the declared dependency graph from `cwd` instead and asks the host
runtime's module resolver where each package lives:

| Layout | Scanning `node_modules` | Resolving |
| --- | --- | --- |
| npm / yarn / bun, single package | works | works |
| pnpm, `bun --linker=isolated` | relies on undocumented store internals | works |
| Workspaces (tree hoisted to the repo root) | **finds nothing** | works |
| Yarn Plug'n'Play (no `node_modules` at all) | **finds nothing** | works |

The trade-off is that only **declared** dependencies are reported. A package that is present in
`node_modules` but that nothing depends on is not returned. See
[How packages are found](/find-installed-packages/guides/how-packages-are-found/) for the details.

## What it is not

- It does not load or import the packages it finds. It returns their names; loading them is up to
  you.
- It does not search a registry. Only packages installed in the project are considered.

## Next

- [Installation](/find-installed-packages/getting-started/installation/)
- [Keyword matching](/find-installed-packages/guides/keyword-matching/)
- [`findByKeywords` reference](/find-installed-packages/reference/find-by-keywords/)
