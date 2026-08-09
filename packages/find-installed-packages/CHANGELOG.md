# find-installed-packages

## 3.1.2

### Patch Changes

- 1bad1eb: Point `repository`, `homepage` and `bugs` at `cyberuni/find-installed-packages`.

  `repository` is read when generating provenance attestations, so it has to be correct
  at publish time — not merely correct in the repo.

## 3.1.1

### Patch Changes

- 8c1e930: Restore missing readme file.

# [3.1.0](https://github.com/unional/find-installed-packages/compare/v3.0.4...v3.1.0) (2026-05-07)

### Features

- add source field to exports and update files configuration ([e18253c](https://github.com/unional/find-installed-packages/commit/e18253c14b59717d75ee3ae43904e89fe9be5f14))

## [3.0.4](https://github.com/unional/find-installed-packages/compare/v3.0.3...v3.0.4) (2026-05-07)

### Performance Improvements

- convert file system operations to async and add memory cache ([71990e7](https://github.com/unional/find-installed-packages/commit/71990e7b4ed9dc2d4e211ba36014b98509d65ca0))

## [3.0.3](https://github.com/unional/find-installed-packages/compare/v3.0.2...v3.0.3) (2023-06-03)

### Bug Fixes

- **deps:** update dependency unpartial to v1.0.5 ([#197](https://github.com/unional/find-installed-packages/issues/197)) ([e218017](https://github.com/unional/find-installed-packages/commit/e21801780f1d7ec13d49f8e58d1b12d075790362))

## [3.0.2](https://github.com/unional/find-installed-packages/compare/v3.0.1...v3.0.2) (2023-03-15)

### Bug Fixes

- **deps:** update dependency unpartial to v1.0.4 ([#156](https://github.com/unional/find-installed-packages/issues/156)) ([24d462f](https://github.com/unional/find-installed-packages/commit/24d462f73337031bb92cd3206148f04f48ed179a))

## [3.0.1](https://github.com/unional/find-installed-packages/compare/v3.0.0...v3.0.1) (2022-09-08)

### Bug Fixes

- improve recursive case ([8783ed3](https://github.com/unional/find-installed-packages/commit/8783ed38243844f02cc0d1a092d357490270da2e))

# [3.0.0](https://github.com/unional/find-installed-packages/compare/v2.1.8...v3.0.0) (2022-09-08)

### Bug Fixes

- drop nodejs 12 support ([f4d1970](https://github.com/unional/find-installed-packages/commit/f4d197039ae8c9853bdb5374cf275cd1b05e6fe0))

### BREAKING CHANGES

- drop nodejs 12 support

## [2.1.8](https://github.com/unional/find-installed-packages/compare/v2.1.7...v2.1.8) (2022-09-08)

### Bug Fixes

- should return unique list ([#56](https://github.com/unional/find-installed-packages/issues/56)) ([c8a4647](https://github.com/unional/find-installed-packages/commit/c8a4647411efc040ba0cc6ba85c5954004781481))

## [2.1.7](https://github.com/unional/find-installed-packages/compare/v2.1.6...v2.1.7) (2022-09-07)

### Bug Fixes

- skip over permission denied ([489c8ef](https://github.com/unional/find-installed-packages/commit/489c8ef329c782f38480ef88ae547bf30287ad9a))
