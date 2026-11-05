# Research

Three lanes ran 2026-11-03 from the headless proxy (operator-named models): `gpt-6-astra` medium source analysis, `muse-wonder-1.0` xhigh deep-research, `grok-4.7` xhigh deep-research with native x_search. Full reports: [`research/01-astra-source-analysis.md`](./research/01-astra-source-analysis.md), [`research/02-muse-deep-research.md`](./research/02-muse-deep-research.md), [`research/03-grok-deep-research.md`](./research/03-grok-deep-research.md). Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md). This page is the digest.

## External Landscape (2026-11-03)

- **`@alchemy.run/domain` 2.0.0-beta.85** (Apache-2.0; peer deps `alchemy` core, effect 4.1.x, optional foldkit). Event-sourced kernel (decide/evolve, envelopes, CatchUp, Backfill), Model / Command / Event / Aggregate / View / Projection / Stream / Policy / Saga / External System / Api / Story, derived HTTP+OpenAPI, CLI and MCP, Session middleware, Unique values, Deadlines, optimistic updates and offline intents, observability. Platforms shipped: `Domain.InMemory` and Cloudflare Durable Objects only. Saga runs on `effect/workflow` `WorkflowEngine`; InMemory bundles `Platform | WorkflowEngine`. Docs https://alchemy.run/domain/*, source `~/YeeBois/references/effect/alchemy/packages/domain/src/`.
- **Project health** (Grok): 84 betas in 203 days with breaking changes accelerating (beta.84 → beta.85 is a breaking migration); Postgres exists only as unreviewed contributor PRs (#2392, #2601, #2721, #2794, #2795); one identified production adopter plus power users filing source-level bugs; one person merges what two people write. Recommendation: pin the lockstep group, own the storage, wrap the API at the use-case boundary.
- **Replay is Cloudflare-shaped** upstream: Sam Goodwin describes event replay as a fan-out workflow over millions of Durable Objects orchestrated by `alchemy deploy` (X post 2117367781444444417, `CAPTURE.md`). A Postgres platform owns its own replay path.
- **Prior art for a Postgres event store**: Marten (storage + projections), KurrentDB's CRUD→ES migration recipe (single-writer cutover, no dual writes), transactional outbox, `SKIP LOCKED` workers, pg_cron. Effect v4 ships `effect/cluster` `ClusterWorkflowEngine` + `SqlMessageStorage` for durable workflows over SQL.
- **Local-first**: alchemy's four topologies (optimistic updates, offline intents, local replica + rebase, device decides). Alchemy ships 1–2 and no sync engine for 3; 4 (CRDT) guarantees convergence, not invariants (Bailis et al. invariant confluence). Figma = server authority + per-property LWW; Replicache/Zero = server authoritative, client rebase. Lesson: `~/YeeBois/teach/local-first-sync/`.
- **Alternatives surveyed and rejected**: `@gjermundgaraba/effect-domain`, `effect-es`, Emmett (none pairs alchemy's surface with Postgres on Effect v4).

## In-Repo Capability Inventory

- `@beep/shared-domain` entity kit (`packages/shared/domain/src/entity/*`): AuditEntity, BaseEntity, EntityId, EntityKit, EntityRef, OrgEntity, PublicEntityId, Principal, SourceKind, primitives; 115 files across nine slice domain packages import it. Semantics to preserve as explicit schemas; kit to retire (D3).
- Slice domain packages: agents, architecture-lab, documents, epistemic, law-practice (34k LOC), ontology, party, shared, workspace.
- `documents` vault-sync (`packages/documents/{domain,use-cases,server}`): entities SyncConflict, SyncCursor, SyncItem, SyncOperation; server `aggregates/Sync/*` (VaultSyncEngine, VaultScan, VaultPush, reconcile, review, drift, file-store, DmsMirrorBox); `@beep/box` client. Astra ranks it 25/25 for feature coverage.
- Alchemy core already in the repo: `alchemy` / `@alchemy.run/cloudflare` 2.0.0-beta.84 via the root catalog (`apps/beep-effect-web`, goal `beep-effect-web-alchemy`, closed 2026-11-02).
- `@beep/schema` `LiteralKit` and `$I.annote` identity annotations; `@beep/effect-drizzle` write path (to retire per slice).
- NOT FOUND: any Postgres implementation of alchemy's `Platform` contract; any sync engine for topology 3; any event upcaster infrastructure.

## Constraints Discovered

- Platform contract is internal-shaped and moves between betas; a conformance suite must be the contract (BRIEF rabbit holes).
- beep doctrine: `domain` must not import SQL/HTTP/server requirements; cross-slice imports forbidden; errors translate adapter → port → action → transport; boundary spans registered in the span catalog (Astra §4 friction table → D9, D13, D17).
- Vault-sync invariants (destination-name uniqueness, leases, Box as single writer) are not invariant-confluent, so no device-decides topology can hold them (D8).
- Whether `LiteralKit` / `$I` annotations survive alchemy constructors, whether envelope metadata survives CatchUp/Backfill, and where an event version slot lives are UNVERIFIED and become P0 spikes in the goal.
