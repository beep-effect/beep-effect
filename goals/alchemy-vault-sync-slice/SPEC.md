# Alchemy Vault-Sync Slice Spec

## Objective

Migrate the `documents` vault-sync bounded context onto `@alchemy.run/domain` end to end: a Postgres Platform driver with the Effect Cluster workflow engine, aggregates/sagas/policies/views for destinations, sync operations and conflicts with Box as External System, one Api (HTTP + OpenAPI, CLI, MCP limited to Views) behind Session middleware, an optimistic + offline-intents client, legacy tables rebuilt as Projections after a single-writer cutover, and the doctrine amendments that let every later slice follow.

Graduated from `explorations/alchemy-domain-adoption` (brief: `explorations/alchemy-domain-adoption/BRIEF.md`; decisions D0–D17: `explorations/alchemy-domain-adoption/DECISIONS.md`). This is the first vertical slice of the alchemy adoption program and the proving ground for the migration recipe, the driver and the conformance suite that the queued slices in `explorations/alchemy-domain-adoption/MAP.md` reuse.

## Non-Goals

- Any CRDT or local-replica sync engine (D8); CRDT content values belong to the document-editor packet.
- Migrating any slice other than `documents` vault-sync; deleting the entity kit before its last consumer migrates (D3). The kit is frozen (forbidden in new work) in this goal.
- Cloudflare Durable Objects as product storage (D1).
- A dual-write shadow period (D7).
- MCP command tools (D13); MCP exposes Views only.
- Regenerating public entity ids (D14).
- A `@beep/shared-domain` facade over alchemy (D4).
- Tracking alchemy betas past 2.0.0-beta.85 inside this goal (D11).
- Upstream acceptance of the Postgres driver as a dependency of completion (D16).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `package.json` root catalog and `bun.lock`: lockstep bump of `alchemy`, `@alchemy.run/cloudflare`, `@alchemy.run/domain` to `2.0.0-beta.85` (D11).
- `packages/documents/domain/src/**`: states, events, commands, rejections, decide/evolve, Views as pure read contracts, Stories (D9).
- `packages/documents/use-cases/src/**`: the assembled `Domain.Model` and `Api`, policies, projections, sagas, middleware contracts; command dispatch as the use-case boundary (D9).
- `packages/documents/server/src/**` (`aggregates/Sync/*`): Postgres Platform + Cluster engine Layers, Box External System adapter, Projections into the legacy sync tables, genesis import and replay-and-diff (D1, D6, D15).
- A new driver package created with `bun run beep create-package` for the Postgres `Platform` implementation and its conformance suite (location fixed in P0; candidate name `alchemy-postgres` under the shared or `_internal` family per `standards/ARCHITECTURE.md`).
- `packages/documents/tables/**`: drizzle tables retained as read models; write path removed.
- Frontend package that hosts the vault-sync UI: optimistic prediction + persisted offline intent queue (D8).
- `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`, `standards/architecture/GLOSSARY.md` (and the numbered `standards/architecture/` chapters where the rows live): entries for Model, Command, Event, Aggregate, View, Projection, Saga, Platform, Session; declarative-vs-hosting note; entity-kit freeze (D16).
- `packages/shared/domain/src/entity/**`: freeze marker and lint guard forbidding new imports; no deletion.
- This packet.

## Constraints

- Design order: schema → `Context.Service` contract → implementation. Effect v4 only; validate every alchemy and Effect API against `.repos/alchemy` and `.repos/effect`, never priors.
- Event streams are the system of record (D2); stored events are never rewritten; every event carries a schema version and upcasters run at read (D12). Genesis-import events are v1.
- Single-writer cutover (D7): the drizzle write path for the slice is deleted in the same PR that makes the alchemy Model the writer; a replay-and-diff test proves projected rows equal legacy rows first.
- Provenance (principal, source kind, timestamp) rides the envelope via Session middleware (D10); payload fields only when the actor is business-meaningful. `Principal` and `SourceKind` survive as explicit value schemas.
- Stream ids are the existing branded public ids; unique-value reservations are org-qualified; Session middleware enforces org membership independently of key shape; a temporary numeric mapping serves legacy SQL references (D14).
- Views are security boundaries: tests cover revoked membership after subscription, cross-tenant key guessing, stream history, and CLI/MCP/HTTP against one policy (D13).
- Local-first is topology 2: prediction per command, persisted intent queue, server `decide` is the only authority (D8).
- Observability: kernel spans nest under registered boundary spans; correlation ids propagate through outbox and workflow; payload attributes audited for PII before deploy (D17).
- Rabbit holes from the brief are P0 spikes, not assumptions: LiteralKit/`$I` annotation propagation through alchemy constructors; envelope metadata survival through CatchUp/Backfill and Postgres storage; where the event version slot lives; `ClusterWorkflowEngine` + `SqlMessageStorage` crash-and-resume on Postgres; a Postgres-owned replay path (upstream Backfill is Cloudflare-shaped).
- Doctrine amendments land in the goal's first PR (D16). Secrets stay `op://` references. Corpus and client documents never enter the repo or a lane.

## Acceptance Criteria

- [ ] Lockstep group at `2.0.0-beta.85`; `apps/beep-effect-web` still deploys.
- [ ] Postgres Platform driver passes the conformance suite, and the same suite passes against `Domain.InMemory`.
- [ ] Sagas run on `ClusterWorkflowEngine` over Postgres; the scan → push → reconcile saga survives a forced process restart (crash-and-resume test).
- [ ] Vault-sync aggregates (destination, sync operation with lease + Deadline, conflict), Box External System, org-qualified Unique destination names, Policies and Projections are implemented in the D9 split; the slice no longer imports `packages/shared/domain/src/entity/*`.
- [ ] Genesis import of existing rows as v1 events; replay-and-diff proves projected rows equal legacy rows; the drizzle write path for the slice is deleted.
- [ ] One Api serves HTTP + OpenAPI, CLI and an MCP server exposing Views only, all under Session middleware that stamps principal and source kind into the envelope; Views-as-security-boundary tests pass.
- [ ] Frontend: optimistic prediction and a persisted offline intent queue; a `bun run beep qa` recording shows an intent queued offline, replayed on reconnect, and a server rejection reverting a prediction.
- [ ] Observability: boundary spans registered in the span catalog with kernel spans nested; PII audit of event payload attributes recorded in `history/`.
- [ ] Doctrine: ARCHITECTURE/DECISIONS/GLOSSARY amendments and the entity-kit freeze (lint guard) merged in the first PR.
- [ ] `goals/alchemy-vault-sync-slice/research/` holds the P0 spike results (annotation propagation, envelope survival, version slot, replay path).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/alchemy-vault-sync-slice/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/alchemy-vault-sync-slice/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/alchemy-vault-sync-slice` | Passes |
| Touched packages | `bun run beep quality package-verify @beep/documents-domain @beep/documents-use-cases @beep/documents-server <driver package>` | Green |
| Conformance suite | driver package tests, InMemory and Postgres projects | Green on both |
| Crash-and-resume | saga test that kills and restarts the runtime mid-flow | Saga completes exactly once |
| Replay-and-diff | genesis import then projection rebuild compared with legacy rows | Zero diff |
| View security | boundary tests (revoked membership, cross-tenant keys, history, CLI/MCP/HTTP) | All deny correctly |
| Browser QA | `bun run beep qa` recording of offline intent → replay → rejection revert | Judge: zero required findings |
| Doctrine | `bun run beep architecture` and docs lint on the amended standards | Green |
| Hosted gate | `bun run beep yeet final-check`, `yeet ready`, `yeet monitor --until-ready` | `merge-ready: yes` |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-05 | Inherit D0–D17 from `explorations/alchemy-domain-adoption/DECISIONS.md` as binding | Grilled and locked with the operator over rounds 1–4 | Reopen the exploration at `align` and amend the entry there |
| 2026-11-05 | Driver and doctrine ship inside this goal, not a separate goal | Operator shape check 2026-11-05: one vertical slice | Split the driver into a separate alchemy-postgres-platform goal at P0 if the conformance suite outgrows the slice |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug alchemy-vault-sync-slice`; add a `kind: decision` file there, never edit this block._

### Conformance suite runs on InMemory and PGlite; real Postgres as integration project, 2026-11-06

`@beep/pglite` ships `PgliteTestLayer` (Postgres dialect in-process), so the driver's conformance scenarios run three ways: `Domain.InMemory`, PGlite, and a real Postgres `test/integration` project reusing the same scenario module. The workflow engine is `effect/cluster/ClusterWorkflowEngine.layer` over `effect/cluster/SingleRunner.layer()` (SqlMessageStorage + SqlRunnerStorage) on the same SqlClient (D6).

Lane `goals/alchemy-vault-sync-slice`

Reverse: Drop the PGlite project and run the suite against a docker Postgres only

### Driver package is @beep/alchemy-postgres under packages/drivers, 2026-11-06

The Postgres Platform implementation and its conformance suite live in `packages/drivers/alchemy-postgres` as `@beep/alchemy-postgres`, created with `bun run beep create-package --family drivers`. `standards/ARCHITECTURE.md` lists Postgres, message storage and workflow engines as driver concerns; a repo-owned event-store platform is an external boundary wrapper, not shared-kernel substrate.

Lane `goals/alchemy-vault-sync-slice`

Reverse: Move the package with bun run beep create-package into the foundation family and update the import sites; no data involved

### Entity-kit freeze is a beep law with a shrinking baseline, 2026-11-06

`bun run beep laws entity-kit-freeze --check` fails any git-tracked `.ts`/`.tsx` file under `packages/` or `apps/` that imports the frozen specifiers (`@beep/shared-domain/entity` barrel, `entity/EntityKit`, `BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`, `primitives`, or those names from the `@beep/shared-domain` barrel) unless it is in `standards/entity-kit-freeze.baseline.jsonc`; a baseline entry that stopped importing is a stale finding fixed by `--write`, so the baseline only shrinks. `Principal`, `SourceKind`, `PublicEntityId`, `EntityId`, `EntityRef` are not frozen (D3). Registered as cheap-gate lane `lint:entity-kit-freeze`.

Lane `goals/alchemy-vault-sync-slice`

Reverse: Delete the law, its baseline and the lint lane when the kit's last consumer migrates and the kit is removed

### Event schema version is a static on the event class; the driver stamps and upcasts, 2026-11-06

beta.85 has no version slot on the wire event or the envelope. Each event class declares `static readonly schemaVersion` (default 1); the driver reads it from the hosted aggregate's declared events, writes a `schema_version` column, and applies the class's upcaster chain to stored JSON at read before the kernel decodes. Genesis-import rows are version 1 (D12). Evidence: `packages/drivers/alchemy-postgres/test/spikes/event-annotations.test.ts`.

Lane `goals/alchemy-vault-sync-slice`

Reverse: Move the version into the stored row only and drop the static once alchemy ships a kernel version slot

### Patch alchemy beta.85 types for exactOptionalPropertyTypes, 2026-11-06

Under the repo's `exactOptionalPropertyTypes: true`, `Domain.Model` rejects every aggregate without a `read` contract because beta.85 types `Aggregate.Resolved.read` as `R` (possibly undefined) while `AnyDefinition.read?` is optional. A one-line bun patch (`patches/@alchemy.run%2Fdomain@2.0.0-beta.85.patch`, precedent `patches/effect@4.1.2.patch`) makes the field optional in `lib/Aggregate.d.ts` and `src/Aggregate.ts`. Alternatives rejected: relaxing the compiler option for alchemy consumers; a `read` contract on every test aggregate.

Lane `goals/alchemy-vault-sync-slice`

Reverse: Delete patches/@alchemy.run%2Fdomain@2.0.0-beta.85.patch and its patchedDependencies entry at the next lockstep bump, where upstream HEAD already restructured Aggregate.Resolved

### Provenance is persisted by the driver from SendMeta.context, 2026-11-06

The kernel envelope is exactly id, stream, seq, at, commandId, correlationId, trace. Every `AggregateStore.send` receives `meta.context`, the encoded RequestContext the Session middleware provided. The Postgres driver persists it beside the command receipt and copies principal and source kind onto each event row; audit reads come from those rows (D10). Evidence: `packages/drivers/alchemy-postgres/test/spikes/platform-send-meta.test.ts`.

Lane `goals/alchemy-vault-sync-slice`

Reverse: Add principal and source kind as explicit payload fields on every event and drop the driver columns

### Validate alchemy APIs against the installed beta.85, not the reference HEAD, 2026-11-06

The reference checkout HEAD is 56 commits past `v2.0.0-beta.85` and differs in 29 kernel files (Event annotations, Query, Aggregate.Resolved). All API reads use the installed package source (it ships `src/` and agent docs) or `git show v2.0.0-beta.85:<path>`. Evidence: `goals/alchemy-vault-sync-slice/research/01-p0-spikes.md` section 0.

Lane `goals/alchemy-vault-sync-slice`

Reverse: Re-point the spikes and driver at the reference checkout once the trio is bumped to a release that matches it (a named goal task per D11)

### Driver coverage floor follows measured totals; InMemory fallbacks stay, 2026-11-07

PR 2b measures @beep/alchemy-postgres at L/S/B/F 96.88/96.04/90.21/92.26 against the floor 98.36/97.72/86.95/95.53 set by #2831. The remaining units are fallbacks copied from Domain.InMemory and upstream Backfill (source or consumer gone from the model, scanner kick, relay fan-out, stored-job rebuilds, generation and duplicate guards, a schedule cancelled between due query and fire) that only run under faults, races or very large histories. Deleting faithful fallbacks to satisfy a number would make the driver diverge from the reference, so the floor for lines, statements and functions moves to the measured totals in a baseline-only PR first; branches stay at 86.95.

Lane `alchemy-postgres-views worktree`

Reverse: Add fault-injection seams for the listed host/view/aggregate/projection fallbacks and raise the floor back in a baseline-only PR

### Enforce the single writer with a persisted epoch and a database fence, 2026-11-07

The migrated store records its writer in `documents_sync_writer_epoch` (legacy, migrating or model, plus a reversal generation and the admitted import id). A statement-level trigger on the four legacy tables reads it: under `migrating` or `model` it refuses any transaction that does not carry the `beep.documents_sync_writer = model` marker, and under `legacy` it refuses the marker. Only the alchemy projections set the marker, inside their checkpoint transactions; the offline backup, restore and reversal procedures use a separate `cutover` marker.

**Why the database, not a startup check.** An older sidecar executable knows nothing about a check added later. It boots, re-runs its bundled drizzle migrations and writes through its repositories; every one of those statements reaches the trigger and fails. `SyncCutoverAdmission.pglite.test.ts` boots the real drizzle migrations, admits, then proves raw SQL, ORM-generated SQL and a re-run of the old migrations all fail, while the Model writer keeps working. New code also guards entry points with `requireSyncWriterEpoch`, which fails with the typed `SyncWriterEpochRejected`.

**Why runtime DDL, not a drizzle migration.** The epoch table, the fence and the D14 identity table are cutover state owned by the documents server, created idempotently at admission like the alchemy driver's own tables. The drizzle target keeps describing the four retained table contracts unchanged (D15), so the desktop migration bundle needs no refresh. The down path is the tested post-admission reversal, which leaves the fence armed under the legacy epoch so the abandoned Model cannot write.

Lane `goals/vault-sync-cutover`

Reverse: Drop the four documents_sync_*_writer_fence triggers, the fence function and documents_sync_writer_epoch, after a reversal has returned the store to the legacy epoch

### Keep activation fenced until writer epoch and both reversal cases are proven, 2026-11-07

The offline importer and pre-admission backup are implementation prerequisites. They do not activate a writer epoch. The existing executable predates any epoch-aware startup check, so adding only a new startup condition cannot prove that an older executable refuses the migrated store. Production cutover must include a database-level stale-writer refusal and the startup compatibility boundary, plus a tested post-admission reversal that retains accepted events. Until these exist, keep legacy application composition and do not claim D7 cutover acceptance.

Reverse: Replace this hold only after the epoch guard, legacy writer deletion, and pre/post-admission reversal tests pass in the same cutover change.

### Fold the remote cursor into the destination aggregate, 2026-11-07

The current cursor scope is one workspace plus provider, so its position and poll failure state belong to SyncDestination. A failed poll preserves the last durable position.

Reverse: Introduce a separately versioned cursor aggregate if account-wide polling becomes independent

### Genesis creates one Box destination per legacy workspace, 2026-11-07

Use the configured mirror root name, default beep-vault, and orgId from legacy rows. The cursor folds into this destination because its scope is workspace plus provider.

Reverse: Change genesis mapping before import; no data is imported in PR 3a

### Offline intents target renderer to sidecar in a later PR, 2026-11-07

D8 applies to renderer to sidecar. PR 3a includes no offline queue or frontend work.

Reverse: Expand the offline transport scope in the frontend PR

### Pre-admission backup retains SQL rows and sequence positions, 2026-11-07

Part 2 lands backupSyncTables and restoreSyncTables before any writer deletion. The first snapshot is immutable per import id, copies every table column, and retains serial last_value and is_called. Repeated restoration is a no-op. This is exclusively a pre-admission reversal; it must not restore a stale snapshot after new commands have been accepted.

Reverse: Restore the verified offline snapshot before admitting commands; retain backup tables for diagnosis.

### Preserve operation ids and schedule lease expiry and retry, 2026-11-07

Existing public operation ids are stable. Retarget and squash are events. Leases carry holder, attempt token and expiresAt; non-rejecting scheduled commands implement expiry and retry backoff. Terminal failure and supersession are separate facts.

Reverse: Introduce a versioned operation protocol and upcasters before changing identity

### Reserve org-qualified destination names before registration and rename, 2026-11-07

beta.85 has no Unique primitive. DestinationNameReservation uses orgId:normalizedName and rejects another destination. Policy order is claim, register or rename, then release the prior claim.

Reverse: Replace the reservation aggregate when the pinned kernel provides Unique

### Reserve remote event identities before recording public conflict streams, 2026-11-07

ConflictEventRegistry is keyed by destination and atomically reserves remoteEventId. Its idempotent policy records SyncConflict at the existing public id. This preserves D14 while enforcing I8; review intent queues correction before the conflict closes. Lease expiry additionally uses a monotonic leaseEpoch separate from the resettable retry budget.

Reverse: Replace the registry with a native uniqueness primitive while retaining conflict stream ids

### Reverse an admitted store from the current projection, not the pre-cutover backup, 2026-11-07

Research/07 section 7 names two reversal cases. Before admission, `restoreSyncTables` restores the immutable offline backup. After admission that backup is stale, so `reverseSyncCutover` uses the projection-to-legacy route: the four tables already hold the projected state of every accepted event.

Procedure, with the Model runtime and workers stopped: refuse while any Box intent receipt is unsettled (`uncertain-remote-outcome`) or a LegacySync projection has pending deliveries or unprocessed inputs (`projection-behind`); record the event high-water count; in one cutover transaction snapshot the four tables to `*_reversal_backup` and verify a zero diff; return leased operations to queued with a row-version bump, recording their ids (the leases belong to workflows that will never resume); move each table sequence beyond every id in the table and in the D14 allocator; record the reversal receipt and the `legacy` epoch with the next generation.

The event and workflow store stays in place, read-only: the fence refuses the Model marker and `ensureSyncCutover` refuses to resume a reversed store, so a recutover needs a fresh import. Box uploads are never compensated. Destination name reservations and lease metadata have no legacy representation and remain only in the retained event store.

Test: `SyncCutoverAdmission.pglite.test.ts` admits a drizzle-migrated store, writes and leases through the Model, proves the uncertain-intent refusal, reverses, then shows the live tables equal the snapshot except the three recorded lease-rollback columns, the legacy writer inserts and updates again with an id beyond every Model id, and the Model can neither resume nor write.

Lane `goals/vault-sync-cutover`

Reverse: Replace reverseSyncCutover with a restore of the offline backup plus a replay of post-admission events into legacy rows, keeping the same refusal preconditions

### Hold uncertain Box mutations behind durable intent receipts, 2026-11-07

Commit an operation intent before calling Box and the acknowledgement before returning. An interrupted intent is looked up through BoxMirrorEvidence; insufficient evidence holds the operation without another Box mutation. The existing DmsMirrorBox port has no authoritative version or digest lookup, so the safe production lookup result is absent until that capability is provided. No fixture proves provider idempotency. Runtime composition must scope the existing Box mirror and root configuration to one destination.

Reverse: Use verified provider idempotency while retaining receipt identities

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
