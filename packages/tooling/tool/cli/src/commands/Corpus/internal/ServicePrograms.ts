/**
 * Service implementation for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { ArtifactId, ContentDigest, OperationId, SourceArtifact } from "@beep/file-processing/Artifact";
import {
  ChildArtifactRecord,
  encodeChildArtifactRecordJson,
  encodeFileProcessingCoverageSummaryJson,
  encodeFileProcessingFailureRecordJson,
  encodeProcessRunManifestJson,
  encodeSourceProcessingRecordJson,
  FailedFileProcessingFailureRecord,
  FailedSourceProcessingRecord,
  FileProcessingCoverageSummary,
  ProcessRunManifest,
  SkippedFileProcessingFailureRecord,
  SkippedSourceProcessingRecord,
  SourceProcessingRecord,
  SucceededSourceProcessingRecord,
} from "@beep/file-processing/Extraction";
import { ProcessFileOperation } from "@beep/file-processing/Operation";
import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import {
  collectSourceOutcomeRecords,
  makeFileProcessingServiceLayer,
  processFile,
} from "@beep/file-processing/Service";
import {
  DeferredSelectedStrategy,
  SupportedSelectedStrategy,
  UnsupportedSelectedStrategy,
} from "@beep/file-processing/Strategy";
import { $RepoCliId } from "@beep/identity/packages";
import { makePffexportFileProcessingEngine, PffexportEngineConfig } from "@beep/libpff";
import { NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { makeTikaAppFileProcessingEngine, TikaAppEngineConfig } from "@beep/tika";
import { makeUsptoError, normalizeUsptoApplicationNumber, normalizeUsptoPatentNumber, Uspto } from "@beep/uspto";
import * as O from "@beep/utils/Option";
import {
  Console,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Match,
  MutableHashMap,
  MutableHashSet,
  Order,
  Path,
  Ref,
  Result,
} from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { hashFileSha256 as sharedHashFileSha256 } from "../../../internal/cli/FsGuards.ts";
import { withDuckDb } from "../../../internal/duckdb/WithDuckDb.ts";
import {
  CorpusArchiveMoveDestinationConflictError,
  CorpusArchiveMoveDigestMismatchError,
  CorpusArchiveMoveUncoveredFileError,
  CorpusCommandError,
} from "../Corpus.errors.ts";
import { classifyRecycleBinName, pairRecycleBinEntries, parseRecycleBinMetadata } from "../Corpus.recyclebin.ts";
import {
  CorpusArchiveMoveManifestRecord,
  CorpusArchiveMoveSummary,
  CorpusCatalogDigestRow,
  CorpusCatalogRunSummary,
  CorpusCatalogSourceFileRecord,
  CorpusCatalogSummary,
  CorpusDuplicateSetRecord,
  CorpusEnrichmentRecord,
  CorpusEnrichSummary,
  CorpusExtractSummary,
  CorpusOrganizeRecord,
  CorpusOrganizeSummary,
  CorpusProvenanceRecord,
  CorpusRestorationRecord,
  CorpusSalvageOriginFile,
  CorpusSalvageSummary,
  encodeCorpusArchiveMoveManifestRecordJson,
  encodeCorpusCatalogSourceFileRecordJson,
  encodeCorpusCatalogSummaryJson,
  encodeCorpusDuplicateSetReportJson,
  encodeCorpusEnrichmentRecordJson,
  encodeCorpusEnrichSummaryJson,
  encodeCorpusExtractSummaryJson,
  encodeCorpusOrganizeRecordJson,
  encodeCorpusOrganizeSummaryJson,
  encodeCorpusProvenanceRecordJson,
  encodeCorpusRestorationRecordJson,
  encodeCorpusSalvageSummaryJson,
  MatchedRestorationRecord,
  RecycleBinScanEntry,
  UnmatchedContentRestorationRecord,
  UnmatchedMetadataRestorationRecord,
} from "../Corpus.schemas.ts";
import { CorpusLedgerRecordJson } from "./Preservation.schemas.ts";
import type { DuckDbError, DuckDbShape } from "@beep/duckdb";
import type {
  ArchiveExportProcessFileResult,
  ExtractedProcessFileResult,
  FileProcessingFailureRecord,
} from "@beep/file-processing/Extraction";
import type { FileProcessingEngineShape, FileProcessingService } from "@beep/file-processing/Service";
import type { FileFormatFamily, FileProcessingEngineFamily, SelectedStrategy } from "@beep/file-processing/Strategy";
import type * as Crypto from "effect/Crypto";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CorpusArchiveMoveError } from "../Corpus.errors.ts";
import type {
  CorpusArchiveMoveOptions,
  CorpusCatalogOptions,
  CorpusEnrichOptions,
  CorpusExtractOptions,
  CorpusOrganizeCategory,
  CorpusOrganizeOptions,
  CorpusSalvageOptions,
  CorpusSalvageSourceSpec,
} from "../Corpus.schemas.ts";
import type { CorpusLedgerRecord } from "./Preservation.schemas.ts";

const isCorpusProvenanceRecord = S.is(CorpusProvenanceRecord);

const retainCorpusProvenanceRecords = (
  records: ReadonlyArray<CorpusLedgerRecord>
): ReadonlyArray<CorpusProvenanceRecord> => A.filter(records, isCorpusProvenanceRecord);

const $I = $RepoCliId.create("commands/Corpus/internal/ServicePrograms");

type CorpusCommandServiceRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;
const sqlStringLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const createSourceFilesTable = (manifestPath: string): string => `
CREATE OR REPLACE TABLE corpus_source_files AS
SELECT
  runLabel AS run_label,
  copyMode AS copy_mode,
  sourceLabel AS source_label,
  originPath AS origin_path,
  relativePath AS relative_path,
  destPath AS dest_path,
  dedupeOfPath AS dedupe_of_path,
  referencedRawPath AS referenced_raw_path,
  sizeBytes AS size_bytes,
  mtimeEpoch AS mtime_epoch,
  mtimeIso AS mtime_iso,
  sha256,
  salvagedAt AS salvaged_at,
  'sha256:' || sha256 AS digest,
  'artifact:' || sha256 AS artifact_id
FROM read_json(${sqlStringLiteral(manifestPath)}, format='newline_delimited', columns={
  runLabel: 'VARCHAR',
  copyMode: 'VARCHAR',
  sourceLabel: 'VARCHAR',
  originPath: 'VARCHAR',
  relativePath: 'VARCHAR',
  destPath: 'VARCHAR',
  dedupeOfPath: 'VARCHAR',
  referencedRawPath: 'VARCHAR',
  sizeBytes: 'BIGINT',
  mtimeEpoch: 'BIGINT',
  mtimeIso: 'VARCHAR',
  sha256: 'VARCHAR',
  salvagedAt: 'VARCHAR'
})`;

const createDuplicateSetsView = `
CREATE OR REPLACE VIEW corpus_duplicate_sets AS
SELECT
  digest,
  COUNT(*)::INTEGER AS copies,
  CASE WHEN COUNT(DISTINCT run_label) > 1 THEN 'cross-run' ELSE 'intra-run' END AS duplicate_scope,
  COUNT(DISTINCT run_label)::INTEGER AS run_count,
  STRING_AGG(DISTINCT run_label, ' | ' ORDER BY run_label) AS run_labels,
  MIN(size_bytes) AS size_bytes,
  CASE
    WHEN COUNT(DISTINCT run_label) > 1 THEN
      STRING_AGG(run_label || ':' || source_label || '/' || relative_path, ' | ' ORDER BY run_label, source_label, relative_path)
    ELSE
      STRING_AGG(source_label || '/' || relative_path, ' | ' ORDER BY source_label, relative_path)
  END AS members
FROM corpus_source_files
GROUP BY digest
HAVING COUNT(*) > 1`;

const createRestorationsTable = `
CREATE OR REPLACE TABLE corpus_restorations (
  match_status VARCHAR NOT NULL,
  source_label VARCHAR NOT NULL,
  pair_key VARCHAR NOT NULL,
  metadata_relative_path VARCHAR,
  content_relative_path VARCHAR,
  original_path VARCHAR,
  original_name VARCHAR,
  original_size_bytes BIGINT,
  deleted_at_iso VARCHAR,
  deleted_at_filetime VARCHAR,
  format_version VARCHAR
)`;

const insertRestorationStatement = `
INSERT INTO corpus_restorations VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

const sourceTotalsStatement = `
SELECT
  CAST(COUNT(*) AS DOUBLE) AS "sourceFiles",
  CAST(COALESCE(SUM(size_bytes), 0) AS DOUBLE) AS "totalBytes",
  CAST(COUNT(DISTINCT digest) AS DOUBLE) AS "distinctDigests"
FROM corpus_source_files`;

const duplicateTotalsStatement = `
SELECT
  CAST(COUNT(*) AS DOUBLE) AS "duplicateSets",
  CAST(COALESCE(SUM(copies - 1), 0) AS DOUBLE) AS "duplicateFiles",
  CAST(COALESCE(SUM((copies - 1) * size_bytes), 0) AS DOUBLE) AS "redundantBytes"
FROM corpus_duplicate_sets`;

const duplicateSetRowsStatement = `
SELECT
  digest,
  copies,
  duplicate_scope AS "duplicateScope",
  run_count AS "runCount",
  run_labels AS "runLabels",
  CAST(size_bytes AS DOUBLE) AS "sizeBytes",
  members
FROM corpus_duplicate_sets
ORDER BY (copies - 1) * size_bytes DESC, digest`;

const catalogDigestRowsStatement = `
SELECT
  sha256,
  MIN(referenced_raw_path) AS "destPath"
FROM corpus_source_files
WHERE sha256 IS NOT NULL AND referenced_raw_path IS NOT NULL
GROUP BY sha256
ORDER BY sha256, "destPath"`;

class SourceTotalsRow extends S.Class<SourceTotalsRow>($I`SourceTotalsRow`)(
  {
    distinctDigests: S.Finite,
    sourceFiles: S.Finite,
    totalBytes: S.Finite,
  },
  $I.annote("SourceTotalsRow", {
    description: "Aggregate file, byte, and digest totals queried from the corpus catalog.",
  })
) {}

class DuplicateTotalsRow extends S.Class<DuplicateTotalsRow>($I`DuplicateTotalsRow`)(
  {
    duplicateFiles: S.Finite,
    duplicateSets: S.Finite,
    redundantBytes: S.Finite,
  },
  $I.annote("DuplicateTotalsRow", {
    description: "Aggregate duplicate-set totals queried from the corpus catalog.",
  })
) {}

const decodeSourceTotalsRows = S.decodeUnknownEffect(S.Array(SourceTotalsRow));
const decodeDuplicateTotalsRows = S.decodeUnknownEffect(S.Array(DuplicateTotalsRow));
const decodeDuplicateSetRecords = S.decodeUnknownEffect(S.Array(CorpusDuplicateSetRecord));
const decodeCatalogDigestRows = S.decodeUnknownEffect(S.Array(CorpusCatalogDigestRow));

const runWithCorpusDb: {
  <A, E>(
    message: string,
    work: Effect.Effect<A, E, DuckDb>
  ): (databasePath: string) => Effect.Effect<A, CorpusCommandError>;
  <A, E>(
    databasePath: string,
    message: string,
    work: Effect.Effect<A, E, DuckDb>
  ): Effect.Effect<A, CorpusCommandError>;
} = dual(
  3,
  <A, E>(
    databasePath: string,
    message: string,
    work: Effect.Effect<A, E, DuckDb>
  ): Effect.Effect<A, CorpusCommandError> =>
    work.pipe(withDuckDb(DuckDbConnectionOptions.make({ databasePath })), CorpusCommandError.mapError(message))
);

const insertRows: {
  <Row>(
    statement: string,
    rows: ReadonlyArray<Row>,
    toParameters: (row: Row) => Array<string | number | boolean | null>
  ): (db: DuckDbShape) => Effect.Effect<void, DuckDbError>;
  <Row>(
    db: DuckDbShape,
    statement: string,
    rows: ReadonlyArray<Row>,
    toParameters: (row: Row) => Array<string | number | boolean | null>
  ): Effect.Effect<void, DuckDbError>;
} = dual(
  4,
  <Row>(
    db: DuckDbShape,
    statement: string,
    rows: ReadonlyArray<Row>,
    toParameters: (row: Row) => Array<string | number | boolean | null>
  ): Effect.Effect<void, DuckDbError> =>
    Effect.forEach(rows, (row) => db.run(statement, toParameters(row)), { discard: true })
);

const singleRow: {
  <Row>(label: string): (rows: ReadonlyArray<Row>) => Effect.Effect<Row, CorpusCommandError>;
  <Row>(rows: ReadonlyArray<Row>, label: string): Effect.Effect<Row, CorpusCommandError>;
} = dual(
  2,
  <Row>(rows: ReadonlyArray<Row>, label: string): Effect.Effect<Row, CorpusCommandError> =>
    A.head(rows).pipe(
      Effect.fromOption(() => CorpusCommandError.make({ message: `DuckDB returned no rows for ${label}.` }))
    )
);

const basenameOf = (relativePath: string): string =>
  A.last(Str.split(relativePath, "/")).pipe(O.getOrElse(() => relativePath));

const parentDirOf = (relativePath: string): string => {
  const lastSlash = relativePath.lastIndexOf("/");
  return lastSlash === -1 ? "" : relativePath.slice(0, lastSlash);
};

const restorationToRow = (record: CorpusRestorationRecord): Array<string | number | null> =>
  Match.value(record).pipe(
    Match.discriminatorsExhaustive("matchStatus")({
      matched: (matched) => [
        matched.matchStatus,
        matched.sourceLabel,
        matched.pairKey,
        matched.metadataRelativePath,
        matched.contentRelativePath,
        matched.original.originalPath,
        matched.original.originalName,
        matched.original.originalSizeBytes,
        matched.original.deletedAtIso,
        matched.original.deletedAtFiletime,
        matched.original.version,
      ],
      "unmatched-content": (content) => [
        content.matchStatus,
        content.sourceLabel,
        content.pairKey,
        null,
        content.contentRelativePath,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      "unmatched-metadata": (metadata) => [
        metadata.matchStatus,
        metadata.sourceLabel,
        metadata.pairKey,
        metadata.metadataRelativePath,
        null,
        metadata.original.originalPath,
        metadata.original.originalName,
        metadata.original.originalSizeBytes,
        metadata.original.deletedAtIso,
        metadata.original.deletedAtFiletime,
        metadata.original.version,
      ],
    })
  );

const decodeProvenanceLines = Effect.fn("CorpusCommandService.decodeProvenanceLines")(function* (
  manifestText: string
): Effect.fn.Return<ReadonlyArray<CorpusProvenanceRecord>, CorpusCommandError> {
  const lines = A.filter(Str.split(manifestText, "\n"), Str.isNonEmpty);
  const records = yield* Effect.forEach(lines, (line, index) =>
    CorpusLedgerRecordJson.decode(line).pipe(
      CorpusCommandError.mapError(`Provenance manifest line ${index + 1} failed schema validation.`)
    )
  );
  return retainCorpusProvenanceRecords(records);
});

/** @category Testing */
export const decodeProvenanceLinesForTesting = decodeProvenanceLines;

const baseCatalogRunLabel = "base";

class CatalogManifest extends S.Class<CatalogManifest>($I`CatalogManifest`)(
  {
    manifestPath: S.NonEmptyString,
    runLabel: S.NonEmptyString,
  },
  $I.annote("CatalogManifest", {
    description: "A provenance manifest selected for corpus catalog unioning.",
  })
) {}

const catalogCopyModeFor = (record: CorpusProvenanceRecord): "copied" | "provenance-only" =>
  O.getOrElse(O.fromUndefinedOr(record.copyMode), () => "copied");

const catalogDigestPathKey = (sha256: string, rawPath: string): string => `${sha256}\u0000${rawPath}`;

const discoverCatalogManifests = Effect.fn("CorpusCommandService.discoverCatalogManifests")(function* (
  rawRoot: string
): Effect.fn.Return<ReadonlyArray<CatalogManifest>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rawExists = yield* fs
    .exists(rawRoot)
    .pipe(CorpusCommandError.mapError(`Failed checking raw root "${rawRoot}".`));
  if (!rawExists) {
    return A.empty<CatalogManifest>();
  }

  const baseManifestPath = path.join(rawRoot, "provenance.jsonl");
  const baseExists = yield* fs
    .exists(baseManifestPath)
    .pipe(CorpusCommandError.mapError(`Failed checking base provenance manifest "${baseManifestPath}".`));
  const baseManifests = baseExists
    ? [CatalogManifest.make({ manifestPath: baseManifestPath, runLabel: baseCatalogRunLabel })]
    : A.empty<CatalogManifest>();

  const entries = yield* fs
    .readDirectory(rawRoot)
    .pipe(CorpusCommandError.mapError(`Failed reading raw catalog root "${rawRoot}".`));
  const runManifestOptions = yield* Effect.forEach(A.sort(entries, Order.String), (entry) => {
    const entryPath = path.join(rawRoot, entry);
    return fs.stat(entryPath).pipe(
      Effect.flatMap((info) => {
        if (info.type !== "Directory") {
          return Effect.succeed(O.none<CatalogManifest>());
        }
        const manifestPath = path.join(entryPath, "provenance.jsonl");
        return fs.exists(manifestPath).pipe(
          CorpusCommandError.mapError(`Failed checking run provenance manifest "${manifestPath}".`),
          Effect.map((exists) =>
            exists ? O.some(CatalogManifest.make({ manifestPath, runLabel: entry })) : O.none<CatalogManifest>()
          )
        );
      }),
      Effect.catchTag("PlatformError", () => Effect.succeed(O.none<CatalogManifest>()))
    );
  });

  return [...baseManifests, ...A.getSomes(runManifestOptions)];
});

const buildCatalogRunSummaries = (
  records: ReadonlyArray<CorpusCatalogSourceFileRecord>
): ReadonlyArray<CorpusCatalogRunSummary> => {
  const seenDigests = MutableHashSet.empty<string>();
  const runLabels = A.dedupe(A.map(records, (record) => record.runLabel));
  return A.map(runLabels, (runLabel) => {
    const runRecords = A.filter(records, (record) => record.runLabel === runLabel);
    const digests = A.dedupe(A.map(runRecords, (record) => record.sha256));
    const newDistinctDigests = A.reduce(digests, 0, (total, digest) => {
      if (MutableHashSet.has(seenDigests, digest)) {
        return total;
      }
      MutableHashSet.add(seenDigests, digest);
      return total + 1;
    });
    return CorpusCatalogRunSummary.make({
      distinctDigests: NonNegativeInt.make(A.length(digests)),
      newDistinctDigests: NonNegativeInt.make(newDistinctDigests),
      recordCount: NonNegativeInt.make(A.length(runRecords)),
      runLabel,
    });
  });
};

const buildRestorationRecords = Effect.fn("CorpusCommandService.buildRestorationRecords")(function* (
  rawRoot: string,
  records: ReadonlyArray<CorpusCatalogSourceFileRecord>
): Effect.fn.Return<ReadonlyArray<CorpusRestorationRecord>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const destByLabelAndPath = new Map<string, string>();
  const groups = new Map<string, { sourceLabel: string; entries: Array<RecycleBinScanEntry> }>();

  for (const record of records) {
    destByLabelAndPath.set(`${record.sourceLabel}\u0000${record.relativePath}`, record.referencedRawPath);
    const classified = classifyRecycleBinName(basenameOf(record.relativePath));
    if (O.isNone(classified)) {
      continue;
    }
    const groupKey = `${record.sourceLabel}\u0000${parentDirOf(record.relativePath)}`;
    const group = groups.get(groupKey) ?? { entries: [], sourceLabel: record.sourceLabel };
    group.entries.push(
      RecycleBinScanEntry.make({
        kind: classified.value.kind,
        pairKey: classified.value.pairKey,
        relativePath: record.relativePath,
      })
    );
    groups.set(groupKey, group);
  }

  const parseMetadataAt = Effect.fn("CorpusCommandService.parseMetadataAt")(function* (
    sourceLabel: string,
    relativePath: string
  ) {
    const destPath = destByLabelAndPath.get(`${sourceLabel}\u0000${relativePath}`);
    if (destPath === undefined) {
      return yield* CorpusCommandError.make({
        message: `Recycle-bin metadata file "${relativePath}" is missing from the provenance manifest.`,
      });
    }
    // Fail closed: the manifest is untrusted, so only read metadata files that
    // canonicalize inside <corpusRoot>/raw, never an attacker-chosen path.
    const safeDestPath = yield* resolveWithinRoot(
      rawRoot,
      destPath,
      "Provenance metadata path escapes the corpus raw directory"
    );
    const bytes = yield* fs
      .readFile(safeDestPath)
      .pipe(CorpusCommandError.mapError(`Failed reading recycle-bin metadata file "${safeDestPath}".`));
    return yield* parseRecycleBinMetadata(bytes).pipe(
      Effect.mapError((error) =>
        CorpusCommandError.make({ cause: error, message: `${error.message} (file "${relativePath}")` })
      )
    );
  });

  const groupResults = yield* Effect.forEach(
    [...groups.values()],
    Effect.fnUntraced(function* (group) {
      const pairing = pairRecycleBinEntries(group.entries);
      const matched = yield* Effect.forEach(pairing.matched, (pair) =>
        parseMetadataAt(group.sourceLabel, pair.metadataRelativePath).pipe(
          Effect.map((original) =>
            MatchedRestorationRecord.make({
              contentRelativePath: pair.contentRelativePath,
              matchStatus: "matched",
              metadataRelativePath: pair.metadataRelativePath,
              original,
              pairKey: pair.pairKey,
              sourceLabel: group.sourceLabel,
            })
          )
        )
      );
      const unmatchedMetadata = yield* Effect.forEach(pairing.unmatchedMetadata, (entry) =>
        parseMetadataAt(group.sourceLabel, entry.relativePath).pipe(
          Effect.map((original) =>
            UnmatchedMetadataRestorationRecord.make({
              matchStatus: "unmatched-metadata",
              metadataRelativePath: entry.relativePath,
              original,
              pairKey: entry.pairKey,
              sourceLabel: group.sourceLabel,
            })
          )
        )
      );
      const unmatchedContent = A.map(pairing.unmatchedContent, (entry) =>
        UnmatchedContentRestorationRecord.make({
          contentRelativePath: entry.relativePath,
          matchStatus: "unmatched-content",
          pairKey: entry.pairKey,
          sourceLabel: group.sourceLabel,
        })
      );
      return [...matched, ...unmatchedMetadata, ...unmatchedContent];
    })
  );

  return A.flatten(groupResults);
});

const catalogCorpusImpl = Effect.fn("CorpusCommandService.catalogCorpus")(function* (
  options: CorpusCatalogOptions
): Effect.fn.Return<CorpusCatalogSummary, CorpusCommandError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const rawRoot = path.join(options.corpusRoot, "raw");
  const catalogDir = path.join(options.corpusRoot, "catalog");
  const reportsDir = path.join(catalogDir, "reports");
  const databasePath = path.join(catalogDir, "corpus.duckdb");
  const catalogSourceManifestPath = path.join(catalogDir, "source-files.jsonl");
  const restorationManifestPath = path.join(catalogDir, "restoration-manifest.jsonl");
  const duplicateReportPath = path.join(reportsDir, "duplicate-sets.json");
  const summaryReportPath = path.join(reportsDir, "catalog-summary.json");

  const manifests = yield* discoverCatalogManifests(rawRoot);
  if (A.length(manifests) === 0) {
    return yield* CorpusCommandError.make({
      message: `No provenance manifests found under "${rawRoot}". Run salvage before catalog.`,
    });
  }

  yield* fs
    .makeDirectory(reportsDir, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating catalog reports directory "${reportsDir}".`));

  const manifestRecordGroups = yield* Effect.forEach(
    manifests,
    Effect.fn("CorpusCommandService.catalogCorpus.loadManifest")(function* (manifest) {
      const manifestText = yield* fs
        .readFileString(manifest.manifestPath)
        .pipe(CorpusCommandError.mapError(`Failed reading provenance manifest "${manifest.manifestPath}".`));
      const records = yield* decodeProvenanceLines(manifestText);
      return A.map(records, (record) => ({ manifest, record }));
    })
  );
  const manifestRecords = A.flatten(manifestRecordGroups);
  const copiedDigestPaths = MutableHashSet.empty<string>();
  A.forEach(manifestRecords, ({ record }) => {
    if (catalogCopyModeFor(record) === "copied") {
      MutableHashSet.add(copiedDigestPaths, catalogDigestPathKey(record.sha256, record.destPath));
    }
  });

  const catalogRecords = yield* Effect.forEach(
    manifestRecords,
    Effect.fn("CorpusCommandService.catalogCorpus.toCatalogRecord")(function* ({ manifest, record }) {
      const copyMode = catalogCopyModeFor(record);
      const dedupeOfPath = O.fromUndefinedOr(record.dedupeOfPath);
      if (copyMode === "provenance-only" && O.isNone(dedupeOfPath)) {
        return yield* CorpusCommandError.make({
          message: `Provenance-only record ${record.sourceLabel}/${record.relativePath} in run "${manifest.runLabel}" is missing dedupeOfPath.`,
        });
      }
      const referencedRawPath =
        copyMode === "provenance-only" && O.isSome(dedupeOfPath) ? dedupeOfPath.value : record.destPath;
      if (
        copyMode === "provenance-only" &&
        !MutableHashSet.has(copiedDigestPaths, catalogDigestPathKey(record.sha256, referencedRawPath))
      ) {
        return yield* CorpusCommandError.make({
          message: `Provenance-only record ${record.sourceLabel}/${record.relativePath} in run "${manifest.runLabel}" references missing canonical raw path "${referencedRawPath}" for digest ${record.sha256}.`,
        });
      }
      return CorpusCatalogSourceFileRecord.make({
        copyMode,
        destPath: record.destPath,
        mtimeEpoch: record.mtimeEpoch,
        mtimeIso: record.mtimeIso,
        originPath: record.originPath,
        referencedRawPath,
        relativePath: record.relativePath,
        runLabel: manifest.runLabel,
        salvagedAt: record.salvagedAt,
        sha256: record.sha256,
        sizeBytes: record.sizeBytes,
        sourceLabel: record.sourceLabel,
        ...(O.isSome(dedupeOfPath) ? { dedupeOfPath: dedupeOfPath.value } : {}),
      });
    })
  );
  const catalogRecordLines = yield* Effect.forEach(catalogRecords, (record) =>
    encodeCorpusCatalogSourceFileRecordJson(record).pipe(
      CorpusCommandError.mapError("Catalog source-file occurrence failed JSONL encoding.")
    )
  );
  yield* fs
    .writeFileString(catalogSourceManifestPath, jsonlContent(catalogRecordLines))
    .pipe(CorpusCommandError.mapError(`Failed writing catalog source manifest "${catalogSourceManifestPath}".`));

  const runSummaries = buildCatalogRunSummaries(catalogRecords);
  yield* Console.log(
    `corpus catalog: ${A.length(catalogRecords)} provenance records validated across ${A.length(manifests)} run manifests`
  );
  yield* Effect.forEach(
    runSummaries,
    (run) =>
      Console.log(
        `corpus catalog: run=${run.runLabel} records=${run.recordCount} distinctDigests=${run.distinctDigests} newDistinctDigests=${run.newDistinctDigests}`
      ),
    { discard: true }
  );

  const restorations = yield* buildRestorationRecords(rawRoot, catalogRecords);
  const matchedCount = A.length(A.filter(restorations, (record) => record.matchStatus === "matched"));
  const unmatchedMetadataCount = A.length(
    A.filter(restorations, (record) => record.matchStatus === "unmatched-metadata")
  );
  const unmatchedContentCount = A.length(
    A.filter(restorations, (record) => record.matchStatus === "unmatched-content")
  );
  yield* Console.log(
    `corpus catalog: recycle-bin pairing matched=${matchedCount} unmatched-metadata=${unmatchedMetadataCount} unmatched-content=${unmatchedContentCount}`
  );

  const duckDbWork = Effect.gen(function* () {
    const db = yield* DuckDb;
    yield* db.run(createSourceFilesTable(catalogSourceManifestPath));
    yield* db.run(createDuplicateSetsView);
    yield* db.run(createRestorationsTable);
    yield* Effect.forEach(restorations, (record) => db.run(insertRestorationStatement, restorationToRow(record)), {
      discard: true,
    });
    const sourceTotalsRows = yield* db.query(sourceTotalsStatement);
    const duplicateTotalsRows = yield* db.query(duplicateTotalsStatement);
    const duplicateSetRows = yield* db.query(duplicateSetRowsStatement);
    return { duplicateSetRows, duplicateTotalsRows, sourceTotalsRows };
  });

  const queried = yield* runWithCorpusDb(
    databasePath,
    `Failed building the DuckDB catalog at "${databasePath}".`,
    duckDbWork
  );

  const sourceTotals = yield* decodeSourceTotalsRows(queried.sourceTotalsRows).pipe(
    CorpusCommandError.mapError("DuckDB source totals row failed schema validation."),
    Effect.flatMap((rows) => singleRow(rows, "source totals"))
  );
  const duplicateTotals = yield* decodeDuplicateTotalsRows(queried.duplicateTotalsRows).pipe(
    CorpusCommandError.mapError("DuckDB duplicate totals row failed schema validation."),
    Effect.flatMap((rows) => singleRow(rows, "duplicate totals"))
  );

  const duplicateReportJson = yield* decodeDuplicateSetRecords(queried.duplicateSetRows).pipe(
    Effect.flatMap(encodeCorpusDuplicateSetReportJson),
    CorpusCommandError.mapError("Duplicate-set report rows failed schema validation.")
  );
  yield* fs
    .writeFileString(duplicateReportPath, `${duplicateReportJson}\n`)
    .pipe(CorpusCommandError.mapError(`Failed writing duplicate-set report "${duplicateReportPath}".`));

  const restorationLines = yield* Effect.forEach(restorations, (record) =>
    encodeCorpusRestorationRecordJson(record).pipe(
      CorpusCommandError.mapError("Restoration record failed JSONL encoding.")
    )
  );
  yield* fs
    .writeFileString(restorationManifestPath, jsonlContent(restorationLines))
    .pipe(CorpusCommandError.mapError(`Failed writing restoration manifest "${restorationManifestPath}".`));

  const summary = CorpusCatalogSummary.make({
    distinctDigests: NonNegativeInt.make(sourceTotals.distinctDigests),
    duplicateFiles: NonNegativeInt.make(duplicateTotals.duplicateFiles),
    duplicateSets: NonNegativeInt.make(duplicateTotals.duplicateSets),
    matchedRestorations: NonNegativeInt.make(matchedCount),
    redundantBytes: NonNegativeInt.make(duplicateTotals.redundantBytes),
    runs: runSummaries,
    sourceFiles: NonNegativeInt.make(sourceTotals.sourceFiles),
    totalBytes: NonNegativeInt.make(sourceTotals.totalBytes),
    unmatchedContentFiles: NonNegativeInt.make(unmatchedContentCount),
    unmatchedMetadataFiles: NonNegativeInt.make(unmatchedMetadataCount),
  });

  const summaryJson = yield* encodeCorpusCatalogSummaryJson(summary).pipe(
    CorpusCommandError.mapError("Catalog summary failed JSON encoding.")
  );
  yield* fs
    .writeFileString(summaryReportPath, `${summaryJson}\n`)
    .pipe(CorpusCommandError.mapError(`Failed writing catalog summary "${summaryReportPath}".`));

  yield* Console.log(
    `corpus catalog: files=${summary.sourceFiles} bytes=${summary.totalBytes} distinctDigests=${summary.distinctDigests} duplicateSets=${summary.duplicateSets} duplicateFiles=${summary.duplicateFiles} redundantBytes=${summary.redundantBytes}`
  );
  yield* Console.log(`corpus catalog: database "${databasePath}"`);
  yield* Console.log(`corpus catalog: restoration manifest "${restorationManifestPath}"`);
  yield* Console.log(`corpus catalog: reports "${reportsDir}"`);

  return summary;
});

const extractCoverageFormats: ReadonlyArray<FileFormatFamily> = [
  "doc",
  "docx",
  "docm",
  "rtf",
  "html",
  "xhtml",
  "pdf-text-layer",
  "pst",
  "plain-text",
  "markdown",
  "image-metadata",
  "xls",
  "xlsx",
  "unknown",
];

const engineFamilyFromName = (engineName: string): FileProcessingEngineFamily =>
  Match.value(engineName).pipe(
    Match.when("libpff", () => "libpff" as const),
    Match.when("apache-tika", () => "tika" as const),
    Match.orElse(() => "auto" as const)
  );

const decodePosixPath = S.decodeUnknownEffect(PosixPath);
const decodeArtifactId = S.decodeUnknownEffect(ArtifactId);
const decodeContentDigest = S.decodeUnknownEffect(ContentDigest);
const decodeOperationId = S.decodeUnknownEffect(OperationId);
const decodeSha256Hex = S.decodeUnknownEffect(Sha256Hex);
const decodeSha256FromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeSourceArtifact = S.decodeUnknownEffect(SourceArtifact);
const encodeMetadataRecordJson = S.encodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.String)));
const operationTextEncoder = new TextEncoder();
const jsonlTextEncoder = new TextEncoder();

const deriveCorpusOperationId = Effect.fn("CorpusCommandService.deriveCorpusOperationId")(function* (
  text: string
): Effect.fn.Return<OperationId, CorpusCommandError, Crypto.Crypto> {
  const digest = yield* decodeSha256FromBytes(operationTextEncoder.encode(text)).pipe(
    CorpusCommandError.mapError("Operation id digest derivation failed.")
  );
  return yield* decodeOperationId(`operation:${digest}`).pipe(
    CorpusCommandError.mapError("Operation id decoding failed.")
  );
});

const extensionOf = (name: string): string | undefined => {
  const dot = name.lastIndexOf(".");
  return dot <= 0 || dot === name.length - 1 ? undefined : name.slice(dot + 1).toLowerCase();
};

// Fail-closed resolver for manifest-supplied paths: the provenance manifest is
// untrusted input, so a `destPath` (or organize target) must canonicalize to a
// real path inside the allowed root before it is read, hashed, copied, or
// passed to an extraction engine. `resolvePathWithinRoot` follows symlinks and
// rejects absolute escapes and `..` traversal, returning the in-root canonical
// path callers should use for the actual filesystem operation.
const resolveWithinRoot = Effect.fn("CorpusCommandService.resolveWithinRoot")(function* (
  root: string,
  candidate: string,
  label: string
): Effect.fn.Return<string, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* resolvePathWithinRoot({ candidate, root }).pipe(
    Effect.mapError((error) =>
      CorpusCommandError.make({ cause: error, message: `${label} "${candidate}": ${error.message}` })
    )
  );
});

// fallow-ignore-next-line complexity -- pre-existing extract-label validation re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const extractOutputLabel = (outLabel: string | undefined): Effect.Effect<string, CorpusCommandError> => {
  const label = outLabel ?? "extract";
  return Str.isEmpty(Str.trim(label)) ||
    label === "." ||
    label === ".." ||
    Str.includes("/")(label) ||
    Str.includes("\\")(label) ||
    Str.includes("\u0000")(label)
    ? Effect.fail(
        CorpusCommandError.make({
          message: `Invalid corpus extract out-label "${label}"; use a single directory name under staging/.`,
        })
      )
    : Effect.succeed(label);
};

const writeCorpusStringFile = Effect.fn("CorpusCommandService.writeCorpusStringFile")(function* (
  outputPath: string,
  content: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(outputPath), { recursive: true })
    .pipe(
      Effect.andThen(fs.writeFileString(outputPath, content)),
      CorpusCommandError.mapError(`Failed writing corpus output "${outputPath}".`)
    );
});

const hashFileSha256 = Effect.fn("CorpusCommandService.hashFileSha256")(function* (
  filePath: string
): Effect.fn.Return<string, CorpusCommandError, FileSystem.FileSystem | Crypto.Crypto> {
  return yield* sharedHashFileSha256(filePath, (cause) =>
    CorpusCommandError.make({ cause, message: `Failed hashing file "${filePath}".` })
  );
});

interface CorpusExtractOutcome {
  readonly childArtifactCount: number;
  readonly failure: O.Option<FileProcessingFailureRecord>;
  readonly sourceRecord: SourceProcessingRecord;
  readonly strategy: SelectedStrategy;
}

const failedOutcome = (
  record: CorpusProvenanceRecord,
  ids: {
    readonly artifactId: ArtifactId;
    readonly digest: ContentDigest;
    readonly operationId: OperationId;
    readonly relativePath: PosixPath;
  },
  reason: "file-detection-failed" | "engine-unavailable" | "unsupported-file-format",
  message: string
): CorpusExtractOutcome => ({
  childArtifactCount: 0,
  failure: O.some(
    FailedFileProcessingFailureRecord.make({
      artifactId: ids.artifactId,
      format: "unknown",
      message,
      operationId: ids.operationId,
      reason,
      relativePath: ids.relativePath,
      status: "failed",
    })
  ),
  sourceRecord: FailedSourceProcessingRecord.make({
    artifactId: ids.artifactId,
    digest: ids.digest,
    format: "unknown",
    operationId: ids.operationId,
    relativePath: ids.relativePath,
    sizeBytes: record.sizeBytes,
    status: "failed",
  }),
  strategy: UnsupportedSelectedStrategy.make({
    disposition: "unsupported",
    engine: "auto",
    format: "unknown",
    operationKind: "process",
    skipReason: reason === "engine-unavailable" ? "engine-unavailable" : "unsupported-format",
  }),
});

const jsonlContent = (lines: ReadonlyArray<string>): string =>
  A.length(lines) === 0 ? "" : `${A.join(lines, "\n")}\n`;

const appendCorpusJsonLines = Effect.fn("CorpusCommandService.appendCorpusJsonLines")(function* (
  manifestPath: string,
  lines: ReadonlyArray<string>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(manifestPath), { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating manifest directory for "${manifestPath}".`));

  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(manifestPath, { flag: "a" })
        .pipe(CorpusCommandError.mapError(`Failed opening append-only manifest "${manifestPath}".`));
      yield* Effect.forEach(
        lines,
        (line) =>
          file
            .writeAll(jsonlTextEncoder.encode(`${line}\n`))
            .pipe(CorpusCommandError.mapError(`Failed appending manifest record to "${manifestPath}".`)),
        { discard: true, concurrency: 1 }
      );
      yield* file.sync.pipe(CorpusCommandError.mapError(`Failed syncing manifest "${manifestPath}".`));
    })
  );
});

const prepareExtractOutputDir = Effect.fn("CorpusCommandService.prepareExtractOutputDir")(function* (
  outDir: string,
  childrenRoot: string,
  overwrite: boolean
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const outDirExists = yield* fs
    .exists(outDir)
    .pipe(CorpusCommandError.mapError(`Failed checking extract output directory "${outDir}".`));
  if (outDirExists && !overwrite) {
    return yield* CorpusCommandError.make({
      message: `Extract output "${outDir}" already exists; pass --overwrite to replace it.`,
    });
  }
  if (outDirExists) {
    yield* fs
      .remove(outDir, { recursive: true })
      .pipe(CorpusCommandError.mapError(`Failed removing previous extract output "${outDir}".`));
  }
  yield* fs
    .makeDirectory(childrenRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating extract output "${childrenRoot}".`));
});

const dedupeBySha256 = <A extends { readonly sha256: string }>(
  records: ReadonlyArray<A>
): { readonly duplicatesSkipped: number; readonly kept: ReadonlyArray<A> } => {
  const seen = MutableHashSet.empty<string>();
  const kept = A.filter(records, (record) => {
    if (MutableHashSet.has(seen, record.sha256)) {
      return false;
    }
    MutableHashSet.add(seen, record.sha256);
    return true;
  });
  return { duplicatesSkipped: A.length(records) - A.length(kept), kept };
};

const selectExtractRecords = (
  allRecords: ReadonlyArray<CorpusProvenanceRecord>,
  options: CorpusExtractOptions
): { readonly duplicatesSkipped: number; readonly selected: ReadonlyArray<CorpusProvenanceRecord> } => {
  const labeled =
    options.sourceLabel === undefined
      ? allRecords
      : A.filter(allRecords, (record) => record.sourceLabel === options.sourceLabel);

  const { duplicatesSkipped, kept } = options.includeDuplicates
    ? { duplicatesSkipped: 0, kept: labeled }
    : dedupeBySha256(labeled);
  const selected = options.maxFiles === undefined ? kept : A.take(kept, Math.max(0, Math.floor(options.maxFiles)));
  return { duplicatesSkipped, selected };
};

// fallow-ignore-next-line complexity -- pre-existing extract coverage reducer re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const buildExtractCoverage = (
  sourceRecords: ReadonlyArray<SourceProcessingRecord>
): Effect.Effect<FileProcessingCoverageSummary, CorpusCommandError> => {
  const byFormat: Record<string, Record<string, number>> = {};
  for (const format of extractCoverageFormats) {
    byFormat[format] = { failed: 0, skipped: 0, succeeded: 0 };
  }
  for (const record of sourceRecords) {
    const counts = byFormat[record.format] ?? { failed: 0, skipped: 0, succeeded: 0 };
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    byFormat[record.format] = counts;
  }
  return S.decodeUnknownEffect(FileProcessingCoverageSummary)({
    byFormat,
    failedCount: A.length(A.filter(sourceRecords, (record) => record.status === "failed")),
    skippedCount: A.length(A.filter(sourceRecords, (record) => record.status === "skipped")),
    sourceCount: A.length(sourceRecords),
    succeededCount: A.length(A.filter(sourceRecords, (record) => record.status === "succeeded")),
    textArtifactCount: A.length(
      A.filter(sourceRecords, (record) => record.status === "succeeded" && record.textPath !== undefined)
    ),
  }).pipe(CorpusCommandError.mapError("Coverage summary failed schema validation."));
};

const extractCorpusImpl = Effect.fn("CorpusCommandService.extractCorpus")(function* (
  options: CorpusExtractOptions
): Effect.fn.Return<CorpusExtractSummary, CorpusCommandError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const rawRoot = path.join(options.corpusRoot, "raw");
  const outLabel = yield* extractOutputLabel(options.outLabel);
  const outDir = path.join(options.corpusRoot, "staging", outLabel);
  const childrenRoot = path.join(outDir, "children");
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));

  yield* prepareExtractOutputDir(outDir, childrenRoot, options.overwrite);

  const manifests = yield* discoverCatalogManifests(rawRoot);
  const recordBatches = yield* Effect.forEach(manifests, (manifest) =>
    fs
      .readFileString(manifest.manifestPath)
      .pipe(
        CorpusCommandError.mapError(`Failed reading provenance manifest "${manifest.manifestPath}".`),
        Effect.flatMap(decodeProvenanceLines)
      )
  );
  const allRecords = A.flatten(recordBatches);
  const { duplicatesSkipped, selected } = selectExtractRecords(allRecords, options);
  yield* Console.log(
    `corpus extract: ${A.length(selected)} sources selected (${duplicatesSkipped} duplicate copies skipped, ${A.length(allRecords)} manifest records)`
  );

  const libpffEngine = yield* makePffexportFileProcessingEngine(
    PffexportEngineConfig.make({
      exportRoot: childrenRoot,
      ...O.getSomesStruct({ pffexportPath: O.fromUndefinedOr(options.pffexportPath) }),
    })
  );
  const tikaEngine = yield* makeTikaAppFileProcessingEngine(
    TikaAppEngineConfig.make({
      jarPath: options.tikaJarPath,
      ...O.getSomesStruct({ javaPath: O.fromUndefinedOr(options.javaPath) }),
    })
  );
  const engines: ReadonlyArray<FileProcessingEngineShape> = [libpffEngine, tikaEngine];

  const completedRef = yield* Ref.make(0);
  const total = A.length(selected);

  const processOneSource = Effect.fn("CorpusCommandService.processOneSource")(function* (
    record: CorpusProvenanceRecord
  ): Effect.fn.Return<
    CorpusExtractOutcome,
    CorpusCommandError,
    Crypto.Crypto | FileProcessingService | FileSystem.FileSystem | Path.Path
  > {
    const sanitizedRelative = `${record.sourceLabel}/${record.relativePath}`.replaceAll("\\", "/");
    const artifactId = yield* decodeArtifactId(`artifact:${record.sha256}`).pipe(
      CorpusCommandError.mapError("Provenance sha256 failed artifact id decoding.")
    );
    const digest = yield* decodeContentDigest(`sha256:${record.sha256}`).pipe(
      CorpusCommandError.mapError("Provenance sha256 failed digest decoding.")
    );
    const operationId = yield* deriveCorpusOperationId(`corpus-extract:${record.sha256}`);
    const fallbackRelative = yield* decodePosixPath(sanitizedRelative).pipe(
      CorpusCommandError.mapError("Sanitized relative path failed decoding.")
    );
    const ids = { artifactId, digest, operationId, relativePath: fallbackRelative };

    // Fail closed before extraction: the manifest is untrusted, so the source
    // file must canonicalize to a real path inside <corpusRoot>/raw rather than
    // an attacker-chosen absolute path or `..`/symlink escape.
    const safeSourcePath = yield* resolveWithinRoot(
      rawRoot,
      record.destPath,
      "Provenance source path escapes the corpus raw directory"
    );
    const sourceBytes = yield* fs
      .readFile(safeSourcePath)
      .pipe(CorpusCommandError.mapError(`Failed reading corpus source "${safeSourcePath}".`));

    const source = yield* decodeSourceArtifact({
      bytes: sourceBytes,
      digest,
      id: artifactId,
      locator: { kind: "file", value: safeSourcePath },
      name: basenameOf(record.relativePath),
      relativePath: `${record.sourceLabel}/${record.relativePath}`,
      sizeBytes: record.sizeBytes,
      ...O.getSomesStruct({ extension: O.fromUndefinedOr(extensionOf(basenameOf(record.relativePath))) }),
    }).pipe(Effect.option);

    if (O.isNone(source)) {
      return failedOutcome(
        record,
        ids,
        "file-detection-failed",
        "Source path or name is not portable (likely contains a backslash); skipped by corpus extract."
      );
    }

    const outcome = yield* processFile(
      ProcessFileOperation.make({
        exportChildren: options.exportChildren,
        operationId,
        operationKind: "process",
        preference: { engine: "auto" },
        source: source.value,
      })
    ).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.succeed(
            failedOutcome(
              record,
              ids,
              error.reason === "engine-unavailable" ? "engine-unavailable" : "unsupported-file-format",
              error.message
            )
          ),
        onSuccess: (result) =>
          Match.value(result).pipe(
            Match.discriminatorsExhaustive("resultKind")({
              "archive-exported": Effect.fn("CorpusCommandService.archiveExportedOutcome")(function* (
                archive: ArchiveExportProcessFileResult
              ) {
                const childLines = yield* Effect.forEach(archive.archiveExport.children, (child) =>
                  encodeChildArtifactRecordJson(
                    ChildArtifactRecord.make({ child, sourceArtifactId: archive.sourceArtifactId })
                  ).pipe(CorpusCommandError.mapError("Child artifact record failed JSONL encoding."))
                );
                yield* writeCorpusStringFile(
                  path.join(outDir, "children", archive.sourceArtifactId, "artifacts.jsonl"),
                  jsonlContent(childLines)
                );
                return {
                  childArtifactCount: A.length(archive.archiveExport.children),
                  failure: O.none<FileProcessingFailureRecord>(),
                  sourceRecord: SucceededSourceProcessingRecord.make({
                    artifactId: ids.artifactId,
                    digest: ids.digest,
                    engine: archive.engine,
                    format: archive.format,
                    operationId: ids.operationId,
                    relativePath: ids.relativePath,
                    sizeBytes: record.sizeBytes,
                    status: "succeeded",
                  }),
                  strategy: SupportedSelectedStrategy.make({
                    disposition: "supported",
                    engine: engineFamilyFromName(archive.engine),
                    format: archive.format,
                    operationKind: "export-archive",
                  }),
                } satisfies CorpusExtractOutcome;
              }),
              // fallow-ignore-next-line complexity -- pre-existing extraction outcome transaction re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
              extracted: Effect.fn("CorpusCommandService.extractedOutcome")(function* (
                extracted: ExtractedProcessFileResult
              ) {
                const textRelative =
                  extracted.extraction.text === undefined ? O.none() : O.some(`text/${ids.operationId}.txt`);
                if (O.isSome(textRelative) && extracted.extraction.text !== undefined) {
                  yield* writeCorpusStringFile(path.join(outDir, textRelative.value), extracted.extraction.text);
                }
                const metadataJson = yield* encodeMetadataRecordJson(extracted.extraction.metadata).pipe(
                  CorpusCommandError.mapError("Extraction metadata failed JSON encoding.")
                );
                yield* writeCorpusStringFile(
                  path.join(outDir, "metadata", `${ids.operationId}.json`),
                  `${metadataJson}\n`
                );
                const textPath = O.isNone(textRelative)
                  ? O.none()
                  : O.some(
                      yield* decodePosixPath(textRelative.value).pipe(
                        CorpusCommandError.mapError("Text artifact path failed decoding.")
                      )
                    );
                return {
                  childArtifactCount: 0,
                  failure: O.none<FileProcessingFailureRecord>(),
                  sourceRecord: SucceededSourceProcessingRecord.make({
                    artifactId: ids.artifactId,
                    digest: ids.digest,
                    engine: extracted.engine,
                    format: extracted.format,
                    operationId: ids.operationId,
                    relativePath: ids.relativePath,
                    sizeBytes: record.sizeBytes,
                    status: "succeeded",
                    ...(O.isNone(textPath) ? {} : { textPath: textPath.value }),
                  }),
                  strategy: SupportedSelectedStrategy.make({
                    disposition: "supported",
                    engine: engineFamilyFromName(extracted.engine),
                    format: extracted.format,
                    operationKind: "extract",
                  }),
                } satisfies CorpusExtractOutcome;
              }),
              skipped: (skipped) =>
                Effect.succeed({
                  childArtifactCount: 0,
                  failure: O.some(
                    SkippedFileProcessingFailureRecord.make({
                      artifactId: ids.artifactId,
                      engine: skipped.engine,
                      format: skipped.format,
                      message: A.join(skipped.warnings, " ") || `Skipped: ${skipped.skipReason}.`,
                      operationId: ids.operationId,
                      reason: skipped.skipReason,
                      relativePath: ids.relativePath,
                      status: "skipped",
                    })
                  ),
                  sourceRecord: SkippedSourceProcessingRecord.make({
                    artifactId: ids.artifactId,
                    digest: ids.digest,
                    engine: skipped.engine,
                    format: skipped.format,
                    operationId: ids.operationId,
                    relativePath: ids.relativePath,
                    sizeBytes: record.sizeBytes,
                    skipReason: skipped.skipReason,
                    status: "skipped",
                  }),
                  strategy: DeferredSelectedStrategy.make({
                    disposition: "deferred",
                    engine: engineFamilyFromName(skipped.engine),
                    format: skipped.format,
                    operationKind: "process",
                    skipReason: skipped.skipReason,
                  }),
                } satisfies CorpusExtractOutcome),
            })
          ),
      })
    );

    const completed = yield* Ref.updateAndGet(completedRef, (value) => value + 1);
    if (completed % 250 === 0 || completed === total) {
      yield* Console.log(`corpus extract: ${completed}/${total} sources processed`);
    }
    return outcome;
  });

  const fileProcessingLayer = makeFileProcessingServiceLayer(engines);
  const outcomes = yield* Effect.scoped(
    Layer.build(fileProcessingLayer).pipe(
      Effect.flatMap((context) =>
        Effect.forEach(selected, (record) => processOneSource(record).pipe(Effect.provide(context)), {
          concurrency,
        })
      )
    )
  );

  const { failureRecords, sourceRecords } = collectSourceOutcomeRecords(outcomes);
  const childArtifactCount = A.reduce(outcomes, 0, (total_, outcome) => total_ + outcome.childArtifactCount);
  const coverage = yield* buildExtractCoverage(sourceRecords);

  const runId = yield* deriveCorpusOperationId(
    `corpus-extract-run:${A.join(
      A.map(selected, (record) => record.sha256),
      "|"
    )}`
  );
  const runManifest = ProcessRunManifest.make({
    coverage,
    engine: "auto",
    manifestVersion: "beep.file-processing.run.v1",
    outputRoot: ".",
    runId,
    sourceRootLabel: "corpus-raw",
    strategies: A.map(outcomes, (outcome) => outcome.strategy),
  });

  const runJson = yield* encodeProcessRunManifestJson(runManifest).pipe(
    CorpusCommandError.mapError("Run manifest failed JSON encoding.")
  );
  const coverageJson = yield* encodeFileProcessingCoverageSummaryJson(coverage).pipe(
    CorpusCommandError.mapError("Coverage summary failed JSON encoding.")
  );
  const sourceLines = yield* Effect.forEach(sourceRecords, (record) =>
    encodeSourceProcessingRecordJson(record).pipe(
      CorpusCommandError.mapError("Source processing record failed JSONL encoding.")
    )
  );
  const failureLines = yield* Effect.forEach(failureRecords, (record) =>
    encodeFileProcessingFailureRecordJson(record).pipe(
      CorpusCommandError.mapError("Failure record failed JSONL encoding.")
    )
  );

  yield* writeCorpusStringFile(path.join(outDir, "run.json"), `${runJson}\n`);
  yield* writeCorpusStringFile(path.join(outDir, "coverage.json"), `${coverageJson}\n`);
  yield* writeCorpusStringFile(path.join(outDir, "sources.jsonl"), jsonlContent(sourceLines));
  yield* writeCorpusStringFile(path.join(outDir, "failures.jsonl"), jsonlContent(failureLines));

  const summary = CorpusExtractSummary.make({
    childArtifactCount: NonNegativeInt.make(childArtifactCount),
    duplicatesSkipped: NonNegativeInt.make(duplicatesSkipped),
    failedCount: coverage.failedCount,
    skippedCount: coverage.skippedCount,
    sourceCount: coverage.sourceCount,
    succeededCount: coverage.succeededCount,
    textArtifactCount: coverage.textArtifactCount,
  });
  const summaryJson = yield* encodeCorpusExtractSummaryJson(summary).pipe(
    CorpusCommandError.mapError("Extract summary failed JSON encoding.")
  );
  yield* writeCorpusStringFile(path.join(outDir, "extract-summary.json"), `${summaryJson}\n`);

  yield* Console.log(
    `corpus extract: sources=${summary.sourceCount} succeeded=${summary.succeededCount} skipped=${summary.skippedCount} failed=${summary.failedCount} textArtifacts=${summary.textArtifactCount} children=${summary.childArtifactCount}`
  );
  yield* Console.log(`corpus extract: output "${outDir}"`);

  return summary;
});

interface ArchiveProvenanceMatch {
  readonly provenancePath: string;
  readonly rawRoot: string;
  readonly record: CorpusProvenanceRecord;
}

interface ArchiveValidatedFile {
  readonly copyMode: "copied" | "provenance-only";
  readonly originPath: string;
}

const zeroSha256 = "0000000000000000000000000000000000000000000000000000000000000000";

const isSafePathSegment = (value: string): boolean =>
  value !== "." && value !== ".." && !Str.includes("/")(value) && !Str.includes("\\")(value);

const validatePathSegment = Effect.fn("CorpusCommandService.validatePathSegment")(function* (
  label: string,
  value: string
): Effect.fn.Return<void, CorpusCommandError> {
  if (isSafePathSegment(value)) {
    return;
  }
  return yield* CorpusCommandError.make({
    message: `${label} must be a single path segment; received "${value}".`,
  });
});

const fileMtimeFields = (info: FileSystem.File.Info): { readonly mtimeEpoch: number; readonly mtimeIso: string } => {
  const dateTime = O.map(info.mtime, DateTime.makeUnsafe);
  return {
    mtimeEpoch: O.getOrElse(
      O.map(dateTime, (mtime) => Math.floor(DateTime.toEpochMillis(mtime) / 1000)),
      () => 0
    ),
    mtimeIso: O.getOrElse(O.map(dateTime, DateTime.formatIso), () => "1970-01-01T00:00:00.000Z"),
  };
};

const collectSalvageSourceFiles = Effect.fn("CorpusCommandService.collectSalvageSourceFiles")(function* (
  spec: CorpusSalvageSourceSpec
): Effect.fn.Return<ReadonlyArray<CorpusSalvageOriginFile>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* validatePathSegment("Salvage source label", spec.sourceLabel);

  const sourceRoot = path.resolve(spec.sourcePath);
  const sourceInfo = yield* fs
    .stat(sourceRoot)
    .pipe(CorpusCommandError.mapError(`Failed inspecting salvage source "${sourceRoot}".`));
  const relativeRoot = sourceInfo.type === "Directory" ? sourceRoot : path.dirname(sourceRoot);

  const makeFile = Effect.fn("CorpusCommandService.makeSalvageOriginFile")(function* (
    filePath: string,
    info: FileSystem.File.Info
  ) {
    // Keep source filenames opaque: Bun's realpath can reject otherwise valid
    // POSIX names such as paths containing literal backslashes.
    const originPath = path.resolve(filePath);
    const rawRelative =
      sourceInfo.type === "Directory" ? path.relative(relativeRoot, filePath) : path.basename(filePath);
    const mtime = fileMtimeFields(info);
    return CorpusSalvageOriginFile.make({
      mtimeEpoch: mtime.mtimeEpoch,
      mtimeIso: mtime.mtimeIso,
      originPath,
      relativePath: rawRelative,
      sizeBytes: NonNegativeInt.make(Number(info.size)),
      sourceLabel: spec.sourceLabel,
    });
  });

  const collectAt: (
    currentPath: string
  ) => Effect.Effect<ReadonlyArray<CorpusSalvageOriginFile>, CorpusCommandError, FileSystem.FileSystem | Path.Path> =
    Effect.fn("CorpusCommandService.collectSalvageSourceFiles.collectAt")(function* (currentPath) {
      const info = yield* fs
        .stat(currentPath)
        .pipe(CorpusCommandError.mapError(`Failed inspecting salvage source entry "${currentPath}".`));
      if (info.type === "File") {
        return [yield* makeFile(currentPath, info)];
      }
      if (info.type !== "Directory") {
        return A.empty<CorpusSalvageOriginFile>();
      }
      const entries = yield* fs
        .readDirectory(currentPath)
        .pipe(CorpusCommandError.mapError(`Failed reading salvage source directory "${currentPath}".`));
      const childFiles = yield* Effect.forEach(A.sort(entries, Order.String), (entry) =>
        collectAt(path.join(currentPath, entry))
      );
      return A.flatten(childFiles);
    });

  return yield* collectAt(sourceRoot);
});

const addDigestRows = (
  index: MutableHashMap.MutableHashMap<string, string>,
  rows: ReadonlyArray<CorpusCatalogDigestRow>
): void => {
  A.forEach(rows, (row) => {
    if (O.isNone(MutableHashMap.get(index, row.sha256))) {
      MutableHashMap.set(index, row.sha256, row.destPath);
    }
  });
};

const loadCatalogDigestRows = Effect.fn("CorpusCommandService.loadCatalogDigestRows")(function* (
  databasePath: string
): Effect.fn.Return<O.Option<ReadonlyArray<CorpusCatalogDigestRow>>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(databasePath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return O.none();
  }
  return yield* runWithCorpusDb(
    databasePath,
    `Failed reading existing corpus catalog digest index at "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      const rows = yield* db.query(catalogDigestRowsStatement);
      return yield* decodeCatalogDigestRows(rows).pipe(
        CorpusCommandError.mapError("Catalog digest rows failed schema validation.")
      );
    })
  ).pipe(Effect.option);
});

const findRawProvenanceManifests = Effect.fn("CorpusCommandService.findRawProvenanceManifests")(function* (
  rawRoot: string
): Effect.fn.Return<ReadonlyArray<string>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(rawRoot).pipe(CorpusCommandError.mapError(`Failed checking raw root "${rawRoot}".`));
  if (!exists) {
    return A.empty<string>();
  }

  const collectAt: (
    directory: string
  ) => Effect.Effect<ReadonlyArray<string>, CorpusCommandError, FileSystem.FileSystem | Path.Path> = Effect.fn(
    "CorpusCommandService.findRawProvenanceManifests.collectAt"
  )(function* (directory) {
    const entries = yield* fs
      .readDirectory(directory)
      .pipe(CorpusCommandError.mapError(`Failed reading raw manifest directory "${directory}".`));
    const manifests = yield* Effect.forEach(A.sort(entries, Order.String), (entry) => {
      const entryPath = path.join(directory, entry);
      return fs.stat(entryPath).pipe(
        Effect.flatMap((info) => {
          if (info.type === "File" && entry === "provenance.jsonl") {
            return Effect.succeed([entryPath]);
          }
          if (info.type === "Directory") {
            return collectAt(entryPath);
          }
          return Effect.succeed(A.empty<string>());
        }),
        Effect.catchTag("PlatformError", () => Effect.succeed(A.empty<string>()))
      );
    });
    return A.flatten(manifests);
  });

  return yield* collectAt(rawRoot);
});

const loadManifestDigestRows = Effect.fn("CorpusCommandService.loadManifestDigestRows")(function* (
  manifestPath: string
): Effect.fn.Return<ReadonlyArray<CorpusCatalogDigestRow>, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const manifestText = yield* fs
    .readFileString(manifestPath)
    .pipe(CorpusCommandError.mapError(`Failed reading existing provenance manifest "${manifestPath}".`));
  const records = yield* decodeProvenanceLines(manifestText);
  return A.map(records, (record) => CorpusCatalogDigestRow.make({ destPath: record.destPath, sha256: record.sha256 }));
});

const loadSalvageDigestIndex = Effect.fn("CorpusCommandService.loadSalvageDigestIndex")(function* (
  corpusRoot: string
): Effect.fn.Return<
  MutableHashMap.MutableHashMap<string, string>,
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const rawRoot = path.join(corpusRoot, "raw");
  const databasePath = path.join(corpusRoot, "catalog", "corpus.duckdb");
  const index = MutableHashMap.empty<string, string>();

  const catalogRows = yield* loadCatalogDigestRows(databasePath);
  if (O.isSome(catalogRows)) {
    addDigestRows(index, catalogRows.value);
    yield* Console.log(`corpus salvage: loaded ${MutableHashMap.size(index)} digest entries from DuckDB catalog`);
    return index;
  }

  const manifestPaths = yield* findRawProvenanceManifests(rawRoot);
  const manifestRows = yield* Effect.forEach(manifestPaths, loadManifestDigestRows);
  addDigestRows(index, A.flatten(manifestRows));
  yield* Console.log(
    `corpus salvage: loaded ${MutableHashMap.size(index)} digest entries from raw provenance manifests`
  );
  return index;
});

const salvageCorpusImpl = Effect.fn("CorpusCommandService.salvageCorpus")(function* (
  options: CorpusSalvageOptions
): Effect.fn.Return<CorpusSalvageSummary, CorpusCommandError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rawRoot = path.join(options.corpusRoot, "raw");
  const runRoot = O.getOrElse(
    O.map(O.fromUndefinedOr(options.runLabel), (runLabel) => path.join(rawRoot, runLabel)),
    () => rawRoot
  );
  yield* fs
    .makeDirectory(rawRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating corpus raw root "${rawRoot}".`));
  const runLabel = O.fromUndefinedOr(options.runLabel);
  if (O.isSome(runLabel)) {
    yield* validatePathSegment("Salvage run label", runLabel.value);
  }
  const safeRunRoot = yield* resolveWithinRoot(rawRoot, runRoot, "Salvage run root escapes corpus raw directory");
  const manifestPath = path.join(safeRunRoot, "provenance.jsonl");
  const sources = O.getOrElse(O.fromUndefinedOr(options.sources), A.empty<CorpusSalvageSourceSpec>);

  yield* fs
    .makeDirectory(safeRunRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating salvage run root "${safeRunRoot}".`));

  const sourceFiles = A.flatten(yield* Effect.forEach(sources, collectSalvageSourceFiles));
  const digestIndex =
    options.dedupe === true
      ? yield* loadSalvageDigestIndex(options.corpusRoot)
      : MutableHashMap.empty<string, string>();
  const salvagedAt = DateTime.formatIso(yield* DateTime.now);

  const records = yield* Effect.forEach(
    sourceFiles,
    // fallow-ignore-next-line complexity -- pre-existing per-file salvage transaction re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
    Effect.fn("CorpusCommandService.salvageCorpus.processFile")(function* (originFile) {
      const sha256Text = yield* hashFileSha256(originFile.originPath);
      const sha256 = yield* decodeSha256Hex(sha256Text).pipe(
        CorpusCommandError.mapError("Computed salvage digest failed SHA-256 validation.")
      );
      const knownDestPath = options.dedupe === true ? MutableHashMap.get(digestIndex, sha256) : O.none<string>();
      if (O.isSome(knownDestPath)) {
        return CorpusProvenanceRecord.make({
          copyMode: "provenance-only",
          dedupeOfPath: knownDestPath.value,
          destPath: knownDestPath.value,
          mtimeEpoch: originFile.mtimeEpoch,
          mtimeIso: originFile.mtimeIso,
          originPath: originFile.originPath,
          relativePath: originFile.relativePath,
          salvagedAt,
          sha256,
          sizeBytes: originFile.sizeBytes,
          sourceLabel: originFile.sourceLabel,
        });
      }

      const destCandidate = path.join(safeRunRoot, originFile.sourceLabel, originFile.relativePath);
      const safeDestPath = yield* resolveWithinRoot(
        safeRunRoot,
        destCandidate,
        "Salvage destination escapes the run raw directory"
      );
      const destExists = yield* fs
        .exists(safeDestPath)
        .pipe(CorpusCommandError.mapError(`Failed checking salvage destination "${safeDestPath}".`));
      if (destExists) {
        return yield* CorpusCommandError.make({
          message: `Salvage destination already exists; refusing to overwrite "${safeDestPath}".`,
        });
      }
      yield* fs
        .makeDirectory(path.dirname(safeDestPath), { recursive: true })
        .pipe(CorpusCommandError.mapError(`Failed creating salvage destination directory "${safeDestPath}".`));
      yield* fs
        .copy(originFile.originPath, safeDestPath, { preserveTimestamps: true })
        .pipe(CorpusCommandError.mapError(`Failed copying salvage source "${originFile.originPath}".`));
      const copiedSha256 = yield* hashFileSha256(safeDestPath);
      if (copiedSha256 !== sha256) {
        return yield* CorpusCommandError.make({
          message: `Salvage copy digest mismatch for "${originFile.originPath}".`,
        });
      }
      MutableHashMap.set(digestIndex, sha256, safeDestPath);
      return CorpusProvenanceRecord.make({
        copyMode: "copied",
        destPath: safeDestPath,
        mtimeEpoch: originFile.mtimeEpoch,
        mtimeIso: originFile.mtimeIso,
        originPath: originFile.originPath,
        relativePath: originFile.relativePath,
        salvagedAt,
        sha256,
        sizeBytes: originFile.sizeBytes,
        sourceLabel: originFile.sourceLabel,
      });
    }),
    { concurrency: 1 }
  );

  const manifestLines = yield* Effect.forEach(records, (record) =>
    encodeCorpusProvenanceRecordJson(record).pipe(
      CorpusCommandError.mapError("Provenance record failed JSONL encoding.")
    )
  );
  yield* appendCorpusJsonLines(manifestPath, manifestLines);

  const provenanceOnly = A.length(A.filter(records, (record) => record.copyMode === "provenance-only"));
  const copied = A.length(A.filter(records, (record) => record.copyMode === "copied"));
  const bytesChecked = A.reduce(records, 0, (total, record) => total + record.sizeBytes);
  const summary = CorpusSalvageSummary.make({
    bytesChecked: NonNegativeInt.make(bytesChecked),
    matched: NonNegativeInt.make(A.length(records)),
    mismatched: NonNegativeInt.make(0),
    missing: NonNegativeInt.make(0),
    recordsChecked: NonNegativeInt.make(A.length(records)),
  });
  yield* Console.log(
    `corpus salvage: sources=${A.length(sources)} records=${A.length(records)} copied=${copied} provenanceOnly=${provenanceOnly} manifest="${manifestPath}"`
  );
  return summary;
});

const verifySalvageImpl = Effect.fn("CorpusCommandService.verifySalvage")(function* (
  options: CorpusSalvageOptions
): Effect.fn.Return<CorpusSalvageSummary, CorpusCommandError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const rawRoot = path.join(options.corpusRoot, "raw");
  const manifestPath = path.join(rawRoot, "provenance.jsonl");
  const reportPath = path.join(options.corpusRoot, "catalog", "reports", "salvage-verify.json");
  const stride = Math.max(1, Math.floor(options.sampleStride ?? 1));

  const manifestText = yield* fs
    .readFileString(manifestPath)
    .pipe(CorpusCommandError.mapError(`Failed reading provenance manifest "${manifestPath}".`));
  const allRecords = yield* decodeProvenanceLines(manifestText);
  const sampled = A.filter(allRecords, (_, index) => index % stride === 0);
  yield* Console.log(
    `corpus salvage: verifying ${A.length(sampled)}/${A.length(allRecords)} records (stride ${stride})`
  );

  const results = yield* Effect.forEach(
    sampled,
    Effect.fnUntraced(function* (record) {
      // Fail closed before reading: never `exists`/`hashFile` a manifest path
      // that escapes <corpusRoot>/raw, which would leak an existence/hash
      // oracle for arbitrary victim-readable files.
      const safeDestPath = yield* resolveWithinRoot(
        rawRoot,
        record.destPath,
        "Provenance salvage path escapes the corpus raw directory"
      );
      const exists = yield* fs
        .exists(safeDestPath)
        .pipe(CorpusCommandError.mapError(`Failed checking salvaged file "${safeDestPath}".`));
      if (!exists) {
        yield* Console.log(`corpus salvage: MISSING ${record.sourceLabel}/${record.relativePath}`);
        return { kind: "missing" as const, sizeBytes: 0 };
      }
      const actual = yield* hashFileSha256(safeDestPath);
      if (actual !== record.sha256) {
        yield* Console.log(`corpus salvage: MISMATCH ${record.sourceLabel}/${record.relativePath}`);
        return { kind: "mismatched" as const, sizeBytes: record.sizeBytes };
      }
      return { kind: "matched" as const, sizeBytes: record.sizeBytes };
    }),
    { concurrency: 4 }
  );

  const matched = A.length(A.filter(results, (result) => result.kind === "matched"));
  const mismatched = A.length(A.filter(results, (result) => result.kind === "mismatched"));
  const missing = A.length(A.filter(results, (result) => result.kind === "missing"));
  const bytesChecked = A.reduce(results, 0, (total, result) => total + result.sizeBytes);

  const summary = CorpusSalvageSummary.make({
    bytesChecked: NonNegativeInt.make(bytesChecked),
    matched: NonNegativeInt.make(matched),
    mismatched: NonNegativeInt.make(mismatched),
    missing: NonNegativeInt.make(missing),
    recordsChecked: NonNegativeInt.make(A.length(results)),
  });
  const summaryJson = yield* encodeCorpusSalvageSummaryJson(summary).pipe(
    CorpusCommandError.mapError("Salvage verification summary failed JSON encoding.")
  );
  yield* writeCorpusStringFile(reportPath, `${summaryJson}\n`);
  yield* Console.log(
    `corpus salvage: checked=${summary.recordsChecked} matched=${summary.matched} mismatched=${summary.mismatched} missing=${summary.missing} bytes=${summary.bytesChecked}`
  );

  if (mismatched > 0 || missing > 0) {
    return yield* CorpusCommandError.make({
      message: `Salvage verification failed: ${mismatched} mismatched and ${missing} missing records (report at "${reportPath}").`,
    });
  }

  return summary;
});

const archiveRawRootForProvenance = (path: Path.Path, provenancePath: string): string => {
  const runRoot = path.dirname(provenancePath);
  const parent = path.dirname(runRoot);
  return path.basename(runRoot) === "raw" ? runRoot : path.basename(parent) === "raw" ? parent : runRoot;
};

const archiveCopyModeFor = (record: CorpusProvenanceRecord): "copied" | "provenance-only" =>
  O.getOrElse(O.fromUndefinedOr(record.copyMode), () => "copied");

const referencedRawPathForArchive = (record: CorpusProvenanceRecord): string =>
  archiveCopyModeFor(record) === "provenance-only"
    ? O.getOrElse(O.fromUndefinedOr(record.dedupeOfPath), () => record.destPath)
    : record.destPath;

const collectArchiveSourceFiles = Effect.fn("CorpusCommandService.collectArchiveSourceFiles")(function* (
  sourcePath: string
): Effect.fn.Return<ReadonlyArray<string>, CorpusArchiveMoveError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absoluteSource = path.resolve(sourcePath);

  const collectAt: (
    currentPath: string
  ) => Effect.Effect<ReadonlyArray<string>, CorpusArchiveMoveError, FileSystem.FileSystem | Path.Path> = Effect.fn(
    "CorpusCommandService.collectArchiveSourceFiles.collectAt"
  )(function* (currentPath) {
    const info = yield* fs
      .stat(currentPath)
      .pipe(CorpusCommandError.mapError(`Failed inspecting archive-move source entry "${currentPath}".`));
    if (info.type === "File") {
      // Keep source filenames opaque: Bun's realpath can reject otherwise valid
      // POSIX names such as paths containing literal backslashes.
      return [path.resolve(currentPath)];
    }
    if (info.type !== "Directory") {
      return A.empty<string>();
    }
    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(CorpusCommandError.mapError(`Failed reading archive-move source directory "${currentPath}".`));
    const childFiles = yield* Effect.forEach(A.sort(entries, Order.String), (entry) =>
      collectAt(path.join(currentPath, entry))
    );
    return A.flatten(childFiles);
  });

  return yield* collectAt(absoluteSource);
});

const loadArchiveProvenanceIndex = Effect.fn("CorpusCommandService.loadArchiveProvenanceIndex")(function* (
  provenancePaths: ReadonlyArray<string>
): Effect.fn.Return<
  MutableHashMap.MutableHashMap<string, ArchiveProvenanceMatch>,
  CorpusArchiveMoveError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const index = MutableHashMap.empty<string, ArchiveProvenanceMatch>();

  yield* Effect.forEach(
    provenancePaths,
    Effect.fn("CorpusCommandService.loadArchiveProvenanceIndex.manifest")(function* (provenancePath) {
      const rawRoot = archiveRawRootForProvenance(path, provenancePath);
      const manifestText = yield* fs
        .readFileString(provenancePath)
        .pipe(CorpusCommandError.mapError(`Failed reading archive-move provenance "${provenancePath}".`));
      const records = yield* decodeProvenanceLines(manifestText);
      yield* Effect.forEach(
        records,
        Effect.fn("CorpusCommandService.loadArchiveProvenanceIndex.record")(function* (record) {
          MutableHashMap.set(index, path.resolve(record.originPath), { provenancePath, rawRoot, record });
        }),
        { discard: true }
      );
    }),
    { discard: true }
  );

  return index;
});

const digestMismatch = Effect.fn("CorpusCommandService.digestMismatch")(function* (input: {
  readonly actualSha256: string;
  readonly expectedSha256: string;
  readonly message: string;
  readonly originPath: string;
  readonly rawPath: string;
}): Effect.fn.Return<never, CorpusArchiveMoveError> {
  const actualSha256 = yield* decodeSha256Hex(input.actualSha256).pipe(
    CorpusCommandError.mapError("Archive-move actual digest failed SHA-256 validation.")
  );
  const expectedSha256 = yield* decodeSha256Hex(input.expectedSha256).pipe(
    CorpusCommandError.mapError("Archive-move expected digest failed SHA-256 validation.")
  );
  return yield* CorpusArchiveMoveDigestMismatchError.make({
    actualSha256,
    expectedSha256,
    message: input.message,
    originPath: input.originPath,
    rawPath: input.rawPath,
  });
});

const validateArchiveFile = Effect.fn("CorpusCommandService.validateArchiveFile")(function* (
  sourcePath: string,
  originPath: string,
  provenanceByOrigin: MutableHashMap.MutableHashMap<string, ArchiveProvenanceMatch>
): Effect.fn.Return<ArchiveValidatedFile, CorpusArchiveMoveError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const match = MutableHashMap.get(provenanceByOrigin, originPath);
  if (O.isNone(match)) {
    return yield* CorpusArchiveMoveUncoveredFileError.make({
      message: `Archive-move source file is not covered by provenance: "${originPath}".`,
      originPath,
      sourcePath,
    });
  }

  const record = match.value.record;
  const rawPath = yield* resolveWithinRoot(
    match.value.rawRoot,
    referencedRawPathForArchive(record),
    "Archive-move raw provenance path escapes the corpus raw directory"
  );
  const rawExists = yield* fs
    .exists(rawPath)
    .pipe(CorpusCommandError.mapError(`Failed checking archive-move raw file "${rawPath}".`));
  if (!rawExists) {
    return yield* digestMismatch({
      actualSha256: zeroSha256,
      expectedSha256: record.sha256,
      message: `Archive-move raw file does not exist for provenance record from "${match.value.provenancePath}".`,
      originPath,
      rawPath,
    });
  }

  const actualSha256 = yield* hashFileSha256(rawPath);
  if (actualSha256 !== record.sha256) {
    return yield* digestMismatch({
      actualSha256,
      expectedSha256: record.sha256,
      message: `Archive-move raw file digest mismatch for "${originPath}".`,
      originPath,
      rawPath,
    });
  }

  return { copyMode: archiveCopyModeFor(record), originPath };
});

const isCrossDeviceRename = (error: PlatformError.PlatformError): boolean => {
  const cause = error.reason.cause;
  return P.hasProperty(cause, "code") && cause.code === "EXDEV";
};

const copyVerifyAndRemoveFile = Effect.fn("CorpusCommandService.copyVerifyAndRemoveFile")(function* (
  sourcePath: string,
  archivePath: string
): Effect.fn.Return<void, CorpusArchiveMoveError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceSha256 = yield* hashFileSha256(sourcePath);
  yield* fs
    .makeDirectory(path.dirname(archivePath), { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating archive-move destination directory "${archivePath}".`));
  yield* fs
    .copy(sourcePath, archivePath, { preserveTimestamps: true })
    .pipe(CorpusCommandError.mapError(`Failed copying archive-move file "${sourcePath}".`));
  const archiveSha256 = yield* hashFileSha256(archivePath);
  if (archiveSha256 !== sourceSha256) {
    return yield* digestMismatch({
      actualSha256: archiveSha256,
      expectedSha256: sourceSha256,
      message: `Archive-move copied file digest mismatch for "${sourcePath}".`,
      originPath: sourcePath,
      rawPath: archivePath,
    });
  }
  yield* fs
    .remove(sourcePath)
    .pipe(CorpusCommandError.mapError(`Failed removing source file after archive-move copy "${sourcePath}".`));
});

const moveSourceAcrossDevice = Effect.fn("CorpusCommandService.moveSourceAcrossDevice")(function* (
  sourcePath: string,
  archivePath: string
): Effect.fn.Return<void, CorpusArchiveMoveError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* collectArchiveSourceFiles(sourcePath);
  const sourceInfo = yield* fs
    .stat(sourcePath)
    .pipe(CorpusCommandError.mapError(`Failed inspecting archive-move source "${sourcePath}".`));
  if (sourceInfo.type === "File") {
    yield* copyVerifyAndRemoveFile(sourcePath, archivePath);
    return;
  }
  yield* fs
    .makeDirectory(archivePath, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating archive-move directory "${archivePath}".`));
  yield* Effect.forEach(
    files,
    Effect.fn("CorpusCommandService.moveSourceAcrossDevice.file")(function* (filePath) {
      const relativePath = path.relative(sourcePath, filePath);
      yield* copyVerifyAndRemoveFile(filePath, path.join(archivePath, relativePath));
    }),
    { discard: true, concurrency: 1 }
  );
});

const moveArchiveSource = Effect.fn("CorpusCommandService.moveArchiveSource")(function* (
  sourcePath: string,
  archivePath: string
): Effect.fn.Return<void, CorpusArchiveMoveError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.rename(sourcePath, archivePath).pipe(
    Effect.catchTag("PlatformError", (error) =>
      isCrossDeviceRename(error)
        ? moveSourceAcrossDevice(sourcePath, archivePath)
        : Effect.fail(
            CorpusCommandError.make({
              cause: error,
              message: `Failed moving archive source "${sourcePath}" to "${archivePath}".`,
            })
          )
    )
  );
});

const archiveMoveImpl = Effect.fn("CorpusCommandService.archiveMove")(function* (
  options: CorpusArchiveMoveOptions
): Effect.fn.Return<CorpusArchiveMoveSummary, CorpusArchiveMoveError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const archiveRoot = path.resolve(options.archiveRoot);
  const provenanceByOrigin = yield* loadArchiveProvenanceIndex(options.provenancePaths);
  const usedArchiveTargets = MutableHashSet.empty<string>();

  const plans = yield* Effect.forEach(
    options.sourcePaths,
    Effect.fn("CorpusCommandService.archiveMove.planSource")(function* (sourcePathInput) {
      const sourcePath = path.resolve(sourcePathInput);
      const archivePath = path.join(archiveRoot, path.basename(sourcePath));
      if (MutableHashSet.has(usedArchiveTargets, archivePath)) {
        return yield* CorpusArchiveMoveDestinationConflictError.make({
          archivePath,
          message: `Archive destination is selected by more than one source: "${archivePath}".`,
          sourcePath,
        });
      }
      MutableHashSet.add(usedArchiveTargets, archivePath);
      const archiveExists = yield* fs
        .exists(archivePath)
        .pipe(CorpusCommandError.mapError(`Failed checking archive destination "${archivePath}".`));
      if (archiveExists) {
        return yield* CorpusArchiveMoveDestinationConflictError.make({
          archivePath,
          message: `Archive destination already exists: "${archivePath}".`,
          sourcePath,
        });
      }
      const sourceFiles = yield* collectArchiveSourceFiles(sourcePath);
      const validatedFiles = yield* Effect.forEach(sourceFiles, (originPath) =>
        validateArchiveFile(sourcePath, originPath, provenanceByOrigin)
      );
      return {
        archivePath,
        copiedCount: A.length(A.filter(validatedFiles, (file) => file.copyMode === "copied")),
        files: validatedFiles,
        originPath: sourcePath,
        provenanceOnlyCount: A.length(A.filter(validatedFiles, (file) => file.copyMode === "provenance-only")),
      };
    }),
    { concurrency: 1 }
  );

  yield* fs
    .makeDirectory(archiveRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating archive root "${archiveRoot}".`));
  yield* Effect.forEach(plans, (plan) => moveArchiveSource(plan.originPath, plan.archivePath), {
    discard: true,
    concurrency: 1,
  });

  const movedAt = DateTime.formatIso(yield* DateTime.now);
  const records = A.map(plans, (plan) =>
    CorpusArchiveMoveManifestRecord.make({
      archivePath: plan.archivePath,
      copiedCount: NonNegativeInt.make(plan.copiedCount),
      fileCount: NonNegativeInt.make(A.length(plan.files)),
      movedAt,
      originPath: plan.originPath,
      provenanceOnlyCount: NonNegativeInt.make(plan.provenanceOnlyCount),
    })
  );
  const manifestLines = yield* Effect.forEach(records, (record) =>
    encodeCorpusArchiveMoveManifestRecordJson(record).pipe(
      CorpusCommandError.mapError("Archive move manifest record failed JSONL encoding.")
    )
  );
  const manifestPath = path.join(path.dirname(options.provenancePaths[0]), "move-manifest.jsonl");
  yield* fs
    .writeFileString(manifestPath, jsonlContent(manifestLines))
    .pipe(CorpusCommandError.mapError(`Failed writing archive move manifest "${manifestPath}".`));

  const filesCovered = A.reduce(plans, 0, (total, plan) => total + A.length(plan.files));
  const copiedRecords = A.reduce(plans, 0, (total, plan) => total + plan.copiedCount);
  const provenanceOnlyRecords = A.reduce(plans, 0, (total, plan) => total + plan.provenanceOnlyCount);
  const summary = CorpusArchiveMoveSummary.make({
    copiedRecords: NonNegativeInt.make(copiedRecords),
    filesCovered: NonNegativeInt.make(filesCovered),
    provenanceOnlyRecords: NonNegativeInt.make(provenanceOnlyRecords),
    sourcesMoved: NonNegativeInt.make(A.length(plans)),
  });
  yield* Console.log(
    `corpus archive-move: sources=${summary.sourcesMoved} files=${summary.filesCovered} copied=${summary.copiedRecords} provenanceOnly=${summary.provenanceOnlyRecords} manifest="${manifestPath}"`
  );
  return summary;
});

const labelPathKey: {
  (relativePath: string): (sourceLabel: string) => string;
  (sourceLabel: string, relativePath: string): string;
} = dual(2, (sourceLabel: string, relativePath: string): string => `${sourceLabel}\u0000${relativePath}`);

const docketPattern = /\b(\d{5,6}(?:US|WO|EP|CA|AU|CN|JP|PCT)\d{0,2}(?:-US\d+)?)\b/iu;
const docketFamilyPattern = /^\d{5,6}/;

/**
 * Extract an attorney-docket token and its family prefix from free text.
 *
 * Matches tokens such as `10109WO02-US1` or `101117US01`; the family is the
 * leading numeric prefix shared by all country-stage filings of one matter.
 *
 * @param text - File name or path text to scan.
 * @returns The normalized docket and family, or none.
 * **Example** (Usage)
 * ```ts
 * import { extractCorpusDocket } from "@beep/repo-cli/commands/Corpus"
 * import * as O from "effect/Option"
 *
 * const docket = extractCorpusDocket("Response OA 2025-11-07 (10109WO02-US1).docx")
 * console.log(O.isSome(docket)) // true
 * ```
 * @category parsers
 * @since 0.0.0
 */
export const extractCorpusDocket = (text: string): O.Option<{ readonly docket: string; readonly family: string }> =>
  pipeDocket(text);

const pipeDocket = (text: string): O.Option<{ readonly docket: string; readonly family: string }> =>
  O.fromNullishOr(docketPattern.exec(text)).pipe(
    O.flatMap((match) => O.fromNullishOr(match[1])),
    O.map((raw) => {
      const docket = raw.toUpperCase();
      const family = docketFamilyPattern.exec(docket)?.[0] ?? docket;
      return { docket, family };
    })
  );

const sanitizeSegment = (value: string): string => {
  const cleaned = Str.trim(value.replaceAll(/[\\/\u0000]/gu, "_"));
  return Str.isEmpty(cleaned) ? "_" : cleaned;
};

const windowsPathDirectories = (originalPath: string): Array<string> => {
  const segments = A.filter(Str.split(originalPath, /[\\/]/u), Str.isNonEmpty);
  const withoutDrive = A.filter(segments, (segment, index) => !(index === 0 && /^[A-Za-z]:$/.test(segment)));
  return A.map(A.dropRight(withoutDrive, 1), sanitizeSegment);
};

const versionStem = (name: string): string => {
  const dot = name.lastIndexOf(".");
  const stem = dot <= 0 ? name : name.slice(0, dot);
  return Str.trim(Str.toLowerCase(stem).replaceAll(/\s+/gu, " "));
};

const decodeRestorationRecordJson = S.decodeUnknownEffect(S.fromJsonString(CorpusRestorationRecord));
const decodeClientMapJson = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.String)));

const createOrganizedTable = `
CREATE OR REPLACE TABLE corpus_organized (
  digest VARCHAR NOT NULL,
  source_label VARCHAR NOT NULL,
  source_relative_path VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  client VARCHAR,
  docket VARCHAR,
  docket_family VARCHAR,
  version_index BIGINT,
  organized_relative_path VARCHAR,
  effective_name VARCHAR NOT NULL,
  restored BOOLEAN NOT NULL,
  materialized BOOLEAN NOT NULL
)`;

const insertOrganizedStatement = `
INSERT INTO corpus_organized VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;

interface OrganizePlanRow {
  readonly category: CorpusOrganizeCategory;
  readonly client: string | undefined;
  readonly destPath: string;
  readonly digest: string;
  readonly directories: ReadonlyArray<string>;
  readonly docket: string | undefined;
  readonly docketFamily: string | undefined;
  readonly effectiveName: string;
  readonly mtimeEpoch: number;
  readonly restored: boolean;
  readonly sourceLabel: string;
  readonly sourceRelativePath: string;
}

// fallow-ignore-next-line complexity -- pre-existing overwrite safety transaction re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const prepareOrganizedRoot = Effect.fn("CorpusCommandService.prepareOrganizedRoot")(function* (
  organizedRoot: string,
  overwrite: boolean
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const organizedExists = yield* fs
    .exists(organizedRoot)
    .pipe(CorpusCommandError.mapError(`Failed checking organized root "${organizedRoot}".`));
  if (organizedExists) {
    const entries = yield* fs
      .readDirectory(organizedRoot)
      .pipe(CorpusCommandError.mapError(`Failed reading organized root "${organizedRoot}".`));
    if (A.length(entries) > 0 && !overwrite) {
      return yield* CorpusCommandError.make({
        message: `Organized root "${organizedRoot}" is not empty; pass --overwrite to rebuild it.`,
      });
    }
    if (A.length(entries) > 0) {
      yield* fs
        .remove(organizedRoot, { recursive: true })
        .pipe(CorpusCommandError.mapError(`Failed clearing organized root "${organizedRoot}".`));
    }
  }
  yield* fs
    .makeDirectory(organizedRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating organized root "${organizedRoot}".`));
});

const loadMatchedRestorations = Effect.fn("CorpusCommandService.loadMatchedRestorations")(function* (
  restorationPath: string
): Effect.fn.Return<Map<string, MatchedRestorationRecord>, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const restorationText = yield* fs
    .readFileString(restorationPath)
    .pipe(CorpusCommandError.mapError(`Failed reading restoration manifest "${restorationPath}"; run catalog first.`));
  const restorations = yield* Effect.forEach(A.filter(Str.split(restorationText, "\n"), Str.isNonEmpty), (line) =>
    decodeRestorationRecordJson(line).pipe(
      CorpusCommandError.mapError("Restoration manifest line failed schema validation.")
    )
  );
  const restoredByLabelPath = new Map<string, MatchedRestorationRecord>();
  for (const record of restorations) {
    if (record.matchStatus === "matched") {
      restoredByLabelPath.set(labelPathKey(record.sourceLabel, record.contentRelativePath), record);
    }
  }
  return restoredByLabelPath;
});

const loadClientMap = Effect.fn("CorpusCommandService.loadClientMap")(function* (
  clientMapPath: string | undefined
): Effect.fn.Return<Map<string, string>, CorpusCommandError, FileSystem.FileSystem> {
  const clientByLabel = new Map<string, string>();
  if (clientMapPath === undefined) {
    return clientByLabel;
  }
  const fs = yield* FileSystem.FileSystem;
  const clientMapText = yield* fs
    .readFileString(clientMapPath)
    .pipe(CorpusCommandError.mapError(`Failed reading client map "${clientMapPath}".`));
  const clientMap = yield* decodeClientMapJson(clientMapText).pipe(
    CorpusCommandError.mapError("Client map failed schema validation.")
  );
  for (const [label, client] of Object.entries(clientMap)) {
    clientByLabel.set(label, sanitizeSegment(client));
  }
  return clientByLabel;
});

// fallow-ignore-next-line complexity -- pre-existing exhaustive organization-category precedence re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const organizeCategoryFor = (input: {
  readonly client: string | undefined;
  readonly extension: string | undefined;
  readonly hasDocket: boolean;
  readonly isEmailExport: boolean;
  readonly isRecycleMetadata: boolean;
}): CorpusOrganizeCategory =>
  input.isRecycleMetadata
    ? "recycle-metadata"
    : input.extension === "pst"
      ? "email-archive"
      : input.hasDocket
        ? "docket"
        : input.isEmailExport
          ? "email-export"
          : input.client === undefined
            ? "unsorted"
            : "client";

// fallow-ignore-next-line complexity -- pre-existing organization planner re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const planOrganizeRow = (
  record: CorpusProvenanceRecord,
  restoration: MatchedRestorationRecord | undefined,
  client: string | undefined
): OrganizePlanRow => {
  const effectiveName = sanitizeSegment(restoration?.original.originalName ?? basenameOf(record.relativePath));
  const directories =
    restoration === undefined
      ? A.map(A.filter(Str.split(parentDirOf(record.relativePath), "/"), Str.isNonEmpty), sanitizeSegment)
      : windowsPathDirectories(restoration.original.originalPath);
  const docket = pipeDocket(`${effectiveName} ${record.relativePath}`);
  const isRecycleMetadata = O.match(classifyRecycleBinName(basenameOf(record.relativePath)), {
    onNone: () => false,
    onSome: (entry) => entry.kind === "metadata",
  });

  return {
    category: organizeCategoryFor({
      client,
      extension: extensionOf(effectiveName),
      hasDocket: O.isSome(docket),
      isEmailExport: record.relativePath.startsWith("Sent_Emails.export/"),
      isRecycleMetadata,
    }),
    client,
    destPath: record.destPath,
    digest: `sha256:${record.sha256}`,
    directories,
    docket: O.isSome(docket) ? docket.value.docket : undefined,
    docketFamily: O.isSome(docket) ? docket.value.family : undefined,
    effectiveName,
    mtimeEpoch: record.mtimeEpoch,
    restored: restoration !== undefined,
    sourceLabel: record.sourceLabel,
    sourceRelativePath: record.relativePath,
  };
};

const buildOrganizePlan = (
  allRecords: ReadonlyArray<CorpusProvenanceRecord>,
  restoredByLabelPath: ReadonlyMap<string, MatchedRestorationRecord>,
  clientByLabel: ReadonlyMap<string, string>
): { readonly duplicatesSkipped: number; readonly plan: ReadonlyArray<OrganizePlanRow> } => {
  const { duplicatesSkipped, kept } = dedupeBySha256(allRecords);
  const plan = A.map(kept, (record) =>
    planOrganizeRow(
      record,
      restoredByLabelPath.get(labelPathKey(record.sourceLabel, record.relativePath)),
      clientByLabel.get(record.sourceLabel)
    )
  );

  return { duplicatesSkipped, plan };
};

// fallow-ignore-next-line complexity -- pre-existing deterministic version grouping re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const assignVersionIndexes = (
  plan: ReadonlyArray<OrganizePlanRow>
): { readonly multiVersionGroups: number; readonly versionIndexByRow: ReadonlyMap<OrganizePlanRow, number> } => {
  const versionIndexByRow = new Map<OrganizePlanRow, number>();
  const versionGroups = new Map<string, Array<OrganizePlanRow>>();
  for (const row of plan) {
    if (row.category !== "docket" || row.docket === undefined) {
      continue;
    }
    const groupKey = `${row.docket}\u0000${versionStem(row.effectiveName)}`;
    const group = versionGroups.get(groupKey) ?? [];
    group.push(row);
    versionGroups.set(groupKey, group);
  }
  let multiVersionGroups = 0;
  for (const group of versionGroups.values()) {
    if (A.length(group) < 2) {
      continue;
    }
    multiVersionGroups += 1;
    const ordered = A.sort(
      group,
      Order.mapInput(Order.Number, (row: OrganizePlanRow) => row.mtimeEpoch)
    );
    ordered.forEach((row, index) => {
      versionIndexByRow.set(row, index + 1);
    });
  }
  return { multiVersionGroups, versionIndexByRow };
};

const joinOrganizedSegments = (segments: ReadonlyArray<string>): string => A.join(segments, "/");

const organizedRelativeFor = (row: OrganizePlanRow, versionedName: string): string | undefined =>
  Match.value(row.category).pipe(
    Match.when("email-archive", () =>
      joinOrganizedSegments(["email-archives", `${row.sourceLabel}--${row.effectiveName}`])
    ),
    Match.when("docket", () =>
      joinOrganizedSegments(["dockets", row.docketFamily ?? "_", row.docket ?? "_", versionedName])
    ),
    Match.when("client", () =>
      joinOrganizedSegments(["clients", row.client ?? "_", ...row.directories, row.effectiveName])
    ),
    Match.when("unsorted", () =>
      joinOrganizedSegments(["_unsorted", row.sourceLabel, ...row.directories, row.effectiveName])
    ),
    Match.orElse(() => undefined)
  );

const dedupeOrganizedTarget = (candidate: string, usedTargets: ReadonlySet<string>, digest: string): string => {
  if (!usedTargets.has(candidate)) {
    return candidate;
  }
  const digestSuffix = digest.slice("sha256:".length, "sha256:".length + 8);
  const dot = candidate.lastIndexOf(".");
  return dot <= candidate.lastIndexOf("/")
    ? `${candidate}--${digestSuffix}`
    : `${candidate.slice(0, dot)}--${digestSuffix}${candidate.slice(dot)}`;
};

const materializeOrganizedRow = Effect.fn("CorpusCommandService.materializeOrganizedRow")(function* (
  rawRoot: string,
  organizedRoot: string,
  row: OrganizePlanRow,
  organizedRelative: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Fail closed on both ends: the manifest source must canonicalize inside
  // <corpusRoot>/raw, and the taxonomy-derived target must canonicalize inside
  // organizedRoot, so neither a `..`/symlink escape in sourceLabel/relativePath
  // nor an attacker `destPath` can read or overwrite files outside the corpus.
  const safeSourcePath = yield* resolveWithinRoot(
    rawRoot,
    row.destPath,
    "Provenance source path escapes the corpus raw directory"
  );
  const targetPath = yield* resolveWithinRoot(
    organizedRoot,
    path.join(organizedRoot, organizedRelative),
    "Organized target path escapes the organized root"
  );
  yield* fs
    .makeDirectory(path.dirname(targetPath), { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating organized directory for "${organizedRelative}".`));
  yield* (
    row.category === "email-archive" ? fs.symlink(safeSourcePath, targetPath) : fs.copyFile(safeSourcePath, targetPath)
  ).pipe(CorpusCommandError.mapError(`Failed materializing organized artifact "${organizedRelative}".`));
});

const organizeRecordFor = (
  row: OrganizePlanRow,
  organizedRelative: string | undefined,
  versionIndex: number | undefined,
  materialized: boolean
): CorpusOrganizeRecord =>
  CorpusOrganizeRecord.make({
    category: row.category,
    digest: row.digest,
    effectiveName: row.effectiveName,
    materialized,
    restoredFromRecycleBin: row.restored,
    sourceLabel: row.sourceLabel,
    sourceRelativePath: row.sourceRelativePath,
    ...O.getSomesStruct({
      client: O.fromUndefinedOr(row.client),
      docket: O.fromUndefinedOr(row.docket),
      docketFamily: O.fromUndefinedOr(row.docketFamily),
      organizedRelativePath: O.fromUndefinedOr(organizedRelative),
    }),
    ...O.getSomesStruct({ versionIndex: O.map(O.fromUndefinedOr(versionIndex), NonNegativeInt.make) }),
  });

const writeOrganizedTable = Effect.fn("CorpusCommandService.writeOrganizedTable")(function* (
  databasePath: string,
  records: ReadonlyArray<CorpusOrganizeRecord>
): Effect.fn.Return<void, CorpusCommandError> {
  yield* runWithCorpusDb(
    databasePath,
    `Failed writing the organized catalog table at "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      yield* db.run(createOrganizedTable);
      yield* insertRows(
        db,
        insertOrganizedStatement,
        records,
        // fallow-ignore-next-line complexity -- pre-existing positional DuckDB binding re-entered the diff only through the mixed-ledger decoder change; this mapper's control flow is unchanged
        (record) => [
          record.digest,
          record.sourceLabel,
          record.sourceRelativePath,
          record.category,
          record.client ?? null,
          record.docket ?? null,
          record.docketFamily ?? null,
          record.versionIndex ?? null,
          record.organizedRelativePath ?? null,
          record.effectiveName,
          record.restoredFromRecycleBin,
          record.materialized,
        ]
      );
    })
  );
});

const buildOrganizeSummary = (input: {
  readonly counts: Record<CorpusOrganizeCategory, number>;
  readonly duplicatesSkipped: number;
  readonly multiVersionGroups: number;
  readonly plan: ReadonlyArray<OrganizePlanRow>;
  readonly records: ReadonlyArray<CorpusOrganizeRecord>;
}): CorpusOrganizeSummary => {
  const docketFamilies = new Set(
    A.flatMap(input.plan, (row) => (row.docketFamily === undefined ? [] : [row.docketFamily]))
  );
  return CorpusOrganizeSummary.make({
    canonicalArtifacts: NonNegativeInt.make(A.length(input.plan)),
    clientFiles: NonNegativeInt.make(input.counts.client),
    docketFamilies: NonNegativeInt.make(docketFamilies.size),
    docketFiles: NonNegativeInt.make(input.counts.docket),
    duplicatesSkipped: NonNegativeInt.make(input.duplicatesSkipped),
    emailArchives: NonNegativeInt.make(input.counts["email-archive"]),
    emailExportFiles: NonNegativeInt.make(input.counts["email-export"]),
    restoredNames: NonNegativeInt.make(A.length(A.filter(input.records, (record) => record.restoredFromRecycleBin))),
    unsortedFiles: NonNegativeInt.make(input.counts.unsorted),
    versionGroups: NonNegativeInt.make(input.multiVersionGroups),
  });
};

// fallow-ignore-next-line complexity -- pre-existing organize orchestration re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const organizeCorpusImpl = Effect.fn("CorpusCommandService.organizeCorpus")(function* (
  options: CorpusOrganizeOptions
): Effect.fn.Return<CorpusOrganizeSummary, CorpusCommandError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const rawRoot = path.join(options.corpusRoot, "raw");
  const manifestPath = path.join(rawRoot, "provenance.jsonl");
  const restorationPath = path.join(options.corpusRoot, "catalog", "restoration-manifest.jsonl");
  const organizedRoot = path.join(options.corpusRoot, "organized");
  const organizeManifestPath = path.join(options.corpusRoot, "catalog", "organize-manifest.jsonl");
  const summaryReportPath = path.join(options.corpusRoot, "catalog", "reports", "organize-summary.json");
  const databasePath = path.join(options.corpusRoot, "catalog", "corpus.duckdb");

  yield* prepareOrganizedRoot(organizedRoot, options.overwrite);

  const manifestText = yield* fs
    .readFileString(manifestPath)
    .pipe(CorpusCommandError.mapError(`Failed reading provenance manifest "${manifestPath}".`));
  const allRecords = yield* decodeProvenanceLines(manifestText);
  const restoredByLabelPath = yield* loadMatchedRestorations(restorationPath);
  const clientByLabel = yield* loadClientMap(options.clientMapPath);

  const { duplicatesSkipped, plan } = buildOrganizePlan(allRecords, restoredByLabelPath, clientByLabel);
  const { multiVersionGroups, versionIndexByRow } = assignVersionIndexes(plan);

  const usedTargets = new Set<string>();
  const records: Array<CorpusOrganizeRecord> = [];
  const counts: Record<CorpusOrganizeCategory, number> = {
    client: 0,
    docket: 0,
    "email-archive": 0,
    "email-export": 0,
    "recycle-metadata": 0,
    unsorted: 0,
  };

  for (const row of plan) {
    counts[row.category] += 1;
    const versionIndex = versionIndexByRow.get(row);
    const versionedName =
      versionIndex === undefined ? row.effectiveName : `v${`${versionIndex}`.padStart(2, "0")}--${row.effectiveName}`;
    const candidate = organizedRelativeFor(row, versionedName);
    const organizedRelative =
      candidate === undefined ? undefined : dedupeOrganizedTarget(candidate, usedTargets, row.digest);

    if (organizedRelative !== undefined) {
      usedTargets.add(organizedRelative);
      yield* materializeOrganizedRow(rawRoot, organizedRoot, row, organizedRelative);
    }

    records.push(organizeRecordFor(row, organizedRelative, versionIndex, organizedRelative !== undefined));
  }

  const manifestLines = yield* Effect.forEach(records, (record) =>
    encodeCorpusOrganizeRecordJson(record).pipe(
      CorpusCommandError.mapError("Organize manifest record failed JSONL encoding.")
    )
  );
  yield* writeCorpusStringFile(organizeManifestPath, jsonlContent(manifestLines));
  yield* writeOrganizedTable(databasePath, records);

  const summary = buildOrganizeSummary({ counts, duplicatesSkipped, multiVersionGroups, plan, records });
  const summaryJson = yield* encodeCorpusOrganizeSummaryJson(summary).pipe(
    CorpusCommandError.mapError("Organize summary failed JSON encoding.")
  );
  yield* writeCorpusStringFile(summaryReportPath, `${summaryJson}\n`);

  yield* Console.log(
    `corpus organize: canonical=${summary.canonicalArtifacts} docketFiles=${summary.docketFiles} (families=${summary.docketFamilies}, versionGroups=${summary.versionGroups}) client=${summary.clientFiles} emailArchives=${summary.emailArchives} emailExport=${summary.emailExportFiles} unsorted=${summary.unsortedFiles} restoredNames=${summary.restoredNames}`
  );
  yield* Console.log(`corpus organize: tree "${organizedRoot}"`);

  return summary;
});

const patentTextPattern = /\b(?:US[\s-]?)?(\d{1,2},\d{3},\d{3}|\d{7,8})(?:\s?[ABU]\d)?\b/gu;
const applicationTextPattern = /\b(\d{2}\/\d{3},?\d{3})\b/gu;

interface EnrichCandidate {
  readonly docketFamilies: Set<string>;
  readonly kind: "application" | "patent";
  occurrenceCount: number;
}

const createEnrichmentTable = `
CREATE OR REPLACE TABLE corpus_enrichment (
  candidate VARCHAR NOT NULL,
  candidate_kind VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  application_number VARCHAR,
  patent_number VARCHAR,
  invention_title VARCHAR,
  first_applicant_name VARCHAR,
  first_inventor_name VARCHAR,
  occurrence_count BIGINT NOT NULL,
  docket_families VARCHAR,
  parent_application_numbers VARCHAR
)`;

const insertEnrichmentStatement = `
INSERT INTO corpus_enrichment VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

interface EnrichCandidateCollector {
  readonly candidates: Map<string, EnrichCandidate>;
  readonly scanText: (text: string, docketFamily: string | undefined) => void;
}

const makeEnrichCandidateCollector = (): EnrichCandidateCollector => {
  const candidates = new Map<string, EnrichCandidate>();
  const noteCandidate = (
    kind: "application" | "patent",
    normalized: string,
    docketFamily: string | undefined
  ): void => {
    const key = `${kind}:${normalized}`;
    const existing = candidates.get(key) ?? { docketFamilies: new Set<string>(), kind, occurrenceCount: 0 };
    existing.occurrenceCount += 1;
    if (docketFamily !== undefined) {
      existing.docketFamilies.add(docketFamily);
    }
    candidates.set(key, existing);
  };
  // fallow-ignore-next-line complexity -- pre-existing two-pattern identifier scan re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
  const scanText = (text: string, docketFamily: string | undefined): void => {
    for (const match of text.matchAll(patentTextPattern)) {
      const normalized = normalizeUsptoPatentNumber(match[1] ?? "");
      if (O.isSome(normalized) && normalized.value.length >= 7) {
        noteCandidate("patent", normalized.value, docketFamily);
      }
    }
    for (const match of text.matchAll(applicationTextPattern)) {
      const normalized = normalizeUsptoApplicationNumber(match[1] ?? "");
      if (O.isSome(normalized)) {
        noteCandidate("application", normalized.value, docketFamily);
      }
    }
  };
  return { candidates, scanText };
};

const loadEnrichOrganizeRecords = Effect.fn("CorpusCommandService.loadEnrichOrganizeRecords")(function* (
  organizeManifestPath: string
): Effect.fn.Return<ReadonlyArray<CorpusOrganizeRecord>, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const organizeText = yield* fs
    .readFileString(organizeManifestPath)
    .pipe(
      CorpusCommandError.mapError(`Failed reading organize manifest "${organizeManifestPath}"; run organize first.`)
    );
  return yield* Effect.forEach(A.filter(Str.split(organizeText, "\n"), Str.isNonEmpty), (line) =>
    S.decodeEffect(S.fromJsonString(CorpusOrganizeRecord))(line).pipe(
      CorpusCommandError.mapError("Organize manifest line failed schema validation.")
    )
  );
});

// fallow-ignore-next-line complexity -- pre-existing docket-family index builder re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const buildFamilyByTextName = Effect.fn("CorpusCommandService.buildFamilyByTextName")(function* (
  corpusRoot: string,
  organizeRecords: ReadonlyArray<CorpusOrganizeRecord>
): Effect.fn.Return<ReadonlyMap<string, string>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const familyByDigest = new Map<string, string>();
  for (const record of organizeRecords) {
    if (record.docketFamily !== undefined) {
      familyByDigest.set(record.digest, record.docketFamily);
    }
  }
  const familyByTextName = new Map<string, string>();
  const sourcesPath = path.join(corpusRoot, "staging", "extract", "sources.jsonl");
  const sourcesExists = yield* fs
    .exists(sourcesPath)
    .pipe(CorpusCommandError.mapError(`Failed checking extraction sources "${sourcesPath}".`));
  if (!sourcesExists) {
    return familyByTextName;
  }
  const sourcesText = yield* fs
    .readFileString(sourcesPath)
    .pipe(CorpusCommandError.mapError(`Failed reading extraction sources "${sourcesPath}".`));
  const sourceRows = yield* Effect.forEach(A.filter(Str.split(sourcesText, "\n"), Str.isNonEmpty), (line) =>
    S.decodeEffect(S.fromJsonString(SourceProcessingRecord))(line).pipe(
      CorpusCommandError.mapError("Extraction sources line failed schema validation.")
    )
  );
  for (const row of sourceRows) {
    if (row.status !== "succeeded" || row.textPath === undefined) {
      continue;
    }
    const family = familyByDigest.get(row.digest);
    if (family !== undefined) {
      familyByTextName.set(basenameOf(row.textPath), family);
    }
  }
  return familyByTextName;
});

const buildEnrichSummary = (records: ReadonlyArray<CorpusEnrichmentRecord>): CorpusEnrichSummary => {
  const resolvedRecords = A.filter(records, (record) => record.status === "resolved");
  return CorpusEnrichSummary.make({
    applicationCandidates: NonNegativeInt.make(
      A.length(A.filter(records, (record) => record.candidateKind === "application"))
    ),
    failedLookups: NonNegativeInt.make(A.length(A.filter(records, (record) => record.status === "failed"))),
    familyAnchors: NonNegativeInt.make(
      A.length(A.filter(resolvedRecords, (record) => A.length(record.docketFamilies) > 0))
    ),
    notFound: NonNegativeInt.make(A.length(A.filter(records, (record) => record.status === "not-found"))),
    patentCandidates: NonNegativeInt.make(A.length(A.filter(records, (record) => record.candidateKind === "patent"))),
    resolved: NonNegativeInt.make(A.length(resolvedRecords)),
  });
};

// fallow-ignore-next-line complexity -- pre-existing enrichment orchestration re-entered the diff only through the mixed-ledger decoder change; this function's control flow is unchanged
const enrichCorpusImpl = Effect.fn("CorpusCommandService.enrichCorpus")(function* (
  options: CorpusEnrichOptions
): Effect.fn.Return<CorpusEnrichSummary, CorpusCommandError, CorpusCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const organizeManifestPath = path.join(options.corpusRoot, "catalog", "organize-manifest.jsonl");
  const textDir = path.join(options.corpusRoot, "staging", "extract", "text");
  const enrichmentManifestPath = path.join(options.corpusRoot, "catalog", "enrichment-manifest.jsonl");
  const summaryReportPath = path.join(options.corpusRoot, "catalog", "reports", "enrich-summary.json");
  const databasePath = path.join(options.corpusRoot, "catalog", "corpus.duckdb");
  const lookupDelayMillis = Math.max(0, Math.floor(options.lookupDelayMillis ?? 400));

  const organizeRecords = yield* loadEnrichOrganizeRecords(organizeManifestPath);
  const { candidates, scanText } = makeEnrichCandidateCollector();
  for (const record of organizeRecords) {
    scanText(`${record.effectiveName} ${record.sourceRelativePath}`, record.docketFamily);
  }
  const familyByTextName = yield* buildFamilyByTextName(options.corpusRoot, organizeRecords);

  const textDirExists = yield* fs
    .exists(textDir)
    .pipe(CorpusCommandError.mapError(`Failed checking extracted text directory "${textDir}".`));
  if (textDirExists) {
    const textFiles = yield* fs
      .readDirectory(textDir)
      .pipe(CorpusCommandError.mapError(`Failed reading extracted text directory "${textDir}".`));
    yield* Effect.forEach(
      textFiles,
      (name) =>
        fs.readFileString(path.join(textDir, name)).pipe(
          Effect.map((text) => scanText(text, familyByTextName.get(name))),
          CorpusCommandError.mapError(`Failed reading extracted text "${name}".`)
        ),
      { concurrency: 8 }
    );
  }

  const orderedCandidates = A.sort(
    [...candidates.entries()],
    Order.mapInput(
      Order.Number,
      (entry: readonly [string, EnrichCandidate]) =>
        // Docket-family-associated candidates first (filename-grounded, high
        // precision), then by corpus occurrence.
        (entry[1].docketFamilies.size > 0 ? -1_000_000 : 0) - entry[1].occurrenceCount
    )
  );
  const limited =
    options.maxLookups === undefined
      ? orderedCandidates
      : A.take(orderedCandidates, Math.max(0, Math.floor(options.maxLookups)));
  yield* Console.log(
    `corpus enrich: ${A.length(limited)}/${candidates.size} identifier candidates selected for USPTO lookup`
  );

  const lookups = Effect.gen(function* () {
    const uspto = yield* Uspto;
    return yield* Effect.forEach(
      limited,
      Effect.fnUntraced(function* ([key, candidate]) {
        const normalized = key.slice(key.indexOf(":") + 1);
        yield* Effect.sleep(`${lookupDelayMillis} millis`);
        const resolved =
          candidate.kind === "application"
            ? yield* uspto.getApplication(normalized).pipe(Effect.result)
            : yield* uspto.searchApplications(`applicationMetaData.patentNumber:"${normalized}"`).pipe(
                Effect.flatMap((results) => A.head(results).pipe(Effect.fromOption(() => makeUsptoError("not-found")))),
                Effect.result
              );

        if (Result.isFailure(resolved)) {
          const status = resolved.failure.reason === "not-found" ? ("not-found" as const) : ("failed" as const);
          return CorpusEnrichmentRecord.make({
            candidate: normalized,
            candidateKind: candidate.kind,
            docketFamilies: [...candidate.docketFamilies].sort(),
            occurrenceCount: NonNegativeInt.make(candidate.occurrenceCount),
            parentApplicationNumbers: [],
            status,
          });
        }

        const continuity = yield* uspto
          .getContinuity(resolved.success.applicationNumberText)
          .pipe(Effect.orElseSucceed(() => ({ childApplicationNumbers: [], parentApplicationNumbers: [] })));

        return CorpusEnrichmentRecord.make({
          applicationNumber: resolved.success.applicationNumberText,
          candidate: normalized,
          candidateKind: candidate.kind,
          docketFamilies: [...candidate.docketFamilies].sort(),
          occurrenceCount: NonNegativeInt.make(candidate.occurrenceCount),
          parentApplicationNumbers: continuity.parentApplicationNumbers,
          status: "resolved",
          ...O.getSomesStruct({
            firstApplicantName: resolved.success.firstApplicantName,
            firstInventorName: resolved.success.firstInventorName,
            inventionTitle: resolved.success.inventionTitle,
            patentNumber: resolved.success.patentNumber,
          }),
        });
      }),
      { concurrency: 1 }
    );
  });

  const records = yield* Effect.scoped(
    Layer.build(Uspto.layer).pipe(Effect.flatMap((context) => lookups.pipe(Effect.provide(context))))
  ).pipe(CorpusCommandError.mapError("USPTO enrichment lookups failed."));

  const manifestLines = yield* Effect.forEach(records, (record) =>
    encodeCorpusEnrichmentRecordJson(record).pipe(
      CorpusCommandError.mapError("Enrichment record failed JSONL encoding.")
    )
  );
  yield* writeCorpusStringFile(enrichmentManifestPath, jsonlContent(manifestLines));

  yield* runWithCorpusDb(
    databasePath,
    `Failed writing the enrichment catalog table at "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      yield* db.run(createEnrichmentTable);
      yield* insertRows(
        db,
        insertEnrichmentStatement,
        records,
        // fallow-ignore-next-line complexity -- pre-existing positional DuckDB binding re-entered the diff only through the mixed-ledger decoder change; this mapper's control flow is unchanged
        (record) => [
          record.candidate,
          record.candidateKind,
          record.status,
          record.applicationNumber ?? null,
          record.patentNumber ?? null,
          record.inventionTitle ?? null,
          record.firstApplicantName ?? null,
          record.firstInventorName ?? null,
          record.occurrenceCount,
          A.join(record.docketFamilies, " | "),
          A.join(record.parentApplicationNumbers, " | "),
        ]
      );
    })
  );

  const summary = buildEnrichSummary(records);
  const summaryJson = yield* encodeCorpusEnrichSummaryJson(summary).pipe(
    CorpusCommandError.mapError("Enrich summary failed JSON encoding.")
  );
  yield* writeCorpusStringFile(summaryReportPath, `${summaryJson}\n`);

  yield* Console.log(
    `corpus enrich: resolved=${summary.resolved} notFound=${summary.notFound} failed=${summary.failedLookups} familyAnchors=${summary.familyAnchors} (applications=${summary.applicationCandidates}, patents=${summary.patentCandidates})`
  );
  yield* Console.log(`corpus enrich: manifest "${enrichmentManifestPath}"`);

  return summary;
});

export {
  appendCorpusJsonLines,
  archiveMoveImpl,
  basenameOf,
  catalogCorpusImpl,
  decodeProvenanceLines,
  dedupeBySha256,
  discoverCatalogManifests,
  enrichCorpusImpl,
  extractCorpusImpl,
  findRawProvenanceManifests,
  hashFileSha256,
  insertRows,
  jsonlContent,
  labelPathKey,
  loadCatalogDigestRows,
  loadManifestDigestRows,
  loadSalvageDigestIndex,
  organizeCorpusImpl,
  parentDirOf,
  resolveWithinRoot,
  runWithCorpusDb,
  salvageCorpusImpl,
  sanitizeSegment,
  singleRow,
  validatePathSegment,
  verifySalvageImpl,
  writeCorpusStringFile,
};
