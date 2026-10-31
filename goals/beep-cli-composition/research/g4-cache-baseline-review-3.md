# Cache baseline review addendum: fingerprint regeneration after G4 merged (2026-10-31)

Reviewer: Claude Opus 5.5 (G4 follow-up, `claude/g4-fingerprint-lint-fixes`).

Follows [`g4-cache-baseline-review.md`](g4-cache-baseline-review.md). Commits that
merged after #2390 changed modules inside six command closures without
running `beep lint policy-fingerprint --write` (the R2b move of the glob and
walker helpers onto `@beep/glob` and `@beep/walker` removed repo-cli modules
from those closures). Regenerating removes the deleted
`packages/tooling/tool/cli/src/internal/GlobPattern.ts` from six seals
(`//#lint:policy-fingerprint:goals-doctor`, `goals-index`, `knowledge`,
`lint-deprecated-apis`, `lint-roadmap-refs` and `quality`) and adds the newly
reached `packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocNodes.ts`
to one of them (all subject `//`).
No other task, flag, edge or input changed, and no qualification is granted.
