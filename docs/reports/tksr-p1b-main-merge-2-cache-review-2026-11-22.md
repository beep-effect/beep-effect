# Cache baseline review: P1 PR B after merging main at 9f921d29d9d

Date: 2026-11-22. Lane: P1 PR B of `goals/text-knowledge-stack-rebuild` (#3439).

## What changed

PR B merged `origin/main` (`9f921d29d9d`) to clear a base conflict after #3467 and #3479. The root baseline
conflicted with `main`'s re-record for the comment-law gate wiring lane. The merge took `main`'s
side, so the root lost the one edit PR B owns.

## Finding

`bun run beep cache audit` reported one blocking finding:

- `//#lint:identity-registry`: configuration drift. PR B adds the input glob
  `packages/foundation/modeling/identity/registry/**/*.json` to this task in `turbo.json`, because
  the lint reads the registry shards.

## Review

This is the same drift reviewed in `docs/reports/tksr-p1b-main-merge-cache-review-2026-11-22.md`.
The glob is an input only: a shard edit must invalidate the lint's cache entry, and it does. No
command, cache flag, output or environment variable changed. `main`'s root changes stay as `main`
reviewed them: the uncached `lint:comment-law` root script, the `oxc-parser` root dependency, the
laws policy seal reseal and the `@beep/lint-rules` edges. No qualification is granted.

## Subjects

Only the root (`//`) is re-recorded.
