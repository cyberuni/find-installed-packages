---
"find-installed-packages": patch
---

Under Deno with `nodeModulesDir: "none"`, a package whose `exports` hide its `package.json` is found again. Deno's resolver lists the package's own cache folder as the lookup instead of a `node_modules` folder above it, and the lookup is now accepted when its `package.json` names the package. This had stopped working when the "resolve the entry point and walk up" lookup was removed.
