---
"@beep/db-admin": patch
---

Close the test-typecheck blind spot: add `tsconfig.test.json` and a
`beep:check:tests` step to `check`, so test-side type errors fail the package
gate instead of surfacing only in the repo-wide lane.
