/**
 * The conformance and consumer suites against the Postgres platform on a
 * given SQL backend, with the storage readers only a Postgres target has.
 */
import {
  AlchemyPostgresConfig,
  AlchemyPostgresPlatform,
  AlchemyPostgresTables,
  BackfillTuning,
  ProvenanceMapping,
} from "@beep/alchemy-postgres";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { consumers } from "./consumers.ts";
import { conformance } from "./scenarios.ts";
import type * as Layer from "effect/Layer";

/** Encodes any JSON value to its JSON text, compiled once. */
const encodeJsonText = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

/** Register both suites for the Postgres platform over `base`, its tables under `tablePrefix`. */
export const postgresSuites = <E>({
  base,
  name,
  tablePrefix = "alchemy_",
}: {
  readonly base: Layer.Layer<SqlClient.SqlClient, E>;
  readonly name: string;
  readonly tablePrefix?: string;
}) => {
  const config = AlchemyPostgresConfig.make({
    tablePrefix,
    pollMillis: 25,
    provenance: O.some(
      ProvenanceMapping.make({
        contextKey: "Conformance/CurrentActor",
        principalField: "principal",
        sourceKindField: "sourceKind",
      })
    ),
  });
  const tables = AlchemyPostgresTables.of(config);

  const AuditRow = S.Struct({
    tag: S.String,
    schema_version: S.Int,
    principal: S.NullOr(S.String),
    source_kind: S.NullOr(S.String),
    context: S.Unknown,
  });
  const decodeAuditRows = S.decodeUnknownEffect(S.Array(AuditRow));

  const auditEvents = Effect.fn("test.auditEvents")(function* (aggregate: string, id: string) {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`SELECT tag, schema_version, principal, source_kind, context
      FROM ${sql(tables.aggregateEvent)}
      WHERE model = 'Conformance' AND aggregate = ${aggregate} AND id = ${id}
      ORDER BY seq`.pipe(Effect.flatMap(decodeAuditRows));
    return A.map(rows, (row) => ({
      tag: row.tag,
      schemaVersion: row.schema_version,
      principal: row.principal,
      sourceKind: row.source_kind,
      context: row.context,
    }));
  }, Effect.orDie);

  const StatusRow = S.Struct({ status: S.String });
  const decodeStatusRows = S.decodeUnknownEffect(S.Array(StatusRow));

  const scheduleStatus = Effect.fn("test.scheduleStatus")(function* (aggregate: string, id: string, commandId: string) {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`SELECT status FROM ${sql(tables.aggregateSchedule)}
      WHERE model = 'Conformance' AND aggregate = ${aggregate} AND id = ${id} AND command_id = ${commandId}`.pipe(
      Effect.flatMap(decodeStatusRows)
    );
    return O.match(A.head(rows), { onNone: () => "missing", onSome: ({ status }) => status });
  }, Effect.orDie);

  conformance({
    name,
    base,
    platform: AlchemyPostgresPlatform.layer(config),
    durable: true,
    redelivers: true,
    auditEvents,
    scheduleStatus,
  });

  /** Write an `Order` event at schema version 1 (before `amount` existed), as an older deploy stored it. */
  const legacyOrder = Effect.fn("test.legacyOrder")(function* (model: string, id: string, json: unknown) {
    const sql = yield* SqlClient.SqlClient;
    const event = yield* encodeJsonText(json);
    const envelope = yield* encodeJsonText({
      id,
      stream: `Order/${id}`,
      seq: 1,
      at: 0,
      commandId: "legacy",
    });
    yield* sql`INSERT INTO ${sql(tables.aggregateInstance)} (model, aggregate, id, state, version)
      VALUES (${model}, 'Order', ${id}, NULL, 1)`;
    yield* sql`INSERT INTO ${sql(tables.aggregateEvent)}
      (model, aggregate, id, seq, tag, event, envelope, schema_version, command_id, context, at)
      VALUES (${model}, 'Order', ${id}, 1, 'OrderPlaced', ${event}::jsonb, ${envelope}::jsonb, 1, 'legacy', '{}'::jsonb, 0)`;
  }, Effect.orDie);

  consumers({
    name,
    base,
    // Catch-up in pages of two over 16 leaves that split at one instance, so a short history
    // spans several reader pages, directory listings and node splits.
    platform: AlchemyPostgresPlatform.layer(
      AlchemyPostgresConfig.make({
        ...config,
        backfill: O.some(BackfillTuning.make({ page: 2, nodePage: 2, apply: 2, leafSize: 1, depth: 1 })),
      })
    ),
    legacyOrder,
    durable: true,
  });
};
