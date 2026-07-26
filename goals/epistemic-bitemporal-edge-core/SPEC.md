# Epistemic Bitemporal Edge Core Spec

## Objective

Ship the Postgres bitemporal edge authority core: a durable claim/edge
`ClaimDisposition` so rejected verdicts have a landing place; atomic
supersession that closes and inserts in one transaction; canonical two-axis
`asOf(validAt, knownAt)` reads with retroactive-correction proof; and
restart/migration proof. This is explicitly **THE `@beep/epistemic-tables`
bitemporal port milestone**. Landing it fires the doctrine trigger to retire
the write-frozen operator-level Graphiti deployment. Record that retirement;
product tables never become an operator-memory backend.

## Non-Goals

- No external graph or memory vendor in the authority path, dual-write authority, or direct authoritative projection writes.
- No widening shared `ClaimLifecycle`; `ClaimDisposition` stays epistemic-local and extraction review state stays orthogonal.
- No RRF arithmetic; `rag-retrieval-projection` is its single owner.
- No automatic supersession from contradiction detection.
- No coupling product memory to Cognee/Graphiti operator memory or using product tables as its backend.
- No tiers, decay, retention, semantic extraction, contradiction triage, external graph, or IP-law vocabulary in this goal.
- No magic dates, mutable fact payloads, delete-on-correction, or default persisted `isLatest` flag.

## Source Hierarchy

1. The graduation instruction that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/epistemic/domain`: edge entity, temporal/logical identity fields, bounded endpoints, disposition, lineage, and typed errors.
- `packages/epistemic/tables`: tables, indexes, unique/check/foreign-key/no-overlap backstops.
- `packages/epistemic/use-cases`: commands, repository ports, transitions, and `asOf(validAt, knownAt)` contract.
- `packages/epistemic/server`: repository implementation and atomic supersession transaction.
- `packages/_internal/db-admin`: generated migration and restart/migration proof.
- Focused package/integration tests and packet evidence only.

## Constraints

The following ratified invariants contract is verbatim from
[`Decision 7`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-7--bitemporal-invariants-contract):

> Both axes use half-open intervals: `[validFrom, validTo)` and
> `[recordedAt, expiredAt)`. Open ends are SQL `NULL`, modeled through Effect
> Schema `Option`; magic dates are forbidden. All reads use canonical as-of
> predicates. Fact payloads are immutable: supersession atomically closes
> metadata intervals and adds a lineage link, never editing or deleting the
> fact. “Latest” is derived from open intervals; no persisted `isLatest` exists
> unless profiling later demands it. Enforcement combines schema/service typed
> errors with DB backstops: ordered-interval checks, unique logical-version
> identity, lineage foreign keys, and no-overlap exclusion where supported.
> Close-and-insert occurs in one repository transaction with concurrency tests.
> Cycle prevention remains application-side unless the spike finds a simple DB
> mechanism.

- **Logical edge identity:** source, target, relation, organization/matter scope, predicate qualifiers, and evidence scope together form the no-overlap partition key.
- **Bounded endpoint model:** endpoints may reference claims, evidence, domain entities, or observations; arbitrary and dangling endpoint kinds are rejected.
- P0 must prove the Postgres range/exclusion design, PGlite parity or explicit test substitution, generated migration shape, index plan, concurrent supersession behavior, identity partition, and endpoint model before schema commitment.
- Complete a pre-code provenance/license inventory. Graphiti is the primary Apache-2.0 attributed donor; preserve required notices, identify ported/modified material, and add no donor runtime dependency.
- Keep schema/service errors typed, DB backstops explicit, and the repository transition atomic.

## Decision Log

The exploration holds the full rationale and rejected options; these are
back-links, not copied doctrine.

| Decision | Binding result | Source |
| --- | --- | --- |
| Scope | Product authority; core landing triggers operator Graphiti retirement without backend coupling. | [`Scope determination`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#scope-determination--product-memory-with-the-bitemporal-port-as-its-core) |
| Donors | Graphiti is the attributed Apache-2.0 donor; inventory precedes code; agentmemory retention attribution is deferred. | [`Decision 1`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-1--sourcing-and-donor-discipline) |
| Program boundary | Core only; triage and retention remain queued. | [`Decision 2`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-2--program-ownership) |
| First slice | Durable disposition, atomic correction, two-axis and restart/migration proof. | [`Decision 3`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-3--first-shippable-slice) |
| Authority | Repo-native Postgres only. | [`Decision 4`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-4--durable-truth-authority) |
| Placement | Epistemic-local model/tables/use-case/server/db-admin ownership. | [`Decision 5`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-5--epistemic-local-placement-and-orthogonal-disposition) |
| Invariants | Half-open bitemporal, immutable fact, derived latest, layered atomic enforcement. | [`Decision 7`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#decision-7--bitemporal-invariants-contract) |
| P0 | Prove portable storage, identity, endpoint, index, and concurrency backstops. | [`Deferred spike A`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md#deferred-spike-a--core-storage-and-concurrency-feasibility) |

## Acceptance Criteria

- [ ] Rejected gate verdicts persist a durable epistemic-local `ClaimDisposition`; shared `ClaimLifecycle` remains unchanged.
- [ ] An accepted evidence-backed claim/edge persists immutable fact payload, bounded endpoints, logical identity, review state, evidence, lineage, and both half-open time axes.
- [ ] Approved supersession closes the prior metadata intervals and inserts the replacement plus lineage in one transaction, with deterministic race behavior and no overlapping authoritative version.
- [ ] For one retroactive correction and the same `validAt`, earlier `knownAt` returns the former fact and later `knownAt` returns the corrected fact.
- [ ] Ordered intervals, logical-version uniqueness, lineage integrity, and no-overlap semantics have typed errors and DB/portable backstops proven in Postgres and the PGlite lane or its ratified substitution.
- [ ] Generated migration and restart proof preserve dispositions, history, lineage, and as-of answers.
- [ ] Graphiti Apache-2.0 attribution duties and the pre-code provenance/license inventory are recorded; no donor is a runtime dependency.
- [ ] Core landing records the Graphiti retirement doctrine trigger without coupling product tables to operator memory.
- [ ] Focused package tests, repo gates, reflection lint, and Yeet PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/epistemic-bitemporal-edge-core/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/epistemic-bitemporal-edge-core/ops/manifest.json` | Passes |
| Packet references | `rg -n -e "epistemic-bitemporal-edge-core" -e "GOAL.md" -e "agentLaunchers" -e "packetAnchorDocument" goals/epistemic-bitemporal-edge-core` | Expected references present |
| Packet whitespace | `git diff --check -- goals/epistemic-bitemporal-edge-core` | Passes |
| Storage spike | Archived Postgres/PGlite migration, range/exclusion, index, and substitution evidence | Every invariant has a production and proof-lane backstop |
| Temporal behavior | Focused disposition, two-axis, retroactive correction, and concurrent supersession tests | Correct history and deterministic races |
| Recovery | Generated migration plus restart integration proof | History and reads survive process boundaries |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- If the spike fails to preserve the ratified invariants across production Postgres and the repo's PGlite proof lane, stop and reshape the storage backstop.
- Logical edge identity, bounded endpoints, portable no-overlap enforcement, generated migration shape, or deterministic concurrent supersession cannot be made explicit before schema commitment.
- The implementation would enter a non-goal, add a donor runtime dependency, or weaken the authority/operator-memory boundary.
- Verification requires unnamed credentials, cost, destructive side effects, or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Raw-SQL constraint ownership | `@beep/epistemic-tables` edge/disposition tables | epistemic slice | `EntityTable.pgTableFrom` and drizzle-orm 1.0.0-rc.4 cannot express CHECK/FK/EXCLUDE/partial-index constraints; the hand-authored db-admin migration owns them and table metadata is knowingly lossy for these backstops. | Remove when the persist-descriptor vocabulary (or drizzle) can express exclusion and composite constraints and the migration is regenerated from metadata. |
