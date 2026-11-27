# Cache baseline review: repo-cli declares law-practice-server's test files

Dated 2026-11-27. Goal `route-soundness-repair`, a review fix on #3616. This is the review
basis for re-recording the cache baseline of the root subject and `@beep/repo-cli`.

## What changed

The cross-package read census now counts a reference that resolves to another package's root.
That surfaced one read: `ci-partitions.test.ts` globs law-practice-server's test files to seed
the in-memory checkout its shard-budget check reads. `@beep/repo-cli` now declares
`packages/law-practice/server/test/**` on `test`, `test:property` and `coverage`.

The root subject `//` records the digest of every per-package `turbo.json`, so it is re-recorded
for the changed file.

## What did not change

No task gained or lost an output. No environment entry, pass-through variable, dependency edge
or cache flag changed. The override starts from `$TURBO_EXTENDS$`, so the root inputs stay in
force.

## Effect on cached results

The new input changes the `test`, `test:property` and `coverage` hashes of `@beep/repo-cli`, so
its cached results are not reused across this change. That is the intent: adding, removing or
renaming a law-practice-server test now reruns, and under `--affected` selects, the repo-cli
test that plans its shards.
