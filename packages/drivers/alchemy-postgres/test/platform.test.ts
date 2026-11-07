/**
 * Postgres platform behaviour outside the shared conformance suite: what it
 * refuses to host, its migrations, its default configuration and how it treats
 * a stored row it cannot read.
 */
import * as Domain from "@alchemy.run/domain";
import { Internals } from "@alchemy.run/domain/Model";
import {
  AlchemyPostgresConfig,
  AlchemyPostgresError,
  AlchemyPostgresPlatform,
  AlchemyPostgresTables,
  migrate,
} from "@beep/alchemy-postgres";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const CardId = S.String.pipe(S.brand("UnitCardId"));
class CardIssued extends Domain.Event("CardIssued", { holder: S.String }) {}
class IssueCard extends Domain.Command("IssueCard", {
  target: CardId,
  input: { holder: S.String },
  events: [CardIssued],
}) {}
class Card extends Domain.Aggregate("Card", {
  id: CardId,
  state: S.Union([S.TaggedStruct("Blank", {}), S.TaggedStruct("Issued", { holder: S.String })]),
  initial: { _tag: "Blank" },
  commands: [IssueCard],
  decide: { IssueCard: (_state, command) => [CardIssued.make({ holder: command.holder })] },
  evolve: { CardIssued: (_state, event) => ({ _tag: "Issued" as const, holder: event.holder }) },
}) {}
/** Audit runs by card id; the first run for a `flaky-*` card dies. */
const audits = MutableHashMap.empty<string, number>();
const auditsOf = (id: string) => O.getOrElse(MutableHashMap.get(audits, id), () => 0);
class CardAudit extends Domain.Policy("CardAudit", { from: Card, on: [CardIssued] }) {}
const CardAuditLive = CardAudit.toLayer(
  Effect.succeed(
    Effect.fn(function* ({ source }) {
      const run = auditsOf(source.id) + 1;
      MutableHashMap.set(audits, source.id, run);
      if (Str.startsWith("flaky-")(source.id) && run === 1) return yield* Effect.die("flaky audit");
    })
  )
);
class Unit extends Domain.Model("Unit", { aggregates: [Card], policies: [CardAudit] }) {}

/** The squashed defect of a cause, when it is an instance of `schema`. */
const defectOf =
  <Schema extends S.Top>(schema: Schema) =>
  <E>(cause: Cause.Cause<E>) =>
    cause.pipe(Cause.squash, O.fromNullishOr, O.filter(S.is(schema)));

const TableName = S.Struct({ tablename: S.String });
/** Decode the rows a SQL statement returned. */
const rowsOf = <Schema extends S.Codec<unknown>>(row: Schema) => S.decodeUnknownEffect(S.Array(row));
const decodeTableNames = rowsOf(TableName);

const OutboxRow = S.Struct({ status: S.String, attempts: S.Int, locked_until: S.Int });
const decodeOutboxRows = rowsOf(OutboxRow);

const StoredRow = S.Struct({ principal: S.NullOr(S.String), source_kind: S.NullOr(S.String) });
const decodeStoredRows = rowsOf(StoredRow);

// Default configuration: `alchemy_` tables and no provenance mapping.
const hosted = Unit.layer(CardAuditLive).pipe(
  Layer.provideMerge(AlchemyPostgresPlatform.layer()),
  Layer.provideMerge(PgliteTestLayer)
);

describe("AlchemyPostgresPlatform", () => {
  layer(hosted, { timeout: "30 seconds", excludeTestServices: true, concurrent: false })("on PGlite", (it) => {
    it.effect("migrates idempotently under a custom table prefix", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const config = AlchemyPostgresConfig.make({ tablePrefix: "custom_" });
        yield* migrate(config);
        yield* migrate(config);
        const rows =
          yield* sql`SELECT tablename FROM pg_tables WHERE tablename LIKE 'custom\\_%' ORDER BY tablename`.pipe(
            Effect.flatMap(decodeTableNames)
          );
        const tables = AlchemyPostgresTables.of(config);
        deepStrictEqual(
          A.map(rows, ({ tablename }) => tablename),
          A.sort(
            [
              tables.aggregateEvent,
              tables.aggregateInstance,
              tables.aggregateReceipt,
              tables.aggregateSchedule,
              tables.delivery,
              tables.hostedModel,
              tables.consumerGeneration,
              tables.consumerInput,
              tables.viewKey,
              tables.viewEntry,
              tables.projectionPartition,
              tables.streamKey,
              tables.streamEntry,
              tables.backfillKv,
              tables.backfillJob,
            ],
            Order.String
          )
        );
      })
    );

    it.effect("fails migrate with an AlchemyPostgresError when a table name is taken by another relation", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        // A view under the outbox's name: CREATE TABLE IF NOT EXISTS skips it, its index cannot.
        yield* sql`CREATE VIEW broken_delivery AS SELECT 1 AS position`;
        const error = yield* migrate(AlchemyPostgresConfig.make({ tablePrefix: "broken_" })).pipe(Effect.flip);
        deepStrictEqual([error._tag, error.operation], ["AlchemyPostgresError", "migrate"]);
      })
    );

    it.effect("leaves outbox rows of an aggregate this host does not run for a host that does", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`INSERT INTO alchemy_delivery
          (model, producer, source, source_seq, target_kind, target_name, target_key, delivery, status, at)
          VALUES ('Unit', 'Ghost', 'Ghost/g-1', 1, 'policy', 'Haunting', 'Ghost/g-1', '{}'::jsonb, 'pending', 0)`;
        const cards = yield* Card;
        yield* cards.send(CardId.make("wakes-the-worker"), IssueCard.make({ holder: "quin" }));
        yield* Effect.sleep(Duration.millis(600));
        const rows = yield* sql`SELECT status, attempts, locked_until FROM alchemy_delivery
          WHERE model = 'Unit' AND producer = 'Ghost'`.pipe(Effect.flatMap(decodeOutboxRows));
        deepStrictEqual(rows, [{ status: "pending", attempts: 0, locked_until: 0 }]);
      })
    );

    it.effect("a failed delivery frees the rest of its batch for the next pass", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const cards = yield* Card;
        const flaky = CardId.make("flaky-batch");
        const steady = CardId.make("steady-batch");
        // One transaction: both outbox rows become visible together, so one pass claims both.
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* cards.send(flaky, IssueCard.make({ holder: "rae" }));
            yield* cards.send(steady, IssueCard.make({ holder: "sol" }));
          })
        );
        const runs = yield* Effect.sync(() => [auditsOf(flaky), auditsOf(steady)]).pipe(
          Effect.repeat({
            until: ([first, second]) => first === 2 && second === 1,
            schedule: Schedule.spaced(Duration.millis(20)),
          }),
          Effect.timeout(Duration.seconds(3))
        );
        deepStrictEqual(runs, [2, 1]);
      })
    );

    it.effect("leaves the provenance columns empty without a provenance mapping", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const cards = yield* Card;
        const id = CardId.make("plain");
        yield* cards.send(id, IssueCard.make({ holder: "pat" }));
        const rows = yield* sql`SELECT principal, source_kind FROM alchemy_aggregate_event
          WHERE model = 'Unit' AND aggregate = 'Card' AND id = ${id}`.pipe(Effect.flatMap(decodeStoredRows));
        deepStrictEqual(rows, [{ principal: null, source_kind: null }]);
      })
    );

    it.effect("dies with an AlchemyPostgresError naming the read when a stored event is unreadable", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const internals = yield* Internals;
        const store = yield* Effect.fromOption(O.fromUndefinedOr(internals.aggregates.get("Card")));
        const events = yield* Effect.fromOption(O.fromUndefinedOr(store.events));
        const id = CardId.make("corrupt");
        yield* sql`INSERT INTO alchemy_aggregate_event
          (model, aggregate, id, seq, tag, event, envelope, command_id, context, at)
          VALUES ('Unit', 'Card', ${id}, 1, 'CardIssued', '{"_tag":"CardIssued"}'::jsonb,
            '{"seq":"not a number"}'::jsonb, 'c-1', '{}'::jsonb, 0)`;
        const cause = yield* events(id).pipe(Effect.sandbox, Effect.flip);
        const defect = cause.pipe(defectOf(AlchemyPostgresError));
        deepStrictEqual(
          defect.pipe(O.map(({ operation, table }) => [operation, table.pipe(O.getOrNull)])),
          O.some(["read", "alchemy_aggregate_event"])
        );
      })
    );
  });
});
