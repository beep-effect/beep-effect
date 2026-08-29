# Projection Dispatch Core — Sources & Provenance

This implementation ledger reproduces the source-exploration corpus relevant
to durable accepted-record projection dispatch, desktop freshness, licensing,
and cross-packet ownership. The exploration ledger remains primary:
[`explorations/local-first-projection-sync/research/SOURCES.md`](../../../explorations/local-first-projection-sync/research/SOURCES.md).

- **Source exploration:** `explorations/local-first-projection-sync`
- **Primary provenance ledger:** `explorations/local-first-projection-sync/research/SOURCES.md`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`

## 1. Relevant mined source corpus

| Nugget | Title | Upstream | Source (`file:line`) | License stance | Disposition here |
| --- | --- | --- | --- | --- | --- |
| `TalentScore#10` | Per-user live connection hub for local-first real-time projection sync | TalentScore | `packages/server/src/public/event-stream/event-stream-hub.ts:83-118` | **UNRESOLVED:** gold-intake says MIT; packet prose says commercial | reference-only, clean-room study of targeted live fan-out; no code copy and no durable ownership |

**Implementation bearing:** the donor only demonstrates that live targeted
fan-out can be a small scoped service. The ratified goal supersedes its v3
mailbox and per-user registry premise: durable work is repo-native intent
persistence plus Effect v4 `DurableQueue`; the first hint path is one scoped
queue/stream; a user/audience registry remains gated by topology and principal
evidence.

## 2. Upstream repositories and licenses

| Repo/product | License | Port discipline | What informs this goal |
| --- | --- | --- | --- |
| TalentScore | unresolved on disk | reference-only; clean-room design-pattern study | historical targeted fan-out shape only |
| ElectricSQL | Apache-2.0 | research only; rejected | demonstrates the broader read-sync platform scope not purchased here |
| PowerSync service/CLI | FSL; client SDKs Apache-2.0/MIT | research only; rejected | demonstrates broader partial replication/write-back scope |
| FalkorDB | SSPLv1 | excluded; separate approval required | future graph projection must remain driver-isolated, rebuildable, and non-authoritative |

TalentScore remains clean-room/reference-only until authoritative upstream
evidence reconciles its license. No implementation decision depends on it.

## 3. Relevant external research sources

These URLs already appear in the source exploration ledger:

- [Effect PubSub documentation](https://effect.website/docs/concurrency/pubsub/)
- [Effect RPC streaming/server-push README](https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md)
- [ElectricSQL Postgres Sync](https://electric-sql.com/products/postgres-sync)
- [PowerSync service architecture](https://docs.powersync.com/architecture/powersync-service)
- [PowerSync Functional Source License](https://powersync.com/legal/fsl)
- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [Redis keyspace notifications](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/)
- [FalkorDB license](https://docs.falkordb.com/References/license.html)

The pinned Effect v4 `DurableQueue` source is a live local dependency rather
than an external web claim; it is recorded below.

## 4. In-repo capability references

| Capability | Exact path | Disposition |
| --- | --- | --- |
| Effect v4 durable queue | `node_modules/effect/src/unstable/workflow/DurableQueue.ts` | reuse only after sibling persistence/crash proof; supplies deterministic key, persisted processing, worker concurrency, and adapter requirements |
| Workflow persistence spike | `goals/effect-v4-workflow-engine-spike` and future `packages/drivers/workflow` | hard prerequisite; consume adapter and evidence, never duplicate |
| Epistemic contracts | `packages/epistemic/use-cases` | extend with NET-NEW dispatch/status/RPC schemas and ports |
| Epistemic persistence | `packages/epistemic/tables` | extend with NET-NEW intent/projection/cursor tables and atomic authority binding |
| Epistemic workers | `packages/epistemic/server` | extend with NET-NEW isolated worker/projector composition |
| Cursor/status precedent | `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts` and `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts` | study only; no vault/provider semantic reuse |
| Desktop re-query precedent | `apps/professional-desktop/src/sync/Sync.atoms.ts` | reuse reactivity-keyed RPC query pattern |
| Desktop IPC socket | `apps/professional-desktop/src/transport/TauriIpcSocket.ts` and `IpcChatClient.ts` | extend existing socket/RPC bridge; topology beyond one session unproved |
| Launch authentication | `apps/professional-desktop/server/RpcSessionAuth.ts` | reuse per-launch auth; add NET-NEW server scope authorization and future principal seam |
| Authority producer | `goals/epistemic-bitemporal-edge-core` | accepted-record producer; projections stay outside its authority path |
| Ranking consumer boundary | `goals/hybrid-retrieval-fusion-core` | ranking/RRF owner; no projection dispatch or durable worker ownership |

## 5. Cross-links and provenance

- Source exploration:
  [`README`](../../../explorations/local-first-projection-sync/README.md) ·
  [`DECISIONS`](../../../explorations/local-first-projection-sync/DECISIONS.md) ·
  [`BRIEF`](../../../explorations/local-first-projection-sync/BRIEF.md) ·
  [`MAP`](../../../explorations/local-first-projection-sync/MAP.md) ·
  [`RESEARCH`](../../../explorations/local-first-projection-sync/RESEARCH.md) ·
  [`primary ledger`](../../../explorations/local-first-projection-sync/research/SOURCES.md)
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
- Prerequisite: [`effect-v4-workflow-engine-spike`](../../effect-v4-workflow-engine-spike/).
- Authority boundary: [`epistemic-bitemporal-edge-core`](../../epistemic-bitemporal-edge-core/).
- Consumer boundary: [`hybrid-retrieval-fusion-core`](../../hybrid-retrieval-fusion-core/).
- Gated multi-window, additional-projector, and graph candidates remain in the
  exploration map; no product prose page graduated.
