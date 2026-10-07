/**
 * Matter lookup port of the docket intake pipeline: the live lookup over a
 * practice knowledge-graph bundle, and the unavailable lookup used when no
 * bundle is configured.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { KgAttributionSource, PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  DocketIntakeError,
  DocketMatterLookup,
  MatterAmbiguous,
  MatterNotFound,
  MatterSuggested,
  MatterUnique,
} from "@beep/law-practice-use-cases/DocketIntake";
import {
  extractPracticeKgPathEvidence,
  extractPracticeKgReferences,
  PracticeKgMatterLookupRequest,
  PracticeKgMatterMatchedOn,
} from "@beep/law-practice-use-cases/server";
import { SchemaUtils } from "@beep/schema";
import { Context, Effect, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import { constFalse } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeKgBundle, PracticeKgBundleContext } from "../PracticeKg.host.ts";
import { PracticeKgMatterLookup, PracticeKgMatterLookupLive } from "../PracticeKg.matters.ts";
import { PracticeKgBundleManifest, PracticeKgSchemaVersions } from "../PracticeKg.schemas.ts";
import type { MatterLookupResult } from "@beep/law-practice-use-cases/DocketIntake";
import type { PracticeKgMatter, PracticeKgMatterLookupResult } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.matters");

/**
 * Matter lookup that always reports the lookup as unavailable.
 *
 * **Details**
 *
 * Every lookup fails at stage `lookup` with the label
 * `practice-kg-lookup-not-wired`. The pipeline keeps the entry and marks it
 * `matter-lookup-failed`, so the attorney still sees the deadline and knows
 * the matter was not resolved. The service wires it when no practice
 * knowledge-graph bundle is configured; tests and offline runs use it too.
 *
 * **Example** (Provide the unavailable lookup)
 *
 * ```ts
 * import { DocketMatterLookupUnavailableLive } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketMatterLookupUnavailableLive);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketMatterLookupUnavailableLive: Layer.Layer<DocketMatterLookup> = Layer.succeed(
  DocketMatterLookup,
  DocketMatterLookup.of({
    lookup: Effect.fn("DocketMatterLookup.lookup")(function* (references) {
      yield* Effect.annotateCurrentSpan({ docket_reference_count: A.length(references) });
      return yield* DocketIntakeError.make({ cause: "practice-kg-lookup-not-wired", stage: "lookup" });
    }),
  })
);

/**
 * Service shape: matters whose documents mention a USPTO number.
 *
 * **Example** (Name the mention method)
 *
 * ```ts
 * import type { DocketMatterMentionsShape } from "@beep/law-practice-server/DocketIntake";
 *
 * const method: keyof DocketMatterMentionsShape = "familiesMentioning";
 * console.log(method);
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DocketMatterMentionsShape {
  /**
   * Family keys of the matters whose docket documents mention the application or patent number in
   * the reference, sorted. Empty when the reference holds no such number.
   */
  readonly familiesMentioning: (reference: string) => Effect.Effect<ReadonlyArray<string>, DocketIntakeError>;
}

/**
 * Matters whose documents mention a USPTO number without owning it.
 *
 * **Details**
 *
 * The practice KG's matter lookup returns a matter for an application or
 * patent number only when one of the matter's dockets was filed under it. The
 * docket intake must still show the attorney the matters whose documents cite
 * the number, as candidates, so this service answers that question.
 *
 * **Example** (Reference the mention service)
 *
 * ```ts
 * import { DocketMatterMentions } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketMatterMentions.key);
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DocketMatterMentions extends Context.Service<DocketMatterMentions, DocketMatterMentionsShape>()(
  $I`DocketMatterMentions`
) {}

class MentionRow extends S.Class<MentionRow>($I`MentionRow`)(
  {
    familyKey: S.NonEmptyString.annotateKey({ description: "Family key of a matter whose documents cite the number." }),
  },
  $I.annote("MentionRow", { description: "One matter whose docket documents mention a USPTO number." })
) {}

const decodeMentionRows = S.decodeUnknownEffect(S.Array(MentionRow));

const applicationTokenPattern = "\\b([0-9]{2}/[0-9]{3},?[0-9]{3})\\b";
const patentTokenPattern = "\\b(?:US[ -]?)?([0-9]{1,2},[0-9]{3},[0-9]{3}|[0-9]{7,8})(?:\\s?[ABU][0-9])?\\b";

/*
 * Read-only query over the bundle's `matters`, `documents` and `document_text`
 * tables. The number is read out of the reference with the same token patterns
 * the bundle build uses to find number mentions in docket documents, so a
 * reference and a document name a number the same way. A docket document
 * belongs to the family key its catalog row gives it (`<client>.<family>`, or
 * the bare family without a client); only families that are matters are
 * returned. Nothing is scanned when the reference holds no number.
 */
const mentionsSql = `
WITH wanted AS (
  SELECT DISTINCT regexp_replace(token, '[^0-9]', '', 'g') AS number
  FROM (
    SELECT UNNEST(regexp_extract_all($1, '${applicationTokenPattern}', 1)) AS token
    UNION ALL
    SELECT UNNEST(regexp_extract_all($1, '${patentTokenPattern}', 1)) AS token
  )
),
docket_docs AS (
  SELECT digest,
    CASE WHEN client IS NULL THEN docket_family ELSE client || '.' || docket_family END AS family_key,
    effective_name || ' ' || source_relative_path AS name_text
  FROM documents
  WHERE category = 'docket' AND docket_family IS NOT NULL AND EXISTS (SELECT 1 FROM wanted)
),
sources AS (
  SELECT d.family_key, t.text AS content FROM docket_docs d JOIN document_text t USING (digest)
  UNION ALL
  SELECT family_key, name_text AS content FROM docket_docs
),
tokens AS (
  SELECT family_key, UNNEST(regexp_extract_all(content, '${applicationTokenPattern}', 1)) AS token FROM sources
  UNION ALL
  SELECT family_key, UNNEST(regexp_extract_all(content, '${patentTokenPattern}', 1)) AS token FROM sources
)
SELECT DISTINCT m.family_key AS "familyKey"
FROM tokens t
JOIN matters m ON m.family_key = t.family_key
WHERE regexp_replace(t.token, '[^0-9]', '', 'g') IN (SELECT number FROM wanted)
ORDER BY 1`;

const mentionsFailed = () => DocketIntakeError.make({ cause: "practice-kg-mentions", stage: "lookup" });

/**
 * Matters whose docket documents mention a number, read from the bundle's
 * DuckDB file.
 *
 * **Details**
 *
 * The query only reads `matters`, `documents` and `document_text`. A failure
 * to read them, or a row that does not decode, fails at stage `lookup`.
 *
 * **Example** (Wire the mention query over a bundle)
 *
 * ```ts
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
 * import { DocketMatterMentionsLive } from "@beep/law-practice-server/DocketIntake";
 * import { Layer } from "effect";
 *
 * const mentions = DocketMatterMentionsLive.pipe(
 *   Layer.provide(
 *     DuckDb.makeNodeLayer(
 *       DuckDbConnectionOptions.make({
 *         databaseOptions: { access_mode: "READ_ONLY" },
 *         databasePath: "bundle/practice.duckdb"
 *       })
 *     )
 *   )
 * );
 * console.log(Layer.isLayer(mentions));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketMatterMentionsLive: Layer.Layer<DocketMatterMentions, never, DuckDb> = Layer.effect(
  DocketMatterMentions,
  Effect.gen(function* () {
    const db = yield* DuckDb;
    return DocketMatterMentions.of({
      familiesMentioning: Effect.fn("DocketMatterMentions.familiesMentioning")(function* (reference) {
        const rows = yield* db
          .query(mentionsSql, [reference])
          .pipe(Effect.flatMap(decodeMentionRows), Effect.mapError(mentionsFailed));
        yield* Effect.annotateCurrentSpan({ docket_mentioning_family_count: A.length(rows) });
        return A.map(rows, (row) => row.familyKey);
      }),
    });
  })
);

// The attorney's own `<client>.<0NNNN>` matter number names no docket family; it is never looked up.
const isAttorneyMatterNumber = (reference: string): boolean =>
  A.isReadonlyArrayNonEmpty(extractPracticeKgPathEvidence(reference).attorneyMatterNumbers);

// What is looked up for one verbatim reference: the forms the practice KG's extraction reads in it,
// or the reference itself when it reads none (a family key, a bare number).
const lookupForms = (reference: string): ReadonlyArray<string> =>
  A.match(extractPracticeKgReferences(reference), {
    onEmpty: () => (Str.isEmpty(reference) || isAttorneyMatterNumber(reference) ? [] : [reference]),
    onNonEmpty: (forms) => forms,
  });

// A client number names every matter of the client, not one matter.
const namesMatter = (matter: PracticeKgMatter): boolean =>
  !A.every(matter.matchedOn, PracticeKgMatterMatchedOn.is.client);

type FormResult = { readonly form: string; readonly matters: ReadonlyArray<PracticeKgMatter> };

const familyKeysOf = (matters: ReadonlyArray<PracticeKgMatter>): ReadonlyArray<string> =>
  A.map(matters, (matter) => matter.familyKey);

const sortedKeys = (keys: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(keys), Order.String);

// A match on the bare family number alone does not tell clients apart.
const isBareFamily = (matchedOn: ReadonlyArray<PracticeKgMatterMatchedOn>): boolean =>
  A.every(matchedOn, PracticeKgMatterMatchedOn.is.family);

// A match through an application or patent number filed from one of the matter's dockets.
const isNumberMatch = S.is(PracticeKgMatterMatchedOn.pick(["application", "patent"]));

// The contract's "needs attorney" rule: no client, a recycle-bin stub, a bare family match, or a
// membership the practice KG only inferred from where most citing documents sit.
const uniqueMatter = (matches: A.NonEmptyReadonlyArray<PracticeKgMatter>): MatterUnique => {
  const matter = A.headNonEmpty(matches);
  const dockets = matter.dockets;
  return MatterUnique.make({
    applications: A.dedupe(A.flatMap(dockets, (docket) => docket.applicationNumbers)),
    client: O.fromNullishOr(matter.client),
    clientName: O.fromNullishOr(matter.clientName),
    dockets: A.map(dockets, (docket) => docket.docketKey),
    familyKey: matter.familyKey,
    matchedDockets: sortedKeys(
      A.flatMap(matches, (match) =>
        A.map(
          A.filter(match.dockets, (docket) => docket.matched),
          (docket) => docket.docketKey
        )
      )
    ),
    patents: A.dedupe(A.flatMap(dockets, (docket) => docket.patentNumbers)),
    verified:
      matter.client !== null &&
      !PracticeKgEpistemicStatus.is["recycled-unverified"](matter.epistemicStatus) &&
      !KgAttributionSource.is["mention-dominance"](matter.attributionSource) &&
      !isBareFamily(A.flatMap(matches, (match) => match.matchedOn)),
  });
};

// What the references resolve to, and the number references whose membership still has to be
// checked: a verified matter found only through application or patent numbers.
type NumberMembership = { readonly forms: ReadonlyArray<string>; readonly unique: MatterUnique };

type Resolved = { readonly answer: MatterLookupResult; readonly membership: O.Option<NumberMembership> };

// One matter is the answer only when every reference that resolved uniquely names it and every
// reference that resolved to several matters includes it. Any other spread is ambiguous.
const combine = (results: ReadonlyArray<FormResult>): O.Option<Resolved> => {
  const resolvedOnce: ReadonlyArray<FormResult> = A.filter(results, (result) => A.length(result.matters) === 1);
  const uniqueMatches: ReadonlyArray<PracticeKgMatter> = A.flatMap(resolvedOnce, (result) => result.matters);
  const several = A.filter(results, (result) => A.length(result.matters) > 1);
  const sole = O.filter(O.liftPredicate(uniqueMatches, A.isReadonlyArrayNonEmpty), (matches) => {
    const key = A.headNonEmpty(matches).familyKey;
    return (
      A.every(matches, (match) => match.familyKey === key) &&
      A.every(several, (result) => A.contains(familyKeysOf(result.matters), key))
    );
  });
  return O.orElse(
    O.map(sole, (matches): Resolved => {
      const unique = uniqueMatter(matches);
      const numberOnly = A.every(
        A.flatMap(matches, (match) => match.matchedOn),
        isNumberMatch
      );
      return {
        answer: unique,
        membership: O.liftPredicate(
          { forms: A.map(resolvedOnce, (result) => result.form), unique },
          () => unique.verified && numberOnly
        ),
      };
    }),
    () =>
      O.map(
        O.liftPredicate(
          sortedKeys(A.flatMap(results, (result) => familyKeysOf(result.matters))),
          A.isReadonlyArrayNonEmpty
        ),
        (familyKeys): Resolved => ({ answer: MatterAmbiguous.make({ familyKeys }), membership: O.none() })
      )
  );
};

// A membership the bundle took from where most citing documents sit (`mention-dominance`) is not
// labelled in the lookup result, so it is recognised the way the build decides it: documents of
// another matter cite the number too. Such a matter needs the attorney.
const checkMembership = (
  mentions: DocketMatterMentionsShape,
  resolved: Resolved
): Effect.Effect<MatterLookupResult, DocketIntakeError> =>
  O.match(resolved.membership, {
    onNone: () => Effect.succeed(resolved.answer),
    onSome: ({ forms, unique }) =>
      Effect.map(Effect.forEach(forms, mentions.familiesMentioning), (mentioned) =>
        A.some(A.flatten(mentioned), (familyKey) => familyKey !== unique.familyKey)
          ? MatterUnique.make({ ...unique, verified: false })
          : unique
      ),
  });

const lookupFailed = () => DocketIntakeError.make({ cause: "practice-kg-lookup", stage: "lookup" });

const makeLookup = (kg: typeof PracticeKgMatterLookup.Service, mentions: DocketMatterMentionsShape) =>
  Effect.fn("DocketMatterLookup.lookup")(function* (references: ReadonlyArray<string>) {
    const forms = A.dedupe(A.flatMap(A.map(references, Str.trim), lookupForms));
    const results = yield* Effect.forEach(forms, (form) =>
      kg.lookup(PracticeKgMatterLookupRequest.make({ reference: form })).pipe(
        Effect.map(
          (result: PracticeKgMatterLookupResult): FormResult => ({
            form,
            matters: A.filter(result.matters, namesMatter),
          })
        ),
        Effect.mapError(lookupFailed)
      )
    );
    // Only when no reference names a matter are the documents searched for mentions: a number
    // that no matter owns is offered with the matters that cite it, never as an answer.
    const answer = yield* O.match(combine(results), {
      onNone: () =>
        Effect.forEach(forms, mentions.familiesMentioning).pipe(
          Effect.map(
            (mentioned): MatterLookupResult =>
              A.match(sortedKeys(A.flatten(mentioned)), {
                onEmpty: () => MatterNotFound.make({}),
                onNonEmpty: (familyKeys) => MatterSuggested.make({ familyKeys }),
              })
          )
        ),
      onSome: (resolved) => checkMembership(mentions, resolved),
    });
    yield* Effect.annotateCurrentSpan({
      docket_lookup_form_count: A.length(forms),
      docket_lookup_result: answer._tag,
      docket_reference_count: A.length(references),
    });
    return answer;
  });

/**
 * Matter lookup over the practice knowledge graph.
 *
 * **Details**
 *
 * Each verbatim reference is read with the practice KG's own reference
 * extraction, so a docket with a national-stage suffix or a foreign
 * associate's reference with a `/ <docket>` tail is looked up by the docket
 * it carries. A reference the extraction reads nothing in is looked up as
 * written, except the attorney's own `<client>.<0NNNN>` matter number, which
 * names no docket family and is skipped. A match on the client number alone
 * names no matter and is dropped.
 *
 * One matter named by every reference that resolved is `MatterUnique`; it is
 * unverified when it has no client, rests on a recycle-bin stub, matched on
 * the bare family number only, or is a `mention-dominance` member: found only
 * through application or patent numbers that other matters' documents cite
 * too. Several matters are `MatterAmbiguous`. When
 * nothing resolves, the matters whose documents mention an application or
 * patent number of the references are `MatterSuggested` (even one); otherwise
 * the answer is `MatterNotFound`. A failing lookup fails at stage `lookup`.
 *
 * **Example** (Wire the lookup over its two services)
 *
 * ```ts
 * import { DocketMatterLookupPracticeKg } from "@beep/law-practice-server/DocketIntake";
 * import { Layer } from "effect";
 *
 * console.log(Layer.isLayer(DocketMatterLookupPracticeKg));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketMatterLookupPracticeKg: Layer.Layer<
  DocketMatterLookup,
  never,
  DocketMatterMentions | PracticeKgMatterLookup
> = Layer.effect(
  DocketMatterLookup,
  Effect.gen(function* () {
    return DocketMatterLookup.of({ lookup: makeLookup(yield* PracticeKgMatterLookup, yield* DocketMatterMentions) });
  })
);

/**
 * The practice knowledge-graph bundle could not be opened for the docket
 * intake.
 *
 * **Example** (Make a bundle error)
 *
 * ```ts
 * import { DocketKgBundleError } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketKgBundleError.make({ message: "Bundle directory is missing." }).message);
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocketKgBundleError extends S.TaggedError<DocketKgBundleError>($I`DocketKgBundleError`)(
  "DocketKgBundleError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString.annotateKey({ description: "What is wrong with the bundle, naming the path." }),
  },
  $I.annoteError<DocketKgBundleError>("DocketKgBundleError", {
    description: "The practice knowledge-graph bundle could not be opened for the docket intake.",
  })
) {}

/**
 * Where the practice knowledge-graph bundle is.
 *
 * **Example** (Make bundle options)
 *
 * ```ts
 * import { DocketKgBundleOptions } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketKgBundleOptions.make({ bundleDir: "bundle" }).bundleDir);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketKgBundleOptions extends S.Class<DocketKgBundleOptions>($I`DocketKgBundleOptions`)(
  {
    bundleDir: S.NonEmptyString.annotateKey({
      description: "Directory holding `bundle.manifest.json` and `practice.duckdb`.",
    }),
  },
  $I.annote("DocketKgBundleOptions", { description: "Where the practice knowledge-graph bundle is." })
) {}

class BundleFormatProbe extends S.Class<BundleFormatProbe>($I`BundleFormatProbe`)(
  {
    schemaVersion: S.Record(S.String, S.String).annotateKey({ description: "Store format per store." }),
  },
  $I.annote("BundleFormatProbe", { description: "The store formats a bundle manifest declares." })
) {}

const decodeFormatProbe = S.decodeUnknownEffect(S.fromJsonString(BundleFormatProbe));
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));

const MANIFEST_FILE = "bundle.manifest.json";
const DATABASE_FILE = "practice.duckdb";
// The DuckDB store format the practice-KG code in this package reads and writes.
const SUPPORTED_DUCKDB_FORMAT: string = PracticeKgSchemaVersions.make({}).duckdb;

const bundleError = (message: string) => (cause: unknown) => DocketKgBundleError.make({ cause, message });

/**
 * A practice knowledge-graph bundle checked and ready to open read-only.
 *
 * **Example** (Read the database path of a bundle)
 *
 * ```ts
 * import type { DocketKgBundle } from "@beep/law-practice-server/DocketIntake";
 *
 * const databasePath = (bundle: DocketKgBundle) => bundle.databasePath;
 * console.log(databasePath);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketKgBundle extends S.Class<DocketKgBundle>($I`DocketKgBundle`)(
  {
    context: PracticeKgBundleContext.annotateKey({ description: "The bundle directory and its manifest." }),
    databasePath: S.NonEmptyString.annotateKey({ description: "Path of the bundle's `practice.duckdb`." }),
  },
  $I.annote("DocketKgBundle", { description: "A practice knowledge-graph bundle checked and ready to open." })
) {}

/**
 * Check a practice knowledge-graph bundle directory before anything opens it.
 *
 * **Details**
 *
 * The directory, its `bundle.manifest.json` and `practice.duckdb` must exist,
 * the manifest must decode, and its DuckDB store format must be the one this
 * package's practice-KG code reads (`PracticeKgSchemaVersions`, `4` today);
 * otherwise this fails with a {@link DocketKgBundleError} that names the path.
 * Nothing is opened: the checks only read the manifest and look for the
 * database file.
 *
 * **Example** (Check a bundle directory)
 *
 * ```ts
 * import { DocketKgBundleOptions, openDocketKgBundle } from "@beep/law-practice-server/DocketIntake";
 * import { Effect } from "effect";
 *
 * const checked = openDocketKgBundle(DocketKgBundleOptions.make({ bundleDir: "bundle" }));
 * console.log(Effect.isEffect(checked));
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const openDocketKgBundle = Effect.fn("DocketMatterLookup.openBundle")(function* (
  options: DocketKgBundleOptions
): Effect.fn.Return<DocketKgBundle, DocketKgBundleError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { bundleDir } = options;
  const isDirectory = yield* fs.stat(bundleDir).pipe(
    Effect.map((info) => info.type === "Directory"),
    Effect.orElseSucceed(constFalse)
  );
  if (!isDirectory) {
    return yield* DocketKgBundleError.make({ message: `Practice KG bundle directory "${bundleDir}" does not exist.` });
  }
  const manifestPath = path.join(bundleDir, MANIFEST_FILE);
  const manifestText = yield* fs
    .readFileString(manifestPath)
    .pipe(Effect.mapError(bundleError(`Practice KG bundle manifest "${manifestPath}" cannot be read.`)));
  const probe = yield* decodeFormatProbe(manifestText).pipe(
    Effect.mapError(bundleError(`Practice KG bundle manifest "${manifestPath}" is not a bundle manifest.`))
  );
  const format = O.getOrElse(O.fromUndefinedOr(probe.schemaVersion.duckdb), () => "none");
  if (format !== SUPPORTED_DUCKDB_FORMAT) {
    return yield* DocketKgBundleError.make({
      message: `Practice KG bundle at "${bundleDir}" uses DuckDB store format ${format}; the docket intake reads format ${SUPPORTED_DUCKDB_FORMAT}. Install a rebuilt bundle.`,
    });
  }
  const manifest = yield* decodeManifest(manifestText).pipe(
    Effect.mapError(bundleError(`Practice KG bundle manifest "${manifestPath}" is invalid.`))
  );
  const databasePath = path.join(bundleDir, DATABASE_FILE);
  const hasDatabase = yield* fs.exists(databasePath).pipe(Effect.orElseSucceed(constFalse));
  if (!hasDatabase) {
    return yield* DocketKgBundleError.make({ message: `Practice KG bundle database "${databasePath}" is missing.` });
  }
  yield* Effect.annotateCurrentSpan({ practice_kg_bundle_version: manifest.bundleVersion });
  return DocketKgBundle.make({ context: PracticeKgBundleContext.make({ bundleDir, manifest }), databasePath });
});

/**
 * The live matter lookup over a practice knowledge-graph bundle directory.
 *
 * **Details**
 *
 * Building the layer checks the bundle first: the directory, its
 * `bundle.manifest.json`, the DuckDB store format (`4`) and `practice.duckdb`
 * must all be there, or the layer fails with a {@link DocketKgBundleError}
 * that names the path. The database is opened read-only, so the lookup runs
 * beside the practice-KG host and any other reader. The bundle's `kg.pglite`
 * is never opened: it belongs to the host.
 *
 * **Example** (Wire the lookup over a bundle directory)
 *
 * ```ts
 * import { DocketKgBundleOptions, makeDocketMatterLookupLayer } from "@beep/law-practice-server/DocketIntake";
 * import { Layer } from "effect";
 *
 * const lookup = makeDocketMatterLookupLayer(DocketKgBundleOptions.make({ bundleDir: "bundle" }));
 * console.log(Layer.isLayer(lookup));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketMatterLookupLayer = (
  options: DocketKgBundleOptions
): Layer.Layer<DocketMatterLookup, DocketKgBundleError, FileSystem.FileSystem | Path.Path> =>
  Layer.unwrap(
    Effect.map(openDocketKgBundle(options), (bundle) =>
      DocketMatterLookupPracticeKg.pipe(
        Layer.provide(Layer.merge(PracticeKgMatterLookupLive, DocketMatterMentionsLive)),
        Layer.provide(
          Layer.merge(
            DuckDb.makeNodeLayer(
              DuckDbConnectionOptions.make({
                databaseOptions: { access_mode: "READ_ONLY" },
                databasePath: bundle.databasePath,
              })
            ),
            Layer.succeed(PracticeKgBundle, PracticeKgBundle.of(bundle.context))
          )
        )
      )
    )
  );
