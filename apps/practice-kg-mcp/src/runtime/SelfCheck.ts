/**
 * Headless self-check for an installed practice KG host: proves the bundle and
 * both stores open without speaking MCP.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $PracticeKgMcpId } from "@beep/identity/packages";
import { PracticeKgQueries, PracticeKgSchemaVersions, PracticeKgToolkit } from "@beep/law-practice-server";
import * as OptionUtils from "@beep/utils/Option";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SqlClient } from "effect/sql/SqlClient";
import { PracticeKgHostError, SelfCheckFailure } from "../PracticeKgMcp.errors.ts";
import { PRACTICE_KG_EXTENSION_VERSION } from "../Version.ts";
import { loadPracticeKgBundleContext, makePracticeKgHostResourcesLayer } from "./Host.ts";

const $I = $PracticeKgMcpId.create("runtime/SelfCheck");

/**
 * The single line a passing `--self-check` prints.
 *
 * **Example** (Make a passing report)
 *
 * ```ts
 * import { PracticeKgSelfCheckReport } from "../../src/runtime/SelfCheck.ts"
 * import { PracticeKgSchemaVersions } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * const report = PracticeKgSelfCheckReport.make({
 *   extensionVersion: "0.4.0",
 *   bundleVersion: "2026.08.1",
 *   schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "4", pglite: "4" }),
 *   nodes: S.Natural.make(4),
 *   matters: S.Natural.make(1),
 *   tools: S.Natural.make(9)
 * })
 * console.log(report.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSelfCheckReport extends S.Class<PracticeKgSelfCheckReport>($I`PracticeKgSelfCheckReport`)(
  {
    ok: S.tag(true),
    extensionVersion: S.NonEmptyString,
    bundleVersion: S.NonEmptyString,
    schemaVersion: PracticeKgSchemaVersions,
    nodes: S.Natural,
    matters: S.Natural,
    tools: S.Natural,
  },
  $I.annote("PracticeKgSelfCheckReport", {
    description: "Versions and store counts proving an installed practice KG host can read its bundle.",
  })
) {}

/**
 * The single line a failing `--self-check` prints.
 *
 * **Details**
 *
 * `message` is the stable operator-facing sentence. `cause`, when present, is
 * the underlying error text on one line with no stack trace.
 *
 * **Example** (Make a failing line)
 *
 * ```ts
 * import { PracticeKgSelfCheckRefusal } from "../../src/runtime/SelfCheck.ts"
 *
 * const refusal = PracticeKgSelfCheckRefusal.make({
 *   message: "The matter store could not be opened.",
 *   cause: "IO Error: Could not set lock on file"
 * })
 * console.log(refusal.ok) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSelfCheckRefusal extends S.Class<PracticeKgSelfCheckRefusal>($I`PracticeKgSelfCheckRefusal`)(
  {
    ok: S.tag(false),
    message: S.String,
    cause: S.optionalKey(S.String),
  },
  $I.annote("PracticeKgSelfCheckRefusal", {
    description: "Reason an installed practice KG host could not read its bundle.",
  })
) {}

class CountRow extends S.Class<CountRow>($I`CountRow`)(
  { count: S.Natural },
  $I.annote("CountRow", { description: "Single-row count returned by a self-check store query." })
) {}

const decodeCountRows = S.decodeUnknownEffect(S.NonEmptyArray(CountRow));
const firstCount = (rows: A.NonEmptyReadonlyArray<CountRow>) => A.headNonEmpty(rows).count;
const encodeReport = S.encodeEffect(S.fromJsonString(PracticeKgSelfCheckReport));
const encodeRefusal = S.encodeEffect(S.fromJsonString(PracticeKgSelfCheckRefusal));

const isString = S.is(S.String);
const lineBreaks = /\s*[\r\n]+\s*/g;
const MAX_CAUSE_DEPTH = 5;

// Driver errors carry `message` and `cause` either bare or as an `Option`
// (`PgliteError` holds both as options, `DuckDbError` its cause).
const fieldOf = (error: unknown, key: "cause" | "message"): unknown => {
  const value = P.hasProperty(error, key) ? error[key] : undefined;
  return O.isOption(value) ? O.getOrUndefined(value) : value;
};

// The messages down an error's cause chain as one line: the driver's own words
// ("Could not set lock on file", "not a valid DuckDB database file") without a
// stack trace. A link without a message is passed through, and the walk is
// depth-bounded so a cyclic chain cannot spin.
type CauseStep = readonly [cause: unknown, depth: number];
const nextLink = ([current, depth]: CauseStep): O.Option<readonly [O.Option<string>, CauseStep]> =>
  depth < MAX_CAUSE_DEPTH && P.isObject(current)
    ? O.some([O.liftPredicate(fieldOf(current, "message"), isString), [fieldOf(current, "cause"), depth + 1]])
    : O.none();

const causeLine = (cause: unknown): O.Option<string> =>
  pipe(
    A.getSomes(A.unfold<CauseStep, O.Option<string>>([cause, 0], nextLink)),
    A.map(flow(Str.replace(lineBreaks, " "), Str.trim)),
    A.filter(Str.isNonEmpty),
    A.dedupe,
    A.match({ onEmpty: O.none<string>, onNonEmpty: flow(A.join(" — "), O.some) })
  );

// Prints the refusal line, then fails with the error that tells the main
// runner the failure is already on stdout.
const refuse = (error: PracticeKgHostError) =>
  encodeRefusal(
    PracticeKgSelfCheckRefusal.make({
      message: error.message,
      ...OptionUtils.getSomesStruct({ cause: causeLine(error.cause) }),
    })
  ).pipe(
    Effect.orDie,
    Effect.flatMap(Console.log),
    Effect.andThen(SelfCheckFailure.make({ cause: error, message: error.message }))
  );

// Opening and reading fail for different reasons and call for different fixes,
// so each store is opened with a trivial statement before its columns are
// probed. A lock held by a running host, a corrupt file or a permission error
// stops at the open and is never reported as a bundle to replace.
const openFailure = (store: string, bundleDir: string) => (cause: unknown) =>
  PracticeKgHostError.make({
    cause,
    message: `Practice KG ${store} at "${bundleDir}" could not be opened; check that no other process holds the bundle (close Claude Desktop) and that the store is readable and not corrupt.`,
  });

// A manifest can say store format 3 over tables built for an older format, and a
// bare COUNT would still pass. Each opened store is therefore probed for the
// columns the tools read, so a missing column fails here instead of in a chat.
const SELF_CHECK_REFERENCE = "practice-kg-self-check";

const storeFailure = (store: string, bundleDir: string) => (cause: unknown) =>
  PracticeKgHostError.make({
    cause,
    message: `Practice KG ${store} at "${bundleDir}" does not answer the queries this server's tools run; install the bundle that matches this server.`,
  });

const matterColumnsProbe = `
SELECT m.family_key, m.family, m.client, m.client_name, m.attribution_source, m.epistemic_status,
  m.docket_count, m.document_count, d.docket_key, d.docket, d.epistemic_status, d.document_count,
  d.application_numbers, d.patent_numbers
FROM matters m LEFT JOIN matter_dockets d USING (family_key)
LIMIT 1`;

// The three tables `kg_correspondent_lookup` reads, every column it selects.
const correspondentColumnsProbe = `
SELECT c.family_key, c.address, c.contact_id, c.display_name, c.role_address, c.is_practice_address,
  c.message_count, c.from_count, c.to_count, c.cc_count, c.first_at, c.last_at, c.epistemic_status,
  a.contact_id, a.display_name, a.organization, a.role_address, a.is_practice_address,
  l.client_number, l.family_key, l.source, l.evidence
FROM matter_correspondents c
FULL JOIN contact_addresses a USING (address)
FULL JOIN contact_client_links l ON l.contact_id = a.contact_id
LIMIT 1`;

const GRAPH_STORE = "graph store (kg.pglite)";
const MATTER_STORE = "matter store (practice.duckdb)";

const readGraphStore = Effect.fn("PracticeKgSelfCheck.readGraphStore")(function* (bundleDir: string) {
  const sql = (yield* SqlClient).withoutTransforms();
  yield* sql.unsafe("SELECT 1").pipe(Effect.mapError(openFailure(GRAPH_STORE, bundleDir)));
  // `kg_find` text: selects every graph column the tools project, attribution_source included.
  return yield* sql
    .unsafe(PracticeKgQueries.find, [SELF_CHECK_REFERENCE])
    .pipe(
      Effect.andThen(sql.unsafe("SELECT COUNT(*)::FLOAT8 AS count FROM kg_node")),
      Effect.flatMap(decodeCountRows),
      Effect.map(firstCount),
      Effect.mapError(storeFailure(GRAPH_STORE, bundleDir))
    );
});

const readMatterStore = Effect.fn("PracticeKgSelfCheck.readMatterStore")(function* (bundleDir: string) {
  const duckdb = yield* DuckDb;
  // DuckDB opens the file on its first statement, so this is where a lock or a damaged file shows.
  yield* duckdb.query("SELECT 1").pipe(Effect.mapError(openFailure(MATTER_STORE, bundleDir)));
  // Every column `kg_matter_lookup` reads from both matter tables, `client_name`
  // included, and every column `kg_correspondent_lookup` reads: an older store
  // that lacks one fails here, not in a tool call.
  return yield* duckdb
    .query(matterColumnsProbe)
    .pipe(
      Effect.andThen(duckdb.query(correspondentColumnsProbe)),
      Effect.andThen(duckdb.query(PracticeKgQueries.getDocument, [SELF_CHECK_REFERENCE, null, 1, 1])),
      Effect.andThen(duckdb.query(PracticeKgQueries.searchText, [SELF_CHECK_REFERENCE, null, 1])),
      Effect.andThen(duckdb.query("SELECT CAST(COUNT(*) AS DOUBLE) AS count FROM matters")),
      Effect.flatMap(decodeCountRows),
      Effect.map(firstCount),
      Effect.mapError(storeFailure(MATTER_STORE, bundleDir))
    );
});

const readStoreCounts = Effect.fn("PracticeKgSelfCheck.readStoreCounts")(function* (bundleDir: string) {
  const nodes = yield* readGraphStore(bundleDir);
  const matters = yield* readMatterStore(bundleDir);
  return { matters, nodes };
});

// PGlite initialises a fresh cluster in a folder without `PG_VERSION` (the marker
// it checks itself), and DuckDB treats a zero-byte file as a new database. Either
// would put an empty store inside the bundle, so both are refused before opening;
// a store that cannot even be inspected is reported as one that will not open.
const STORE_MARKERS = {
  graph: { store: GRAPH_STORE, name: "kg.pglite", marker: O.some("PG_VERSION") },
  matter: { store: MATTER_STORE, name: "practice.duckdb", marker: O.none<string>() },
} as const;

type StoreMarker = (typeof STORE_MARKERS)[keyof typeof STORE_MARKERS];

const requireStore = Effect.fn("PracticeKgSelfCheck.requireStore")(function* (bundleDir: string, spec: StoreMarker) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const storePath = path.join(bundleDir, spec.name);
  const uninitialised = PracticeKgHostError.make({
    message: `Practice KG ${spec.store} at "${bundleDir}" is missing or not an initialised store; install the bundle that matches this server.`,
  });
  const initialised = yield* Effect.gen(function* () {
    const info = yield* fs.stat(storePath);
    return yield* O.match(spec.marker, {
      onNone: () => Effect.succeed(info.type === "File" && ByteSize.toBigInt(info.size) > BigInt(0)),
      onSome: (marker) => (info.type === "Directory" ? fs.exists(path.join(storePath, marker)) : Effect.succeed(false)),
    });
  }).pipe(
    Effect.catchIf(
      (error) => P.isTagged(error.reason, "NotFound"),
      () => Effect.succeed(false)
    ),
    Effect.mapError(openFailure(spec.store, bundleDir))
  );
  if (!initialised) {
    return yield* uninitialised;
  }
});

/**
 * Load a bundle exactly as the server does and read each store the way the tools do.
 *
 * **Details**
 *
 * Each store is first checked to be an initialised store (`kg.pglite` holds
 * `PG_VERSION`, `practice.duckdb` is a non-empty file), so the check never
 * creates one. Each is then opened with a trivial statement, then probed for the columns
 * the tools read, then counted. A store that will not open (held by another
 * process, unreadable or corrupt) and a store whose tables are older than the
 * manifest claims are refused with different messages, each naming the store.
 * Document get and text search run their tool SQL, including the full-text index.
 * The stdio entrypoint also runs this check before starting the MCP transport.
 * Only `SELECT` statements run, and both stores close before the report is
 * returned. The stores are the ones `makePracticeKgHostResourcesLayer` hands
 * the stdio server, so a passing report covers the files the server reads.
 *
 * **Example** (Check a bundle folder)
 *
 * ```ts
 * import { runPracticeKgSelfCheck } from "../../src/runtime/SelfCheck.ts"
 * import * as Effect from "effect/Effect";
 * const check = runPracticeKgSelfCheck("/bundle")
 * console.log(Effect.isEffect(check)) // true
 * ```
 *
 * @param bundleDir - Directory containing `bundle.manifest.json` and both stores.
 * @param corpusRoot - Optional pointer to the external corpus content tree.
 * @category use-cases
 * @since 0.0.0
 */
export const runPracticeKgSelfCheck = Effect.fn("PracticeKgSelfCheck.run")(function* (
  bundleDir: string,
  corpusRoot?: string | undefined
) {
  const context = yield* loadPracticeKgBundleContext(bundleDir, corpusRoot);
  yield* requireStore(bundleDir, STORE_MARKERS.graph);
  yield* requireStore(bundleDir, STORE_MARKERS.matter);
  const counts = yield* Layer.build(makePracticeKgHostResourcesLayer(context)).pipe(
    // PGlite opens `kg.pglite` while the layer builds; DuckDB opens on its first statement.
    Effect.mapError(openFailure(GRAPH_STORE, bundleDir)),
    Effect.flatMap((resources) => readStoreCounts(bundleDir).pipe(Effect.provide(resources))),
    Effect.scoped
  );
  return PracticeKgSelfCheckReport.make({
    extensionVersion: PRACTICE_KG_EXTENSION_VERSION,
    bundleVersion: context.manifest.bundleVersion,
    schemaVersion: context.manifest.schemaVersion,
    nodes: counts.nodes,
    matters: counts.matters,
    tools: S.Natural.make(A.length(R.keys(PracticeKgToolkit.tools))),
  });
});

/**
 * Print a self-check outcome as exactly one JSON line on stdout.
 *
 * **Details**
 *
 * A failing check prints `{"ok":false,"message":…}`, with the underlying
 * error text under `cause` when there is one, and then fails with
 * `SelfCheckFailure`, which exits the process non-zero without a second
 * report: nothing but the one line reaches stdout.
 *
 * **Example** (Print a self-check line)
 *
 * ```ts
 * import { printPracticeKgSelfCheck, runPracticeKgSelfCheck } from "../../src/runtime/SelfCheck.ts"
 * import * as Effect from "effect/Effect";
 * const printing = printPracticeKgSelfCheck(runPracticeKgSelfCheck("/bundle"))
 * console.log(Effect.isEffect(printing)) // true
 * ```
 *
 * @param check - Self-check to run and report.
 * @category use-cases
 * @since 0.0.0
 */
export const printPracticeKgSelfCheck = <R>(
  check: Effect.Effect<PracticeKgSelfCheckReport, PracticeKgHostError, R>
): Effect.Effect<void, SelfCheckFailure, R> =>
  check.pipe(
    // Both lines encode values their schemas already validated, so an encode failure is a defect.
    Effect.flatMap(flow(encodeReport, Effect.orDie)),
    Effect.matchEffect({ onFailure: refuse, onSuccess: Console.log }),
    Effect.withSpan("PracticeKgSelfCheck.print")
  );
