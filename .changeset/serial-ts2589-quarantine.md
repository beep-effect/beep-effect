---
"@beep/repo-cli": patch
---

Run TS2589 quarantine package and lane recovery at Turbo concurrency one so the
recovery proof does not reintroduce the same concurrent compiler pressure across
the remaining packages.
