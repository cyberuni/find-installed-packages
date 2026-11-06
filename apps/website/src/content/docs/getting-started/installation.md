---
title: Installation
description: Install find-installed-packages and check its runtime requirements.
---

```sh
npm install find-installed-packages
```

Or with another package manager:

```sh
pnpm add find-installed-packages
yarn add find-installed-packages
bun add find-installed-packages
```

## Requirements

- **ESM only.** The package ships as ES modules with no CommonJS build. Load it with `import`.
- **Node.js >= 20.19**, or **Bun >= 1.0**, as declared in the package's `engines` field.
- **TypeScript types are included.** No separate `@types` package is needed.

## Yarn Plug'n'Play

Under Yarn PnP, call `findByKeywords` from inside the PnP-enabled process, which is the normal case
for a library loaded by your app. A separate plain `node` process finds nothing, because there is no
`node_modules` folder to fall back to.

Inside the PnP process, packages are located through Yarn's `pnpapi`. `pnpapi` is provided by Yarn
at runtime; it is not a dependency and you do not install it.

Bun does not provide Yarn's PnP runtime, so under Bun a PnP-only project finds nothing.
