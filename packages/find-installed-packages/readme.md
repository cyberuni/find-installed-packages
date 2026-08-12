# find-installed-packages

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]

[![Github NodeJS][github-nodejs]][github-action-url]
[![Codecov][codecov-image]][codecov-url]

[![Visual Studio Code][vscode-image]][vscode-url]
[![Wallaby.js][wallaby-image]][wallaby-url]

Find installed packages.

## Usage

```ts
import { findByKeywords } from 'find-installed-packages'

(async () => {
  const packages = await findByKeywords(['some-keyword']) // ['pkg-a', 'pkg-b']

  // or from somewhere other than the current directory
  await findByKeywords(['some-keyword'], { cwd: './packages/app' })
}())
```

A package is returned when its `package.json` declares **every** keyword you ask for.

## How packages are found

Packages are located by walking the declared dependency graph from `cwd` and asking
the host runtime's module resolver where each one lives, rather than scanning
`node_modules` folders.

That keeps results correct across layouts a `node_modules` scan gets wrong:

| Layout | Scanning `node_modules` | Resolving |
| --- | --- | --- |
| npm / yarn / bun, single package | works | works |
| pnpm, `bun --linker=isolated` | relies on undocumented store internals | works |
| Workspaces (tree hoisted to the repo root) | **finds nothing** | works |
| Yarn Plug'n'Play (no `node_modules` at all) | **finds nothing** | works |

Two consequences worth knowing:

- Only **declared** dependencies are reported. A package present in `node_modules`
  that nothing depends on is not returned.
- Under Yarn PnP this must run inside the PnP-enabled process (the normal case for
  a library loaded by your app). Shelling out to a plain `node` will find nothing.

If `cwd` has no readable `package.json`, or one that declares no dependencies, the
`node_modules` scan is used as a fallback.

## Cache

Results are cached in the temp folder, keyed by `cwd` plus keywords, and invalidated
when the lockfile, `package.json`, or top-level `node_modules` changes. Lockfiles are
looked up from `cwd` upwards, so workspaces are handled.

## Contribute

```sh
# after fork and clone
npm install

# begin making changes
git checkout -b <branch>
npm run watch

# after making change(s)
git commit -m "<commit message>"
git push

# create PR
```

[codecov-image]: https://codecov.io/gh/cyberuni/find-installed-packages/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/cyberuni/find-installed-packages
[downloads-image]: https://img.shields.io/npm/dm/find-installed-packages.svg?style=flat
[downloads-url]: https://npmjs.org/package/find-installed-packages
[github-nodejs]: https://github.com/cyberuni/find-installed-packages/actions/workflows/release.yml/badge.svg
[github-action-url]: https://github.com/cyberuni/find-installed-packages/actions
[npm-image]: https://img.shields.io/npm/v/find-installed-packages.svg?style=flat
[npm-url]: https://npmjs.org/package/find-installed-packages
[vscode-image]: https://img.shields.io/badge/vscode-ready-green.svg
[vscode-url]: https://code.visualstudio.com/
[wallaby-image]: https://img.shields.io/badge/wallaby.js-configured-green.svg
[wallaby-url]: https://wallabyjs.com
