# Postgres Platform driver design (`@beep/alchemy-postgres`)

Date: 2026-11-06. Status: design for PR 2; schema first, then the
`Context.Service` contracts, then implementation. Semantics are the installed
beta.85 `Platform.ts` contract with `InMemory.ts` as the executable reference
(single writer per id, `commandId` dedupe, atomic commit of events + state +
receipt + deliveries, ordered at-least-once delivery, catch-up through
`Backfill`).

## 1. Storage schema

All tables are prefixed `alchemy_` and keyed by `model` (models never share
data; two models with the same name on one platform fail, as upstream). JSON
columns are `jsonb` holding the kernel's JSON (`Platform.Json`); the driver
never decodes events.

| Table | Key | Columns | Serves |
|-------|-----|---------|--------|
| `alchemy_aggregate_instance` | `(model, aggregate, id)` | `state jsonb`, `version int`, `routed jsonb` | `AggregateStore.state`, single-writer row lock (`SELECT ... FOR UPDATE`) |
| `alchemy_aggregate_event` | `(model, aggregate, id, seq)` | `tag`, `event jsonb`, `envelope jsonb`, `schema_version int`, `command_id`, `correlation_id`, `principal`, `source_kind`, `context jsonb`, `at timestamptz` | `events`, `tail`, replay rows (`log`), provenance (D10), upcasting (D12) |
| `alchemy_aggregate_receipt` | `(model, aggregate, id, command_id)` | `result jsonb` (`SendResult`), `at` | dedupe by `commandId` |
| `alchemy_aggregate_schedule` | `(model, aggregate, id, command_id)` | `command jsonb`, `meta jsonb`, `due_at`, `status` (`pending`,`executed`,`cancelled`) | `schedule`, `unschedule`, Deadline timers |
| `alchemy_delivery` | `(model, position bigserial)` | `target_kind`, `target_name`, `generation`, `in_place`, `key`, `source`, `source_seq`, `delivery jsonb`, `status`, `attempts`, `locked_until` | outbox: ordered at-least-once delivery per `(source, target)` |
| `alchemy_view_key` | `(model, view, key)` | `snapshot jsonb` (`ViewSnapshot`), `generation`, `routed jsonb` | `ViewStore.read`, `changes` |
| `alchemy_view_entry` | `(model, view, key, seq)` | `event jsonb`, `envelope jsonb`, `state jsonb` | `list`, `tail`, replay |
| `alchemy_consumer_input` | `(model, consumer, key, position)` | `delivery jsonb`, `source`, `source_seq`, `at` | immutable input log (`Accepted`) for views and projections; dedupe by `(source, seq)` |
| `alchemy_projection_key` | `(model, projection, key)` | `processed int`, `checkpoints jsonb`, `generation` | `ProjectionStore.checkpoints`, batch runs |
| `alchemy_stream_key` | `(model, stream, key)` | `meta jsonb` (`StreamMeta`), `routed jsonb` | `StreamStore.read`, `changes` |
| `alchemy_stream_entry` | `(model, stream, key, seq)` | `event jsonb`, `envelope jsonb` | `list`, `tail` |
| `alchemy_backfill_kv` | `(model, address, key)` | `value jsonb` | `Backfill.Storage` per object address |
| `alchemy_backfill_job` | `(model, address, job_id)` | `due_at`, `locked_until` | `Backfill.Jobs` |
| `alchemy_hosted_model` | `(model)` | `legacy_data bool`, `sagas jsonb`, `built_at` | `hostedModels` claim across processes |

Provenance columns (`principal`, `source_kind`) are copied from
`meta.context` by a driver option `provenance: { key: "Documents/CurrentActor",
principal: "principal", sourceKind: "sourceKind" }` so the driver stays
model-agnostic; the full encoded context is kept in `context jsonb`.

Schema version: the driver builds an `eventVersions` map from
`aggregate.definition.events` (each class's static `schemaVersion`, default 1)
when `ModelHost.aggregate` is called, stamps `schema_version` at write and
applies `upcast(from, json)` chains from the same classes at read (`tail`,
`events`, replay rows) before returning `StoredEvent`.

## 2. Workers

- **Commit** runs inside one transaction: lock the instance row, check the
  receipt, `kit.handle`, insert events + update instance + insert receipt +
  insert deliveries, commit, then `NOTIFY alchemy_<model>` for live readers.
- **Delivery worker**: `SELECT ... FROM alchemy_delivery WHERE status =
  'pending' ORDER BY position FOR UPDATE SKIP LOCKED`, grouped per `(source,
  target, key)` to keep order, calls `kit.deliver`, marks delivered; retries with
  backoff on failure (at least once; targets dedupe by `(source, seq)`).
- **Schedule worker**: due rows in `alchemy_aggregate_schedule` are committed
  through the same `send` path; `unschedule` flips `pending` to `cancelled`
  under the instance lock.
- **Live reads** (`changes`, `tail`): `LISTEN/NOTIFY` on PGlite and Postgres,
  with a polling fallback interval (`pollMillis`).
- **Catch-up**: `Backfill.Storage`/`Jobs` over the two `alchemy_backfill_*`
  tables, one `address` per role object exactly as `InMemory` names them
  (`source:<aggregate>/<id>`, `consumer:<target>/<key>`, `scanner:<target>/<source>/<id>`,
  `node:<path>`, `run:<target>`); `exclusive` is a per-address advisory lock
  (`pg_advisory_xact_lock(hashtext(address))`); `Network` is in-process as in
  `InMemory`. `start` records the model's targets and plans in
  `alchemy_hosted_model` and begins the runs for `backfill`; `history(target)`
  reads the run phase.
- **Semantics copied from `InMemory`, verified by the conformance suite**: a
  view key or projection partition built by an earlier `generation` is reset
  before use; a projection drops deliveries for an earlier generation and
  dedupes intake by `(source, seq)`; stream `append` ignores a write whose
  `origin` is not after the stored one and stamps entries with `{ id: key,
  stream: "<stream>/<key>", seq, at, commandId }` (no correlation id); policies
  run at least once, serialized per key; a view keyed by its one aggregate
  (`kit.catchUp`) reads that instance's history before its first answer.

## 3. Service contracts (package `@beep/alchemy-postgres`)

- `AlchemyPostgresConfig` (schema): `schema` (Postgres schema name, default
  `public`), `pollMillis`, `deliveryBatch`, `provenance` mapping, `tablePrefix`.
- `AlchemyPostgresMigrations`: `Layer` that creates the tables (effect/sql
  `Migrator` is not used; one idempotent `CREATE TABLE IF NOT EXISTS` script
  per table, versioned by `alchemy_schema_version`).
- `AlchemyPostgresPlatform.layer(config?)`: `Layer<Platform, AlchemyPostgresError,
  SqlClient>`.
- `AlchemyPostgresWorkflows.layer`: `Layer<WorkflowEngine, ConfigError,
  SqlClient | Digest>` = `ClusterWorkflowEngine.layer` over
  `SingleRunner.layer()`.
- `AlchemyPostgres.layer(config?)`: the merge, mirroring `Domain.InMemory`'s
  `Platform | WorkflowEngine` surface so a model swaps platforms by one Layer.
- Errors: `AlchemyPostgresError` (tagged, with `operation`, `table`, `cause`).

## 4. Conformance suite

`test/conformance/scenarios.ts` exports scenario functions over a `Platform`
Layer: dedupe by command id, concurrent sends to one id serialize, events
survive a second `layer` build (durability), deliveries reach a view in order,
a scheduled command fires once and `unschedule` fails correctly, provenance
columns hold the request context, a view added later catches up from history,
`AlreadyExecuted` on rescheduling an executed command. Three projects run the
same module: `Domain.InMemory`, PGlite (`@beep/pglite` `PgliteTestLayer`), and
`test/integration` against a real Postgres (`DB_PG_URL`). The saga
crash-and-resume test runs on PGlite with the Cluster engine: start a saga whose
second step blocks, dispose the runtime, build it again, release the step,
assert the saga completed exactly once.
