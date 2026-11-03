# Cache baseline review: W2 repo-utils dependency (2026-11-03)

Reviewer: Claude Opus 5.5 (W2 lane, `refactor/beep-cli-w2-leaf`).

W2 moves repo-cli's JSDoc section and doctest-source helpers into
`@beep/repo-utils/JSDoc/` (SPEC D28). `JSDocSections.ts` reads
`@beep/markdown`'s `MarkdownDocument`, so `@beep/repo-utils` declares that
workspace dependency; `tsconfig-sync` added the matching project reference and
`bun.lock` records the edge. `@beep/markdown` does not depend on
`@beep/repo-utils`, so no cycle forms.

## `@beep/repo-utils`

The `build`, `check`, `lint:deprecated-apis`, `test` and `test:property` tasks
gain the `@beep/markdown#build` upstream edge. No task, cache flag, output or
`passThroughEnv` changes, and no qualification is granted.

## `//` (root)

`tsconfig-sync` regenerated `standards/fallow.boundaries.generated.jsonc`
from the workspace dependency edges, which now include
`@beep/repo-utils -> @beep/markdown`. No root task, flag or output changes.
