# Cache dependency reconciliation after HTML merge

Preserve main's HTML runner dependency projection and this branch's separately
reviewed package dependency changes. A three-way comparison confirms the
changed computation nodes are disjoint or identical. Every other projection
field is equal across the merge base and both sides. No qualification state
or cache configuration is changed.

Branch review: `goals/effect-vitest-canon/research/media-drivers-cache-review.md`.
Main review: `goals/effect-vitest-canon/research/html-main-cache-review.md`.

Retained branch nodes:

- `@beep/exiftool#audit`
- `@beep/exiftool#build`
- `@beep/exiftool#check`
- `@beep/exiftool#coverage`
- `@beep/exiftool#lint:deprecated-apis`
- `@beep/exiftool#package-test-typecheck`
- `@beep/exiftool#test`
- `@beep/exiftool#test:integration`
- `@beep/exiftool#test:integration:parallel`
- `@beep/face-detection#audit`
- `@beep/face-detection#build`
- `@beep/face-detection#check`
- `@beep/face-detection#coverage`
- `@beep/face-detection#lint:deprecated-apis`
- `@beep/face-detection#package-test-typecheck`
- `@beep/face-detection#test`
- `@beep/face-detection#test:integration`
- `@beep/face-detection#test:property`

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
