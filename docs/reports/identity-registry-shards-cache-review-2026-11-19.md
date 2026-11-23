# Cache review for the identity registry shards input (2026-11-19)

Branch `goals/text-knowledge-stack-rebuild-p1b-registry` (text-knowledge-stack-rebuild
P1, PR B commit 7, `feat(repo-cli): identity registry generator`).
Reviewer: Claude Opus 5.5 (P1 registry lane).

`bun run beep quality cache-policy` reports 1 blocking finding in one subject:

- `//`: `configuration-drift` on `//#lint:identity-registry`.

## Cause

`bun run beep lint identity-registry` now also checks the declared-term registry: it
decodes the source shards under `packages/foundation/modeling/identity/registry/namespaces/`
and compares the generated `Registry.data.ts` and `registry/term-snapshot.json` with their
regeneration. The task already listed every `.ts` file as an input, which covers
`Registry.data.ts`, but not the JSON shards or the snapshot. The commit adds the input
glob `packages/foundation/modeling/identity/registry/**/*.json` to the task, so an edited
shard or snapshot reruns the lint instead of replaying a stale cached pass.

## Judgement

One input glob is added. The task's command, cache flag, outputs and environment keys are
unchanged. The added glob only makes the cache key cover files the task now reads.
Recording the subject grants no qualification.

## Reversal

Remove the `packages/foundation/modeling/identity/registry/**/*.json` input from
`//#lint:identity-registry` in `turbo.json` together with the registry check in
`commands/Lint/IdentityRegistry.ts`, and re-record the `//` subject.
