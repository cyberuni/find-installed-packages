---
"find-installed-packages": patch
---

Find every installed package under Yarn Plug'n'Play, including one whose `exports`
expose neither `./package.json` nor a `require` entry, such as an ESM-only plugin.

Under PnP such a package was silently left out of the results, because Node's
resolver honours `exports` and PnP has no `node_modules` lookup paths to fall back
on. Packages are now located through Yarn's `pnpapi` when the process runs under
PnP. `pnpapi` is provided by Yarn, so this adds no dependency, and `node_modules`
installs behave as before.
