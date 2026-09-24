---
"@beep/repo-cli": patch
---

`beep models check --offline` now reports an empty catalog diff instead of comparing its
upstream-less snapshot with the online ledger baseline, which listed every upstream-only model as
`removed`.
