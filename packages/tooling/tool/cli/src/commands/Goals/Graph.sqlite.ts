/**
 * In-memory SQLite engine for the goals capability graph.
 *
 * **Details**
 *
 * The projection's four row families load into a disposable `:memory:`
 * database; availability, fog, frontier, cycles, and unlock walks are SQL
 * (recursive CTEs for the last two). {@link queryCapabilityGraph} is written
 * against the `SqlClient` service only. {@link GraphSqliteLive} supplies a
 * fresh in-memory database: `@effect/sql-sqlite-bun` (`bun:sqlite`) on Bun,
 * which is every CLI run, and `@effect/sql-sqlite-node` (`node:sqlite`) only
 * when the module is loaded by Node (the coverage lane's test workers). Both
 * clients load by dynamic import, so the CLI module graph stays loadable on
 * either runtime. Query rows decode through schemas at the boundary.
 *
 * SQL is never trusted on its own: the differential test compares every answer
 * against the pure-TypeScript reference evaluator over the sealed fixtures in
 * several insertion orders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { GoalGraphOperationalError } from "./Goals.errors.ts";
import { CapabilitySlug } from "./Goals.schemas.ts";
import { groupCycles } from "./Graph.projection.ts";
import { CapabilityGraphAnswers, PacketUnlockWalk, UnlockDepth } from "./Graph.schemas.ts";
import type { SqlError } from "effect/sql/SqlError";
import type { CapabilityProjection, GraphPacketRow } from "./Graph.schemas.ts";

const SCHEMA_SQL: ReadonlyArray<string> = [
  "PRAGMA foreign_keys = ON",
  "CREATE TABLE packets (packet_id TEXT PRIMARY KEY, status TEXT NOT NULL, execution_capable INTEGER NOT NULL)",
  "CREATE TABLE capabilities (capability_slug TEXT PRIMARY KEY)",
  `CREATE TABLE provides_edges (
    provider_packet_id TEXT NOT NULL REFERENCES packets (packet_id),
    capability_slug TEXT NOT NULL REFERENCES capabilities (capability_slug),
    PRIMARY KEY (provider_packet_id, capability_slug)
  )`,
  `CREATE TABLE requires_edges (
    consumer_packet_id TEXT NOT NULL REFERENCES packets (packet_id),
    capability_slug TEXT NOT NULL REFERENCES capabilities (capability_slug),
    PRIMARY KEY (consumer_packet_id, capability_slug)
  )`,
];

// Shared CTEs: `avail` = capabilities with a completed-retained provider;
// `cand` = consumer -> candidate-provider edges for unavailable requirements,
// where a candidate provider is still buildable but unfinished.
const GRAPH_CTES = `
  avail (cap) AS (
    SELECT DISTINCT p.capability_slug
    FROM provides_edges p
    JOIN packets k ON k.packet_id = p.provider_packet_id
    WHERE k.status = 'completed-retained'
  ),
  cand (consumer, provider) AS (
    SELECT DISTINCT r.consumer_packet_id, p.provider_packet_id
    FROM requires_edges r
    JOIN provides_edges p ON p.capability_slug = r.capability_slug
    JOIN packets k ON k.packet_id = p.provider_packet_id
    WHERE r.capability_slug NOT IN (SELECT cap FROM avail)
      AND k.status IN ('active', 'paused')
  )`;

const AVAILABLE_SQL = `WITH ${GRAPH_CTES} SELECT cap AS capability FROM avail ORDER BY cap`;

const FOG_SQL = `
  SELECT DISTINCT r.capability_slug AS capability
  FROM requires_edges r
  WHERE NOT EXISTS (
    SELECT 1
    FROM provides_edges p
    JOIN packets k ON k.packet_id = p.provider_packet_id
    WHERE p.capability_slug = r.capability_slug
      AND k.status IN ('active', 'paused', 'completed-retained')
  )
  ORDER BY r.capability_slug`;

const FRONTIER_SQL = `
  WITH ${GRAPH_CTES}
  SELECT k.packet_id AS slug
  FROM packets k
  WHERE k.status = 'active'
    AND k.execution_capable = 1
    AND NOT EXISTS (
      SELECT 1 FROM requires_edges r
      WHERE r.consumer_packet_id = k.packet_id
        AND r.capability_slug NOT IN (SELECT cap FROM avail)
    )
  ORDER BY k.packet_id`;

// `UNION` over a finite (src, dst) set terminates; a member's root is the least
// slug it reaches and is reached by, which includes itself.
const CYCLES_SQL = `
  WITH RECURSIVE ${GRAPH_CTES},
  reach (src, dst) AS (
    SELECT consumer, provider FROM cand
    UNION
    SELECT r.src, c.provider FROM reach r JOIN cand c ON c.consumer = r.dst
  )
  SELECT a.src AS member, MIN(a.dst) AS root
  FROM reach a
  JOIN reach b ON b.src = a.dst AND b.dst = a.src
  GROUP BY a.src
  ORDER BY a.src`;

// Depth is bounded by the packet count, so the `UNION` stays finite; the
// minimum depth per (target, slug) is the breadth-first depth.
const WALKS_SQL = `
  WITH RECURSIVE ${GRAPH_CTES},
  walk (target, slug, depth) AS (
    SELECT consumer, provider, 1 FROM cand
    UNION
    SELECT w.target, c.provider, w.depth + 1
    FROM walk w
    JOIN cand c ON c.consumer = w.slug
    WHERE w.depth < (SELECT COUNT(*) FROM packets)
  )
  SELECT target, slug, MIN(depth) AS depth
  FROM walk
  GROUP BY target, slug
  ORDER BY target, depth, slug`;

const CapabilityRows = S.Array(S.Struct({ capability: CapabilitySlug }));
const SlugRows = S.Array(S.Struct({ slug: S.String }));
const CycleRows = S.Array(S.Struct({ member: S.String, root: S.String }));
const WalkRows = S.Array(S.Struct({ target: S.String, slug: S.String, depth: S.Int }));

const CAUSE_CHAIN_DEPTH = 5;

const ownMessage = (cause: unknown): O.Option<string> =>
  P.hasProperty(cause, "message") && P.isString(cause.message) && Str.isNonEmpty(cause.message)
    ? O.some(cause.message)
    : O.none();

// SqlError's own message is generic ("Failed to execute statement"); the driver's
// text (e.g. "FOREIGN KEY constraint failed") sits further down the cause chain.
const causeMessages = (cause: unknown, depth: number): ReadonlyArray<string> =>
  depth >= CAUSE_CHAIN_DEPTH || P.isNullish(cause)
    ? []
    : [
        ...O.toArray(ownMessage(cause)),
        ...causeMessages(P.hasProperty(cause, "cause") ? cause.cause : undefined, depth + 1),
      ];

const causeMessage = (cause: unknown): string => {
  const messages = A.dedupe(causeMessages(cause, 0));
  return A.isReadonlyArrayNonEmpty(messages) ? A.join(messages, ": ") : String(cause);
};

const engineError = (cause: unknown): GoalGraphOperationalError =>
  GoalGraphOperationalError.make({
    message: `The in-memory capability-graph engine failed: ${causeMessage(cause)}`,
    cause,
  });

const isGraphError = S.is(GoalGraphOperationalError);

const asGraphError = (cause: unknown): GoalGraphOperationalError => (isGraphError(cause) ? cause : engineError(cause));

const statement = Effect.fn("Goals.graphStatement")(function* (sql: string, params?: ReadonlyArray<unknown>) {
  const client = yield* SqlClient.SqlClient;
  return yield* client.unsafe(sql, params).pipe(Effect.mapError(engineError));
});

const loadProjection = Effect.fn("Goals.loadGraphProjection")(function* (projection: CapabilityProjection) {
  const client = yield* SqlClient.SqlClient;
  yield* Effect.forEach(SCHEMA_SQL, (sql) => statement(sql), { discard: true });
  yield* client
    .withTransaction(
      Effect.gen(function* () {
        yield* Effect.forEach(
          projection.packets,
          (packet) =>
            statement("INSERT INTO packets (packet_id, status, execution_capable) VALUES (?, ?, ?)", [
              packet.packetId,
              packet.status,
              packet.executionCapable ? 1 : 0,
            ]),
          { discard: true }
        );
        yield* Effect.forEach(
          projection.capabilities,
          (capability) => statement("INSERT INTO capabilities (capability_slug) VALUES (?)", [capability]),
          { discard: true }
        );
        yield* Effect.forEach(
          projection.provides,
          (edge) =>
            statement("INSERT INTO provides_edges (provider_packet_id, capability_slug) VALUES (?, ?)", [
              edge.packetId,
              edge.capability,
            ]),
          { discard: true }
        );
        yield* Effect.forEach(
          projection.requires,
          (edge) =>
            statement("INSERT INTO requires_edges (consumer_packet_id, capability_slug) VALUES (?, ?)", [
              edge.packetId,
              edge.capability,
            ]),
          { discard: true }
        );
      })
    )
    .pipe(Effect.mapError(asGraphError));
});

const selectRows = <A, I>(sql: string, schema: S.Codec<A, I>) =>
  statement(sql).pipe(Effect.flatMap((rows) => S.decodeUnknownEffect(schema)(rows).pipe(Effect.mapError(engineError))));

const walksFor = (
  projection: CapabilityProjection,
  rows: ReadonlyArray<{ readonly target: string; readonly slug: string; readonly depth: number }>
): ReadonlyArray<PacketUnlockWalk> => {
  const byTarget = A.groupBy(rows, (row) => row.target);
  const packets = A.sort(
    projection.packets,
    Order.mapInput(Order.String, (packet: GraphPacketRow) => packet.packetId)
  );
  return A.map(packets, (packet) =>
    PacketUnlockWalk.make({
      slug: packet.packetId,
      steps: pipe(
        R.get(byTarget, packet.packetId),
        O.map(A.map((row) => UnlockDepth.make({ slug: row.slug, depth: row.depth }))),
        O.getOrElse(A.empty<UnlockDepth>)
      ),
    })
  );
};

/**
 * Answers the capability-graph questions over the provided SQL database.
 *
 * **Details**
 *
 * Loads the projection into the `SqlClient` database in one transaction and
 * runs the five queries. The database must be empty: build a fresh
 * {@link GraphSqliteLive} per call, or use {@link runCapabilityGraph}. Row
 * decode failures and statement failures are {@link GoalGraphOperationalError}.
 *
 * **Example** (Build the query effect for an empty projection)
 *
 * ```ts
 * import { queryCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.sqlite"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(Effect.isEffect(queryCapabilityGraph(projection))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const queryCapabilityGraph = Effect.fn("Goals.queryCapabilityGraph")(function* (
  projection: CapabilityProjection
) {
  yield* loadProjection(projection);
  const available = yield* selectRows(AVAILABLE_SQL, CapabilityRows);
  const fog = yield* selectRows(FOG_SQL, CapabilityRows);
  const frontier = yield* selectRows(FRONTIER_SQL, SlugRows);
  const cycles = yield* selectRows(CYCLES_SQL, CycleRows);
  const walks = yield* selectRows(WALKS_SQL, WalkRows);
  return CapabilityGraphAnswers.make({
    available: A.map(available, (row) => row.capability),
    fog: A.map(fog, (row) => row.capability),
    frontier: A.map(frontier, (row) => row.slug),
    cycles: groupCycles(cycles),
    unlock: walksFor(projection, walks),
  });
});

const IN_MEMORY = { filename: ":memory:" } as const;

const loadSqliteLayer = Effect.gen(function* () {
  if (P.hasProperty(process.versions, "bun")) {
    const bun = yield* Effect.tryPromise({
      try: () => import("@effect/sql-sqlite-bun/SqliteClient"),
      catch: engineError,
    });
    return bun.layer(IN_MEMORY);
  }
  const node = yield* Effect.tryPromise({
    try: () => import("@effect/sql-sqlite-node/SqliteClient"),
    catch: engineError,
  });
  return node.layer(IN_MEMORY);
});

/**
 * A fresh in-memory SQLite database for one capability-graph run.
 *
 * **Details**
 *
 * Selects the client by runtime: `bun:sqlite` under Bun, `node:sqlite` under
 * Node. Each `Effect.provide` builds a new database, which closes when the
 * providing scope ends.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { GraphSqliteLive } from "@beep/repo-cli/commands/Goals/Graph.sqlite"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(GraphSqliteLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GraphSqliteLive: Layer.Layer<SqlClient.SqlClient, GoalGraphOperationalError | SqlError> =
  Layer.unwrap(loadSqliteLayer);

/**
 * Answers the capability-graph questions in a fresh in-memory database.
 *
 * **Example** (Build the run effect for an empty projection)
 *
 * ```ts
 * import { runCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.sqlite"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(Effect.isEffect(runCapabilityGraph(projection))) // true
 * ```
 *
 * @param projection - Compiled capability projection.
 * @returns The SQL engine's answers.
 * @category queries
 * @since 0.0.0
 */
export const runCapabilityGraph = Effect.fn("Goals.runCapabilityGraph")(
  function* (projection: CapabilityProjection) {
    const database = yield* Layer.build(GraphSqliteLive);
    return yield* queryCapabilityGraph(projection).pipe(Effect.provideContext(database));
  },
  Effect.scoped,
  Effect.mapError(asGraphError)
);
