# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/cli-config-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/ai-provider-cli#audit`
- `@beep/ai-provider-cli#build`
- `@beep/ai-provider-cli#check`
- `@beep/ai-provider-cli#coverage`
- `@beep/ai-provider-cli#lint:deprecated-apis`
- `@beep/ai-provider-cli#package-test-typecheck`
- `@beep/ai-provider-cli#test`
- `@beep/ai-provider-cli#test:integration`
- `@beep/ai-provider-cli#test:property`
- `@beep/architecture-lab-config#audit`
- `@beep/architecture-lab-config#build`
- `@beep/architecture-lab-config#check`
- `@beep/architecture-lab-config#coverage`
- `@beep/architecture-lab-config#lint:deprecated-apis`
- `@beep/architecture-lab-config#package-test-typecheck`
- `@beep/architecture-lab-config#test`
- `@beep/architecture-lab-config#test:integration`
- `@beep/architecture-lab-config#test:property`

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
