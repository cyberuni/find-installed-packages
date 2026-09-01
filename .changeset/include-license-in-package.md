---
"find-installed-packages": patch
---

Include the `LICENSE` file in the published package. Previously the package declared `"license": "MIT"` but shipped no license text because the root `LICENSE` file was never copied into the package directory.
