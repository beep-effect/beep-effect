# 11 — Vault-sync observability plan (D17)

D17 (`explorations/alchemy-domain-adoption/DECISIONS.md:146-152`) has three parts. Kernel
spans nest under registered boundary spans. Correlation ids propagate through the outbox
and the workflow engine. Event payload attributes are audited for PII before deploy; the
audit is `history/2026-11-07-pii-audit.md`, cited below as *the audit*. This plan names
the boundary spans, their attributes, the nesting the code produces today, the
correlation path with file:line evidence, and the implementation steps assigned to PRs.

Revisions read: PR 3a `226638f37b4` (#2886), PR 3b1 `68763f20fe2`, PR 3c `a6eee3aafb9`
(content-final), `main` `97a7bb87f44`, and the installed `@alchemy.run/domain`
`2.0.0-beta.85`. Citations without a branch refer to the 3c head.

## 1. Catalog rules that apply

- Names are `Concept(.Sub)*.action`: PascalCase concept segments and a camelCase action.
  Names are static literals, unique across packages
  (`standards/architecture/12-observability.md:15-28`). A protocol span uses the OTel
  form and is declared `protocol: true` in the owning package's `*.instruments.ts`.
- Attribute keys are lowercase dotted and declared once, with signals, cardinality and
  the strictest tier allowed to carry them. Domain keys are `<slice>.<concept>.<field>`;
  drivers attach technical keys only (§3).
- `bun run beep observability catalog --check|--write [paths]` regenerates the
  per-package shards under `standards/instrumentation-catalog/@beep/` and fails on
  interpolated names. Other packages declare instruments in a `*.instruments.ts` file
  (for example `packages/tooling/library/palantiri/src/Palantiri.instruments.ts`:
  `SpanInstrument.make`, `AttributeKey.make` with `cardinality` and `minTier`).
- Enforcement at runtime is the catalog enrichment tracer: under `shape-only` it drops
  undeclared attribute keys and all span events (`Catalog.enrichment.ts:117-160`).
  `StrictDesktop` caps at `shape-only`, `Server` at `standard`
  (`Catalog.behavior.ts:153-161`). No app mounts it yet.

Kernel span names (`Domain.decide <Agg>.<Cmd>` and the rest) are interpolated inside the
library. The repo scanner never sees them, and D17 treats them as library internals.
The catalog registers the repo-owned boundary spans around them, plus the `domain.*`
attribute keys that may survive `shape-only`.

## 2. The four non-conforming driver spans

`standards/instrumentation-catalog/@beep/alchemy-postgres.generated.jsonc` records four
`conforms: false` spans, on `main` since #2863, unchanged on 3a, 3b1 and 3c. The second
segment of each name is lowercase, so it is not a PascalCase concept:

| Current name | Site (`packages/drivers/alchemy-postgres/src/`) | Conforming name |
| --- | --- | --- |
| `AlchemyPostgres.backfill.schedule` | `internal/host.ts:203` | `AlchemyPostgres.Backfill.schedule` |
| `AlchemyPostgres.projection.receive` | `internal/projection.ts:199` | `AlchemyPostgres.Projection.receive` |
| `AlchemyPostgres.view.markLive` | `internal/view.ts:166` | `AlchemyPostgres.View.markLive` |
| `AlchemyPostgres.view.receive` | `internal/view.ts:218` | `AlchemyPostgres.View.receive` |

These names are new in this initiative, not harvested legacy names, so the "no mass
rename" exemption (`12-observability.md:28`) does not apply. Fix: rename the four
literals and run `bun run beep observability catalog --write
packages/drivers/alchemy-postgres/src`. Nothing in the repo matches on these names.

One slice span also fails: `Documents.VaultSyncPass`
(`VaultSyncPass.saga-handlers.ts:93`, 3b1 and 3c), whose action is PascalCase. Rename it
to `VaultSyncPass.run` in PR 3b1.

## 3. Boundary spans to register

The attribute keys all follow the audit's redaction rules R1-R6. No key carries a path, a
name, evidence, a digest or a cursor.

### Attribute keys

| Key | Owner | Type and cardinality | Min tier | Values |
| --- | --- | --- | --- | --- |
| `documents.vault_sync.transport` | documents-server | string, static | shape-only | `TransportKind` (`http`, `cli`, `mcp`, `sidecar`) |
| `documents.vault_sync.command` | documents-server | string, static | shape-only | the seven Api command tags |
| `documents.vault_sync.view` | documents-server | string, static | shape-only | the four Api View tags |
| `documents.vault_sync.read_mode` | documents-server | string, static | shape-only | `get`, `snapshot`, `list`, `watch`, `events` |
| `documents.vault_sync.outcome` | documents-server | string, bounded | shape-only | `accepted`, `ScopeDenied`, `SyncRuleViolation:<rule>` (rule as a LiteralKit, audit F10), `defect` |
| `documents.vault_sync.destination_id` | documents-server | string, unbounded identifier | standard | opaque `DestinationId` only (audit F3) |
| `documents.vault_sync.operation_id` | documents-server | string, unbounded identifier | standard | hashed `OperationId` |
| `documents.vault_sync.request_correlation_id` | documents-server | string, unbounded identifier | standard | validated token (audit F6) |
| `documents.vault_sync.pass_step` | documents-server | string, static | shape-only | `refreshProbe`, `probe`, `scan`, `plan`, `pump`, `pollStart`, `poll` |
| `documents.vault_sync.box_operation` | documents-server | string, static | shape-only | the eight `BoxMirror` operations |
| `documents.vault_sync.box_failure` | documents-server | string, static | shape-only | the `BoxMirrorUnavailable.operation` LiteralKit (audit F10) |
| `documents.vault_sync.items_observed`, `.operations_succeeded`, `.conflicts` | documents-server | int | shape-only | counts |
| `beep.alchemy.aggregate`, `beep.alchemy.target_kind`, `beep.alchemy.target_name` | alchemy-postgres | string, bounded | shape-only | model-declared names |
| `beep.alchemy.batch_size`, `beep.alchemy.attempt` | alchemy-postgres | int | shape-only | counts |
| `beep.outcome` | existing | string, bounded | shape-only | `ok`, `retry`, `failed` |
| `domain.aggregate`, `domain.command`, `domain.event`, `domain.view`, `domain.saga`, `domain.system`, `domain.operation`, `domain.outcome`, `domain.kind`, `domain.events`, `domain.version`, `domain.seq`, `domain.batch` | alchemy-postgres (declared on behalf of the hosted kernel) | static or bounded | shape-only | kernel literals |
| `domain.command_id`, `domain.correlation_id`, `domain.id`, `domain.key`, `domain.stream`, `domain.source` | alchemy-postgres | unbounded identifier | standard | safe only after audit F1, F2, F3 and F5 land |

The split means a `StrictDesktop` host keeps the kernel's shape (which command, which
outcome, how many events) and drops every identifier. A `Server` host keeps identifiers,
which is why F1-F3 must land before deploy, not after.

### Spans

| Span | Kind | Owner and file | Attributes | Lands in |
| --- | --- | --- | --- | --- |
| `POST /vault-sync/rpc` (`protocol: true`) | server | documents-server, around the mount at `VaultSyncApi.ts:315` | `rpc.system`, `rpc.method` (RPC tag), `documents.vault_sync.transport` | 3c |
| `VaultSyncApi.command` | internal | documents-server, wrapping the delivery client's command path. One wrapper serves the generated HTTP endpoints, the CLI (in process and remote), and the compat RPCs (`VaultSyncRpcs.api.ts`) | `transport`, `command`, `destination_id` (when the target is a `DestinationId` or `ConflictId`, never a `ReservationKey`), `request_correlation_id`, `outcome` | 3c |
| `VaultSyncApi.read` | internal | documents-server, wrapping `authorizeVaultSyncDelivery` (`VaultSyncApi.ts:90-110`) for HTTP SSE, RPC watch and MCP tool reads | `transport`, `view`, `read_mode`, `destination_id`, `outcome` | 3c |
| `VaultSyncSession.resolve`, `.grants`, `.scope`, `.revoked`, `.registered`; `VaultSync.authorize`; `VaultSync.deliveryCheck` | internal | already in the catalog (3c shards) | add `transport` and `outcome` only. `deliveryCheck` runs once per frame, so it stays attribute-light | 3c |
| `VaultSyncRequests.start` | internal | documents-use-cases (exists) | `destination_id` | 3c (exists) |
| `VaultSyncPass.run` (renamed from `Documents.VaultSyncPass`) | internal | documents-server, `VaultSyncPass.saga-handlers.ts:93` | `destination_id`, `probe_only`, `operations_succeeded`, `conflicts`, `outcome` | 3b1 |
| `VaultSyncPass.step` | internal | documents-server; one static name opened inside each `Activity.make` body | `pass_step`, `operation_id` (pump only), `items_observed` (scan) | 3b1 |
| `BoxMirror.call` | client | documents-server `BoxMirror.ts`, inside each implementation op | `box_operation`, `box_failure` | 3b1 |
| `AlchemyPostgresPlatform.send` (exists, conforms) | internal | `internal/aggregate.ts:304` | replace `{ aggregate, id }` with `beep.alchemy.aggregate` (audit F4) | driver PR |
| `AlchemyPostgres.Outbox.claim` | internal | new, `internal/host.ts:490` | `beep.alchemy.batch_size` | driver PR |
| `AlchemyPostgres.Outbox.deliver` | consumer | new, around `deliverRow` (`internal/host.ts:532-536`), parented to `delivery.envelope.trace` | `beep.alchemy.target_kind`, `beep.alchemy.target_name`, `beep.alchemy.attempt`, `beep.outcome` | driver PR |
| `AlchemyPostgres.View.receive`, `.View.markLive`, `.Projection.receive`, `.Backfill.schedule` | internal | renames (section 2) | `beep.alchemy.target_name`, `beep.alchemy.batch_size` | driver PR |
| `AlchemyPostgres.Backfill.runJob` | internal | new, around the job runner (`internal/host.ts:365`) | `beep.alchemy.target_name`, `beep.outcome` | driver PR |

The activity spans Effect creates are named by `activity.name` (`Activity.ts:355`), and
`pump/<operationId>` is dynamic (`saga-handlers:217`). The activity name is also the
activity's durable identity within the execution, so it stays dynamic. It is upstream,
opaque (a hash) and invisible to the scanner. The static `VaultSyncPass.step` child gives
the catalog a stable name.

## 4. How kernel spans nest under the boundary spans

A command over HTTP (the RPC, CLI and MCP paths are the same below the protocol span):

```text
POST                                   Effect HttpMiddleware (name = method, HttpMiddleware.ts:187-190)
└─ VaultSyncApi.command                new, 3c
   ├─ VaultSyncSession.resolve         Session middleware (VaultSyncSession.ts:123)
   ├─ VaultSync.authorize              shared policy (documents-domain)
   └─ Domain.send SyncDestination.RequestVaultSync     kernel client (Model.ts:640-650)
      ├─ AlchemyPostgresPlatform.send  driver (aggregate.ts:304), the current span when store.send runs
      │  └─ sql spans
      └─ Domain.decide SyncDestination.RequestVaultSync  parent = meta.trace (Kernel.ts:1148-1157)
```

`metaFor` captures `Telemetry.currentTrace` while the `Domain.send` span is current
(`Model.ts:613`, inside the span opened at `:640-650`). The decide span therefore parents
to `Domain.send` and is a **sibling** of the driver send span, not its child. Both sit
under the registered `VaultSyncApi.command`, which is what D17 asks for.

The asynchronous path after commit:

```text
Domain.decide ... (commit)             trace stored in each delivery envelope (Kernel.ts:1100-1110)
├─ AlchemyPostgres.Outbox.deliver      new: parent = envelope.trace
│  └─ AlchemyPostgres.View.receive     driver
├─ Domain.view VaultSyncStatus         kernel: explicit parent = envelope.trace (Kernel.ts:143-144, 1262-1267)
└─ Domain.policy VaultSyncRequests     kernel: same parent (Kernel.ts:1438-1442)
   └─ VaultSyncRequests.start
      └─ (Saga.start → engine.execute; trace stored in the workflow payload, Saga.ts:445-452)

Domain.saga VaultSyncPass              root: true, linked to the cause trace (Saga.ts:55-59)
└─ VaultSyncPass.run                   3b1 rename
   └─ <activity name>                  Effect Activity span (Activity.ts:355)
      └─ VaultSyncPass.step            new, 3b1
         ├─ Domain.external BoxMirror.<op>   kernel (ExternalSystem.ts:36)
         │  └─ BoxMirror.call          new, 3b1
         │     └─ Box.* SDK spans
         └─ Domain.send SyncItem.ObserveItem ...   Correlation provided by the saga (Saga.ts:40)
```

Kernel reaction spans take an explicit parent from the stored trace, so they never nest
under the driver's worker span. The fix is to parent `AlchemyPostgres.Outbox.deliver` to
the same stored trace. Today the driver's `*.receive` spans run in the worker fiber
forked at model start, so they hang off the startup span, far from the commit. A saga run
is a new trace by design (`root: true`); it joins its cause through the span link and
`domain.correlation_id`.

## 5. Correlation ids through the outbox and the workflow engine

Verified by reading. Every hop below already carries the kernel `correlationId` and the
trace; no driver change is needed for propagation.

| Hop | Carries | Evidence |
| --- | --- | --- |
| Client send | `correlationId` = the ambient `Correlation`, else the command's own id; `trace` = the current span; `context` = the captured RequestContext | `Model.ts:604-621`, `Telemetry.ts:69-75` |
| Driver commit | `{ commandId, context, ...flow }` spread into `kit.handle`, so `correlationId`, `trace` and `link` reach the kernel | `internal/aggregate.ts:252-268` |
| Event row | `correlation_id` column; the full envelope JSONB; `context` JSONB; `principal` and `source_kind` from `config.provenance` | `internal/aggregate.ts:200-216`, `AlchemyPostgres.schema.ts:676-692` |
| Outbox row | the whole `Delivery` (envelope with `commandId`, `correlationId`, `trace`, `at`) as `delivery` JSONB | `internal/host.ts:469-480`, `AlchemyPostgres.schema.ts:716-731` |
| Outbox claim and deliver | `delivery` decoded and handed whole to the producer's `deliver` | `internal/host.ts:490-506`, `:532-536` |
| Policy run | `Correlation` = `envelope.correlationId`, so the policy's sends inherit it | `Kernel.ts:1405-1415` |
| Scheduled command | `StoredSendMeta` keeps `commandId`, `context`, `correlationId`, `trace` and `link`; replayed through `commitLocked` | `AlchemyPostgres.schema.ts:292-302`, `internal/aggregate.ts:309-383` |
| Saga start | `CAUSE { correlationId, trace }` written into the workflow payload, which the Cluster engine persists in SQL | `Saga.ts:441-452`, `AlchemyPostgresWorkflows.ts:39-43` |
| Saga run | `Correlation` provided from `CAUSE`, so every command and activity send in the run carries it | `Saga.ts:30-40` |
| Streams | no correlation id (unused by vault-sync: `streams: []`) | `internal/stream.ts:1-6`, `Api.ts` |

`SendMeta.context` is persisted per event and per schedule. It is restored only into
effectful decisions (`Kernel.ts:1075-1080`). Commands that a policy or saga sends capture
that fiber's request context, not the original caller's (`Model.ts:606`), so derived
events carry no caller principal (audit, "Request context and driver provenance"). The
provenance query for derived events joins on `correlation_id`.

The repo has a second correlation id. `VaultSyncRequest.correlationId`
(`Session.context.ts:55`) comes from `x-correlation-id` or `${sessionRef}:${at}`
(`VaultSyncSession.ts:132-135`), and it lives only in `context` JSONB. It is not the
kernel's correlation id. The plan keeps both and joins them on the boundary span:
`VaultSyncApi.command` records `documents.vault_sync.request_correlation_id`, and its
kernel children record `domain.correlation_id`. Seeding the kernel `Correlation` from the
request id would require `Domain.Telemetry.Correlation`, which is marked `@internal`
(`Telemetry.ts:62-71`). We do not depend on it.

## 6. Implementation steps and where each lands

Order matters only where noted. Each step ends with `bun run beep observability catalog
--write <package src>` for the touched package and
`bun run beep quality package-verify <package>`.

### Driver PR off `main` (independent; open it now)

1. Rename the four spans (section 2).
2. `internal/aggregate.ts:304`: attributes `{ "beep.alchemy.aggregate": name }`; drop
   `id` (audit F4).
3. Add `AlchemyPostgres.Outbox.claim` (around `claim`, `host.ts:490`) and
   `AlchemyPostgres.Outbox.deliver` around `deliverRow` (`host.ts:532-536`), with
   `parent: Tracer.externalSpan(row.delivery.envelope.trace)` when a trace is present.
4. Add `AlchemyPostgres.Backfill.runJob` around the job body (`host.ts:365`).
5. Replace raw `cause` in `host.ts:377`, `:517-520` and `:571` with the failure tag and
   position. Keep `Cause.pretty` behind a `dev-verbose` check (audit F7).
6. Add `src/AlchemyPostgres.instruments.ts` declaring the driver spans, the
   `beep.alchemy.*` keys, and the `domain.*` keys with the tiers from section 3.
7. Test: run a send and one delivery under an in-memory tracer. Assert the deliver span's
   parent is the decide span, and that no attribute equals the aggregate id.

### `main` PR, documents legacy logs (independent)

8. `VaultSync.file-store.ts:156-157`: drop the `path` annotation (count skipped symlinks).
   `DmsMirrorBox.ts:910-914`: log `method`, `status`, `code` and `disconnectReason`, not
   `reason` (audit F9).

### PR 3a (#2886)

9. `Values.ts`: an opaque check on `DestinationId`; `ReservationKey.forName(orgId,
   name)` = `${orgId}:${sha256hex(lower(trim(name)))}`; `OperationInput.idempotencyKey`
   typed as `OperationId`.
10. `DestinationNameReservation.aggregate.ts:34,41`: evidence becomes a rule phrase, not
    the key. `VaultSync.policy-handlers.ts:79` calls `ReservationKey.forName`.
11. `SyncRuleViolation.rule` and `BoxMirrorUnavailable.operation` become `LiteralKit`s.
12. Test: a property check that no `ReservationKey` contains the source name.

### PR 3b1 (saga; merge 3a first)

13. `VaultSyncPass.saga-handlers.ts:165`: `options(\`claim/${itemId}\`)` (audit F1).
14. Rename `Documents.VaultSyncPass` to `VaultSyncPass.run`. Wrap each activity body in
    `VaultSyncPass.step` with `pass_step`. Wrap each `BoxMirror.ts` op in `BoxMirror.call`.
15. Add `VaultSync.instruments.ts` to documents-server with the `documents.vault_sync.*`
    keys used so far.
16. Test: run a pass over a fixture vault under an in-memory tracer. Assert that no span
    attribute and no command id contains a fixture path segment.

### PR 3c (api; content-final, so this is one more wave before publication)

17. `VaultSyncRequest.command.ts`: `requestId` as a bounded token schema (audit F5).
    `VaultSyncSession.ts:132-135`: accept `x-correlation-id` only when it matches the same
    token, otherwise generate one (audit F6).
18. `Session.context.ts`: add `principalKey: S.String` (`User:<userId>` and the matching
    forms) to v1 before it is published (audit F8).
19. Register `POST /vault-sync/rpc`, `VaultSyncApi.command` and `VaultSyncApi.read` in
    the documents-server instruments file. Wrap the delivery client's command and read
    paths. Add `transport` and `outcome` to the existing Session spans.
20. Test: extend `VaultSyncApi.transport.test.ts` with a tracer assertion. For one
    command over HTTP, `Domain.decide` must be a descendant of `VaultSyncApi.command`,
    and the boundary span must carry the request correlation id.

### PR 3b2 (cutover)

21. Configure `AlchemyPostgresConfig.provenance` with `contextKey:
    "documents/vault-sync/RequestContext/v1"`, `principalField: "principalKey"` and
    `sourceKindField: "sourceKind"`.
22. Mount `layerCatalogEnrichment` with `StrictDesktop` on the desktop sidecar tracer,
    outermost, over the exporter (`Catalog.enrichment.ts` gotchas). Server hosts use
    `Server` (`standard`).
23. Genesis mints opaque `DestinationId`s. Test that the `principal` column is set for a
    Session-gated command and NULL for derived events, and that a join on
    `correlation_id` recovers the principal.

## 7. Open points

- Whether a server host should run below `standard` for vault sync. The current answer is
  no: with F1-F5 fixed, identifiers are opaque. Revisit if a `Server` exporter leaves the
  workstation.
- `RecordConflict` and `ClaimDestinationName` are exposed on the external Api. Their
  payloads are not recorded on spans, but a caller can store free evidence text up to
  8 KiB. Whether those two belong on the external surface is an Api-scope question for
  the 3c reviewer, not an observability one.
