/**
 * Pinned Free Law Project reporters-db target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, Str } from "@beep/utils";
import { Crypto, Effect, Encoding, FileSystem, Order, Path, pipe } from "effect";
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

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/ReportersDb");
const targetId = "reporters-db" as const;
const outputRoot = "packages/law-practice/domain/src/internal/generated/free-law-project" as const;
const canonicalPath = `${outputRoot}/reporters-db.data.json` as const;
const vocabularyOutputPath = `${outputRoot}/reporters-vocabulary.ts` as const;
const vocabularyDataPath = `${outputRoot}/reporters-vocabulary.data.json` as const;
const refreshCommand = "bun run beep sync-data-to-ts --target reporters-db" as const;
const textEncoder = new TextEncoder();

/**
 * Pinned reporters-db release.
 *
 * @category configuration
 * @since 0.0.0
 */
export const REPORTERS_DB_RELEASE = "3.2.66" as const;

/**
 * Immutable reporters-db source commit.
 *
 * @category configuration
 * @since 0.0.0
 */
export const REPORTERS_DB_COMMIT = "fad63b383b92f9446c223ddc12bf0b6fd1a6b44c" as const;

/**
 * SHA-256 digest of the pinned reporters-db commit archive.
 *
 * @category configuration
 * @since 0.0.0
 */
export const REPORTERS_DB_ARCHIVE_SHA256 = "11d6aee9b5927fbf29d92fbce6e502c712d3c7acd0a3ed736293d7100b1386f2";

/**
 * Immutable reporters-db commit archive URL.
 *
 * @category configuration
 * @since 0.0.0
 */
export const REPORTERS_DB_SOURCE_URL =
  `https://github.com/freelawproject/reporters-db/archive/${REPORTERS_DB_COMMIT}.tar.gz` as const;

const caseNameAbbreviationsPath = "/reporters_db/data/case_name_abbreviations.json" as const;
const journalsPath = "/reporters_db/data/journals.json" as const;
const lawsPath = "/reporters_db/data/laws.json" as const;
const regexesPath = "/reporters_db/data/regexes.json" as const;
const reportersPath = "/reporters_db/data/reporters.json" as const;
const stateAbbreviationsPath = "/reporters_db/data/state_abbreviations.json" as const;
const reportersDbArchivePaths = [
  caseNameAbbreviationsPath,
  journalsPath,
  lawsPath,
  regexesPath,
  reportersPath,
  stateAbbreviationsPath,
] as const;

class ReporterDateRange extends S.Class<ReporterDateRange>($I`ReporterDateRange`)(
  {
    end: S.NullOr(S.String),
    start: S.NullOr(S.String),
  },
  $I.annote("ReporterDateRange", {
    description: "Date range attached to one reporters-db edition.",
  })
) {}

class ReporterEdition extends S.Class<ReporterEdition>($I`ReporterEdition`)(
  {
    end: S.NullOr(S.String),
    regexes: S.Array(S.String).pipe(S.optionalKey),
    start: S.NullOr(S.String),
  },
  $I.annote("ReporterEdition", {
    description: "Edition metadata nested within a reporters-db reporter record.",
  })
) {}

class ReporterRecord extends S.Class<ReporterRecord>($I`ReporterRecord`)(
  {
    cite_format: S.optionalKey(S.String),
    cite_type: S.String,
    editions: S.Record(S.String, ReporterEdition),
    examples: S.Array(S.String).pipe(S.optionalKey),
    href: S.optionalKey(S.String),
    mlz_jurisdiction: S.Array(S.String),
    name: S.String,
    notes: S.optionalKey(S.String),
    publisher: S.optionalKey(S.String),
    variations: S.Record(S.String, S.String),
  },
  $I.annote("ReporterRecord", {
    description: "One official reporters-db reporter record.",
  })
) {}

class ReporterVocabularyEdition extends S.Class<ReporterVocabularyEdition>($I`ReporterVocabularyEdition`)(
  {
    abbreviation: S.NonEmptyString,
    start: S.NullOr(S.String),
    end: S.NullOr(S.String),
  },
  $I.annote("ReporterVocabularyEdition", {
    description: "Source-faithful reporter edition retained in the published vocabulary.",
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

class ReporterVocabularyOutputRecord extends S.Class<ReporterVocabularyOutputRecord>(
  $I`ReporterVocabularyOutputRecord`
)(
  {
    id: S.NonEmptyString,
    semanticKey: S.NonEmptyString,
    lineageKey: S.NonEmptyString,
    primaryAbbreviation: S.NonEmptyString,
    name: S.NonEmptyString,
    citeType: S.NonEmptyString,
    editions: S.Array(ReporterVocabularyEdition),
    jurisdictions: S.Array(S.String),
    aliases: S.Array(S.NonEmptyString),
    contextualAliases: S.Array(VocabularyContextualAlias),
    status: S.Literals(["active", "tombstone"]),
    successorId: S.NullOr(S.NonEmptyString),
  },
  $I.annote("ReporterVocabularyOutputRecord", {
    description: "Generated reporter vocabulary row used to preserve previously issued identities across refreshes.",
  })
) {}

const PreviousReporterVocabularyArtifact = S.Struct({
  records: S.Array(ReporterVocabularyOutputRecord),
}).pipe(
  $I.annoteSchema("PreviousReporterVocabularyArtifact", {
    description: "Minimal checked-in reporter vocabulary shape required for lifecycle reconciliation.",
  })
);

class JournalRecord extends S.Class<JournalRecord>($I`JournalRecord`)(
  {
    cite_type: S.String,
    end: ReporterDateRange.fields.end,
    examples: S.Array(S.String),
    name: S.String,
    notes: S.optionalKey(S.String),
    regexes: S.Array(S.String),
    start: ReporterDateRange.fields.start,
    variations: S.Array(S.String),
  },
  $I.annote("JournalRecord", {
    description: "One official reporters-db journal record.",
  })
) {}

class LawRecord extends S.Class<LawRecord>($I`LawRecord`)(
  {
    cite_type: S.String,
    end: S.Null,
    examples: S.Array(S.String),
    href: S.optionalKey(S.String),
    jurisdiction: S.String,
    name: S.String,
    notes: S.optionalKey(S.String),
    regexes: S.Array(S.String),
    start: S.Null,
    variations: S.Array(S.String),
  },
  $I.annote("LawRecord", {
    description: "One official reporters-db law record.",
  })
) {}

const CaseNameAbbreviations = S.Record(S.String, S.NonEmptyArray(S.String)).pipe(
  $I.annoteSchema("CaseNameAbbreviations", {
    description: "Official reporters-db case-name abbreviations keyed by citation abbreviation.",
  })
);
const Journals = S.Record(S.String, S.NonEmptyArray(JournalRecord)).pipe(
  $I.annoteSchema("Journals", {
    description: "Official reporters-db journal records keyed by citation abbreviation.",
  })
);
const Laws = S.Record(S.String, S.NonEmptyArray(LawRecord)).pipe(
  $I.annoteSchema("Laws", {
    description: "Official reporters-db law records keyed by citation abbreviation.",
  })
);
const ReporterRegexes = S.Record(S.String, S.Json).pipe(
  $I.annoteSchema("ReporterRegexes", {
    description: "Official reporters-db nested regex fragment families.",
  })
);
const Reporters = S.Record(S.String, S.NonEmptyArray(ReporterRecord)).pipe(
  $I.annoteSchema("Reporters", {
    description: "Official reporters-db reporter records keyed by citation abbreviation.",
  })
);
const StateAbbreviations = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("StateAbbreviations", {
    description: "Official reporters-db state abbreviation lookup.",
  })
);

const decodeCaseNameAbbreviations = S.decodeUnknownEffect(S.fromJsonString(CaseNameAbbreviations));
const decodeJournals = S.decodeUnknownEffect(S.fromJsonString(Journals));
const decodeLaws = S.decodeUnknownEffect(S.fromJsonString(Laws));
const decodeReporterRegexes = S.decodeUnknownEffect(S.fromJsonString(ReporterRegexes));
const decodeReporters = S.decodeUnknownEffect(S.fromJsonString(Reporters));
const decodeStateAbbreviations = S.decodeUnknownEffect(S.fromJsonString(StateAbbreviations));
const decodePreviousReporterVocabularyArtifact = S.decodeUnknownEffect(
  S.fromJsonString(PreviousReporterVocabularyArtifact)
);

const readPreviousReporterVocabulary = Effect.fn("SyncDataToTs.ReportersDb.readPreviousVocabulary")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    SyncDataToTsError.mapError("Failed to locate the repo root for reporter vocabulary reconciliation", targetId)
  );
  const absolutePath = path.resolve(repoRoot, vocabularyDataPath);
  const exists = yield* fs
    .exists(absolutePath)
    .pipe(
      SyncDataToTsError.mapError("Failed to inspect the checked-in reporter vocabulary", targetId, vocabularyDataPath)
    );

  if (!exists) {
    return A.empty<ReporterVocabularyOutputRecord>();
  }

  const content = yield* fs
    .readFileString(absolutePath)
    .pipe(
      SyncDataToTsError.mapError("Failed to read the checked-in reporter vocabulary", targetId, vocabularyDataPath)
    );
  const artifact = yield* decodePreviousReporterVocabularyArtifact(content).pipe(
    SyncDataToTsError.mapError("Failed to decode the checked-in reporter vocabulary", targetId, vocabularyDataPath)
  );

  return artifact.records;
});

const decodeArchiveEntry = <A, E>(
  targetId: string,
  file: string,
  text: string,
  decode: (input: string) => Effect.Effect<A, E>
): Effect.Effect<A, SyncDataToTsError> =>
  decode(text).pipe(SyncDataToTsError.mapError(`Failed to decode ${file}`, targetId, file));

const recordArrayCount = <A>(record: Readonly<Record<string, ReadonlyArray<A>>>): number =>
  pipe(
    R.values(record),
    A.reduce(0, (count, values) => count + A.length(values))
  );

const makeReporterId = Effect.fn("SyncDataToTs.ReportersDb.makeReporterId")(function* (semanticKey: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", textEncoder.encode(semanticKey))
    .pipe(SyncDataToTsError.mapError("Failed to compute a stable reporters-db identifier", targetId, reportersPath));

  return `reporter:${pipe(Encoding.encodeHex(digest), Str.slice(0, 24))}`;
});

const formatReporterRangeBoundary = (boundary: string | null): string =>
  pipe(
    O.fromNullishOr(boundary),
    O.getOrElse(() => "open")
  );

const reporterAliasContext = (record: ReporterRecord): string => {
  const editions = pipe(
    R.toEntries(record.editions),
    A.sortWith(([abbreviation]) => abbreviation, Order.String),
    A.map(
      ([abbreviation, edition]) =>
        `${abbreviation}:${formatReporterRangeBoundary(edition.start)}..${formatReporterRangeBoundary(edition.end)}`
    ),
    A.join(",")
  );

  return `${record.name}; cite-type=${record.cite_type}; editions=${editions}`;
};

/**
 * Decode all six authoritative reporters-db source datasets.
 *
 * @category parsing
 * @since 0.0.0
 */
export const decodeReportersDbSourceData = Effect.fn("SyncDataToTs.ReportersDb.decodeSourceData")(function* (
  entries: Readonly<Record<string, string>>
) {
  const caseNameAbbreviations = yield* decodeArchiveEntry(
    targetId,
    caseNameAbbreviationsPath,
    entries[caseNameAbbreviationsPath],
    decodeCaseNameAbbreviations
  );
  const journals = yield* decodeArchiveEntry(targetId, journalsPath, entries[journalsPath], decodeJournals);
  const laws = yield* decodeArchiveEntry(targetId, lawsPath, entries[lawsPath], decodeLaws);
  const regexes = yield* decodeArchiveEntry(targetId, regexesPath, entries[regexesPath], decodeReporterRegexes);
  const reporters = yield* decodeArchiveEntry(targetId, reportersPath, entries[reportersPath], decodeReporters);
  const stateAbbreviations = yield* decodeArchiveEntry(
    targetId,
    stateAbbreviationsPath,
    entries[stateAbbreviationsPath],
    decodeStateAbbreviations
  );

  return {
    caseNameAbbreviations,
    journals,
    laws,
    regexes,
    reporters,
    stateAbbreviations,
  } as const;
});

const acquireReportersDbProjection = Effect.fn("SyncDataToTs.ReportersDb.acquire")(function* () {
  const fetched = yield* fetchSource(targetId, "reporters-db-archive", REPORTERS_DB_SOURCE_URL);
  const source = yield* assertPinnedArchive({
    expectedSha256: REPORTERS_DB_ARCHIVE_SHA256,
    source: fetched,
    targetId,
  });
  const entries = yield* extractArchiveTextEntries({
    bytes: source.bytes,
    pathSuffixes: reportersDbArchivePaths,
    targetId,
  });
  const { caseNameAbbreviations, journals, laws, regexes, reporters, stateAbbreviations } =
    yield* decodeReportersDbSourceData(entries);
  const reporterSeeds = pipe(
    R.toEntries(reporters),
    A.flatMap(([primaryAbbreviation, records]) =>
      A.map(records, (record) => {
        const semanticKey = A.join([primaryAbbreviation, record.cite_type, record.name], "\u001f");
        const lineageKey = A.join([primaryAbbreviation, record.name], "\u001f");
        const candidateAliases = pipe(
          [primaryAbbreviation],
          A.appendAll(R.keys(record.editions)),
          A.appendAll(R.keys(record.variations)),
          A.appendAll(R.values(record.variations)),
          A.filter(Str.isNonEmpty),
          A.dedupe
        );

        return { candidateAliases, lineageKey, primaryAbbreviation, record, semanticKey };
      })
    )
  );
  const reportersWithIds = yield* Effect.forEach(
    reporterSeeds,
    (seed) => makeReporterId(seed.semanticKey).pipe(Effect.map((id) => ({ ...seed, id }))),
    { concurrency: 16 }
  );
  const stableReporterIds = A.dedupe(A.map(reportersWithIds, (reporter) => reporter.id));

  if (A.length(stableReporterIds) !== A.length(reportersWithIds)) {
    return yield* SyncDataToTsError.make({
      message: "Stable reporters-db identifiers contain a hash collision.",
      targetId,
      file: reportersPath,
    });
  }

  const aliasesByReporterId = pipe(
    reportersWithIds,
    A.map(({ candidateAliases, id, record }) => [id, reporterAliasContext(record), candidateAliases] as const),
    classifyVocabularyAliases,
    A.map(([id, aliases, contextualAliases]) => [id, { aliases, contextualAliases }] as const),
    R.fromEntries
  );
  const projectedReporterVocabulary = A.map(
    reportersWithIds,
    ({ id, lineageKey, primaryAbbreviation, record, semanticKey }) => {
      const aliases = pipe(
        R.get(aliasesByReporterId, id),
        O.getOrElse(() => ({ aliases: A.empty<string>(), contextualAliases: A.empty<readonly [string, string]>() }))
      );

      return ReporterVocabularyOutputRecord.make({
        id,
        semanticKey,
        lineageKey,
        primaryAbbreviation,
        name: record.name,
        citeType: record.cite_type,
        editions: pipe(
          R.toEntries(record.editions),
          A.map(([abbreviation, edition]) => ({
            abbreviation,
            start: edition.start,
            end: edition.end,
          }))
        ),
        jurisdictions: record.mlz_jurisdiction,
        aliases: aliases.aliases,
        contextualAliases: A.map(aliases.contextualAliases, ([alias, context]) => ({ alias, context })),
        status: "active",
        successorId: null,
      });
    }
  );
  const previousReporterVocabulary = yield* readPreviousReporterVocabulary();
  const reporterVocabulary = preserveIssuedVocabularyRecords(
    previousReporterVocabulary,
    projectedReporterVocabulary,
    (previous, current) => (previous.status === "tombstone" ? previous : current),
    (previous, successorId) =>
      ReporterVocabularyOutputRecord.make({
        ...previous,
        status: "tombstone",
        successorId,
      })
  );
  const counts = {
    caseNameAbbreviationKeys: A.length(R.keys(caseNameAbbreviations)),
    caseNameExpansions: recordArrayCount(caseNameAbbreviations),
    journalKeys: A.length(R.keys(journals)),
    journalRecords: recordArrayCount(journals),
    lawKeys: A.length(R.keys(laws)),
    lawRecords: recordArrayCount(laws),
    regexFamilies: A.length(R.keys(regexes)),
    reporterKeys: A.length(R.keys(reporters)),
    reporterRecords: recordArrayCount(reporters),
    stableReporterIds: A.length(reporterVocabulary),
    stateAbbreviations: A.length(R.keys(stateAbbreviations)),
  };
  const vocabularyArtifact = {
    schemaVersion: COURT_REPORTER_VOCABULARY_SCHEMA_VERSION,
    projectionVersion: COURT_REPORTER_PROJECTION_VERSION,
    artifactVersion: COURT_REPORTER_ARTIFACT_VERSION,
    source: {
      repository: "reporters-db",
      release: REPORTERS_DB_RELEASE,
      commit: REPORTERS_DB_COMMIT,
      retrievedOn: "2026-07-25",
      sourceUrl: REPORTERS_DB_SOURCE_URL,
      sha256: source.sha256,
      semanticSha256: null,
      refreshCommand,
    },
    stableIdCount: A.length(reporterVocabulary),
    records: reporterVocabulary,
  };
  const metadata = sourceMetadata(source, { version: REPORTERS_DB_RELEASE });
  const canonical = yield* normalizeJson(targetId, {
    schemaVersion: "law-practice/free-law-project/reporters-db/v1",
    metadata: {
      release: REPORTERS_DB_RELEASE,
      commit: REPORTERS_DB_COMMIT,
      retrievedOn: "2026-07-25",
      sourceUrl: REPORTERS_DB_SOURCE_URL,
      sha256: source.sha256,
      refreshCommand,
    },
    artifact: {
      version: COURT_REPORTER_ARTIFACT_VERSION,
      schemaVersion: COURT_REPORTER_VOCABULARY_SCHEMA_VERSION,
      projectionVersion: COURT_REPORTER_PROJECTION_VERSION,
      vocabularyPath: vocabularyDataPath,
    },
    counts,
    data: {
      caseNameAbbreviations,
      journals,
      laws,
      regexes,
      reporters,
      stateAbbreviations,
    },
  });
  const recordCount =
    counts.caseNameExpansions +
    counts.journalRecords +
    counts.lawRecords +
    counts.regexFamilies +
    counts.reporterRecords +
    counts.stateAbbreviations;

  return SyncDataTargetProjection.make({
    files: [
      outputFile(
        `${outputRoot}/case-name-abbreviations.ts`,
        renderUnknownJsonModule({
          exportName: "CaseNameAbbreviationsData",
          refreshCommand,
          value: caseNameAbbreviations,
        })
      ),
      outputFile(
        `${outputRoot}/journals.ts`,
        renderUnknownJsonModule({ exportName: "JournalsData", refreshCommand, value: journals })
      ),
      outputFile(
        `${outputRoot}/laws.ts`,
        renderUnknownJsonModule({ exportName: "LawsData", refreshCommand, value: laws })
      ),
      outputFile(
        `${outputRoot}/regexes.ts`,
        renderUnknownJsonModule({ exportName: "RegexesData", refreshCommand, value: regexes })
      ),
      outputFile(
        `${outputRoot}/reporters.ts`,
        renderUnknownJsonModule({ exportName: "ReportersData", refreshCommand, value: reporters })
      ),
      outputFile(
        `${outputRoot}/state-abbreviations.ts`,
        renderUnknownJsonModule({
          exportName: "StateAbbreviationsData",
          refreshCommand,
          value: stateAbbreviations,
        })
      ),
      outputFile(
        vocabularyOutputPath,
        renderUnknownJsonModule({
          exportName: "ReportersVocabularyData",
          refreshCommand,
          value: vocabularyArtifact,
        })
      ),
      outputFile(vocabularyDataPath, formatJson(vocabularyArtifact)),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount,
    summary: `${counts.reporterRecords} reporters, ${counts.journalRecords} journals, ${counts.lawRecords} laws, and companion abbreviation/regex data from reporters-db ${REPORTERS_DB_RELEASE}`,
    sources: [metadata],
  });
});

/**
 * Checked-in sync target for the pinned official reporters-db release.
 *
 * @category configuration
 * @since 0.0.0
 */
export const reportersDbTarget: SyncDataTarget = {
  id: targetId,
  access: "public",
  description: "Sync all six official citation datasets from a pinned reporters-db release.",
  sourceUrls: [REPORTERS_DB_SOURCE_URL],
  acquire: acquireReportersDbProjection(),
};
