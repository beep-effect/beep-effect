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

### Desktop membership rows ship with writer activation, 2026-11-07

The desktop PGlite migration bundle has no shared_membership table. Until activation adds it and seeds an active owner row for the desktop principal (user 1, org 1), every vault-sync adapter denies with ScopeDenied, which is the intended fail-closed state. This is an activation input for the cutover lane, not a permissive default.

Lane `goals/vault-sync-api`

Reverse: Drop the shared_membership migration and seed; adapters keep failing closed

### Remote CLI uses a gated RPC endpoint, never the raw Api fetch, 2026-11-07

The generated CLI speaks the Api RPC protocol. The sidecar serves that protocol at /vault-sync/rpc with handlers that forward every RPC to the protected delivery client with the caller's headers, so Session runs and watch/events pass the per-frame gate. The unwrapped Api fetch, whose streams bypass that gate, is not mounted. The remote CLI reads the launch token per call from BEEP_DESKTOP_RPC_SESSION_TOKEN, redacted. An IPC-mode sidecar serves no HTTP, so the remote CLI then cannot connect.

Lane `goals/vault-sync-api`

Reverse: Unmount VaultSyncRpcHttp; the CLI stays in-process only

### Hold desktop API cutover until verified identity hosting exists, 2026-11-07

Live source search found no signed-in principal or bearer/session verifier in the desktop host; RpcSessionAuth verifies only the per-launch token. The new SessionResolver remains a required host service, with no anonymous, uid or launch-token identity fallback. Existing desktop callers have not been switched. PR 3c is not content-final: destination-scoped pass/probe initiators and compatibility mapping also remain. This records an implementation hold, not acceptance or permission to publish a partial cutover.

Reverse: Supply host credential verification, enrollment and live membership adapters, then migrate callers

### Per-route launch-token session adapters lift the identity hold, 2026-11-07

Supersedes the 2026-11-07 identity hold. Each sidecar route builds its own SessionResolver: launch-token adapters for HTTP (http), the gated RPC endpoint (cli) and MCP (mcp), a channel adapter for the desktop RPC surface (sidecar; HTTP passes the global token middleware and IPC the Tauri token check before handlers run), and the local-operator adapter for in-process CLI. The route fixes the transport kind; headers can only prove the token and supply a correlation id. All adapters bind the desktop principal and read active, undeleted shared_membership rows live on every call and frame; the owner role carries the diagnostics grant OperationQueue needs. No test stub sits in a production Layer.

Lane `goals/vault-sync-api`

Reverse: Add a bearer adapter behind SessionResolver; no caller changes

### Desktop vault-sync RPCs keep their wire and run through the Api, 2026-11-07

VaultSyncRpcsApiLive implements the four VaultSyncRpcs over the protected Api client with unchanged payloads and DTOs. Workspace maps to its destination through the authorized DestinationList View. Trigger and forceProbe record RequestVaultSync and ProbeDestination and answer with the status at acceptance, not after the pass; the panel's existing invalidation re-reads status. forceProbe also refreshes the probe cache for the answer. Conflict rows come from the legacy SQL read model the slice projects, restricted to public ids the authorized OpenConflicts View returns; review resolves the numeric id through those rows, sends ReviewConflict with a per-conflict heal operation id, and never writes legacy tables. Mounting it in RuntimeLive is the single-writer flip and belongs to the cutover activation, which also hosts the model on the sidecar PGlite.

Lane `goals/vault-sync-api`

Reverse: Keep VaultSyncHandlersLive in RuntimeLive; VaultSyncRpcsApiLive is a drop-in layer swap

### Probe requests reuse the pass saga with a probe-only flag, 2026-11-07

RequestVaultSync and ProbeDestination are public destination commands with Session. Their events route through the VaultSyncRequests policy to VaultSyncPass under the key destination/event/requestId, so repeated delivery resumes one run. The probe run executes only the BoxMirror probe activity. A paused destination refuses RequestVaultSync; probing stays allowed.

Lane `goals/vault-sync-api`

Reverse: Split a dedicated probe saga keyed by request id

### Reauthorize every delivered frame and terminate on revocation, 2026-11-07

Check live grants before each frame leaves the authorized delivery stream. No downstream buffering is permitted across this barrier. Revocation closes the subscription with a typed denial; restored RequestContext supplies identity only, never a grant.

Reverse: Disable subscription routes until an equivalent delivery barrier is proven

### One SessionResolver owns transport identity and live grants, 2026-11-07

Every transport resolves a verified principal through one SessionResolver. HTTP uses host session or bearer verification; sidecar enrollment binds the launch token to the signed-in principal; CLI uses the enrolled local operator; MCP uses the configured client identity. Grants are read live on every command and View delivery, never captured as authority.

Reverse: Replace the resolver adapters while retaining the persisted v1 request codec

### Member Views and operator diagnostics share one key policy, 2026-11-07

VaultSyncStatus, OpenConflicts and DestinationList require current workspace membership. OperationQueue requires admin or operator grants. History is authorized per key under the same policy; aggregate and raw stream history are not exposed.

Reverse: Introduce a separately named View for any changed audience

### DestinationList is workspace keyed at the public boundary, 2026-11-07

The PR 3a organization-keyed DestinationList can contain destinations from workspaces beyond the caller grant. Change its key to an explicit org:workspace value before any Api publication. Session still resolves and checks ownership independently of key shape. This is a pre-publication View key break; no existing desktop caller uses the alchemy View yet.

Reverse: Introduce a separately authorized organization-wide View and migrate its callers

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

Released the same day on `goals/vault-sync-cutover`: the database fence and startup state machine
(`2026-11-07-enforce-the-single-writer-with-a-persisted-epoch-and-a-database-fence.md`), the tested
post-admission reversal (`2026-11-07-reverse-an-admitted-store-from-the-current-projection-not-the-pre-cutover-backup.md`)
and the legacy writer deletion landed in the same cutover change, with the pre-admission restore
retained from the earlier commit.

Reverse: Replace this hold only after the epoch guard, legacy writer deletion, and pre/post-admission reversal tests pass in the same cutover change.

### Fold the remote cursor into the destination aggregate, 2026-11-07

The current cursor scope is one workspace plus provider, so its position and poll failure state belong to SyncDestination. A failed poll preserves the last durable position.

Reverse: Introduce a separately versioned cursor aggregate if account-wide polling becomes independent

### Genesis binds each workspace to one minted destination id, 2026-11-07

PII audit F3 requires genesis to mint opaque destination ids. The earlier lane derived legacy-box-workspace-<n> from the workspace id, and the bootstrap used the same derivation. A minted id must still be the same on every call: a genesis re-run after a crash in migrating, the desktop bootstrap and the Model engine all have to agree. workspaceDestinationId therefore mints a documents_sync_destination_<cuid-shaped random> id once and records it in documents_sync_destination_binding (workspace_id primary key, destination_id unique). Every later call reads that binding. The table is cutover state, created idempotently at runtime like the epoch and D14 identity tables, and is outside the writer fence. Minting uses Clock and Random through makeDestinationId, not mintDestinationId, so neither host needs a CuidState layer. Uniqueness comes from about 62 random bits plus the unique constraint.

Lane `goals/vs-cutover`

Reverse: Drop documents_sync_destination_binding and restore a derived workspace destination id in SyncGenesis.service.ts; any store already imported keeps its minted ids

### Genesis creates one Box destination per legacy workspace, 2026-11-07

Use the configured mirror root name, default beep-vault, and orgId from legacy rows. The cursor folds into this destination because its scope is workspace plus provider.

Reverse: Change genesis mapping before import; no data is imported in PR 3a

### Genesis imports the desktop store in one pass, not in batches, 2026-11-07

Genesis reads the four *_cutover_backup tables fully into one validated snapshot, then sends one genesis command per row. It is not paged. The desktop sidecar store is the only genesis target: one workspace, with item and operation rows in the thousands at most. The whole snapshot fits in memory, and the per-row commands are already crash-safe. Each command id is derived from the snapshot digest, so a re-run after a crash replays as receipts and adds no events. Batching would split the snapshot digest that names the import and add a resumable cursor, which costs more than it saves at this size. Revisit when a server Postgres store with many workspaces becomes a genesis target.

Lane `goals/vs-cutover`

Reverse: Page the four backup tables by numeric id and send each page's genesis commands before reading the next

### Hash destination names in reservation keys, 2026-11-07

PII audit F2: the kernel always records aggregate ids and streams on spans, so an orgId:name key leaked destination names into domain.id, domain.stream, driver spans and SyncRuleViolation evidence. ReservationKey is now orgId:sha256hex(trimmed, lowercased name), built only by reservationKey in aggregates/VaultSync/Values.ts with a synchronous @noble/hashes SHA-256 (the PartyKey precedent), so pure decide and policy code hash in place. The schema admits only an integer, a colon and a 64-character lowercase hex digest. The name stays in reservation state and event payloads, which the kernel never puts on spans.

Lane `goals/vault-sync-domain` · PR #2886

Reverse: Restore the orgId:normalizedName key in Values.ts reservationKey and widen the ReservationKey schema back to NonEmptyString; replay any stored reservation streams under the old ids

### Map legacy free-text sync reasons onto the closed kits losslessly at genesis, 2026-11-07

PR 3a closed the vault sync reason fields (`MirrorOperation`, `SupersedeReason`,
`SyncRule`) and narrowed `OperationInput.idempotencyKey` to `OperationId`. The legacy
tables hold free text in those places: cursor and operation `last_error` (vendor
diagnostics such as a `DmsMirrorUnavailable.reason`, or `superseded: ...`) and
`{provider}:{workspace}:...` idempotency keys.

**The mapping is lossless; the projection does not reconstruct legacy text.**
Every genesis event already stores its complete legacy row (`row`), and the legacy
projection writes that row verbatim for `*GenesisImported`. The closed literals
exist only in aggregate state, so replay-and-diff stays at zero difference without
a literal-to-text table.

| Legacy column | Aggregate state after genesis | Projected column |
| --- | --- | --- |
| cursor `last_error`, non-null | `DestinationState.cursorError = "pollEvents"` (the legacy writer set it only when polling Box failed) | legacy text, verbatim |
| cursor `last_error`, null | `cursorError = null` | null |
| operation `last_error` | not in `OperationRecord`; no state mapping needed | legacy text, verbatim |
| operation `idempotency_key` | `input.idempotencyKey = public_id` (the only key `QueueOperation` accepts) | legacy text, verbatim, and kept on later live events |

Later live events write closed literals into `last_error` (for example
`kind-replaced`, `uploadFile`, `pollEvents`). `idempotency_key` is now an
insert-only projection column, like the creation audit columns: a live event on an
imported operation keeps its legacy key text, and a live operation keeps the id it
was queued under.

Evidence: `SyncGenesis.pglite.test.ts` imports a selected error cursor with free
vendor text, asserts the state's `cursorError` is `pollEvents`, keeps the
all-column zero diff, and supersedes an imported queued operation live, asserting
`idempotency_key` stays `stored-key-107` while `last_error` becomes `kind-replaced`.

Lane `goals/vs-cutover-2`

Reverse: Restore free-text reason fields (S.String) on the domain events and state, and write idempotency_key on every projected operation event again

### Mint opaque destination ids, 2026-11-07

PII audit F3: DestinationId is the SyncDestination aggregate id, View key, URL segment and saga key, and accepted any non-empty string such as a destination name. It is now the fixed prefix documents_sync_destination_ plus a CUID (the PublicEntityId format), checked by a template-literal pattern, so decode rejects names. mintDestinationId draws a fresh CUID; makeDestinationId wraps an existing one. The id lives in Values.ts without the frozen entity kit, since a destination has no SQL row id. The cutover genesis in PR 3b2 must mint one id per destination and never derive it from a name or path.

Lane `goals/vault-sync-domain` · PR #2886

Reverse: Widen DestinationId in Values.ts back to a branded NonEmptyString and drop mintDestinationId and makeDestinationId

### Mount the PR 3c Api on the sidecar and provision desktop membership at startup, 2026-11-07

With PR 3c content-final, the cutover lane flips the desktop: `RuntimeLive` and `RuntimeTest` serve `VaultSyncRpcsApiLive` (the four existing RPCs, legacy wire unchanged) over `VaultSyncSessionLive`, the sidecar channel adapter, the desktop binding and live membership, on the hosted `VaultSyncPassModel`. `server/main.ts` mounts `makeVaultSyncTransportLayer` (HTTP, `/vault-sync/rpc`, MCP) beside the ontology MCP when a launch token is configured; the handlers and the transport share one host value, so memoization builds a single Model on the sidecar PGlite. The interim Model-backed `VaultSyncEngine` port, its inputs and `VaultSyncOrchestrator` are deleted in the same change; this supersedes the engine-port decision of the same day.

`shared_membership` is added through db-admin's drizzle tooling (`20261107120500_shared_membership`), which also feeds the desktop migration bundle. drizzle-kit is forward-only, so the folder carries a `down.sql` that drops the table and its journal row; `SharedMembershipMigration.pglite.test.ts` proves up, down and up again. The owner seed is not part of the shared migration (server Postgres replays the same folder): the desktop bootstrap calls `ensureVaultSyncOwnerMembership(1, 1)` once per start, with a deterministic public id, so restarts add nothing and a soft-deleted row stays revoked. The bootstrap also registers workspace 1's `legacy-box-workspace-1` destination idempotently, because the Api maps a workspace to its destination through DestinationList and a fresh workspace has none.

A pass now reads its vault root on every call through `VaultSyncRootFromWorkspaceLive` (destination → workspace → authorized workspace vault configuration), replacing the root registry that only the deleted engine populated. If admission refuses, the vault-sync handlers fall back to maintenance responses and the transport is not mounted; the rest of the sidecar keeps serving.

Behaviour change at the flip: TriggerVaultSync and the forced probe answer at acceptance; the pass completes in its saga. The panel invalidates its status and conflict keys when the RPC returns, so counts reflect the pass only on the next read.

Lane `goals/vault-sync-cutover`

Reverse: Apply drizzle/20261107120500_shared_membership/down.sql, restore VaultSyncHandlersLive over a Model-backed engine port, and drop the transport mount from server/main.ts

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

beta.85 has no Unique primitive. DestinationNameReservation is keyed by `orgId:sha256hex(normalizedName)` (see the "Hash destination names in reservation keys" decision) and rejects another destination. Policy order is claim, register or rename, then release the prior claim.

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

### Serve the unchanged vault-sync RPC port from the Model writer during the cutover, 2026-11-07

D7 requires the drizzle writer to disappear in the same change that makes the Model the writer, while PR 3c separately owns the RPC and HTTP surface. This change therefore keeps the `VaultSyncEngine` port and `VaultSyncRpcs` byte-for-byte and re-implements the port over the Model (`makeVaultSyncModelEngine`):

- `syncOnce` registers the workspace's `legacy-box-workspace-<n>` destination on first use (the same id genesis derives), records the canonical vault root in `documents_sync_destination_root`, runs one durable `VaultSyncPass` and waits for the LegacySync projections before reading status, so callers see post-pass state as before.
- Reads (`status`, `listOpenConflicts`) come from `LegacySyncReadModel`, a read-only query service over the four projected tables using the legacy row decoders, so every reader keeps its entities and D14 numeric ids.
- `markConflictReviewed` resolves the numeric conflict id through its projected row, refuses another workspace's id, sends `ReviewConflict` with a deterministic heal operation id and no correction, and waits for the projected review.

The four repository ports, their drizzle and in-memory implementations, the legacy engine and its reconcile/push/drift/review modules are deleted. The vault root lives in SQL rather than events (no absolute paths in events or workflow results) so a resumed pass reads the same root after a restart. If startup admission refuses, the engine serves reads and refuses writes with `VaultSyncWriterUnavailable` instead of crashing the sidecar.

Known narrowing: the legacy review requeued a corrective operation for remote move or rename conflicts; the Model review sends `correction: null` and relies on the ConflictReviews and ItemHealing policies to return the item to pending. PR 3c owns review corrections on the new Api.

Superseded the same day by `2026-11-07-mount-the-pr-3c-api-on-the-sidecar-and-provision-desktop-membership-at-startup.md`: the PR 3c Api now serves the RPCs and the engine port is deleted.

Lane `goals/vault-sync-cutover`

Reverse: When PR 3c moves the RPC callers onto the Model Api, delete makeVaultSyncModelEngine and the VaultSyncEngine port in that PR; the Model, projections and read model stay

### Sidecar launch token binds the slice principal, 2026-11-07

Operator decision: no login-session or bearer-verification service exists here or elsewhere. The local sidecar launch token is the authenticated HTTP/RPC channel and binds the desktop principal; in-process CLI uses the local operator, remote CLI presents the launch token from the existing handoff, and MCP uses the configured sidecar identity following OntologyMcpTransport. SessionResolver remains the port. A narrow documents-server repository reads active shared membership on each command and View emission. Hosted multi-user bearer/OIDC is a future adapter, not this slice.

Reverse: Add a bearer adapter behind the same port; no caller changes

### Hold uncertain Box mutations behind durable intent receipts, 2026-11-07

Commit an operation intent before calling Box and the acknowledgement before returning. An interrupted intent is looked up through BoxMirrorEvidence; insufficient evidence holds the operation without another Box mutation. The existing DmsMirrorBox port has no authoritative version or digest lookup, so the safe production lookup result is absent until that capability is provided. No fixture proves provider idempotency. Runtime composition must scope the existing Box mirror and root configuration to one destination.

Reverse: Use verified provider idempotency while retaining receipt identities

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
