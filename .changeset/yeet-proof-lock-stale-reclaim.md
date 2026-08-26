---
"@beep/repo-cli": patch
---

Close the stale-lock reclamation race in the yeet cross-checkout proof
coordinator with observation-bound atomic rename claims, and harden release
against removing a foreign lock generation.
