---
"@beep/ai-sync": patch
---

Tighten the Graft policy after adversarial review: the structural `graft build` is approved exactly (no `--deep`), and `graft init`, `graft uninstall`, and `graft upgrade` join the required deny domain because they rewrite tracked agent wiring.
