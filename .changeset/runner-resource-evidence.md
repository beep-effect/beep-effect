---
"@beep/repo-cli": patch
---

Verify that runner resource reporting preserves lane failures and executes jobs
when measurement storage is unavailable. Keep full verification working for older
PR checkouts that do not yet contain the optional resource helper.
