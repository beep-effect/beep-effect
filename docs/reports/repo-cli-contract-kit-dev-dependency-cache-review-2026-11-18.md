# Cache review for the `@beep/contract-kit` dev dependency of `@beep/repo-cli` (2026-11-18)

Branch `claude/model-first-standard-scaffolder` (PR #3394). Reviewer: Claude Opus 5.5
(scaffolder lane).

`bun run beep quality cache-policy` reports 6 blocking `configuration-drift`
findings, all in `@beep/repo-cli`: `build`, `check`, `doctest`,
`lint:deprecated-apis`, `test` and `test:property`.

## Cause

`@beep/repo-cli` gains `"@beep/contract-kit": "workspace:^"` in
`devDependencies`. Its `architecture-model-first-context` test type-checks a
generated context that imports `@beep/contract-kit` and references its project,
so the declaration output of `@beep/contract-kit` is a build input of that test.
Without the edge the hosted unit shard's prebuild (`turbo run build
--filter=@beep/repo-cli^...`) never built it, and the test failed with TS6305.
The edge adds `@beep/contract-kit` to the upstream set of every listed task.

## Judgement

The change is one dependency edge. No task command, cache flag, input glob,
output glob or environment variable changed in `@beep/repo-cli`. Recording the
new configuration grants no qualification.

## Reversal

Remove the dev dependency, run `bun install` and `bun run beep tsconfig-sync`,
and re-record `@beep/repo-cli`.
