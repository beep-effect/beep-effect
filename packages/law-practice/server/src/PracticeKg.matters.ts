/**
 * Matter tables and the matter-lookup service over a practice knowledge-graph
 * bundle's DuckDB store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { KgAttributionSource, PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  PracticeKgMatter,
  PracticeKgMatterDocket,
  PracticeKgMatterLookupError,
  PracticeKgMatterLookupResult,
  PracticeKgMatterMatchedOn,
} from "@beep/law-practice-use-cases/server";
import * as O from "@beep/utils/Option";
import { Context, Effect, Layer, MutableHashMap, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { PracticeKgBundle } from "./PracticeKg.host.ts";
import { PracticeKgDocketRegisterRow, practiceKgRegisterClientNames } from "./PracticeKg.register.ts";
import { withDuckDb } from "./PracticeKg.rows.ts";
import { PracticeKgEdgeRow, PracticeKgNodeRow } from "./PracticeKg.schemas.ts";
import type { PracticeKgMatterLookupRequest } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("PracticeKg.matters");

/**
 * One row of the bundle's `matters` table: a client-keyed docket family.
 *
 * **Example** (Make a matter row)
 *
 * ```ts
 * import { PracticeKgMatterRow } from "../../src/PracticeKg.matters.ts"
 *
 * const row = PracticeKgMatterRow.make({
 *   attributionSource: "text-reference",
 *   client: "12345",
 *   clientName: "Example Client",
 *   docketCount: 1,
 *   documentCount: 4,
 *   epistemicStatus: "derived-from-official-records",
 *   family: "10008",
 *   familyKey: "12345.10008"
 * })
 * console.log(row.familyKey) // "12345.10008"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgMatterRow extends S.Class<PracticeKgMatterRow>($I`PracticeKgMatterRow`)(
  {
    attributionSource: KgAttributionSource,
    client: S.NullOr(S.String),
    clientName: S.NullOr(S.String),
    docketCount: S.Finite,
    documentCount: S.Finite,
    epistemicStatus: PracticeKgEpistemicStatus,
    family: S.NonEmptyString,
    familyKey: S.NonEmptyString,
  },
  $I.annote("PracticeKgMatterRow", {
    description: "Client-keyed docket family as persisted in the bundle DuckDB matters table.",
  })
) {}

/**
 * One row of the bundle's `matter_dockets` table: a docket and the USPTO
 * numbers filed from it.
 *
 * **Example** (Make a matter docket row)
 *
 * ```ts
 * import { PracticeKgMatterDocketRow } from "../../src/PracticeKg.matters.ts"
 *
 * const row = PracticeKgMatterDocketRow.make({
 *   applicationNumbers: ["14783547"],
 *   docket: "10008US01",
 *   docketKey: "12345.10008US01",
 *   documentCount: 4,
 *   epistemicStatus: "derived-from-official-records",
 *   familyKey: "12345.10008",
 *   patentNumbers: []
 * })
 * console.log(row.docket) // "10008US01"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgMatterDocketRow extends S.Class<PracticeKgMatterDocketRow>($I`PracticeKgMatterDocketRow`)(
  {
    applicationNumbers: S.Array(S.String),
    docket: S.NonEmptyString,
    docketKey: S.NonEmptyString,
    documentCount: S.Finite,
    epistemicStatus: PracticeKgEpistemicStatus,
    familyKey: S.NonEmptyString,
    patentNumbers: S.Array(S.String),
  },
  $I.annote("PracticeKgMatterDocketRow", {
    description: "Docket of a matter with its application and patent numbers, as persisted in matter_dockets.",
  })
) {}

/**
 * Matter and docket rows derived from one projected graph.
 *
 * **Example** (Make empty matter tables)
 *
 * ```ts
 * import { PracticeKgMatterTables } from "../../src/PracticeKg.matters.ts"
 *
 * const tables = PracticeKgMatterTables.make({ dockets: [], matters: [] })
 * console.log(tables.matters.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgMatterTables extends S.Class<PracticeKgMatterTables>($I`PracticeKgMatterTables`)(
  {
    dockets: S.Array(PracticeKgMatterDocketRow),
    matters: S.Array(PracticeKgMatterRow),
  },
  $I.annote("PracticeKgMatterTables", {
    description: "Rows for the bundle's matters and matter_dockets tables.",
  })
) {}

/**
 * The projected graph a matter table is derived from, with the register rows
 * that name its clients.
 *
 * **Example** (Make an empty graph input)
 *
 * ```ts
 * import { PracticeKgMatterGraph } from "../../src/PracticeKg.matters.ts"
 *
 * const graph = PracticeKgMatterGraph.make({ edges: [], nodes: [] })
 * console.log(graph.nodes.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgMatterGraph extends S.Class<PracticeKgMatterGraph>($I`PracticeKgMatterGraph`)(
  {
    edges: S.Array(PracticeKgEdgeRow),
    nodes: S.Array(PracticeKgNodeRow),
    registerRows: S.Array(PracticeKgDocketRegisterRow).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<PracticeKgDocketRegisterRow>()))
    ),
  },
  $I.annote("PracticeKgMatterGraph", {
    description: "Projected graph nodes and edges, plus docket-register rows, used to derive the matter tables.",
  })
) {}

const listSeparator = " | ";

const appendTo = <Value>(
  map: MutableHashMap.MutableHashMap<string, ReadonlyArray<Value>>,
  key: string,
  value: Value
): void => {
  MutableHashMap.set(map, key, A.append(pipe(MutableHashMap.get(map, key), O.getOrElse(A.empty<Value>)), value));
};

const valuesAt = <Value>(
  map: MutableHashMap.MutableHashMap<string, ReadonlyArray<Value>>,
  key: string
): ReadonlyArray<Value> => pipe(MutableHashMap.get(map, key), O.getOrElse(A.empty<Value>));

const sortedUnique = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(values), Order.String);

// A client-keyed docket is `<client>.<docket>`; an unattributed one is the bare code.
const bareDocketOf = (node: PracticeKgNodeRow): string =>
  pipe(
    O.fromNullishOr(node.client),
    O.match({
      onNone: () => node.naturalKey,
      onSome: (client) => Str.slice(Str.length(client) + 1)(node.naturalKey),
    })
  );

/**
 * Derive the `matters` and `matter_dockets` rows from a projected graph.
 *
 * **Details**
 *
 * A matter is one `docket_family` node; its dockets are the targets of its
 * `has_docket` edges. A docket's application numbers are its `files_as`
 * targets and its patent numbers are those applications' `granted_as` targets
 * plus any patent filed directly. Mention-only anchors never appear: only
 * membership edges are read. A matter's `clientName` is the name the docket
 * register gives its client number, and null when the register does not name
 * the client or names it more than one way. Rows are ordered by key so a
 * rebuild is stable.
 *
 * **Example** (Derive from an empty graph)
 *
 * ```ts
 * import { buildMatterTables, PracticeKgMatterGraph } from "../../src/PracticeKg.matters.ts"
 *
 * const tables = buildMatterTables(PracticeKgMatterGraph.make({ edges: [], nodes: [] }))
 * console.log(tables.dockets.length) // 0
 * ```
 *
 * @param graph - Projected nodes and edges, with the register rows that name clients.
 * @returns Ordered matter and docket rows.
 * @category use-cases
 * @since 0.0.0
 */
export const buildMatterTables = (graph: PracticeKgMatterGraph): PracticeKgMatterTables => {
  const nodeByIri = MutableHashMap.fromIterable(A.map(graph.nodes, (node) => [node.iri, node] as const));
  const targetsBySubject = MutableHashMap.empty<string, ReadonlyArray<PracticeKgEdgeRow>>();
  A.forEach(graph.edges, (edge) => appendTo(targetsBySubject, `${edge.predicate}\u0000${edge.subjectIri}`, edge));
  const targetNodes = (
    predicate: PracticeKgEdgeRow["predicate"],
    subjectIri: string
  ): ReadonlyArray<PracticeKgNodeRow> =>
    A.getSomes(
      A.map(valuesAt(targetsBySubject, `${predicate}\u0000${subjectIri}`), (edge) =>
        MutableHashMap.get(nodeByIri, edge.objectIri)
      )
    );
  const targetCount = (predicate: PracticeKgEdgeRow["predicate"], subjectIri: string): number =>
    A.length(valuesAt(targetsBySubject, `${predicate}\u0000${subjectIri}`));

  const docketRowFor = (familyKey: string, docket: PracticeKgNodeRow): PracticeKgMatterDocketRow => {
    const anchors = targetNodes("files_as", docket.iri);
    const applications = A.filter(anchors, (anchor) => anchor.kind === "application");
    const patents = A.appendAll(
      A.filter(anchors, (anchor) => anchor.kind === "patent"),
      A.flatMap(applications, (application) => targetNodes("granted_as", application.iri))
    );
    return PracticeKgMatterDocketRow.make({
      applicationNumbers: sortedUnique(A.map(applications, (application) => application.naturalKey)),
      docket: bareDocketOf(docket),
      docketKey: docket.naturalKey,
      documentCount: targetCount("has_document", docket.iri),
      epistemicStatus: docket.epistemicStatus,
      familyKey,
      patentNumbers: sortedUnique(A.map(patents, (patent) => patent.naturalKey)),
    });
  };

  const clientNameOf = practiceKgRegisterClientNames(graph.registerRows);
  const families = A.filter(graph.nodes, (node) => node.kind === "docket_family");
  const dockets = A.flatMap(families, (family) =>
    A.map(targetNodes("has_docket", family.iri), (docket) => docketRowFor(family.naturalKey, docket))
  );
  const docketsByFamily = MutableHashMap.empty<string, ReadonlyArray<PracticeKgMatterDocketRow>>();
  A.forEach(dockets, (docket) => appendTo(docketsByFamily, docket.familyKey, docket));
  const matters = A.map(families, (family) => {
    const familyDockets = valuesAt(docketsByFamily, family.naturalKey);
    return PracticeKgMatterRow.make({
      attributionSource: family.attributionSource,
      client: family.client ?? null,
      clientName: pipe(O.fromNullishOr(family.client), O.flatMap(clientNameOf), O.getOrNull),
      docketCount: A.length(familyDockets),
      documentCount:
        targetCount("family_document", family.iri) +
        A.reduce(familyDockets, 0, (total, docket) => total + docket.documentCount),
      epistemicStatus: family.epistemicStatus,
      family: family.docketFamily ?? family.naturalKey,
      familyKey: family.naturalKey,
    });
  });
  return PracticeKgMatterTables.make({
    dockets: A.sort(
      dockets,
      Order.mapInput(Order.String, (row: PracticeKgMatterDocketRow) => row.docketKey)
    ),
    matters: A.sort(
      matters,
      Order.mapInput(Order.String, (row: PracticeKgMatterRow) => row.familyKey)
    ),
  });
};

const createMatterTables = [
  `CREATE TABLE matters (
  family_key VARCHAR PRIMARY KEY,
  family VARCHAR NOT NULL,
  client VARCHAR,
  client_name VARCHAR,
  attribution_source VARCHAR NOT NULL,
  epistemic_status VARCHAR NOT NULL,
  docket_count BIGINT NOT NULL,
  document_count BIGINT NOT NULL
)`,
  `CREATE TABLE matter_dockets (
  docket_key VARCHAR PRIMARY KEY,
  docket VARCHAR NOT NULL,
  family_key VARCHAR NOT NULL,
  epistemic_status VARCHAR NOT NULL,
  document_count BIGINT NOT NULL,
  application_numbers VARCHAR[] NOT NULL,
  patent_numbers VARCHAR[] NOT NULL
)`,
];

const insertMatter = "INSERT INTO matters VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";

const insertMatterDocket = `
INSERT INTO matter_dockets VALUES (
  $1, $2, $3, $4, $5,
  list_filter(string_split($6, '${listSeparator}'), x -> x <> ''),
  list_filter(string_split($7, '${listSeparator}'), x -> x <> '')
)`;

/**
 * Write the `matters` and `matter_dockets` tables into a bundle DuckDB.
 *
 * **Details**
 *
 * Runs once per build, after the graph is projected. The tables are the
 * multi-process-safe read surface for matter lookup: services open the bundle
 * DuckDB read-only and never touch the single-process PGlite store.
 *
 * **Example** (Write empty matter tables)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PracticeKgMatterTables, writeMatterTables } from "../../src/PracticeKg.matters.ts"
 *
 * const write = writeMatterTables("/corpus/staging/practice-kg-bundle/practice.duckdb")(
 *   PracticeKgMatterTables.make({ dockets: [], matters: [] })
 * )
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @param databasePath - Bundle DuckDB written earlier in the same build.
 * @returns A function from matter tables to the write effect.
 * @effects Creates and fills two tables in the bundle DuckDB.
 * @category use-cases
 * @since 0.0.0
 */
export const writeMatterTables = (databasePath: string) =>
  Effect.fn("PracticeKg.writeMatterTables")(function* (tables: PracticeKgMatterTables) {
    return yield* Effect.gen(function* () {
      const db = yield* DuckDb;
      yield* Effect.forEach(createMatterTables, (statement) => db.run(statement), { discard: true });
      yield* Effect.forEach(
        tables.matters,
        (row) =>
          db.run(insertMatter, [
            row.familyKey,
            row.family,
            row.client,
            row.clientName,
            row.attributionSource,
            row.epistemicStatus,
            row.docketCount,
            row.documentCount,
          ]),
        { discard: true }
      );
      yield* Effect.forEach(
        tables.dockets,
        (row) =>
          db.run(insertMatterDocket, [
            row.docketKey,
            row.docket,
            row.familyKey,
            row.epistemicStatus,
            row.documentCount,
            A.join(row.applicationNumbers, listSeparator),
            A.join(row.patentNumbers, listSeparator),
          ]),
        { discard: true }
      );
    }).pipe(
      withDuckDb(DuckDbConnectionOptions.make({ databasePath })),
      PracticeKgProjectionError.mapError(`Failed writing matter tables to "${databasePath}".`)
    );
  });

class MatterHitRow extends S.Class<MatterHitRow>($I`MatterHitRow`)({
  docketKey: S.NullOr(S.String),
  familyKey: S.NonEmptyString,
  matchedOn: PracticeKgMatterMatchedOn,
}) {}

class MatterQueryRow extends S.Class<MatterQueryRow>($I`MatterQueryRow`)({
  attributionSource: KgAttributionSource,
  client: S.NullOr(S.String),
  clientName: S.NullOr(S.String),
  docketCount: S.Finite,
  documentCount: S.Finite,
  epistemicStatus: PracticeKgEpistemicStatus,
  family: S.NonEmptyString,
  familyKey: S.NonEmptyString,
}) {}

class MatterDocketQueryRow extends S.Class<MatterDocketQueryRow>($I`MatterDocketQueryRow`)({
  applicationNumbers: S.String,
  docket: S.NonEmptyString,
  docketKey: S.NonEmptyString,
  documentCount: S.Finite,
  epistemicStatus: PracticeKgEpistemicStatus,
  familyKey: S.NonEmptyString,
  patentNumbers: S.String,
}) {}

const decodeHitRows = S.decodeUnknownEffect(S.Array(MatterHitRow));
const decodeMatterRows = S.decodeUnknownEffect(S.Array(MatterQueryRow));
const decodeMatterDocketRows = S.decodeUnknownEffect(S.Array(MatterDocketQueryRow));

const exactHitsSql = `
SELECT family_key AS "familyKey", 'family-key' AS "matchedOn", NULL AS "docketKey" FROM matters WHERE family_key = $1
UNION ALL
SELECT family_key, 'family', NULL FROM matters WHERE family = $1 AND family_key <> $1
UNION ALL
SELECT family_key, 'client', NULL FROM matters WHERE client = $1
UNION ALL
SELECT family_key, 'docket-key', docket_key FROM matter_dockets WHERE docket_key = $1
UNION ALL
SELECT family_key, 'docket', docket_key FROM matter_dockets WHERE docket = $1 AND docket_key <> $1
UNION ALL
SELECT family_key, 'application', docket_key FROM matter_dockets WHERE $2 <> '' AND list_contains(application_numbers, $2)
UNION ALL
SELECT family_key, 'patent', docket_key FROM matter_dockets WHERE $2 <> '' AND list_contains(patent_numbers, $2)
ORDER BY 1, 2, 3`;

const familyFallbackHitsSql = `
SELECT family_key AS "familyKey", 'family-key' AS "matchedOn", NULL AS "docketKey" FROM matters WHERE $1 <> '' AND family_key = $1
UNION ALL
SELECT family_key, 'family', NULL FROM matters WHERE $1 = '' AND $2 <> '' AND family = $2
ORDER BY 1, 2, 3`;

const mattersSql = `
SELECT family_key AS "familyKey", family, client, client_name AS "clientName",
  attribution_source AS "attributionSource",
  epistemic_status AS "epistemicStatus", CAST(docket_count AS DOUBLE) AS "docketCount",
  CAST(document_count AS DOUBLE) AS "documentCount"
FROM matters
WHERE list_contains(string_split($1, '${listSeparator}'), family_key)
ORDER BY family_key`;

const matterDocketsSql = `
SELECT docket_key AS "docketKey", docket, family_key AS "familyKey", epistemic_status AS "epistemicStatus",
  CAST(document_count AS DOUBLE) AS "documentCount",
  array_to_string(application_numbers, '${listSeparator}') AS "applicationNumbers",
  array_to_string(patent_numbers, '${listSeparator}') AS "patentNumbers"
FROM matter_dockets
WHERE list_contains(string_split($1, '${listSeparator}'), family_key)
ORDER BY docket_key`;

const splitList = (value: string): ReadonlyArray<string> => A.filter(Str.split(value, listSeparator), Str.isNonEmpty);

const whitespacePattern = /\s+/gu;
const usPrefixPattern = /^US[ -]?(?=[0-9])/iu;
const kindCodePattern = /[ABU][0-9]$/iu;
const nonDigitPattern = /[^0-9]/gu;
const usptoNumberPattern = /^[0-9]{2}\/[0-9]{3},?[0-9]{3}$|^[0-9]{1,2},[0-9]{3},[0-9]{3}$|^[0-9]{7,8}$/u;
const docketFamilyPattern = /^(?:([0-9]{4,6})\.)?([0-9]{5,6})[A-Z]/u;

/*
 * `compact` is the reference upper-cased with whitespace removed, which is how
 * docket and family keys are stored. `digits` is set only when the reference is
 * shaped like a USPTO application or patent number, so a docket code's digits
 * are never mistaken for one.
 */
const normalizeReference = (
  reference: string
): { readonly compact: string; readonly digits: string; readonly family: string; readonly familyKey: string } => {
  const compact = Str.toUpperCase(reference.replace(whitespacePattern, ""));
  const numberLike = compact.replace(usPrefixPattern, "").replace(kindCodePattern, "");
  const docketFamily = docketFamilyPattern.exec(compact);
  const client = docketFamily?.[1];
  const family = docketFamily?.[2] ?? "";
  return {
    compact,
    digits: usptoNumberPattern.test(numberLike) ? numberLike.replace(nonDigitPattern, "") : "",
    family,
    familyKey: client === undefined || family === "" ? "" : `${client}.${family}`,
  };
};

const lookupFailure =
  (message: string) =>
  (cause: unknown): PracticeKgMatterLookupError =>
    PracticeKgMatterLookupError.make({ cause, message });

/**
 * Resolve one reference to practice matters against the ambient bundle DuckDB.
 *
 * **Details**
 *
 * Exact identities are tried first: a client-keyed or bare docket, a
 * client-keyed or bare family, a USPTO application or patent number filed from
 * a docket, or a client number. Only when none hit, and the reference is shaped
 * like a docket, does the lookup fall back to that docket's family, so a new
 * country stage of a known matter still resolves. Resolution is `unique` when
 * exactly one matter matches.
 *
 * **Example** (Resolve a reference)
 *
 * ```ts
 * import { PracticeKgMatterLookupRequest } from "@beep/law-practice-use-cases/server"
 * import { Effect } from "effect"
 * import { lookupPracticeKgMatters } from "../../src/PracticeKg.matters.ts"
 *
 * const lookup = lookupPracticeKgMatters(PracticeKgMatterLookupRequest.make({ reference: "12345.10008US01" }))
 * console.log(Effect.isEffect(lookup)) // true
 * ```
 *
 * @param request - The reference to resolve.
 * @returns Matching matters with their dockets and how each matched.
 * @category use-cases
 * @since 0.0.0
 */
export const lookupPracticeKgMatters = Effect.fn("PracticeKg.lookupMatters")(function* (
  request: PracticeKgMatterLookupRequest
): Effect.fn.Return<PracticeKgMatterLookupResult, PracticeKgMatterLookupError, DuckDb | PracticeKgBundle> {
  const db = yield* DuckDb;
  const bundle = yield* PracticeKgBundle;
  const normalized = normalizeReference(request.reference);
  const queryHits = (statement: string, parameters: ReadonlyArray<string>) =>
    db
      .query(statement, A.fromIterable(parameters))
      .pipe(
        Effect.flatMap(decodeHitRows),
        Effect.mapError(lookupFailure("Practice KG matter lookup could not read the matter tables."))
      );
  const exactHits = yield* queryHits(exactHitsSql, [normalized.compact, normalized.digits]);
  const hits = A.isReadonlyArrayNonEmpty(exactHits)
    ? exactHits
    : yield* queryHits(familyFallbackHitsSql, [normalized.familyKey, normalized.family]);
  const familyKeys = A.join(A.dedupe(A.map(hits, (hit) => hit.familyKey)), listSeparator);
  const matterRows = yield* db
    .query(mattersSql, [familyKeys])
    .pipe(
      Effect.flatMap(decodeMatterRows),
      Effect.mapError(lookupFailure("Practice KG matter lookup could not read matched matters."))
    );
  const docketRows = yield* db
    .query(matterDocketsSql, [familyKeys])
    .pipe(
      Effect.flatMap(decodeMatterDocketRows),
      Effect.mapError(lookupFailure("Practice KG matter lookup could not read matched dockets."))
    );
  const matters = A.map(matterRows, (matter) => {
    const matterHits = A.filter(hits, (hit) => hit.familyKey === matter.familyKey);
    const matchedDocketKeys = A.getSomes(A.map(matterHits, (hit) => O.fromNullishOr(hit.docketKey)));
    return PracticeKgMatter.make({
      ...matter,
      dockets: A.map(
        A.filter(docketRows, (docket) => docket.familyKey === matter.familyKey),
        (docket) =>
          PracticeKgMatterDocket.make({
            applicationNumbers: splitList(docket.applicationNumbers),
            docket: docket.docket,
            docketKey: docket.docketKey,
            documentCount: docket.documentCount,
            epistemicStatus: docket.epistemicStatus,
            matched: A.contains(matchedDocketKeys, docket.docketKey),
            patentNumbers: splitList(docket.patentNumbers),
          })
      ),
      matchedOn: A.sort(A.dedupe(A.map(matterHits, (hit) => hit.matchedOn)), Order.String),
    });
  });
  return PracticeKgMatterLookupResult.make({
    bundleVersion: bundle.manifest.bundleVersion,
    matters,
    reference: request.reference,
    resolution: A.length(matters) === 0 ? "none" : A.length(matters) === 1 ? "unique" : "ambiguous",
  });
});

/**
 * Matter lookup over one practice knowledge-graph bundle.
 *
 * **Details**
 *
 * The stable entry point for services that need to turn a reference found in
 * mail or a document into a practice matter. `lookup` is requirement-free: the
 * layer that provides this service has already captured the bundle's DuckDB
 * connection and manifest.
 *
 * **Example** (Yield the service and look up)
 *
 * ```ts
 * import { PracticeKgMatterLookup } from "@beep/law-practice-server"
 * import { PracticeKgMatterLookupRequest } from "@beep/law-practice-use-cases/server"
 * import { Effect } from "effect"
 *
 * const resolution = Effect.gen(function* () {
 *   const matters = yield* PracticeKgMatterLookup
 *   const result = yield* matters.lookup(PracticeKgMatterLookupRequest.make({ reference: "10008US01" }))
 *   return result.resolution
 * })
 *
 * console.log(Effect.isEffect(resolution)) // true
 * ```
 *
 * @see {@link PracticeKgMatterLookupLive} for the layer that satisfies it.
 * @category services
 * @since 0.0.0
 */
export class PracticeKgMatterLookup extends Context.Service<
  PracticeKgMatterLookup,
  {
    readonly lookup: (
      request: PracticeKgMatterLookupRequest
    ) => Effect.Effect<PracticeKgMatterLookupResult, PracticeKgMatterLookupError>;
  }
>()($I`PracticeKgMatterLookup`) {}

/**
 * Matter-lookup layer over an injected bundle DuckDB connection and manifest.
 *
 * **Gotchas**
 *
 * Provide a read-only DuckDB connection to the bundle's `practice.duckdb`
 * (`databaseOptions: { access_mode: "READ_ONLY" }`). DuckDB allows any number
 * of read-only processes on one file, which is what lets several services share
 * a bundle. Do not open the bundle's `kg.pglite` from a second process.
 *
 * **Example** (Wire the layer over a bundle)
 *
 * ```ts
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { PracticeKgMatterLookupLive } from "@beep/law-practice-server"
 * import { Layer } from "effect"
 *
 * const duckDb = DuckDb.makeNodeLayer(
 *   DuckDbConnectionOptions.make({
 *     databaseOptions: { access_mode: "READ_ONLY" },
 *     databasePath: "/corpus/staging/practice-kg-bundle/practice.duckdb"
 *   })
 * )
 * const matters = PracticeKgMatterLookupLive.pipe(Layer.provide(duckDb))
 *
 * console.log(typeof matters.pipe) // "function"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgMatterLookupLive = Layer.effect(
  PracticeKgMatterLookup,
  Effect.gen(function* () {
    const dependencies = yield* Effect.context<DuckDb | PracticeKgBundle>();
    return PracticeKgMatterLookup.of({
      lookup: Effect.fn("PracticeKgMatterLookup.lookup")((request) =>
        lookupPracticeKgMatters(request).pipe(Effect.provide(dependencies))
      ),
    });
  })
);
