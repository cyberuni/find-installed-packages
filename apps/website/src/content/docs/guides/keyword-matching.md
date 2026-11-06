---
title: Keyword matching
description: Which packages findByKeywords returns for a given keyword list.
---

A package is returned when the `keywords` array in its `package.json` contains **every** keyword you
pass. The package may declare extra keywords; they do not prevent a match.

Given a package `plugin-m` that declares both `some-keyword` and `another-keyword`, and a package
`plugin-a` that declares only `some-keyword`:

| Call | `plugin-a` | `plugin-m` |
| --- | --- | --- |
| `findByKeywords(['some-keyword'])` | returned | returned |
| `findByKeywords(['some-keyword', 'another-keyword'])` | not returned | returned |

## What is returned

- **Package names**, taken from the `name` field of each matching `package.json`. Scoped packages keep
  their scope, for example `'@some-scope/plugin-a'`.
- **Each name once.** A package reached through more than one dependent appears a single time.
- **An empty array** when nothing matches, when `cwd` does not exist, or when there is nothing
  installed. `findByKeywords` does not throw for these cases.

Do not rely on the order of the names.

## What is never returned

- Packages with no `keywords` field.
- Packages without a `name` field.
- Packages in the `@types` scope. They are skipped without being read.
- Packages that are installed but that no `package.json` in the graph declares. See
  [How packages are found](/find-installed-packages/guides/how-packages-are-found/).
