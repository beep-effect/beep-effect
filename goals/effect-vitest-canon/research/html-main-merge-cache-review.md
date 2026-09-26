# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/transport-sync-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/ai-sync#audit`
- `@beep/ai-sync#build`
- `@beep/ai-sync#check`
- `@beep/ai-sync#coverage`
- `@beep/ai-sync#lint:deprecated-apis`
- `@beep/ai-sync#package-test-typecheck`
- `@beep/ai-sync#test`
- `@beep/ai-sync#test:integration`
- `@beep/ai-sync#test:property`
- `@beep/api-transport#audit`
- `@beep/api-transport#build`
- `@beep/api-transport#check`
- `@beep/api-transport#coverage`
- `@beep/api-transport#doctest`
- `@beep/api-transport#lint:deprecated-apis`
- `@beep/api-transport#package-test-typecheck`
- `@beep/api-transport#test`
- `@beep/api-transport#test:integration`
- `@beep/api-transport#test:property`

Retained main nodes:

- `@beep/html#audit`
- `@beep/html#build`
- `@beep/html#check`
- `@beep/html#coverage`
- `@beep/html#doctest`
- `@beep/html#lint:deprecated-apis`
- `@beep/html#package-test-typecheck`
- `@beep/html#test`
- `@beep/html#test:integration`
- `@beep/html#test:property`
