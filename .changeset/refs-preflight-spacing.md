---
"@beep/repo-cli": patch
---

`beep refs refresh` now checks the Graft dist patches before deep builds. When the check fails,
deep members build structurally and report `skipped-preflight`. The receipt records the result in
an optional `preflight` field. The rendered refs service orders after the beep graft deep refresh.
