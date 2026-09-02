---
---

Repo-internal only, no release. Toolchain, supply-chain soak and dependency
automation. The only change inside the package is devDependency pins
(`tsdown`, `bun-types`), which do not affect what consumers install: the
emitted `dist/index.mjs` and `dist/index.d.mts` are byte-identical before and
after.
