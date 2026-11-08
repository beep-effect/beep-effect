# 13 — Vault-sync observability: plan audit and implementation

This note checks each step of `11-observability-plan.md` §6 against `main` at `ff7568b1c23`
and records what this lane implemented for the acceptance item "Observability: boundary
spans registered in the span catalog with kernel spans nested". The PRs the plan assigned
steps to (#2886, #2894, #2899, #2903, and the driver PR #2889) have all merged. File:line
citations refer to this lane's working tree unless marked `main`.

## 1. Step audit

"Landed" means landed on `main` before this lane. "Done here" means this lane did it.

| Step | What | Landed | Evidence |
| --- | --- | --- | --- |
| 1 | Rename the four driver spans | yes | `internal/host.ts:230`, `internal/projection.ts:199`, `internal/view.ts:166`, `:218`; the shard has no `conforms: false` driver span |
| 2 | Send span carries `beep.alchemy.aggregate` only (F4) | yes | `internal/aggregate.ts:333` |
| 3 | `Outbox.claim` and `Outbox.deliver` (parented to the envelope trace) | partial | deliver: `internal/host.ts:589-592` (`Tracer.externalSpan(envelope.trace)`). claim: not added, see §3 |
| 4 | `AlchemyPostgres.Backfill.runJob` | no, done here | `internal/host.ts:400` |
| 5 | Driver logs carry the failure tag, not the cause (F7) | yes | `causeTagOf` at `internal/host.ts:412`, `:559`, `:624` |
| 6 | Driver `*.instruments.ts` with `beep.alchemy.*` and `domain.*` keys | partial, completed here | `AlchemyPostgres.instruments.ts` existed with the send and deliver spans and three keys (#2889). This lane added `beep.alchemy.job_role`, the `runJob` span and 23 `domain.*` keys with tiers |
| 7 | Driver test: deliver parent is the decide span; no attribute equals the aggregate id | yes | `test/observability.test.ts:119`, `:142` |
| 8 | Legacy logs drop the vault path and Box `reason` (F9) | yes | `VaultSync.file-store.ts:155`, `DmsMirrorBox.ts:920` |
| 9 | Opaque `DestinationId`, hashed `ReservationKey`, `idempotencyKey: OperationId` | yes | `Values.ts:103`, `:190`, `:230`; `SyncOperation.events.ts:34` |
| 10 | Reservation evidence and policy key built by one helper | yes | `DestinationNameReservation.aggregate.ts:34` puts the hashed key in evidence, never the name; `VaultSync.policy-handlers.ts:120`, `:130` |
| 11 | `SyncRuleViolation.rule` and `BoxMirrorUnavailable.operation` as `LiteralKit`s (F10) | yes | `SyncRuleViolation.rejection.ts:24`; `BoxMirror.external.ts:83` (`V.MirrorOperation`, `Values.ts:299`) |
| 12 | Property check: no `ReservationKey` contains the source name | yes | `packages/documents/domain/test/VaultSync.test.ts:247-262` |
| 13 | Saga claim command id is `claim/${itemId}` (F1) | yes | `VaultSyncPass.saga-handlers.ts:240` (main `:225`), in `observeEntry` |
| 14 | Rename `Documents.VaultSyncPass` to `VaultSyncPass.run`; `VaultSyncPass.step` per activity; `BoxMirror.call` per op | no, done here | `VaultSyncPass.saga-handlers.ts` (`Effect.fn("VaultSyncPass.run")`, `passStep(...)` on all seven activities); `BoxMirror.ts` (`boxCall(...)` on all eight ops) |
| 15 | `VaultSync.instruments.ts` with the `documents.vault_sync.*` keys | no, done here | `packages/documents/server/src/aggregates/Sync/VaultSync.instruments.ts` |
| 16 | Test: a pass over a fixture vault leaks no path segment into spans | partial, completed here | `VaultSyncPass.pglite.test.ts` already checked command ids. This lane added the span test, see §4 |
| 17 | `requestId` token schema (F5); `x-correlation-id` validated (F6) | yes | `Values.ts:162` (`RequestToken`), `VaultSyncRequest.command.ts:22`; `VaultSyncSession.ts:165-167` (`O.filter(..., S.is(V.RequestToken))`) |
| 18 | `principalKey` in the v1 request context (F8) | yes | `Session.context.ts:80`, `:106` |
| 19 | Register and wrap `POST /vault-sync/rpc`, `VaultSyncApi.command`, `VaultSyncApi.read`; transport and outcome on the Session spans | partial, done here | `VaultSyncApi.command` and `.read` are opened in `VaultSyncSessionLive` (`VaultSyncApi.ts`, `traceApiCall`). Session spans carry `transport` and `outcome` (`VaultSyncSession.ts`). `POST /vault-sync/rpc` is not done, see §3 |
| 20 | Test: an HTTP command's `Domain.decide` descends from `VaultSyncApi.command`, which carries the request correlation id | no, done here | `VaultSyncApi.transport.test.ts`, describe "vault-sync boundary spans (D17)" |
| 21 | `provenance` mapping for the v1 request context | partial | The driver mapping works and is tested (`VaultSyncProvenance.pglite.test.ts:31-40`). The production host still maps the genesis context (`packages/documents/server/src/Layer.ts:116-125`). Not changed here, see §3 |
| 22 | Mount `layerCatalogEnrichment` (`StrictDesktop` / `Server`) | no | `git grep layerCatalogEnrichment` finds only `packages/foundation/capability/observability`. Not done here, see §3 |
| 23 | Genesis mints opaque `DestinationId`s; principal set for gated commands, NULL for derived events, recovered by a `correlation_id` join | partial | Minting: `SyncGenesis.service.ts:42`. The provenance test asserts only the gated-command principal (`VaultSyncProvenance.pglite.test.ts:47`), not the derived-event NULL or the join |

## 2. What this lane changed

### `@beep/documents-server`

- New `src/aggregates/Sync/VaultSync.instruments.ts`, exported from the Sync barrel. It
  holds `LiteralKit` vocabularies for the attribute values (`VaultSyncApiCommand`,
  `VaultSyncApiView`, `VaultSyncReadMode`, `VaultSyncPassStep`, `VaultSyncBoxOperation`,
  `VaultSyncBoxFailure`, `VaultSyncOutcome`), the `VaultSyncAttribute` key table,
  `vaultSyncOutcomeOf` / `annotateVaultSyncOutcome`, `vaultSyncBoxFailureOf`, and
  `VaultSyncInstruments`. That last export declares 15 keys and 11 spans.
- Keys: literal keys at `shape-only` (`transport`, `command`, `view`, `read_mode`,
  `pass_step`, `box_operation`, `box_failure`, `probe_only`, `outcome`, and the three
  counts). The opaque identifiers `destination_id`, `operation_id` and
  `request_correlation_id` start at `standard`. The catalog requires every key a span
  lists to be valid at the span's own tier. So each span is `shape-only`, lists only its
  `shape-only` keys, and names the identifiers it adds at `standard` in its description.
- `outcome` is bounded. Its values are `accepted`, `ScopeDenied`, `failed`,
  `interrupted`, `defect`, and `SyncRuleViolation:<rule>` for each `SyncRule` literal.
  An unknown rule falls back to `failed`.
- `VaultSyncApi.command` and `VaultSyncApi.read` are opened in the Session middleware
  (`VaultSyncSessionLive`), not in `VaultSyncDeliveryClient`. Every transport goes through
  that middleware: in-process CLI, generated HTTP, the gated RPC endpoint and MCP. The
  delivery client never sees the in-process CLI path or the resolved transport. The span
  opens before the Session resolves the caller, so `VaultSyncSession.resolve`,
  `VaultSync.authorize` and the kernel `Domain.send` / `Domain.decide` are its
  descendants. After `resolve`, the span gets `transport` and `request_correlation_id`.
  The static attributes come from the RPC tag: `<Command>` or `<View>.<mode>`.
  `destination_id` is set only when the payload's `target` or `key` decodes as a
  `DestinationId`, so a `ReservationKey`, `ConflictId` or `WorkspaceKey` never reaches it.
- The Session spans (`resolve`, `grants`, `scope`, `registered`, `revoked`) carry the
  entrypoint's fixed `transport` and their `outcome`. `VaultSync.deliveryCheck` carries
  `transport` and `outcome`.
- The saga span is renamed to `VaultSyncPass.run`. It carries `destination_id`,
  `probe_only`, `operations_succeeded`, `conflicts` and `outcome`. Each of the seven
  activity bodies runs inside `VaultSyncPass.step` with its `pass_step`. Pump steps add
  `operation_id`, and the scan step adds `items_observed`.
- Each of the eight `BoxMirrorLive` operations runs inside a `BoxMirror.call` client span
  with `box_operation`. On failure the span gets `box_failure`: the adapter stage, or
  `remote`. It records no arguments, paths or Box text.
- `package.json` adds `@beep/observability` to dependencies and `@beep/memfs` to
  devDependencies. `tsconfig*.json`, `bun.lock` and `standards/fallow.boundaries.generated.jsonc`
  were regenerated by `beep tsconfig-sync` and `bun install`.

### `@beep/alchemy-postgres`

- `AlchemyPostgres.Backfill.runJob` wraps each claimed backfill job with
  `beep.alchemy.job_role`, the role of the job's address (`node`, `run`, `scanner`,
  `source` or `consumer`), never its key.
- `AlchemyPostgres.instruments.ts` adds `BackfillJobRole`, `JobRoleAttribute`,
  `BackfillRunJobSpan`, and the `domain.*` keys declared for the hosted kernel. Names,
  kinds, outcomes and counts are `shape-only`. `domain.id`, `.key`, `.stream`,
  `.source`, `.command_id` and `.correlation_id` start at `standard`.

### Catalog

`standards/instrumentation-catalog/@beep/documents-server.generated.jsonc` and
`@beep/alchemy-postgres.generated.jsonc` were regenerated. `Documents.VaultSyncPass`
(`conforms: false`) is gone, and all 38 spans in the three packages conform.

## 3. Not done, and why

- **`AlchemyPostgres.Outbox.claim` (step 3).** The claim runs on every worker poll
  (`pollMillis`, 250 ms by default) whether or not rows are due. A span there would open
  about four spans per second per model on an idle host, all as children of the
  long-lived startup span. The deliver span already ties each delivered row to its
  commit's trace. A claim span is worth adding only once it is gated on a non-empty
  claim, which changes the pass shape.
- **`beep.outcome` and `beep.alchemy.attempt` on deliver (plan §3).** `beep.outcome` is
  declared by `@beep/observability` for metrics only, with the values `started`,
  `completed`, `failed` and `interrupted`, not `ok` / `retry` / `failed` for spans.
  Reusing it would violate its declaration. The claimed row does not return `attempts`.
- **`POST /vault-sync/rpc` protocol span (step 19).** The HTTP server span is created by
  the host app's `HttpMiddleware`, and its name comes from the app-level
  `HttpMiddleware.SpanNameGenerator` (the request method by default). Wrapping the route
  inside documents-server would add a second server span under the app's `POST` span.
  The right owner is the app (`apps/professional-desktop/server/VaultSyncTransport.ts`),
  with a route-aware `SpanNameGenerator` and the protocol span declared in
  `ProfessionalDesktop.instruments.ts`.
- **`destination_id` on `VaultSyncRequests.start` (plan §3).** The span lives in
  `@beep/documents-use-cases`, which cannot import keys owned by documents-server. Moving
  the `documents.vault_sync.*` keys down to use-cases would fix that (use-cases is where
  standard 12 puts domain attributes), but it is an ownership change to the plan.
- **Transport and outcome on `VaultSync.authorize`.** It is in `@beep/documents-domain`,
  for the same reason.
- **Step 21, the production provenance mapping.** The driver takes one
  `ProvenanceMapping`. The host maps it to `V.GenesisProvenance` so genesis events carry
  their import principal (`Layer.ts:116-125`). Switching it to the v1 request context
  would drop that genesis provenance. Supporting both needs a driver change: several
  mappings, or a mapping per context key. That is a schema and provenance-behaviour
  change, so it is left for its owner.
- **Step 22, mounting catalog enrichment.** This is host composition in the desktop
  sidecar and the server hosts, outside these three packages. It is the change that makes
  the `shape-only` / `standard` split above take effect at export time.
- **Step 23, provenance assertions for derived events and the join.** It depends on
  step 21.

## 4. Known shape of the traces

- On the gated RPC endpoint, the Session middleware runs twice. It runs once in the outer
  RPC server and once in the in-process client that the gated handlers forward to. So a
  remote CLI call shows two nested `VaultSyncApi.command` spans with the same
  `transport` and `request_correlation_id`. HTTP, MCP and the in-process CLI show one.
- `VaultSyncApi.read` for `watch` / `events` lives as long as the subscription. The
  per-frame `VaultSync.deliveryCheck` spans run on the consumer side of the delivery
  client, so they are not its descendants.
- A saga run is a new trace (`root: true`). `VaultSyncPass.run` sits under
  `Domain.saga VaultSyncPass`. Each `VaultSyncPass.step` sits under its Effect activity
  span, whose name is the durable activity name (`pump/<operationId>` included).

## 5. Tests added

- `packages/documents/server/test/VaultSyncApi.transport.test.ts`, describe "vault-sync
  boundary spans (D17)":
  - "an HTTP command nests the kernel decide under VaultSyncApi.command with the request
    correlation id": `POST /PauseDestination` over the generated HTTP Api under an
    in-memory tracer. `Domain.decide SyncDestination.PauseDestination` and
    `VaultSyncSession.resolve` are descendants of `VaultSyncApi.command`. The boundary
    span carries `command`, `destination_id`, `transport=http`,
    `request_correlation_id=corr-trace-1` and `outcome=accepted`.
  - "a denied View read records the read shape and a ScopeDenied outcome, never a foreign
    key": a foreign `DestinationList.get` records `view`, `read_mode`, `transport` and
    `outcome=ScopeDenied`, and no `destination_id`.
- `packages/documents/server/test/VaultSyncPassTracing.pglite.test.ts`, "nests each
  activity step under VaultSyncPass.run and keeps fixture path segments off spans". A full
  pass runs over an in-memory fixture vault (`MemoryFileSystem`) with the Box fixture and
  PGlite. Every `VaultSyncPass.step` descends from a `VaultSyncPass.run`, and the six
  steps of a non-probe pass appear. `items_observed` is 2. `BoxMirror.call` is a client
  span labelled by operation. No span name or string attribute contains the fixture
  folder name, the file name or the vault root.
- `packages/drivers/alchemy-postgres/test/observability.test.ts`: the declarations test
  now covers `runJob` and `job_role`. "declares kernel names at shape-only and kernel
  identifiers only from standard up" checks the `domain.*` tiers.
