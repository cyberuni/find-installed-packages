---
'find-installed-packages': patch
---

Point `repository`, `homepage` and `bugs` at `cyberuni/find-installed-packages`.

`repository` is read when generating provenance attestations, so it has to be correct
at publish time — not merely correct in the repo.
