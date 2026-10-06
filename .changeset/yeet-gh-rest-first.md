---
"@beep/repo-cli": minor
---

Add `beep yeet gh`: REST-first pull-request operations (`pr status|label|comment|ready`,
`checks rerun-failed|cancel-queued`, `merge --sha`, `rate-limit`) over `@effected/github`,
with a GraphQL budget guard for the two GraphQL-only operations (the ready flip and the
review-thread count) and an alternate identity through `--token-ref op://…`,
`BEEP_GH_TOKEN_REF`, or a GitHub App installation token (`BEEP_GH_APP_*`). Yeet's PR
lookup, heavy-admission label, provenance footer reads and writes, and Greptile re-trigger
comment now use REST, and `yeet ready` flips through the budget guard instead of
`gh pr ready`.
