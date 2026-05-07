# find-installed-packages

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]

[![Github NodeJS][github-nodejs]][github-action-url]
[![Codecov][codecov-image]][codecov-url]
[![Codacy Badge][codacy-image]][codacy-url]

[![Greenkeeper][greenkeeper-image]][greenkeeper-url]
[![Semantic Release][semantic-release-image]][semantic-release-url]

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

[codacy-image]: https://api.codacy.com/project/badge/Grade/fdf9435f584146b2aef88750c315c17a
[codacy-url]: https://www.codacy.com/manual/homawong/find-installed-packages?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=unional/find-installed-packages&amp;utm_campaign=Badge_Grade
[codecov-image]: https://codecov.io/gh/unional/find-installed-packages/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/unional/find-installed-packages
[downloads-image]: https://img.shields.io/npm/dm/find-installed-packages.svg?style=flat
[downloads-url]: https://npmjs.org/package/find-installed-packages
[github-nodejs]: https://github.com/unional/find-installed-packages/workflows/nodejs/badge.svg
[github-action-url]: https://github.com/unional/find-installed-packages/actions
[greenkeeper-image]: https://badges.greenkeeper.io/unional/find-installed-packages.svg
[greenkeeper-url]: https://greenkeeper.io/
[npm-image]: https://img.shields.io/npm/v/find-installed-packages.svg?style=flat
[npm-url]: https://npmjs.org/package/find-installed-packages
[semantic-release-image]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[vscode-image]: https://img.shields.io/badge/vscode-ready-green.svg
[vscode-url]: https://code.visualstudio.com/
[wallaby-image]: https://img.shields.io/badge/wallaby.js-configured-green.svg
[wallaby-url]: https://wallabyjs.com
