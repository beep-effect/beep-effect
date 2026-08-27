/**
 * Command definitions for corpus curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { CorpusCommandError } from "./Corpus.errors.ts";
import {
  CorpusArchiveMoveOptions,
  CorpusCatalogOptions,
  CorpusEnrichOptions,
  CorpusExtractOptions,
  CorpusOrganizeOptions,
  CorpusSalvageOptions,
  CorpusSalvageSourceSpec,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  RestorationPreserveOptions,
  RestorationRecycleOptions,
  RestorationVerifyOptions,
} from "./Corpus.schemas.ts";
import {
  archiveMoveCorpus,
  CorpusCommandServiceLive,
  catalogCorpus,
  enrichCorpus,
  extractCorpus,
  organizeCorpus,
  preserveRestorationArchive,
  printCorpusIndex,
  reconcileRestorationAcceptance,
  restoreLegacyWord,
  restoreMail,
  restoreRecycle,
  salvageCorpus,
  verifyRestorationArchive,
  verifySalvage,
} from "./Corpus.service.ts";

/** @since 0.0.0 */
const corpusRootFlag = Flag.directory("corpus-root", { mustExist: true }).pipe(
  Flag.withDescription(
    "Salvaged corpus root containing raw/provenance.jsonl; outputs land under <corpus-root>/catalog and <corpus-root>/staging"
  )
);
/** @since 0.0.0 */
const tikaJarFlag = Flag.file("tika-jar", { mustExist: true }).pipe(
  Flag.withDescription("Apache tika-app jar used for text and metadata extraction")
);
/** @since 0.0.0 */
const pffexportFlag = Flag.string("pffexport").pipe(
  Flag.withDescription("pffexport binary used for PST archive export"),
  Flag.optional
);
/** @since 0.0.0 */
const javaFlag = Flag.string("java").pipe(
  Flag.withDescription("java binary used to run the tika-app jar"),
  Flag.optional
);
/** @since 0.0.0 */
const exportChildrenFlag = Flag.boolean("export-children").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Export per-message child artifacts and attachments from PST archives")
);
/** @since 0.0.0 */
const includeDuplicatesFlag = Flag.boolean("include-duplicates").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Process every manifest record instead of one representative per content digest")
);
/** @since 0.0.0 */
const sourceLabelFlag = Flag.string("source").pipe(
  Flag.withDescription("Restrict extraction to one salvage source label"),
  Flag.optional
);
/** @since 0.0.0 */
const extractOutLabelFlag = Flag.string("out-label").pipe(
  Flag.withDescription(
    "Write extraction output under staging/<out-label> instead of staging/extract; must be one directory name"
  ),
  Flag.optional
);
/** @since 0.0.0 */
const extractConcurrencyFlag = Flag.integer("concurrency").pipe(
  Flag.withDefault(4),
  Flag.withDescription("Bounded number of concurrent extraction subprocesses")
);
/** @since 0.0.0 */
const maxFilesFlag = Flag.integer("max-files").pipe(
  Flag.withDescription("Process at most this many sources (smoke runs)"),
  Flag.optional
);
/** @since 0.0.0 */
const extractOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replace an existing staging/extract output tree")
);
/** @since 0.0.0 */
const sampleStrideFlag = Flag.integer("sample-stride").pipe(
  Flag.withDescription("Verify every Nth provenance record instead of all records"),
  Flag.optional
);
/** @since 0.0.0 */
const salvageRunLabelFlag = Flag.string("run-label").pipe(
  Flag.withDescription("Write copied files and provenance under raw/<run-label>/"),
  Flag.optional
);
/** @since 0.0.0 */
const salvageDedupeFlag = Flag.boolean("dedupe").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Hash each origin before copy and write provenance-only rows for already-known digests")
);
/** @since 0.0.0 */
const salvageSourceFlag = Flag.string("source").pipe(
  Flag.withDescription("Generic salvage source mapping in source-a=/path form; repeat for source-b, source-c, ..."),
  Flag.atMost(Number.MAX_SAFE_INTEGER)
);
/** @since 0.0.0 */
const archiveMoveSourceFlag = Flag.path("source", { mustExist: true, pathType: "either" }).pipe(
  Flag.withDescription("Source directory or file to archive after provenance verification; repeat for each source"),
  Flag.atLeast(1)
);
/** @since 0.0.0 */
const archiveRootFlag = Flag.directory("archive-root").pipe(
  Flag.withDescription("Archive root that will receive <source-basename> destinations")
);
/** @since 0.0.0 */
const archiveMoveProvenanceFlag = Flag.file("provenance", { mustExist: true }).pipe(
  Flag.withDescription("Run provenance.jsonl used to prove every source file before moving; repeat if needed"),
  Flag.atLeast(1)
);

const restorationSourceRootFlag = Flag.directory("source-root", { mustExist: true }).pipe(
  Flag.withDescription("Current source tree to preserve without transformation")
);
const restorationRootArchiveFlag = Flag.file("root-archive", { mustExist: true }).pipe(
  Flag.withDescription("Separately addressable verbatim root archive object")
);
const restorationCollectorManifestFlag = Flag.file("collector-manifest", { mustExist: true }).pipe(
  Flag.withDescription("Inherited collector JSONL ledger reconciled row by row before preservation")
);
const restorationAbsentTreeFlag = Flag.string("absent-recycle-tree").pipe(
  Flag.withDescription("Recorded absent recycle-tree path that must remain absent during opening reconciliation")
);
const restorationCapacityCeilingFlag = Flag.integer("capacity-ceiling-bytes").pipe(
  Flag.withDescription("Operator-approved maximum preserved payload bytes; required and checked before payload writes")
);
const restorationMinimumFreeFlag = Flag.integer("minimum-free-after-bytes").pipe(
  Flag.withDescription("Operator-approved free-space floor retained after the full required payload")
);
const restorationCollectorRowsFlag = Flag.integer("expected-collector-rows").pipe(
  Flag.withDefault(28_508),
  Flag.withDescription("Frozen inherited collector row denominator")
);
const restorationMissingRecycleFlag = Flag.integer("expected-missing-recycle-payloads").pipe(
  Flag.withDefault(13),
  Flag.withDescription("Ratified missing recycle-payload opening balance")
);
const restorationMutatedDestinationFlag = Flag.integer("expected-mutated-destinations").pipe(
  Flag.withDefault(1_021),
  Flag.withDescription("Ratified post-staging destination-mutation denominator")
);
const restorationRootArchiveBytesFlag = Flag.integer("expected-root-archive-bytes").pipe(
  Flag.withDefault(147_731_138_560),
  Flag.withDescription("Frozen byte denominator for the separately preserved root archive")
);
const restorationSourceDirectoriesFlag = Flag.integer("expected-source-directories").pipe(
  Flag.withDefault(755),
  Flag.withDescription("Frozen current-source directory denominator")
);
const restorationSourceFilesFlag = Flag.integer("expected-source-files").pipe(
  Flag.withDefault(12_156),
  Flag.withDescription("Frozen current-source file denominator")
);
const restorationSourceTreeBytesFlag = Flag.integer("expected-source-tree-bytes").pipe(
  Flag.withDefault(207_772_579_526),
  Flag.withDescription("Frozen current-source file-byte denominator")
);
const restorationChunkSizeFlag = Flag.integer("chunk-size-bytes").pipe(
  Flag.withDefault(8 * 1024 * 1024),
  Flag.withDescription("Bounded streaming copy and hashing chunk size")
);
const restorationRunLabelFlag = Flag.string("run-label").pipe(
  Flag.withDefault("t7-salvage-2026-08-10"),
  Flag.withDescription("Immutable destination label under corpus raw storage")
);
const restorationCrashPointFlag = Flag.choiceWithValue("crash-point", [
  ["none", "none" as const],
  ["after-payload-sync", "after-payload-sync" as const],
  ["after-rename", "after-rename" as const],
  ["before-pass", "before-pass" as const],
]).pipe(Flag.withDefault("none"), Flag.withDescription("Synthetic interruption boundary for recovery proofs"));
const restorationMailScopeFlag = Flag.choiceWithValue("scope", [
  ["slice", "slice" as const],
  ["full", "full" as const],
]).pipe(Flag.withDefault("slice"), Flag.withDescription("One metadata-selected PST or the complete mail estate"));
const restorationExpectedStoresFlag = Flag.integer("expected-stores").pipe(
  Flag.withDescription("Frozen terminal mail-store denominator for the selected scope")
);
const restorationMaxAmplificationFlag = Flag.float("max-amplification-ratio").pipe(
  Flag.withDescription("Approved maximum output-bytes to input-bytes ratio for each PST attempt")
);
const restorationMaxElapsedFlag = Flag.integer("max-elapsed-millis").pipe(
  Flag.withDescription("Approved maximum elapsed milliseconds for each PST attempt")
);
const restorationMaxTotalOutputFlag = Flag.integer("max-total-output-bytes").pipe(
  Flag.withDescription("Approved cumulative retained-output byte ceiling for the selected restoration family")
);
const restorationMaxTotalElapsedFlag = Flag.integer("max-total-elapsed-millis").pipe(
  Flag.withDescription("Approved cumulative elapsed-time ceiling for the selected restoration family")
);
const restorationExpectedRecycleSurfacesFlag = Flag.integer("expected-surfaces").pipe(
  Flag.withDefault(3),
  Flag.withDescription("Frozen recycle-surface denominator")
);
const restorationConverterFlag = Flag.string("converter").pipe(
  Flag.withDescription("Absolute pinned LibreOffice converter path")
);
const restorationExpectedConverterVersionFlag = Flag.string("expected-converter-version").pipe(
  Flag.withDescription("Exact approved output of the pinned converter --version probe")
);
const restorationExpectedLegacyWordOccurrencesFlag = Flag.integer("expected-occurrences").pipe(
  Flag.withDefault(564),
  Flag.withDescription("Frozen legacy .doc occurrence denominator before distinct-digest grouping")
);
const restorationMaxVisualRmseFlag = Flag.float("max-visual-rmse").pipe(
  Flag.withDescription("Approved maximum normalized rendered-page RMSE")
);
const restorationBwrapFlag = Flag.string("bwrap").pipe(Flag.withDefault("bwrap"));
const restorationCompareFlag = Flag.string("compare").pipe(Flag.withDefault("compare"));
const restorationPdfinfoFlag = Flag.string("pdfinfo").pipe(Flag.withDefault("pdfinfo"));
const restorationPdftoppmFlag = Flag.string("pdftoppm").pipe(Flag.withDefault("pdftoppm"));

const parseSalvageSourceSpec = Effect.fn("CorpusCommand.parseSalvageSourceSpec")(function* (
  value: string
): Effect.fn.Return<CorpusSalvageSourceSpec, CorpusCommandError> {
  const separator = Str.indexOf("=")(value);
  if (O.isNone(separator)) {
    return yield* CorpusCommandError.make({
      message: `Salvage --source must use source-label=/path form; received "${value}".`,
    });
  }
  const sourceLabel = Str.slice(0, separator.value)(value);
  const sourcePath = Str.slice(separator.value + 1)(value);
  if (Str.isEmpty(sourceLabel) || Str.isEmpty(sourcePath)) {
    return yield* CorpusCommandError.make({
      message: `Salvage --source must include both source label and path; received "${value}".`,
    });
  }
  return CorpusSalvageSourceSpec.make({ sourceLabel, sourcePath });
});

const corpusCatalogCommand = Command.make(
  "catalog",
  {
    corpusRoot: corpusRootFlag,
  },
  Effect.fn(function* ({ corpusRoot }) {
    yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription(
    "Build the corpus DuckDB catalog, exact-duplicate report, and recycle-bin name-restoration manifest"
  ),
  Command.provide(CorpusCommandServiceLive)
);

const corpusExtractCommand = Command.make(
  "extract",
  {
    concurrency: extractConcurrencyFlag,
    corpusRoot: corpusRootFlag,
    exportChildren: exportChildrenFlag,
    includeDuplicates: includeDuplicatesFlag,
    java: javaFlag,
    maxFiles: maxFilesFlag,
    outLabel: extractOutLabelFlag,
    overwrite: extractOverwriteFlag,
    pffexport: pffexportFlag,
    source: sourceLabelFlag,
    tikaJar: tikaJarFlag,
  },
  Effect.fn(function* ({
    concurrency,
    corpusRoot,
    exportChildren,
    includeDuplicates,
    java,
    maxFiles,
    outLabel,
    overwrite,
    pffexport,
    source,
    tikaJar,
  }) {
    yield* extractCorpus(
      CorpusExtractOptions.make({
        concurrency,
        corpusRoot,
        exportChildren,
        includeDuplicates,
        overwrite,
        tikaJarPath: tikaJar,
        ...(O.isNone(java) ? {} : { javaPath: java.value }),
        ...(O.isNone(maxFiles) ? {} : { maxFiles: maxFiles.value }),
        ...(O.isNone(outLabel) ? {} : { outLabel: outLabel.value }),
        ...(O.isNone(pffexport) ? {} : { pffexportPath: pffexport.value }),
        ...(O.isNone(source) ? {} : { sourceLabel: source.value }),
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Run libpff and Tika extraction over salvaged raw/ files into staging/extract"),
  Command.provide(CorpusCommandServiceLive)
);

const clientMapFlag = Flag.file("client-map", { mustExist: true }).pipe(
  Flag.withDescription("JSON file mapping salvage source labels to client slugs"),
  Flag.optional
);
const organizeOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Rebuild a non-empty organized/ tree")
);

const corpusOrganizeCommand = Command.make(
  "organize",
  {
    clientMap: clientMapFlag,
    corpusRoot: corpusRootFlag,
    overwrite: organizeOverwriteFlag,
  },
  Effect.fn(function* ({ clientMap, corpusRoot, overwrite }) {
    yield* organizeCorpus(
      CorpusOrganizeOptions.make({
        corpusRoot,
        overwrite,
        ...(O.isNone(clientMap) ? {} : { clientMapPath: clientMap.value }),
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Build the organized/ client, docket, and email-archive taxonomy from the catalog"),
  Command.provide(CorpusCommandServiceLive)
);

const maxLookupsFlag = Flag.integer("max-lookups").pipe(
  Flag.withDescription("Resolve at most this many identifier candidates against USPTO"),
  Flag.optional
);
const lookupDelayFlag = Flag.integer("lookup-delay-millis").pipe(
  Flag.withDefault(400),
  Flag.withDescription("Delay between USPTO lookups to respect rate limits")
);

const corpusEnrichCommand = Command.make(
  "enrich",
  {
    corpusRoot: corpusRootFlag,
    lookupDelayMillis: lookupDelayFlag,
    maxLookups: maxLookupsFlag,
  },
  Effect.fn(function* ({ corpusRoot, lookupDelayMillis, maxLookups }) {
    yield* enrichCorpus(
      CorpusEnrichOptions.make({
        corpusRoot,
        lookupDelayMillis,
        ...(O.isNone(maxLookups) ? {} : { maxLookups: maxLookups.value }),
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Resolve corpus-derived patent and application numbers against the USPTO open data portal"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusSalvageCommand = Command.make(
  "salvage",
  {
    corpusRoot: corpusRootFlag,
    dedupe: salvageDedupeFlag,
    runLabel: salvageRunLabelFlag,
    sampleStride: sampleStrideFlag,
    source: salvageSourceFlag,
  },
  Effect.fn(function* ({ corpusRoot, dedupe, runLabel, sampleStride, source }) {
    const sources = yield* Effect.forEach(source, parseSalvageSourceSpec);
    const options = CorpusSalvageOptions.make({
      corpusRoot,
      dedupe,
      ...(O.isNone(runLabel) ? {} : { runLabel: runLabel.value }),
      ...(O.isNone(sampleStride) ? {} : { sampleStride: sampleStride.value }),
      ...(A.length(sources) === 0 ? {} : { sources }),
    });
    yield* (A.length(sources) === 0 ? verifySalvage(options) : salvageCorpus(options)).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Copy labeled sources into raw/ with provenance, or verify an existing raw/provenance.jsonl"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationPreserveCommand = Command.make(
  "restore-preserve",
  {
    absentRecycleTree: restorationAbsentTreeFlag,
    capacityCeilingBytes: restorationCapacityCeilingFlag,
    chunkSizeBytes: restorationChunkSizeFlag,
    collectorManifest: restorationCollectorManifestFlag,
    corpusRoot: corpusRootFlag,
    crashPoint: restorationCrashPointFlag,
    expectedCollectorRows: restorationCollectorRowsFlag,
    expectedMissingRecyclePayloads: restorationMissingRecycleFlag,
    expectedMutatedDestinations: restorationMutatedDestinationFlag,
    expectedRootArchiveBytes: restorationRootArchiveBytesFlag,
    expectedSourceDirectories: restorationSourceDirectoriesFlag,
    expectedSourceFiles: restorationSourceFilesFlag,
    expectedSourceTreeBytes: restorationSourceTreeBytesFlag,
    minimumFreeAfterBytes: restorationMinimumFreeFlag,
    rootArchive: restorationRootArchiveFlag,
    runLabel: restorationRunLabelFlag,
    sourceRoot: restorationSourceRootFlag,
  },
  Effect.fn(function* ({
    absentRecycleTree,
    capacityCeilingBytes,
    chunkSizeBytes,
    collectorManifest,
    corpusRoot,
    crashPoint,
    expectedCollectorRows,
    expectedMissingRecyclePayloads,
    expectedMutatedDestinations,
    expectedRootArchiveBytes,
    expectedSourceDirectories,
    expectedSourceFiles,
    expectedSourceTreeBytes,
    minimumFreeAfterBytes,
    rootArchive,
    runLabel,
    sourceRoot,
  }) {
    yield* preserveRestorationArchive(
      RestorationPreserveOptions.make({
        absentRecycleTreePath: absentRecycleTree,
        capacityCeilingBytes: NonNegativeInt.make(capacityCeilingBytes),
        chunkSizeBytes: NonNegativeInt.make(chunkSizeBytes),
        corpusRoot,
        crashPoint,
        expectedCollectorRowCount: NonNegativeInt.make(expectedCollectorRows),
        expectedMissingRecyclePayloadCount: NonNegativeInt.make(expectedMissingRecyclePayloads),
        expectedMutatedDestinationCount: NonNegativeInt.make(expectedMutatedDestinations),
        expectedRootArchiveBytes: NonNegativeInt.make(expectedRootArchiveBytes),
        expectedSourceDirectoryCount: NonNegativeInt.make(expectedSourceDirectories),
        expectedSourceFileCount: NonNegativeInt.make(expectedSourceFiles),
        expectedSourceTreeBytes: NonNegativeInt.make(expectedSourceTreeBytes),
        minimumFreeAfterBytes: NonNegativeInt.make(minimumFreeAfterBytes),
        rootArchivePath: rootArchive,
        runLabel,
        sourceManifestPath: collectorManifest,
        sourceRoot,
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Preserve the ratified corpus state through the bounded bar-v2 archive boundary"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationVerifyCommand = Command.make(
  "restore-verify",
  {
    corpusRoot: corpusRootFlag,
    runLabel: restorationRunLabelFlag,
  },
  Effect.fn(function* ({ corpusRoot, runLabel }) {
    yield* verifyRestorationArchive(RestorationVerifyOptions.make({ corpusRoot, runLabel })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Fresh-process verification of every terminal restoration archive object"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationAcceptanceCommand = Command.make(
  "restore-accept",
  {
    corpusRoot: corpusRootFlag,
    runLabel: restorationRunLabelFlag,
  },
  Effect.fn(function* ({ corpusRoot, runLabel }) {
    yield* reconcileRestorationAcceptance(RestorationVerifyOptions.make({ corpusRoot, runLabel })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Reconcile four separate aggregate-only restoration acceptance records"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationMailCommand = Command.make(
  "restore-mail",
  {
    corpusRoot: corpusRootFlag,
    expectedStores: restorationExpectedStoresFlag,
    java: javaFlag,
    maxAmplificationRatio: restorationMaxAmplificationFlag,
    maxElapsedMillis: restorationMaxElapsedFlag,
    maxTotalElapsedMillis: restorationMaxTotalElapsedFlag,
    maxTotalOutputBytes: restorationMaxTotalOutputFlag,
    pffexport: pffexportFlag,
    runLabel: restorationRunLabelFlag,
    scope: restorationMailScopeFlag,
    tikaJar: tikaJarFlag,
  },
  Effect.fn(function* ({
    corpusRoot,
    expectedStores,
    java,
    maxAmplificationRatio,
    maxElapsedMillis,
    maxTotalElapsedMillis,
    maxTotalOutputBytes,
    pffexport,
    runLabel,
    scope,
    tikaJar,
  }) {
    yield* restoreMail(
      RestorationMailOptions.make({
        corpusRoot,
        expectedStoreCount: NonNegativeInt.make(expectedStores),
        javaPath: O.getOrElse(java, () => "java"),
        maxAmplificationRatio,
        maxElapsedMillis: NonNegativeInt.make(maxElapsedMillis),
        maxTotalElapsedMillis: NonNegativeInt.make(maxTotalElapsedMillis),
        maxTotalOutputBytes: NonNegativeInt.make(maxTotalOutputBytes),
        pffexportPath: O.getOrElse(pffexport, () => "pffexport"),
        runLabel,
        scope,
        tikaJarPath: tikaJar,
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Restore one metadata-selected PST or the complete mail estate at concurrency one"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationRecycleCommand = Command.make(
  "restore-recycle",
  {
    corpusRoot: corpusRootFlag,
    expectedMissingContent: restorationMissingRecycleFlag,
    expectedSurfaces: restorationExpectedRecycleSurfacesFlag,
    maxTotalElapsedMillis: restorationMaxTotalElapsedFlag,
    maxTotalOutputBytes: restorationMaxTotalOutputFlag,
    runLabel: restorationRunLabelFlag,
  },
  Effect.fn(function* ({
    corpusRoot,
    expectedMissingContent,
    expectedSurfaces,
    maxTotalElapsedMillis,
    maxTotalOutputBytes,
    runLabel,
  }) {
    yield* restoreRecycle(
      RestorationRecycleOptions.make({
        corpusRoot,
        expectedMissingContentCount: NonNegativeInt.make(expectedMissingContent),
        expectedSurfaceCount: NonNegativeInt.make(expectedSurfaces),
        maxTotalElapsedMillis: NonNegativeInt.make(maxTotalElapsedMillis),
        maxTotalOutputBytes: NonNegativeInt.make(maxTotalOutputBytes),
        runLabel,
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Restore all recycle surfaces through a four-class occurrence join"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationLegacyWordCommand = Command.make(
  "restore-legacy-word",
  {
    bwrap: restorationBwrapFlag,
    compare: restorationCompareFlag,
    converter: restorationConverterFlag,
    corpusRoot: corpusRootFlag,
    expectedConverterVersion: restorationExpectedConverterVersionFlag,
    expectedOccurrences: restorationExpectedLegacyWordOccurrencesFlag,
    java: javaFlag,
    maxElapsedMillis: restorationMaxElapsedFlag,
    maxTotalElapsedMillis: restorationMaxTotalElapsedFlag,
    maxTotalOutputBytes: restorationMaxTotalOutputFlag,
    maxVisualRmse: restorationMaxVisualRmseFlag,
    pdfinfo: restorationPdfinfoFlag,
    pdftoppm: restorationPdftoppmFlag,
    runLabel: restorationRunLabelFlag,
    tikaJar: tikaJarFlag,
  },
  Effect.fn(function* ({
    bwrap,
    compare,
    converter,
    corpusRoot,
    expectedConverterVersion,
    expectedOccurrences,
    java,
    maxElapsedMillis,
    maxTotalElapsedMillis,
    maxTotalOutputBytes,
    maxVisualRmse,
    pdfinfo,
    pdftoppm,
    runLabel,
    tikaJar,
  }) {
    yield* restoreLegacyWord(
      RestorationLegacyWordOptions.make({
        bwrapPath: bwrap,
        comparePath: compare,
        converterPath: converter,
        corpusRoot,
        expectedConverterVersion,
        expectedOccurrenceCount: NonNegativeInt.make(expectedOccurrences),
        javaPath: O.getOrElse(java, () => "java"),
        maxElapsedMillis: NonNegativeInt.make(maxElapsedMillis),
        maxTotalElapsedMillis: NonNegativeInt.make(maxTotalElapsedMillis),
        maxTotalOutputBytes: NonNegativeInt.make(maxTotalOutputBytes),
        maxVisualRmse,
        pdfinfoPath: pdfinfo,
        pdftoppmPath: pdftoppm,
        runLabel,
        tikaJarPath: tikaJar,
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Convert every distinct legacy .doc digest inside a pinned fidelity sandbox"),
  Command.provide(CorpusCommandServiceLive)
);

/** @since 0.0.0 */
const corpusArchiveMoveCommand = Command.make(
  "archive-move",
  {
    archiveRoot: archiveRootFlag,
    provenance: archiveMoveProvenanceFlag,
    source: archiveMoveSourceFlag,
  },
  Effect.fn(function* ({ archiveRoot, provenance, source }) {
    yield* archiveMoveCorpus(
      CorpusArchiveMoveOptions.make({
        archiveRoot,
        provenancePaths: provenance,
        sourcePaths: source,
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Move fully provenance-covered source directories or files into an archive root"),
  Command.provide(CorpusCommandServiceLive)
);

/**
 * Corpus curation command group.
 *
 * **Example** (Register corpus command group)
 *
 * ```ts
 * import { corpusCommand } from "@beep/repo-cli/commands/Corpus"
 *
 * const commandGroups = { corpus: corpusCommand }
 * console.log(Object.keys(commandGroups)) // ["corpus"]
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const corpusCommand = Command.make("corpus", {}, () => printCorpusIndex).pipe(
  Command.withDescription("Corpus salvage and curation commands"),
  Command.withSubcommands([
    corpusArchiveMoveCommand,
    corpusCatalogCommand,
    corpusEnrichCommand,
    corpusExtractCommand,
    corpusOrganizeCommand,
    corpusRestorationPreserveCommand,
    corpusRestorationAcceptanceCommand,
    corpusRestorationLegacyWordCommand,
    corpusRestorationMailCommand,
    corpusRestorationRecycleCommand,
    corpusRestorationVerifyCommand,
    corpusSalvageCommand,
  ])
);
