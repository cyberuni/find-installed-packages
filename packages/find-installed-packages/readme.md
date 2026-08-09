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
import { findByKeyword } from 'find-installed-packages'

(async () => {
  const packages = await findByKeyord('some-keyword') // ['pkg-a', 'pkg-b']
}())
```

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
