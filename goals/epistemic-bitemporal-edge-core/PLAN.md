# Epistemic Bitemporal Edge Core Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Storage/concurrency/provenance spike | pending | Prove the storage design and attribution boundary before schema commitment. | Every ratified invariant has an evidenced Postgres and PGlite proof-lane backstop, or the stop rule fires. |
| P1 Implement | pending | Build the domain, tables, ports, repository, and migration vertical slice. | Durable disposition, atomic supersession, and as-of behavior are implemented. |
| P2 Verify | pending | Prove two-axis history, races, and recovery. | Focused tests, restart/migration proof, and repo verification are green. |
| P3 Close | pending | Reflect, publish through Yeet, monitor, and record readiness/retirement trigger. | Reflection passes lint and the PR is mergeable. |

## P0 — Storage, Concurrency, and Provenance Spike

- Inventory every donor/source before code, including exact Graphiti locations,
  Apache-2.0 notices/modified-file duties, and the deferred agentmemory lane.
- Define logical edge identity across source, target, relation,
  organization/matter scope, predicate qualifiers, and evidence scope; prove it
  is a safe no-overlap partition.
- Define the bounded endpoint model for claims, evidence, domain entities, and
  observations; specify typed rejection of arbitrary/dangling endpoints.
- Prototype Postgres half-open ranges and exclusion/no-overlap enforcement,
  ordered interval checks, unique logical-version identity, lineage foreign
  keys, and the temporal index plan.
- Establish PGlite parity. Where a production mechanism is unavailable,
  document and test the explicit substitution/portable backstop without
  weakening semantics.
- Generate and inspect the migration shape through the repo-owned db-admin
  path; do not hand-wave extension/operator availability.
- Exercise concurrent supersession under the chosen isolation/locking rule;
  prove deterministic close-and-insert and rejection of overlapping races.
- Decide cycle enforcement only from evidence; retain application-side
  prevention unless a simple DB mechanism wins.

**Hard gate:** if the spike cannot preserve every ratified invariant across
production Postgres and the PGlite proof lane, stop and reshape the storage
backstop before P1.

## P1 — Implement

- Add the schema-first epistemic domain entity/value objects, bounded endpoint
  union, logical identity, lineage, review state, `ClaimDisposition`, and typed
  temporal/repository errors.
- Add epistemic tables, constraints, indexes, and projected metadata using the
  P0-selected portable enforcement design.
- Add use-case commands/ports and the canonical `asOf(validAt, knownAt)` query
  contract without widening shared `ClaimLifecycle`.
- Implement the server repository so supersession closes metadata intervals
  and inserts the immutable replacement/lineage in one transaction.
- Add the generated db-admin migration and register it through existing
  migration composition.
- Record the operator-level Graphiti retirement trigger when the port milestone
  actually lands; never route operator memory through product tables.

## P2 — Verify

- Fixture: accepted claim/edge plus durable rejected disposition.
- Fixture: retroactive correction with one `validAt` and two `knownAt` values,
  proving former and corrected answers respectively.
- Fixture: interval boundaries and open-ended `Option`/SQL `NULL` semantics.
- Adversarial concurrency tests: two superseders race without producing
  overlapping authoritative versions or partial lineage.
- Restart/migration integration proof: disposition, immutable versions,
  lineage, and two-axis answers survive process boundaries.
- Run focused package/type/lint/test lanes chosen from affected workspaces,
  then `bun run beep yeet verify`; archive exact evidence under `history/`.

## P3 — Close

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, starting
   from `history/reflections/_TEMPLATE.md`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README evidence, manifest phase states, and lifecycle only when the
   proof and completion gate allow it.
4. Use Yeet to repair, verify, publish a PR, monitor checks/review, and drive it
   to mergeable.
5. Confirm the doctrine-trigger record retires the write-frozen Graphiti
   deployment without creating product/operator coupling.

## Execution Notes

- Preserve unrelated worktree changes and keep this packet's scope strict.
- `SPEC.md` is normative; update this plan as evidence resolves P0 choices.
- Archive proof and closeout artifacts under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/epistemic-bitemporal-edge-core/GOAL.md)" -le 4000
jq . goals/epistemic-bitemporal-edge-core/ops/manifest.json
rg -n "epistemic-bitemporal-edge-core|GOAL.md|agentLaunchers|packetAnchorDocument" goals/epistemic-bitemporal-edge-core
git diff --check -- goals/epistemic-bitemporal-edge-core
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
