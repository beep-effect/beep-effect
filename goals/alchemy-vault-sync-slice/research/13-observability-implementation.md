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
| 21 | `provenance` mapping for the v1 request context | partial, completed here | The driver already took further mappings (`AlchemyPostgresConfig.provenanceMappings`). The production host now mounts the genesis mapping first and the v1 request-context mapping (`principalKey`, `sourceKind`) after it (`packages/documents/server/src/Layer.ts`), and `VaultSyncProvenance.pglite.test.ts` runs that exact pair |
| 22 | Mount `layerCatalogEnrichment` (`StrictDesktop` / `Server`) | no | `git grep layerCatalogEnrichment` finds only `packages/foundation/capability/observability`. Not done here, see §3 |
| 23 | Genesis mints opaque `DestinationId`s; principal set for gated commands, NULL for derived events, recovered by a `correlation_id` join | partial, completed here | Minting: `SyncGenesis.service.ts:42`. `VaultSyncProvenance.pglite.test.ts` now also asserts that the `DestinationRegistered` row the `DestinationNames` policy derives has NULL `principal` and `source_kind` and the caller's `correlation_id`, and that a join on `alchemy_aggregate_event.correlation_id` recovers `User:5` / `http` |

## 2. What this lane changed

### `@beep/documents-server`

- New `src/aggregates/Sync/VaultSync.instruments.ts`, exported from the Sync barrel. It
  holds `LiteralKit` vocabularies for the attribute values (`VaultSyncApiCommand`,
  `VaultSyncApiView`, `VaultSyncReadMode`, `VaultSyncPassStep`, `VaultSyncBoxOperation`,
  `VaultSyncBoxFailure`, `VaultSyncOutcome`), the `VaultSyncAttribute` key table,
  `vaultSyncOutcomeOf` / `annotateVaultSyncOutcome`, `vaultSyncBoxFailureOf`, and
  `VaultSyncInstruments`. That last export declares 14 keys and 11 spans.
  `destination_id` is declared by `@beep/documents-use-cases` (below) and imported.
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
  that middleware: in-process CLI, generated HTTP, the gated RPC endpoint and MCP. On the
  gated RPC endpoint the outer RPC server runs the same Session without the boundary span
  (`makeSession(false)`, provided only to the outer server in `VaultSyncRpcHttp`); its
  handlers forward to the in-process client, whose Session opens the one boundary span.
  That inner Session also provides the kernel `Correlation`, so the span's
  `request_correlation_id` is the id the events store. The
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

### `@beep/documents-use-cases`

- New `src/aggregates/VaultSync/VaultSync.instruments.ts` declares
  `documents.vault_sync.destination_id` (`standard`) and the `VaultSyncRequests.start`
  span, which now records the destination it starts a pass or probe for. Standard 12 puts
  domain attributes in use-cases, and this is the lowest package whose span needs the
  key; documents-server imports `VaultSyncDestinationIdAttribute` from it.
- `package.json` adds `@beep/observability`; tsconfigs and `bun.lock` were regenerated.
  Other use-cases packages already depend on `foundation/capability` packages
  (`@beep/mcp-kit`, `@beep/semantic-web`).

### `@beep/alchemy-postgres`

- `AlchemyPostgres.Backfill.runJob` wraps each claimed backfill job with
  `beep.alchemy.job_role`, the role of the job's address (`node`, `run`, `scanner`,
  `source` or `consumer`), never its key.
- `AlchemyPostgres.instruments.ts` adds `BackfillJobRole`, `JobRoleAttribute`,
  `BackfillRunJobSpan`, and the `domain.*` keys declared for the hosted kernel. Names,
  kinds, outcomes and counts are `shape-only`. `domain.id`, `.key`, `.stream`,
  `.source`, `.command_id` and `.correlation_id` start at `standard`.

### Catalog

`standards/instrumentation-catalog/@beep/documents-server.generated.jsonc`,
`@beep/documents-use-cases.generated.jsonc` and `@beep/alchemy-postgres.generated.jsonc`
were regenerated. `Documents.VaultSyncPass`
(`conforms: false`) is gone, and all 38 spans in the three packages conform.

## 3. Not done, and why

Inside these packages:

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
- **Transport and outcome on `VaultSync.authorize`.** The span is opened in
  `@beep/documents-domain` (`Session.middleware.ts:38`). Domain may import only
  shared-kernel language and `foundation/primitive` / `foundation/modeling` packages
  (`standards/architecture/01-hexagonal-vertical-slices.md:59-61`,
  `06-configuration-boundaries.md:111-114`), so it cannot import the catalog types from
  `@beep/observability` (`foundation/capability`), nor keys owned by use-cases or server.
  Writing the key as a bare string in domain would be an undeclared second owner. The
  outcome of authorization is already recorded on the enclosing `VaultSyncApi.command` /
  `.read` span (`ScopeDenied`), and the transport on that span and on `VaultSyncSession.*`.

Outside these packages (host composition in `apps/professional-desktop`):

- **`POST /vault-sync/rpc` protocol span (step 19).** The HTTP server span is created by
  the host app's `HttpMiddleware`, and its name comes from the app-level
  `HttpMiddleware.SpanNameGenerator` (the request method by default). Wrapping the route
  inside documents-server would add a second server span under the app's `POST` span.
  The owner is the app (`apps/professional-desktop/server/VaultSyncTransport.ts`), with a
  route-aware `SpanNameGenerator` and the protocol span declared in
  `ProfessionalDesktop.instruments.ts`.
- **Step 22, mounting catalog enrichment.** This is host composition in the desktop
  sidecar and the server hosts. It is the change that makes the `shape-only` / `standard`
  split above take effect at export time.

## 4. Known shape of the traces

- Every transport, the gated RPC endpoint included, shows one `VaultSyncApi.command` or
  `VaultSyncApi.read` span per call. On the gated endpoint it sits under the outer
  `RpcServer.<tag>` span (through span propagation), and the Session still runs twice:
  the outer pass authenticates without a span, the inner pass opens it.
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
  - "a remote CLI command over the gated RPC endpoint opens exactly one
    VaultSyncApi.command span": `PauseDestination` through `VaultSyncApi.clientHttp` (the
    remote CLI's protocol) against `/vault-sync/rpc`; exactly one boundary span, with
    `transport=cli` and the caller's `request_correlation_id`, and `Domain.decide` under it.
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
- `packages/documents/server/test/VaultSyncProvenance.pglite.test.ts`: the provenance test
  now also checks the derived `DestinationRegistered` row (NULL `principal` and
  `source_kind`, caller's `correlation_id`) and the `correlation_id` join back to the
  gated command's principal.
- `packages/documents/use-cases/test/vault-sync/api.test.ts`, "records the destination on
  each VaultSyncRequests.start span (D17)".
