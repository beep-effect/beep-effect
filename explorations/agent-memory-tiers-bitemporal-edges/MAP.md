# Agent Memory Tiers & Bitemporal Edges — Map

## Controlling Scope and First Slice

This map decomposes **product memory for the professional runtime**, not
Claude/Codex operator memory. The first slice is
`epistemic-bitemporal-edge-core`: the authoritative Postgres record of a gated,
evidence-backed claim/relation and its durable disposition, atomic retroactive
replacement, two-axis `asOf(validAt, knownAt)`, and restart/migration proof.

## Candidate Goal Packets

| Order | Slug | Mission | Depends on | Gate / capability boundary |
| --- | --- | --- | --- | --- |
| **GRADUATED 2026-07-14** | [`epistemic-bitemporal-edge-core`](../../goals/epistemic-bitemporal-edge-core/README.md) | Ship the Postgres bitemporal edge authority, durable claim/edge disposition, atomic supersession, and two-axis as-of reads. This is explicitly **THE `@beep/epistemic-tables` bitemporal port milestone**. Landing it fires the doctrine trigger to retire the write-frozen operator-level Graphiti deployment; it does not make product tables an operator-memory backend. | Existing epistemic, provenance, identity, Drizzle/Postgres, and db-admin bricks | P0 storage/concurrency/provenance spike; NET-NEW edge entity, temporal/logical identity model, `ClaimDisposition`, tables/indexes, repository, as-of contract, and migration |
| **GRADUATED 2026-07-25** | [`epistemic-contradiction-triage`](../../goals/epistemic-contradiction-triage/README.md) | Add evidence-backed, confidence-bearing, reviewable `CONTRADICTS` candidates and an approval path that may resolve as atomic `SUPERSEDES` without detection mutating authority. | `epistemic-bitemporal-edge-core` | P0 fixture spike for identity/anchor matching, symmetric edges, duplicate suppression, unresolved behavior, and candidate-to-approved transition |
| **GRADUATED 2026-08-13** | [`epistemic-memory-retention-projections`](../../goals/epistemic-memory-retention-projections/README.md) | Ship rebuildable retention/tier projections over accepted authority records, with mechanism now and policy-as-data inert behind calibration evidence. | `epistemic-bitemporal-edge-core` | Repo-native algorithm; agentmemory cite-only; standalone operator tier/memory-pressure report with as-of/disposition views and delete/rebuild proof; RRF integration follows only when its owning goal wakes |

## Sequencing

1. **Core first.** It closes the live rejected-disposition gap and establishes
   the only authority, temporal, lineage, identity, and transaction contracts
   every later lane needs. Its P0 must pass before schema commitment.
2. **Contradiction triage second.** It is gated behind the finalized core so
   candidate matching and approval fixtures target real endpoint, identity,
   evidence, and supersession contracts. Detection remains non-authoritative.
3. **Retention projections third.** The optional lane was spun and graduated
   2026-08-13. Mechanism ships now, while tier/decay/threshold values remain
   inert behind calibration evidence. RRF integration remains a follow-on.

## Cross-Reference Boundaries

| Capability | Relationship to this program | Authority rule |
| --- | --- | --- |
| `explorations/rag-retrieval-projection` | Future dependency/consumer contract; it is the **single owner of RRF arithmetic**. This program may supply accepted bitemporal-edge candidates and consume its future contract, but implements no fusion math. | RRF ranks results; it does not own claim/edge truth. |
| External graph projections | Deferred optional consumers, always rebuildable and driver-isolated. FalkorDB is SSPL and is not silently authorized. | Fed only from accepted Postgres authority records; never authoritative and never writes authority directly. |
| Cognee / Graphiti operator tooling | Outside product scope. Core landing triggers Graphiti operator-deployment retirement under doctrine. | Operator memory remains operator-level; product tables are not its backend. |

## Capability Check

| Major component | Exact existing brick | Assessment |
| --- | --- | --- |
| Claim proposal and evidence entities | `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts` | **REUSE / EXTEND** |
| Evidence spans and confidence | `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts` | **REUSE** |
| Gate verdict and current rejection gap | `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`; `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts`; `packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts` | **REUSE / EXTEND**; rejected currently returns unchanged |
| Shared lifecycle | `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts` | **REUSE UNCHANGED** |
| Provenance anchors | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | **REUSE** |
| PROV-O lineage vocabulary | `packages/foundation/modeling/rdf/src/Prov.ts`; `packages/foundation/modeling/rdf/src/Vocab/Prov.ts` | **REUSE / EXTEND** |
| Package identity composers and epistemic IDs | `packages/foundation/modeling/identity/src/packages.ts`; `packages/shared/domain/src/identity/Epistemic` | **REUSE** |
| Existing epistemic table pattern | `packages/epistemic/tables/src/entities/UsageRecord/UsageRecord.table.ts`; `packages/epistemic/tables/src/Schema.ts` | **REUSE pattern** |
| Server composition / transaction owner | `packages/epistemic/server/src/Layer.ts` | **EXTEND** with server-owned repositories and transactions |
| Migration owner and PGlite precedent | `packages/_internal/db-admin/src/migrations/EpistemicUsage.ts`; `packages/_internal/db-admin/test/integration/ArchitectureLabMigration.pglite.test.ts` | **REUSE / EXTEND** |
| Edge entity, temporal fields, logical edge identity, bounded endpoints, lineage invariants | No existing epistemic implementation found | **NET-NEW** in `@beep/epistemic-domain` |
| Durable `ClaimDisposition` | No existing epistemic-local durable truth-outcome model found | **NET-NEW**; orthogonal to review state and shared lifecycle |
| Edge tables, temporal indexes, constraint backstops | `@beep/epistemic-tables` currently has only the UsageRecord entity/table pattern | **NET-NEW** |
| Two-axis as-of repository and atomic close-and-insert | No existing epistemic repository/as-of implementation found | **NET-NEW** in use-case ports plus `@beep/epistemic-server` implementation |

## First Vertical Slice

Given one accepted, evidence-backed relation, record its immutable fact and
open valid/transaction intervals. Then approve a retroactive replacement in a
single repository transaction that closes the old intervals and links the new
version. For the same `validAt`, prove that an earlier `knownAt` returns the
old fact and a later `knownAt` returns the correction. In the same fixture,
prove that a `REJECTED` verdict leaves a durable disposition instead of only
returning the claim unchanged. Restart the store, run the db-admin migration
path, and repeat the reads. Concurrent replacement tests must prove the chosen
isolation/locking strategy prevents overlapping authoritative versions.

The slice excludes RRF, decay, semantic extraction, contradiction detection,
external graphs, and IP-law vocabulary.

## Risks Inherited by the First Goal

- PGlite may not support the same exclusion/index/locking mechanism as
  production Postgres; P0 must specify a semantics-preserving backstop.
- Logical identity and bounded endpoints must be explicit before the
  no-overlap partition and uniqueness constraints can be finalized.
- Concurrent supersession can create overlapping open versions unless locking
  and isolation are proven with adversarial tests.
- Donor licenses and mined source locations must be inventoried before code;
  no donor runtime dependency is allowed.
- Cycle prevention stays application-side unless P0 demonstrates a simple,
  portable DB mechanism.
