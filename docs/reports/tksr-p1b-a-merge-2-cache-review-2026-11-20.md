# Cache baseline review: P1 PR B after taking PR A's head 91d8c174242

Date: 2026-11-20. Lane: `goals/text-knowledge-stack-rebuild-p1b-registry`.

## What changed

PR B merged PR A's newer head `91d8c174242`, which carries `main` at
`c6debbfe089`. The root baseline conflicted and the merge took PR A's side, so
the root lost the one edit PR B owns.

## Finding

`bun run beep cache audit` reported one blocking finding:

- `//#lint:identity-registry`: configuration drift. PR B adds the input glob
  `packages/foundation/modeling/identity/registry/**/*.json` to this task in
  `turbo.json`, because the lint now reads the registry shards.

## Review

The drift is the same one reviewed in
`docs/reports/tksr-p1b-a-merge-cache-review-2026-11-19.md`. The glob is an
input only: a shard edit must invalidate the lint's cache entry, and it does.
No command, cache flag, output or environment variable changed. No
qualification is granted.

## Subjects

Only the root (`//`) is re-recorded. `@beep/rdf` merged without conflict and
the audit reports nothing for it.
