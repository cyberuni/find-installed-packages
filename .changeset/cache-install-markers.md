---
"find-installed-packages": patch
---

The cache stamp now also watches install markers, such as `node_modules/.pnpm/` and `node_modules/.package-lock.json`, whose names come from `package-manager-detector`'s `INSTALL_METADATA`. An install that changes the installed packages without changing the lockfile, such as `npm install --no-save`, now invalidates cached results. From a workspace member, the markers at the repository root count too, so a change to the root's store is noticed.
