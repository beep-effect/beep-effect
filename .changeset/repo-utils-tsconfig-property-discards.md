---
"@beep/repo-utils": patch
---

Give the TSConfig compiler-options round-trip property a larger discard budget so a
random fast-check seed cannot exhaust it before the requested runs.
