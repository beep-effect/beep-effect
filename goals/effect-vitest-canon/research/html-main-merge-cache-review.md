# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/provider-drivers-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/anthropic#audit`
- `@beep/anthropic#build`
- `@beep/anthropic#check`
- `@beep/anthropic#coverage`
- `@beep/anthropic#lint:deprecated-apis`
- `@beep/anthropic#package-test-typecheck`
- `@beep/anthropic#test`
- `@beep/anthropic#test:property`
- `@beep/openai#audit`
- `@beep/openai#build`
- `@beep/openai#check`
- `@beep/openai#coverage`
- `@beep/openai#lint:deprecated-apis`
- `@beep/openai#package-test-typecheck`
- `@beep/openai#test`
- `@beep/openai#test:integration`
- `@beep/openai-compat#audit`
- `@beep/openai-compat#build`
- `@beep/openai-compat#check`
- `@beep/openai-compat#coverage`
- `@beep/openai-compat#lint:deprecated-apis`
- `@beep/openai-compat#package-test-typecheck`
- `@beep/openai-compat#test`
- `@beep/openai-compat#test:integration`
- `@beep/openai-compat#test:property`
- `@beep/venice-ai#audit`
- `@beep/venice-ai#build`
- `@beep/venice-ai#check`
- `@beep/venice-ai#coverage`
- `@beep/venice-ai#lint:deprecated-apis`
- `@beep/venice-ai#package-test-typecheck`
- `@beep/venice-ai#test`
- `@beep/venice-ai#test:integration`
- `@beep/venice-ai#test:integration:parallel`
- `@beep/venice-ai#test:property`
- `@beep/xai#audit`
- `@beep/xai#build`
- `@beep/xai#check`
- `@beep/xai#coverage`
- `@beep/xai#lint:deprecated-apis`
- `@beep/xai#package-test-typecheck`
- `@beep/xai#test`
- `@beep/xai#test:integration`
- `@beep/xai#test:property`

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
