---
"@beep/repo-cli": patch
---

`beep refs refresh` now probes the model proxy before each deep build. On HTTP 429 it runs a
structural build only and reports `skipped-cooldown` instead of sleeping into the step timeout.
Member receipts also keep the tail of a failed step's output in `detail`.
