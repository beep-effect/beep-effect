# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/business-drivers-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/freshbooks#audit`
- `@beep/freshbooks#build`
- `@beep/freshbooks#check`
- `@beep/freshbooks#coverage`
- `@beep/freshbooks#lint:deprecated-apis`
- `@beep/freshbooks#package-test-typecheck`
- `@beep/freshbooks#test`
- `@beep/freshbooks#test:integration`
- `@beep/hubspot#audit`
- `@beep/hubspot#build`
- `@beep/hubspot#check`
- `@beep/hubspot#coverage`
- `@beep/hubspot#lint:deprecated-apis`
- `@beep/hubspot#package-test-typecheck`
- `@beep/hubspot#test`
- `@beep/hubspot#test:integration`
- `@beep/hubspot#test:property`
- `@beep/m365#audit`
- `@beep/m365#build`
- `@beep/m365#check`
- `@beep/m365#coverage`
- `@beep/m365#lint:deprecated-apis`
- `@beep/m365#package-test-typecheck`
- `@beep/m365#test`
- `@beep/m365#test:integration`
- `@beep/m365#test:integration:parallel`
- `@beep/m365#test:property`
- `@beep/uspto#audit`
- `@beep/uspto#build`
- `@beep/uspto#check`
- `@beep/uspto#coverage`
- `@beep/uspto#lint:deprecated-apis`
- `@beep/uspto#package-test-typecheck`
- `@beep/uspto#test`
- `@beep/uspto#test:integration`
- `@beep/uspto#test:property`

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
