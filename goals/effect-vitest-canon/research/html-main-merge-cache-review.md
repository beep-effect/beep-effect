# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/leaves-checkpoint-main-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/brand#audit`
- `@beep/brand#build`
- `@beep/brand#check`
- `@beep/brand#coverage`
- `@beep/brand#lint:deprecated-apis`
- `@beep/brand#package-test-typecheck`
- `@beep/brand#test`
- `@beep/brand#test:integration`
- `@beep/chalk#audit`
- `@beep/chalk#build`
- `@beep/chalk#check`
- `@beep/chalk#coverage`
- `@beep/chalk#doctest`
- `@beep/chalk#lint:deprecated-apis`
- `@beep/chalk#package-test-typecheck`
- `@beep/chalk#test`
- `@beep/chalk#test:property`
- `@beep/ciops#audit`
- `@beep/ciops#build`
- `@beep/ciops#check`
- `@beep/ciops#dev`
- `@beep/ciops#lint:deprecated-apis`
- `@beep/ciops#package-test-typecheck`
- `@beep/ciops#test`
- `@beep/discord#audit`
- `@beep/discord#build`
- `@beep/discord#check`
- `@beep/discord#coverage`
- `@beep/discord#lint:deprecated-apis`
- `@beep/discord#package-test-typecheck`
- `@beep/discord#test`
- `@beep/discord#test:integration`
- `@beep/discord#test:property`

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
