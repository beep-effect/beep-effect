/**
 * Conformance of the Postgres platform over an in-process PGlite database.
 * Every build of the platform in this file shares the one database, so a
 * second build of the model sees what the first committed.
 */
import {
  AlchemyPostgresConfig,
  AlchemyPostgresPlatform,
  AlchemyPostgresTables,
  ProvenanceMapping,
} from "@beep/alchemy-postgres";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { conformance } from "./scenarios.ts";

const config = AlchemyPostgresConfig.make({
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

conformance({
  name: "AlchemyPostgresPlatform over PGlite",
  base: PgliteTestLayer,
  platform: AlchemyPostgresPlatform.layer(config),
  durable: true,
  auditEvents,
});
