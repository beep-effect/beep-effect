# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/mcp-kit-main-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/mcp-kit#audit`
- `@beep/mcp-kit#build`
- `@beep/mcp-kit#check`
- `@beep/mcp-kit#coverage`
- `@beep/mcp-kit#doctest`
- `@beep/mcp-kit#lint:deprecated-apis`
- `@beep/mcp-kit#package-test-typecheck`
- `@beep/mcp-kit#test`
- `@beep/mcp-kit#test:integration`
- `@beep/mcp-kit#test:property`

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
