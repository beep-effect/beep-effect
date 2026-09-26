---
"@beep/fc-runs": patch
"@beep/repo-ai-metrics": patch
---

Import Effect and `@beep/utils` helpers through their per-module paths and use
shared helper references (`identity`, `constant`, `thunk0`) in place of trivial
lambdas. No behavior change.
