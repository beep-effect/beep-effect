---
"@beep/identity": patch
"@beep/utils": patch
"@beep/wink": patch
---

Keep coverage test files isolated to avoid shared module state affecting test
contexts, error equivalence, and Wink model loading.
