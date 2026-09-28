---
"@beep/repo-cli": patch
---

The proof ledger now lives in the owning clone, so sibling worktrees share one shadow sample.
A red lane records its Turbo input digest as an observation, so shadow disagreements are
observable. `yeet proof-report --since <timestamp>` bounds the enforcement sample to rows
recorded at or after that instant.
