# GOAL: Ship the epistemic bitemporal edge authority core

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: deliver the Postgres authority for immutable, bitemporal claims and
edges with durable `ClaimDisposition`, atomic supersession, canonical
`asOf(validAt, knownAt)` reads, and restart/migration proof.

This is a compact `/goal` launcher. Read these first:

- `goals/epistemic-bitemporal-edge-core/README.md`
- `goals/epistemic-bitemporal-edge-core/SPEC.md`
- `goals/epistemic-bitemporal-edge-core/PLAN.md`
- `goals/epistemic-bitemporal-edge-core/ops/manifest.json`
- `goals/epistemic-bitemporal-edge-core/research/SOURCES.md`

Then read `AGENTS.md`, `CLAUDE.md`, the exploration back-links named by
`SPEC.md`, and governing architecture/package standards. Use the required
Effect-first, schema-first, service, and symbol-discovery skills. Higher
priority repo standards outrank packet prose when they conflict.

Scope:

- In: `@beep/epistemic-domain` entity/value/error work;
  `@beep/epistemic-tables` tables, indexes, and constraints;
  `@beep/epistemic-use-cases` ports and as-of contract;
  `@beep/epistemic-server` transactional repository; `@beep/db-admin`
  migration; focused Postgres/PGlite, concurrency, temporal, and restart tests.
- Out: external authority vendors; shared `ClaimLifecycle` widening; RRF;
  automatic supersession; operator-memory coupling; tiers, decay, extraction,
  contradiction triage, external graph work, or domain-specific vocabulary.

Workflow:

1. Inspect referenced files, live exports, current state, and unrelated work.
2. Complete P0 before schema commitment: provenance/license inventory,
   logical identity, bounded endpoints, Postgres range/exclusion design,
   PGlite parity or explicit test substitution, generated migration shape,
   indexes, concurrency behavior, and portable backstops.
3. If P0 cannot preserve every ratified invariant in the Postgres and PGlite
   proof lanes, stop and reshape the storage backstop.
4. Implement the smallest schema-first, Effect-first vertical slice. Keep
   typed service errors, DB backstops, and close-and-insert in one repository
   transaction. Preserve unrelated changes.
5. Prove durable rejected disposition, atomic replacement, retroactive
   correction across both time axes, race behavior, and restart/migration.
6. Keep `PLAN.md`, manifest phase state, and evidence current.
7. At P3 Close, use `/reflect`, pass reflection lint, then use Yeet to publish
   a PR and drive it to mergeable.

Acceptance:

- [ ] Every criterion and stop condition in `SPEC.md` is honored.
- [ ] Required verification is green or unrelated failures are reproduced and recorded.
- [ ] No unrelated refactors, formatting churn, or forbidden scope expansion.

Packet verification:

```sh
test "$(wc -m < goals/epistemic-bitemporal-edge-core/GOAL.md)" -le 4000
jq . goals/epistemic-bitemporal-edge-core/ops/manifest.json
git diff --check -- goals/epistemic-bitemporal-edge-core
```

Done only when the implementation passes focused and repo proof, the reflection
exists, and the PR is mergeable; otherwise report the blocker with evidence.
