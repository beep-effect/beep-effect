# Epistemic Bitemporal Edge Core — Sources & Provenance

This implementation ledger reproduces the source-exploration entries relevant
to the bitemporal authority core. The exploration ledger remains primary:
[`explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md).

- **Source exploration:** `explorations/agent-memory-tiers-bitemporal-edges`
- **Primary provenance ledger:** `explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`

## 1. Primary attributed donor — Graphiti

Graphiti is the ratified primary donor for temporal field semantics, episode
lineage shape, and invalidate-don't-delete behavior. Its repository at the
researched v0.29.2 point is Apache-2.0. Porting requires preserving applicable
copyright and license notices, marking modified/ported files, completing the
pre-code inventory, and avoiding a donor runtime dependency.

| Upstream location | Relevant contract | Disposition |
| --- | --- | --- |
| `graphiti_core/edges.py:263-285` | temporal edge fields and invalidation semantics | port with Apache-2.0 attribution after live provenance inventory |
| `graphiti_core/nodes.py:318-351` | episode/node lineage shape | port with Apache-2.0 attribution after live provenance inventory |
| `graphiti_core/utils/maintenance/edge_operations.py:538-847` | invalidation and replacement operations | port contract with attribution; reimplement in Effect/transactional Postgres |

Sources already recorded by the exploration:

- [Graphiti repository and license](https://github.com/getzep/graphiti)
- [Graphiti `edges.py`](https://raw.githubusercontent.com/getzep/graphiti/main/graphiti_core/edges.py)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [`docs/agent-memory-infra/00-recommendation.md`](../../../docs/agent-memory-infra/00-recommendation.md) records the mined locations.

No Graphiti code or location should be assumed current until P0 inventories the
live donor revision and resulting attribution artifacts.

## 2. Bitemporal model source

- Martin Fowler, [*Bitemporal History*](https://martinfowler.com/articles/bitemporal-history.html): external basis for independent actual/valid and record/known time and a two-parameter as-of read.
- The ratified repo contract strengthens that basis to half-open
  `[validFrom, validTo)` and `[recordedAt, expiredAt)` intervals, SQL `NULL` /
  Effect Schema `Option` open ends, canonical `asOf(validAt, knownAt)`
  predicates, immutable facts, and atomic supersession.

## 3. Agentmemory deferral

The exploration mined `rohitg00/agentmemory` (Apache-2.0), including
`src/types.ts:411-435` for a never-overwrite bitemporal `GraphEdge` shape and
`src/functions/retention.ts:81-95` for retention scoring. The ratified sourcing
decision supersedes its use for this core: Graphiti is the primary attributed
donor, and **agentmemory attribution/adoption is deferred until a separately
shaped retention goal actually adopts its algorithm**. This goal copies no
retention constants, tiers, decay behavior, relation-confidence math, or
agentmemory runtime dependency.

Reference only:

- [rohitg00/agentmemory](https://github.com/rohitg00/agentmemory)
- [agentmemory license](https://github.com/rohitg00/agentmemory/blob/main/LICENSE)
- [agentmemory types](https://raw.githubusercontent.com/rohitg00/agentmemory/main/src/types.ts)

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `CandidateClaim`, `Evidence`, `EvidenceSpan`, `ClaimGate` | `packages/epistemic/domain/src/`; `packages/epistemic/use-cases/src/` | reuse/extend; durable rejection closes the observed no-op gap |
| Shared `ClaimLifecycle` | `packages/shared/domain/src/values/ClaimLifecycle/` | reuse unchanged |
| `TextAnchor` | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | reuse evidence anchor primitive |
| PROV-O lineage | `packages/foundation/capability/semantic-web/src/prov.ts` | reuse/extend lineage vocabulary |
| Epistemic table pattern | `packages/epistemic/tables/src/entities/UsageRecord/UsageRecord.table.ts` | reuse pattern; edge/disposition tables are net-new |
| Server composition | `packages/epistemic/server/src/Layer.ts` | extend with server-owned transactional repository |
| Migration/PGlite precedent | `packages/_internal/db-admin/src/migrations/EpistemicUsage.ts`; `packages/_internal/db-admin/test/integration/ArchitectureLabMigration.pglite.test.ts` | reuse/extend through generated migration and restart proof |

## 5. Cross-links

- Exploration: [`README`](../../../explorations/agent-memory-tiers-bitemporal-edges/README.md) · [`BRIEF`](../../../explorations/agent-memory-tiers-bitemporal-edges/BRIEF.md) · [`MAP`](../../../explorations/agent-memory-tiers-bitemporal-edges/MAP.md) · [`DECISIONS`](../../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md) · [`primary ledger`](../../../explorations/agent-memory-tiers-bitemporal-edges/research/SOURCES.md)
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
- Doctrine: [`standards/memory-architecture/04-decision-log.md`](../../../standards/memory-architecture/04-decision-log.md).
- Queued lanes remain in the exploration map: `epistemic-contradiction-triage` and `epistemic-memory-retention-projections`.
