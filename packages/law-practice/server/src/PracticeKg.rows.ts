/**
 * Shared practice knowledge-graph build-lane row schemas and scoped-layer helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  PracticeKgCandidateClaimToolRow,
  PracticeKgDocumentToolRow,
  PracticeKgEmailToolRow,
  PracticeKgFamilyToolRow,
  PracticeKgGraphToolRow,
} from "@beep/law-practice-use-cases/server";
import { Effect, flow, Layer } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DuckDbConnectionOptions } from "@beep/duckdb";
import type { Path } from "effect";

const $I = $LawPracticeServerId.create("PracticeKg.rows");

/**
 * Catalog row decoded from the corpus DuckDB `corpus_organized` join.
 *
 * @remarks
 * `digest` is the identity of the underlying file, so the same document reached
 * through two source paths yields two rows with one digest. The nullable fields
 * are genuinely absent rather than empty: an unorganized file has no
 * `organizedRelativePath`, and a document filed outside a matter has no
 * `docket`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PracticeKgCatalogRow } from "../../src/PracticeKg.rows.ts"
 *
 * const row = S.decodeUnknownSync(PracticeKgCatalogRow)({
 *   category: "correspondence",
 *   client: "Acme Corp",
 *   digest: "sha256:9f2c",
 *   docket: "AB-1234",
 *   docketFamily: "AB",
 *   effectiveName: "2019-04-02-office-action.pdf",
 *   mtimeIso: "2019-04-02T14:22:00.000Z",
 *   organizedRelativePath: "organized/Acme/AB-1234/2019-04-02-office-action.pdf",
 *   runLabel: "base",
 *   sizeBytes: 18342,
 *   sourceLabel: "acme-archive",
 *   sourceOriginChain: "base:acme-archive:raw/acme/OA_20190402.pdf",
 *   sourceRelativePath: "raw/acme/OA_20190402.pdf"
 * })
 *
 * console.log(row.digest) // "sha256:9f2c"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCatalogRow extends S.Class<PracticeKgCatalogRow>($I`PracticeKgCatalogRow`)(
  {
    category: S.String,
    client: S.NullOr(S.String),
    digest: S.NonEmptyString,
    docket: S.NullOr(S.String),
    docketFamily: S.NullOr(S.String),
    effectiveName: S.String,
    mtimeIso: S.String,
    organizedRelativePath: S.NullOr(S.String),
    sourceOriginChain: S.String,
    runLabel: S.String,
    sizeBytes: S.Finite,
    sourceLabel: S.String,
    sourceRelativePath: S.String,
  },
  $I.annote("PracticeKgCatalogRow", {
    description: "One digest-identified corpus document as joined from the catalog DuckDB organize view.",
  })
) {}

/**
 * Enrichment row decoded from the corpus DuckDB `corpus_enrichment` table.
 *
 * @remarks
 * Enrichment is candidate evidence rather than settled fact — it is what makes
 * an edge projected from this row `candidate-unreviewed`. `docketFamilies` and
 * `parentApplicationNumbers` hold delimited lists, not single values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PracticeKgEnrichmentRow } from "../../src/PracticeKg.rows.ts"
 *
 * const row = S.decodeUnknownSync(PracticeKgEnrichmentRow)({
 *   applicationNumber: "16123456",
 *   candidate: "AB-1234",
 *   docketFamilies: "AB",
 *   firstApplicantName: "Acme Corp",
 *   firstInventorName: "Ada Lovelace",
 *   inventionTitle: "Widget alignment apparatus",
 *   parentApplicationNumbers: "15987654,14876543",
 *   patentNumber: null,
 *   status: "pending"
 * })
 *
 * console.log(row.parentApplicationNumbers.split(",").length) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgEnrichmentRow extends S.Class<PracticeKgEnrichmentRow>($I`PracticeKgEnrichmentRow`)(
  {
    applicationNumber: S.NullOr(S.String),
    candidate: S.String,
    docketFamilies: S.String,
    firstApplicantName: S.NullOr(S.String),
    firstInventorName: S.NullOr(S.String),
    inventionTitle: S.NullOr(S.String),
    parentApplicationNumbers: S.String,
    patentNumber: S.NullOr(S.String),
    status: S.String,
  },
  $I.annote("PracticeKgEnrichmentRow", {
    description: "One USPTO enrichment candidate joined to a docket family from the catalog DuckDB.",
  })
) {}

/**
 * Provide a scoped layer around an effect, closing the scope when it ends.
 *
 * Module-private on purpose: `@beep/test-utils` exports the canonical copy for
 * tests, and server source cannot import tooling — this stays the one
 * production-side copy, consumed only by {@link withDuckDb}.
 */
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R0>(effect: Effect.Effect<A, E, R0>): Effect.Effect<A, E | E2, RIn | Exclude<R0, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

/**
 * Run an effect against a node-backed DuckDB connection for the given options.
 *
 * @remarks
 * The connection opens when the wrapped effect starts and closes when it
 * settles, so each build step owns its handle rather than sharing one across the
 * whole projection. Writes are therefore committed per step, not per build.
 *
 * @example
 * ```ts
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { Effect } from "effect"
 * import { withDuckDb } from "../../src/PracticeKg.rows.ts"
 *
 * const program = Effect.gen(function* () {
 *   const db = yield* DuckDb
 *   yield* db.run("CREATE TABLE documents (digest VARCHAR PRIMARY KEY)")
 *   return yield* db.query("SELECT COUNT(*) AS total FROM documents")
 * }).pipe(withDuckDb(DuckDbConnectionOptions.make({ databasePath: "/tmp/practice.duckdb" })))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows.length)) // 1
 * ```
 *
 * @see {@link provideScopedLayer} for the scoping this builds on.
 *
 * @category layers
 * @since 0.0.0
 */
export const withDuckDb = (options: DuckDbConnectionOptions) => provideScopedLayer(DuckDb.makeNodeLayer(options));

/**
 * Strip a required prefix, returning `None` when the prefix is absent.
 *
 * @remarks
 * The absence of the prefix is a `None`, not an untouched string — that is the
 * point: callers use it as a combined guard and slice when parsing the
 * `artifact:`-prefixed export directory names the extract tree uses.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { stripPrefix } from "../../src/PracticeKg.rows.ts"
 *
 * const stripArtifact = stripPrefix("artifact:")
 *
 * console.log(O.getOrNull(stripArtifact("artifact:sha256-9f2c"))) // "sha256-9f2c"
 * console.log(O.getOrNull(stripArtifact("sha256-9f2c"))) // null
 * ```
 *
 * @param prefix - Exact leading substring required for a `Some` result.
 *
 * @category utilities
 * @since 0.0.0
 */
export const stripPrefix = (prefix: string) =>
  flow(O.liftPredicate(Str.startsWith(prefix)), O.map(Str.slice(Str.length(prefix))));

/**
 * Decode graph-tool query rows.
 *
 * @example
 * ```ts
 * import { decodePracticeKgGraphRows } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePracticeKgGraphRows([]))) // true
 * ```
 * @since 0.0.0
 * @category codecs
 */
export const decodePracticeKgGraphRows = S.decodeUnknownEffect(S.Array(PracticeKgGraphToolRow));
/**
 * Decode docket-family query rows.
 *
 * @example
 * ```ts
 * import { decodePracticeKgFamilyRows } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePracticeKgFamilyRows([]))) // true
 * ```
 * @since 0.0.0
 * @category codecs
 */
export const decodePracticeKgFamilyRows = S.decodeUnknownEffect(S.Array(PracticeKgFamilyToolRow));
/**
 * Decode corpus-document query rows.
 *
 * @example
 * ```ts
 * import { decodePracticeKgDocumentRows } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePracticeKgDocumentRows([]))) // true
 * ```
 * @since 0.0.0
 * @category codecs
 */
export const decodePracticeKgDocumentRows = S.decodeUnknownEffect(S.Array(PracticeKgDocumentToolRow));
/**
 * Decode email-header query rows.
 *
 * @example
 * ```ts
 * import { decodePracticeKgEmailRows } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePracticeKgEmailRows([]))) // true
 * ```
 * @since 0.0.0
 * @category codecs
 */
export const decodePracticeKgEmailRows = S.decodeUnknownEffect(S.Array(PracticeKgEmailToolRow));
/**
 * Decode grounded candidate-claim query rows.
 *
 * @example
 * ```ts
 * import { decodePracticeKgCandidateClaimRows } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePracticeKgCandidateClaimRows([]))) // true
 * ```
 * @since 0.0.0
 * @category codecs
 */
export const decodePracticeKgCandidateClaimRows = S.decodeUnknownEffect(S.Array(PracticeKgCandidateClaimToolRow));

/**
 * Convert any decoded tool row to the generic record accepted by the
 * field-tier projector.
 *
 * @example
 * ```ts
 * import { toToolRecord } from "@beep/law-practice-server"
 *
 * console.log(toToolRecord({ digest: "sha256:9f2c" })) // { digest: "sha256:9f2c" }
 * ```
 * @category mappers
 * @since 0.0.0
 */
export const toToolRecord = <Row extends object>(row: Row): { [K in keyof Row]: Row[K] } => ({ ...row });

/**
 * Resolve optional external-corpus pointers with the platform path service.
 *
 * @example
 * ```ts
 * import { addPracticeKgCorpusPointers } from "@beep/law-practice-server"
 *
 * console.log(typeof addPracticeKgCorpusPointers) // "function"
 * ```
 * @category mappers
 * @since 0.0.0
 */
export const addPracticeKgCorpusPointers: {
  (
    corpusRoot: string | undefined,
    path: Path.Path
  ): (rows: ReadonlyArray<PracticeKgDocumentToolRow>) => ReadonlyArray<PracticeKgDocumentToolRow>;
  (
    rows: ReadonlyArray<PracticeKgDocumentToolRow>,
    corpusRoot: string | undefined,
    path: Path.Path
  ): ReadonlyArray<PracticeKgDocumentToolRow>;
} = dual(
  3,
  (
    rows: ReadonlyArray<PracticeKgDocumentToolRow>,
    corpusRoot: string | undefined,
    path: Path.Path
  ): ReadonlyArray<PracticeKgDocumentToolRow> =>
    A.map(rows, (row) => {
      const pointer = O.all({
        relative: O.fromNullOr(row.sourceRelativePath),
        root: O.fromUndefinedOr(corpusRoot),
      }).pipe(
        O.map(({ relative, root }) => path.join(root, relative)),
        O.getOrNull
      );
      return PracticeKgDocumentToolRow.make({ ...row, pointer });
    })
);
