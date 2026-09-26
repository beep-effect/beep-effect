# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/provenance-main-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/provenance#audit`
- `@beep/provenance#build`
- `@beep/provenance#check`
- `@beep/provenance#coverage`
- `@beep/provenance#doctest`
- `@beep/provenance#lint:deprecated-apis`
- `@beep/provenance#package-test-typecheck`
- `@beep/provenance#test`
- `@beep/provenance#test:property`

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
