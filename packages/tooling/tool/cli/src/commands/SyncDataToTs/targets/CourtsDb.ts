/**
 * Pinned Free Law Project courts-db target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, flow, Path, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { assertPinnedArchive, extractArchiveTextEntries, renderUnknownJsonModule } from "../internal/FreeLawProject.ts";
import {
  COURT_REPORTER_ARTIFACT_VERSION,
  COURT_REPORTER_PROJECTION_VERSION,
  COURT_REPORTER_VOCABULARY_SCHEMA_VERSION,
  classifyVocabularyAliases,
  preserveIssuedVocabularyRecords,
} from "../internal/FreeLawProjectVocabulary.ts";
import { fetchSource, formatJson, normalizeJson, outputFile, sourceMetadata } from "../internal/Source.ts";
import { SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.ts";
import type { SyncDataTarget } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/CourtsDb");
const targetId = "courts-db" as const;
const outputRoot = "packages/law-practice/domain/src/internal/generated/free-law-project" as const;
const outputPath = `${outputRoot}/courts.ts` as const;
const canonicalPath = `${outputRoot}/courts-db.data.json` as const;
const vocabularyOutputPath = `${outputRoot}/courts-vocabulary.ts` as const;
const vocabularyDataPath = `${outputRoot}/courts-vocabulary.data.json` as const;
const refreshCommand = "bun run beep sync-data-to-ts --target courts-db" as const;
const expectedCourtCount = 2_809;

/**
 * Pinned courts-db release.
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURTS_DB_RELEASE = "0.10.27" as const;

/**
 * Immutable courts-db source commit.
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURTS_DB_COMMIT = "f353e51400a55cc8942b230b3e12540ad364fd23" as const;

/**
 * SHA-256 digest of the pinned courts-db commit archive.
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURTS_DB_ARCHIVE_SHA256 = "6c0e4fc800a8ebdb7d539960fd08b8373b219623694723af36378df229f369fa";

/**
 * Semantic digest of the fully assembled pinned courts-db records.
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURTS_DB_SEMANTIC_SHA256 = "41a20fb1916149fd5a60bf8adfcd2572fc35dd872ecb3d0fa9119bd64ef0ba05";

/**
 * Immutable courts-db commit archive URL.
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURTS_DB_SOURCE_URL =
  `https://github.com/freelawproject/courts-db/archive/${COURTS_DB_COMMIT}.tar.gz` as const;

const courtsPath = "/courts_db/data/courts.json" as const;
const variablesPath = "/courts_db/data/variables.json" as const;
const utilsPath = "/courts_db/utils.py" as const;
const placeNames = [
  "al_counties",
  "al_districts",
  "al_municipals",
  "al_probates",
  "ar_circuits",
  "ar_cities",
  "ar_districts",
  "az_cities",
  "az_superior_cts",
  "ca_counties",
  "co_counties",
  "co_munis",
  "ct_superior",
  "fl_counties",
  "ga_juvenile",
  "ga_magistrates",
  "ga_probates",
  "ga_state_ct",
  "gand_divisions",
  "md_circuits",
  "nj_counties",
  "ny_cities",
  "ny_counties",
  "ny_towns",
  "oh_counties",
  "pa_places",
  "va_circuits",
  "va_cities",
] as const;
const placePath = (name: string): string => `/courts_db/data/places/${name}.txt`;
const courtsDbArchivePaths = [courtsPath, variablesPath, utilsPath, ...A.map(placeNames, placePath)] as const;

class CourtDateRange extends S.Class<CourtDateRange>($I`CourtDateRange`)(
  {
    end: S.NullOr(S.String),
    name: S.optionalKey(S.String),
    notes: S.optionalKey(S.String),
    reason: S.optionalKey(S.String),
    reorg: S.Array(S.String).pipe(S.optionalKey),
    reorganization: S.Union([S.String, S.Array(S.String)]).pipe(S.optionalKey),
    reorganization_dates: S.Array(S.String).pipe(S.optionalKey),
    start: S.NullOr(S.String),
  },
  $I.annote("CourtDateRange", {
    description: "One dates entry from an assembled courts-db record.",
  })
) {}

const nullableStringOrStrings = S.NullOr(S.Union([S.String, S.Array(S.String)]));
const optionalCourtFields = {
  active: S.optionalKey(S.Boolean),
  appeal_to: S.optionalKey(nullableStringOrStrings),
  bankruptcy: S.optionalKey(S.Null),
  case_types: S.optionalKey(nullableStringOrStrings),
  cites: S.Array(S.String).pipe(S.optionalKey),
  court_url: S.String.pipe(S.NullOr, S.optionalKey),
  division: S.Union([S.String, S.Array(S.String)]).pipe(S.optionalKey),
  division_type: S.optionalKey(S.String),
  divisions: S.Array(S.String).pipe(S.optionalKey),
  federal_circuit: S.optionalKey(S.Int),
  jurisdiction: S.String.pipe(S.NullOr, S.optionalKey),
  locations: S.optionalKey(S.Int),
  lower_courts: S.Array(S.String).pipe(S.optionalKey),
  name_abbreviation: S.String.pipe(S.NullOr, S.optionalKey),
  notes: S.String.pipe(S.NullOr, S.optionalKey),
  parent: S.String.pipe(S.NullOr, S.optionalKey),
  reorganization_dates: S.Array(S.String).pipe(S.optionalKey),
  sub_names: S.Array(S.String).pipe(S.optionalKey),
  url: S.optionalKey(S.String),
} as const;

class RawCourtRecord extends S.Class<RawCourtRecord>($I`RawCourtRecord`)(
  {
    ...optionalCourtFields,
    citation_string: S.String,
    dates: S.Array(CourtDateRange).pipe(S.optionalKey),
    examples: S.Array(S.String),
    id: S.String,
    level: S.NullOr(S.String),
    location: S.optionalKey(S.String),
    name: S.String,
    regex: S.Array(S.String),
    system: S.String,
    type: S.String.pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("RawCourtRecord", {
    description: "One courts-db source record before parent-field inheritance.",
  })
) {}

class CourtRecord extends S.Class<CourtRecord>($I`CourtRecord`)(
  {
    ...optionalCourtFields,
    citation_string: S.String,
    dates: S.Array(CourtDateRange),
    examples: S.Array(S.String),
    id: S.String,
    level: S.NullOr(S.String),
    location: S.String,
    name: S.String,
    regex: S.Array(S.String),
    system: S.String,
    type: S.NullOr(S.String),
  },
  $I.annote("CourtRecord", {
    description: "One fully assembled official courts-db record.",
  })
) {}

class VocabularyContextualAlias extends S.Class<VocabularyContextualAlias>($I`VocabularyContextualAlias`)(
  {
    alias: S.NonEmptyString,
    context: S.NonEmptyString,
  },
  $I.annote("VocabularyContextualAlias", {
    description: "Context-bearing alias retained in a generated court or reporter vocabulary.",
  })
) {}

class CourtVocabularyOutputRecord extends S.Class<CourtVocabularyOutputRecord>($I`CourtVocabularyOutputRecord`)(
  {
    id: S.NonEmptyString,
    sourceId: S.NonEmptyString,
    semanticKey: S.NonEmptyString,
    lineageKey: S.NonEmptyString,
    name: S.NonEmptyString,
    nameAbbreviation: S.NullOr(S.String),
    citationString: S.String,
    sourceJurisdiction: S.NullOr(S.String),
    system: S.String,
    type: S.NullOr(S.String),
    hierarchyLevel: S.NullOr(S.String),
    location: S.String,
    parentId: S.NullOr(S.String),
    effectiveRanges: S.Array(CourtDateRange),
    aliases: S.Array(S.NonEmptyString),
    contextualAliases: S.Array(VocabularyContextualAlias),
    status: S.Literals(["active", "tombstone"]),
    successorId: S.NullOr(S.NonEmptyString),
  },
  $I.annote("CourtVocabularyOutputRecord", {
    description: "Generated court vocabulary row used to preserve previously issued identities across refreshes.",
  })
) {}

const PreviousCourtVocabularyArtifact = S.Struct({
  records: S.Array(CourtVocabularyOutputRecord),
}).pipe(
  $I.annoteSchema("PreviousCourtVocabularyArtifact", {
    description: "Minimal checked-in court vocabulary shape required for lifecycle reconciliation.",
  })
);

const Variables = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("Variables", {
    description: "Regex variables used to assemble courts-db court records.",
  })
);
const Ordinals = S.Array(S.String).pipe(
  $I.annoteSchema("Ordinals", {
    description: "Ordinal regex fragments embedded in the pinned courts-db Python utility.",
  })
);
const RawCourts = S.Array(RawCourtRecord).pipe(
  $I.annoteSchema("RawCourts", {
    description: "Raw templated courts-db court records.",
  })
);
const Courts = S.Array(CourtRecord).pipe(
  $I.annoteSchema("Courts", {
    description: "Fully assembled courts-db court records.",
  })
);

const decodeVariables = S.decodeUnknownEffect(S.fromJsonString(Variables));
const decodeOrdinals = S.decodeUnknownEffect(S.fromJsonString(Ordinals));
const decodeRawCourts = S.decodeUnknownEffect(S.fromJsonString(RawCourts));
const decodeCourts = S.decodeUnknownEffect(Courts);
const decodePreviousCourtVocabularyArtifact = S.decodeUnknownEffect(S.fromJsonString(PreviousCourtVocabularyArtifact));

/**
 * Read the checked-in court vocabulary used to preserve issued identities.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const readPreviousCourtVocabularyForTesting = Effect.fn("SyncDataToTs.CourtsDb.readPreviousVocabulary")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repoRoot = yield* findRepoRoot().pipe(
      SyncDataToTsError.mapError("Failed to locate the repo root for court vocabulary reconciliation", targetId)
    );
    const absolutePath = path.resolve(repoRoot, vocabularyDataPath);
    const exists = yield* fs
      .exists(absolutePath)
      .pipe(
        SyncDataToTsError.mapError("Failed to inspect the checked-in court vocabulary", targetId, vocabularyDataPath)
      );

    if (!exists) {
      return A.empty<CourtVocabularyOutputRecord>();
    }

    const content = yield* fs
      .readFileString(absolutePath)
      .pipe(SyncDataToTsError.mapError("Failed to read the checked-in court vocabulary", targetId, vocabularyDataPath));
    const artifact = yield* decodePreviousCourtVocabularyArtifact(content).pipe(
      SyncDataToTsError.mapError("Failed to decode the checked-in court vocabulary", targetId, vocabularyDataPath)
    );

    return artifact.records;
  }
);

const replaceLiteralAll = (text: string, search: string, replacement: string): string =>
  pipe(text, Str.split(search), A.join(replacement));

const decodeEntry = <A, E>(
  file: string,
  text: string,
  decode: (input: string) => Effect.Effect<A, E>
): Effect.Effect<A, SyncDataToTsError> =>
  decode(text).pipe(SyncDataToTsError.mapError(`Failed to decode ${file}`, targetId, file));

const extractOrdinals: (utilsText: string) => Effect.Effect<ReadonlyArray<string>, SyncDataToTsError> = flow(
  Str.match(/ordinals = (\[[\s\S]*?\n\s*\])/u),
  O.flatMap((match) => A.get(match, 1)),
  O.match({
    onNone: () =>
      Effect.fail(
        SyncDataToTsError.make({
          message: "Could not find the ordinals array in the pinned courts-db utility.",
          targetId,
          file: utilsPath,
        })
      ),
    onSome: (json) => decodeEntry(utilsPath, Str.replace(/,\s*\]$/u, "\n]")(json), decodeOrdinals),
  })
);

const expandOrdinalRanges = (courtsText: string, ordinals: ReadonlyArray<string>): string => {
  let expanded = courtsText;

  for (const match of Str.matchAll(/\$\{(\d+)-(\d+)\}/gu)(courtsText)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const replacement = `((${pipe(ordinals, A.slice({ start: start - 1, end }), A.join(")|("))}))`;
    expanded = replaceLiteralAll(expanded, match[0], replacement);
  }

  return expanded;
};

const substituteVariables = (
  courtsText: string,
  variables: Readonly<Record<string, string>>
): Effect.Effect<string, SyncDataToTsError> => {
  let substituted = courtsText;
  for (const [name, value] of R.toEntries(variables)) {
    substituted = replaceLiteralAll(substituted, `\${${name}}`, value);
    substituted = replaceLiteralAll(substituted, `$${name}`, value);
  }

  return O.isSome(Str.match(/\$(?:\{|[A-Za-z_])/u)(substituted))
    ? Effect.fail(
        SyncDataToTsError.make({
          message: "Unresolved template variables remain in the courts-db source.",
          targetId,
          file: courtsPath,
        })
      )
    : Effect.succeed(substituted);
};

const inheritParentFields = (courts: ReadonlyArray<RawCourtRecord>): ReadonlyArray<unknown> => {
  const courtsById = pipe(
    courts,
    A.map((court) => [court.id, court] as const),
    R.fromEntries
  );

  return A.map(courts, (court) => {
    const parent = pipe(
      O.fromNullishOr(court.parent),
      O.flatMap((parentId) => R.get(courtsById, parentId))
    );

    return {
      ...court,
      ...O.getSomesStruct({
        dates: pipe(
          O.fromUndefinedOr(court.dates),
          O.orElse(() => O.flatMap(parent, (record) => O.fromUndefinedOr(record.dates)))
        ),
        location: pipe(
          O.fromUndefinedOr(court.location),
          O.orElse(() => O.flatMap(parent, (record) => O.fromUndefinedOr(record.location)))
        ),
        type: pipe(
          O.fromUndefinedOr(court.type),
          O.orElse(() => O.flatMap(parent, (record) => O.fromUndefinedOr(record.type)))
        ),
      }),
    };
  });
};

/**
 * Assemble courts-db templates, place variables, ordinal ranges, and parent inheritance.
 *
 * @category parsing
 * @since 0.0.0
 */
export const assembleCourtsData = Effect.fn("SyncDataToTs.CourtsDb.assemble")(function* (
  courtsText: string,
  variablesText: string,
  places: Readonly<Record<string, string>>,
  utilsText: string
): Effect.fn.Return<ReadonlyArray<CourtRecord>, SyncDataToTsError> {
  const variables = yield* decodeEntry(variablesPath, variablesText, decodeVariables);
  const ordinals = yield* extractOrdinals(utilsText);
  const placeVariables = pipe(
    places,
    R.map((content) => `(${pipe(content, Str.split(/\r?\n/u), A.filter(Str.isNonEmpty), A.join("|"))})`)
  );
  const templated = expandOrdinalRanges(courtsText, ordinals);
  const substituted = yield* substituteVariables(templated, { ...variables, ...placeVariables });
  const escaped = pipe(
    substituted,
    (text) => replaceLiteralAll(text, "$$", "$"),
    (text) => replaceLiteralAll(text, "\\", "\\\\")
  );
  const rawCourts = yield* decodeEntry(courtsPath, escaped, decodeRawCourts);
  const courts = yield* decodeCourts(inheritParentFields(rawCourts)).pipe(
    SyncDataToTsError.mapError("Failed to validate assembled courts-db records", targetId, courtsPath)
  );
  const uniqueIds = pipe(
    courts,
    A.map((court) => court.id),
    A.dedupe
  );

  if (A.length(uniqueIds) !== A.length(courts)) {
    return yield* SyncDataToTsError.make({
      message: "Assembled courts-db records contain duplicate court identifiers.",
      targetId,
      file: courtsPath,
    });
  }

  return courts;
});

const acquireCourtsDbProjection = Effect.fn("SyncDataToTs.CourtsDb.acquire")(function* () {
  const fetched = yield* fetchSource(targetId, "courts-db-archive", COURTS_DB_SOURCE_URL);
  const source = yield* assertPinnedArchive({
    expectedSha256: COURTS_DB_ARCHIVE_SHA256,
    source: fetched,
    targetId,
  });
  const entries = yield* extractArchiveTextEntries({
    bytes: source.bytes,
    pathSuffixes: courtsDbArchivePaths,
    targetId,
  });
  const places = pipe(
    placeNames,
    A.map((name) => [name, entries[placePath(name)]] as const),
    R.fromEntries
  );
  const courts = yield* assembleCourtsData(entries[courtsPath], entries[variablesPath], places, entries[utilsPath]);

  if (A.length(courts) !== expectedCourtCount) {
    return yield* SyncDataToTsError.make({
      message: `Expected ${expectedCourtCount} assembled courts-db records, received ${A.length(courts)}.`,
      targetId,
      file: courtsPath,
    });
  }

  const previousCourtVocabulary = yield* readPreviousCourtVocabularyForTesting();
  const courtVocabulary = yield* projectCourtVocabulary(courts, previousCourtVocabulary);

  const vocabularyArtifact = {
    schemaVersion: COURT_REPORTER_VOCABULARY_SCHEMA_VERSION,
    projectionVersion: COURT_REPORTER_PROJECTION_VERSION,
    artifactVersion: COURT_REPORTER_ARTIFACT_VERSION,
    source: {
      repository: "courts-db",
      release: COURTS_DB_RELEASE,
      commit: COURTS_DB_COMMIT,
      retrievedOn: "2026-07-25",
      sourceUrl: COURTS_DB_SOURCE_URL,
      sha256: source.sha256,
      semanticSha256: COURTS_DB_SEMANTIC_SHA256,
      refreshCommand,
    },
    stableIdCount: A.length(courtVocabulary),
    records: courtVocabulary,
  };

  const metadata = sourceMetadata(source, { version: COURTS_DB_RELEASE });
  const canonical = yield* normalizeJson(targetId, {
    schemaVersion: "law-practice/free-law-project/courts-db/v1",
    metadata: {
      release: COURTS_DB_RELEASE,
      commit: COURTS_DB_COMMIT,
      retrievedOn: "2026-07-25",
      sourceUrl: COURTS_DB_SOURCE_URL,
      sha256: source.sha256,
      semanticSha256: COURTS_DB_SEMANTIC_SHA256,
      refreshCommand,
    },
    counts: {
      courts: A.length(courts),
      placeVariables: A.length(placeNames),
      stableCourtIds: A.length(courtVocabulary),
    },
    artifact: {
      version: COURT_REPORTER_ARTIFACT_VERSION,
      schemaVersion: COURT_REPORTER_VOCABULARY_SCHEMA_VERSION,
      projectionVersion: COURT_REPORTER_PROJECTION_VERSION,
      vocabularyPath: vocabularyDataPath,
    },
    data: {
      courts,
    },
  });

  return SyncDataTargetProjection.make({
    files: [
      outputFile(outputPath, renderUnknownJsonModule({ exportName: "CourtsData", refreshCommand, value: courts })),
      outputFile(
        vocabularyOutputPath,
        renderUnknownJsonModule({
          exportName: "CourtsVocabularyData",
          refreshCommand,
          value: vocabularyArtifact,
        })
      ),
      outputFile(vocabularyDataPath, formatJson(vocabularyArtifact)),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount: A.length(courts),
    summary: `${A.length(courts)} assembled court records from courts-db ${COURTS_DB_RELEASE}`,
    sources: [metadata],
  });
});

/**
 * Project assembled courts-db records into the stable court vocabulary.
 *
 * @category projection
 * @since 0.0.0
 */
export const projectCourtVocabulary = Effect.fn("SyncDataToTs.CourtsDb.projectVocabulary")(function* (
  courts: ReadonlyArray<CourtRecord>,
  previousCourtVocabulary: ReadonlyArray<CourtVocabularyOutputRecord>
) {
  const aliasSeeds = A.map(courts, (court) => {
    const aliases = pipe(
      [court.name, court.citation_string],
      A.appendAll(pipe(O.fromNullishOr(court.name_abbreviation), A.fromOption)),
      A.appendAll(pipe(O.fromUndefinedOr(court.sub_names), O.getOrElse(A.empty<string>))),
      A.filter(Str.isNonEmpty),
      A.dedupe
    );

    return [court.id, `${court.location}: ${court.name}`, aliases] as const;
  });
  const aliasesByCourtId = pipe(
    classifyVocabularyAliases(aliasSeeds),
    A.map(([id, aliases, contextualAliases]) => [id, { aliases, contextualAliases }] as const),
    R.fromEntries
  );
  const projectedCourtVocabulary = A.map(courts, (court) => {
    const aliases = pipe(
      R.get(aliasesByCourtId, court.id),
      O.getOrElse(() => ({ aliases: A.empty<string>(), contextualAliases: A.empty<readonly [string, string]>() }))
    );

    return CourtVocabularyOutputRecord.make({
      id: court.id,
      sourceId: court.id,
      semanticKey: `court:${court.id}`,
      lineageKey: `court:${court.id}`,
      name: court.name,
      nameAbbreviation: pipe(O.fromNullishOr(court.name_abbreviation), O.getOrNull),
      citationString: court.citation_string,
      sourceJurisdiction: pipe(O.fromNullishOr(court.jurisdiction), O.getOrNull),
      system: court.system,
      type: court.type,
      hierarchyLevel: court.level,
      location: court.location,
      parentId: pipe(O.fromNullishOr(court.parent), O.getOrNull),
      effectiveRanges: court.dates,
      aliases: aliases.aliases,
      contextualAliases: A.map(aliases.contextualAliases, ([alias, context]) => ({ alias, context })),
      status: "active",
      successorId: null,
    });
  });
  return preserveIssuedVocabularyRecords(
    previousCourtVocabulary,
    projectedCourtVocabulary,
    (previous, current) => (previous.status === "tombstone" ? previous : current),
    (previous, successorId) =>
      CourtVocabularyOutputRecord.make({
        ...previous,
        status: "tombstone",
        successorId,
      })
  );
});

/**
 * Checked-in sync target for the pinned official courts-db release.
 *
 * @category configuration
 * @since 0.0.0
 */
export const courtsDbTarget: SyncDataTarget = {
  id: targetId,
  access: "public",
  description: "Sync assembled court records from a pinned courts-db release.",
  sourceUrls: [COURTS_DB_SOURCE_URL],
  acquire: acquireCourtsDbProjection(),
};
