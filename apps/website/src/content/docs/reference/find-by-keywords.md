---
title: findByKeywords
description: Return the names of the installed packages that declare every given keyword.
---

```ts
function findByKeywords(
  keywords: string[],
  options?: { cwd?: string },
): Promise<string[]>
```

Returns the names of the installed packages whose `package.json` `keywords` contain every entry in
`keywords`.

## Parameters

### `keywords`

`string[]`. The keywords a package must declare. A package matches only when it declares all of them.
See [Keyword matching](/find-installed-packages/guides/keyword-matching/).

### `options.cwd`

`string`, default `'.'`. The project folder to search from. It may be relative; it is resolved
against the current working directory.

Set it to look somewhere other than the current directory, for example a workspace package:

```ts
await findByKeywords(['some-keyword'], { cwd: './packages/app' })
```

## Returns

`Promise<string[]>`. The matching package names, each once. Scoped names keep their scope, for
example `'@some-scope/plugin-a'`. The array is empty when nothing matches, including when `cwd` does
not exist.

## Behavior

- Packages are located by walking the declared dependency graph from `cwd`. When `cwd` has no
  readable `package.json`, or one with no dependencies, the `node_modules` folders are scanned
  instead. See [How packages are found](/find-installed-packages/guides/how-packages-are-found/).
- Packages in the `@types` scope are never returned.
- Results are cached in the system temp folder and recomputed when the installed tree changes. See
  [Cache](/find-installed-packages/guides/cache/).

## Example

```ts
import { findByKeywords } from 'find-installed-packages'

// plugin-a declares ['some-keyword']
// plugin-m declares ['some-keyword', 'another-keyword']

await findByKeywords(['some-keyword'])
// ['plugin-a', 'plugin-m'] (in no particular order)

await findByKeywords(['some-keyword', 'another-keyword'])
// ['plugin-m']
```
