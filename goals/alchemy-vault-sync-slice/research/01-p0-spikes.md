# P0 spikes: alchemy `@alchemy.run/domain` 2.0.0-beta.85 against beep

Date: 2026-11-06. Lane: `goals/alchemy-vault-sync-slice`. Executable evidence:
`packages/drivers/alchemy-postgres/test/spikes/event-annotations.test.ts` and
`packages/drivers/alchemy-postgres/test/spikes/platform-send-meta.test.ts`
(both green under `bun run check` and vitest in `@beep/alchemy-postgres`).

## 0. Read the installed beta.85, not the reference HEAD

The reference checkout (`.repos/alchemy`, HEAD `e312f31c3`, 56 commits past the
`v2.0.0-beta.85` tag) differs from the published beta.85 in 29 of the domain
kernel files (+2386/-787 lines): `Annotations.ts` and `Query.ts` do not exist in
beta.85, `Event.make` takes `{ attributes }` instead of annotations, and
`Aggregate.Resolved` was restructured. Every API in this goal is validated
against the installed package (it ships its TypeScript source under `src/` and
agent docs under `skills/alchemy-domain/`) or `git show v2.0.0-beta.85:<path>`
in the reference checkout. D11 freezes the trio at beta.85.

Peer pins: `effect ^4.1.0` (repo has 4.1.2), `alchemy 2.0.0-beta.85`,
`foldkit ^0.170.0` (added to the root catalog as `0.170.0`).

## 1. Annotation propagation (brief rabbit hole 3)

Verified at runtime and type level:

- Field schemas are plain Effect schemas. `LiteralKit` values keep their
  identity (`fields.kind === DestinationKind`, `.is.box` works) and field
  annotations (`identifier`, `description`) survive on `fields.<name>.ast`.
- The class is a `Schema.TaggedClass`; its AST annotation `identifier` is the
  event tag. beta.85 `Domain.Event(tag, fields, { attributes })` has no class
  annotation slot; `attributes` is the telemetry projection (D17 PII audit
  point: nothing from a payload is traced unless `attributes` returns it).
- `$I.annoteSchema` applies to the field schemas we author; it cannot wrap the
  event class itself without losing the `Domain.Event` static surface. Rule:
  annotate the value schemas, name the class by its tag.

## 2. Envelope survival and provenance (D10, rabbit hole 4)

The kernel envelope is exactly `{ id, stream, seq, at, commandId,
correlationId, trace? }` (`EnvelopeJson` in the installed `Platform.ts`). The
request context is **not** in it. What a Platform driver does receive, on every
`AggregateStore.send(id, command, meta)`, is `meta.context`: the encoded
`RequestContext` services present in the sender's fiber, keyed by service key
(spike output: `{"Spike/CurrentActor": {"principal": "user_123", "sourceKind":
"user"}}`), plus `commandId`, `correlationId` and `trace`.

Consequence for D10: Session middleware provides a `RequestContext` (principal,
source kind); the Postgres driver persists `meta.context` in its own columns
next to the command receipt and copies principal/source kind onto each stored
event row. The kernel envelope stays alchemy-shaped, so `CatchUp`/`Backfill`
replay (which hands the driver's own stored rows back to `kit.replay`) carries
the provenance columns untouched. Audit reads come from the driver's rows, as
D10 wants.

## 3. Event schema version slot (D12, rabbit hole 5)

No version slot exists on the wire event or the envelope in beta.85. Decision
(agent-decided, see the decision files): the version is a static on the event
class (`static readonly schemaVersion = 2`, default 1 when absent); the driver
reads it from `aggregate.definition.events` when the model is hosted, stamps a
`schema_version` column at write, and applies the class's upcaster chain to the
stored JSON at read, before the kernel decodes it. Genesis-import rows are
written with version 1.

## 4. Postgres replay and durable sagas (D1, D6, rabbit holes 2 and 6)

- `Platform` is a `Context.Service` with one method, `model(hosted)`, returning
  a `ModelHost` whose five factories (`aggregate`, `view`, `policy`,
  `projection`, `stream`) return stores; `start`/`history` are the catch-up
  hooks. The kernel owns decide/evolve/route (`AggregateKit.handle`); the driver
  owns single-writer-per-id, `commandId` dedupe, atomic persistence of events,
  state, receipt and deliveries, then at-least-once ordered delivery.
- Replay reuses upstream machinery. beta.85 `Backfill` is abstracted over three
  small driver contracts, `Backfill.Storage` (get/put/delete/list by key
  prefix + `exclusive`), `Backfill.Jobs` (`schedule(id, afterMillis)`,
  idempotent, at least once) and `Backfill.Network` (routing between source,
  scanner, consumer, node, relay and run roles); `InMemory` implements them with
  Maps and a work queue, not with Durable Objects. The Postgres driver
  implements `Storage` as a per-address KV table, `Jobs` as a due-job table
  drained by a `FOR UPDATE SKIP LOCKED` worker, and `Network` in-process, so
  catch-up and backfill run on Postgres unchanged. The brief's "Backfill is
  Cloudflare-shaped" worry applied to the Durable Object hosting, not to the
  kernel.
- `InMemory` provides `Platform | WorkflowEngine`. For Postgres the engine is
  `effect/cluster/ClusterWorkflowEngine.layer` (needs `Sharding |
  MessageStorage`), provided by `effect/cluster/SingleRunner.layer()`
  (`SqlMessageStorage` + `SqlRunnerStorage` over `SqlClient`). The driver Layer
  therefore provides `Platform | WorkflowEngine` over a `PgClient`.
- Tests: `@beep/pglite` ships `PgliteTestLayer`, so the conformance suite runs
  the same scenarios on `Domain.InMemory` and on a PGlite-backed Postgres
  dialect in-process; a real-Postgres integration project reuses the suite. The
  crash-and-resume saga test is an acceptance item for P1/P2.

## 5. Strict optional typing (new finding)

Under the repo's `exactOptionalPropertyTypes: true`, `Domain.Model({ aggregates:
[Account] })` rejects any aggregate without a `read` contract: beta.85
`Aggregate.Resolved.read` is `R` (possibly `undefined`) while `AnyDefinition.read?`
is optional. Upstream HEAD restructured `Resolved` and no longer has the field.
Fix: a one-line bun patch, `patches/@alchemy.run%2Fdomain@2.0.0-beta.85.patch`,
makes `read` optional in both `lib/Aggregate.d.ts` and `src/Aggregate.ts`
(repo precedent: `patches/effect@4.1.2.patch`). It disappears at the next
lockstep bump.

## 6. Driver package location (SPEC target surface)

`@beep/alchemy-postgres` at `packages/drivers/alchemy-postgres`, family
`drivers` (`standards/ARCHITECTURE.md` lists Postgres, message storage and
workflow engines as driver concerns). Created with `bun run beep create-package`.
