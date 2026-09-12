---
"@beep/utils": patch
---

Resolve the `HostProcess` platform and architecture browser fallbacks through `Option` so
the module evaluates the same way in browser bundles without leaving an uncovered branch.
