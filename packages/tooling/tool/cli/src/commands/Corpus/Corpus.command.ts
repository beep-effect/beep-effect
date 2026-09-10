/**
 * Command definitions for corpus curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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
  T7PreservationOptions,
} from "./Corpus.schemas.ts";
import {
  approveT7Preservation,
  archiveMoveCorpus,
  CorpusCommandServiceLive,
  catalogCorpus,
  enrichCorpus,
  extractCorpus,
  organizeCorpus,
  preflightT7Preservation,
  preserveRestorationArchive,
  printCorpusIndex,
  reconcileRestorationAcceptance,
  restoreLegacyWord,
  restoreMail,
  restoreRecycle,
  runT7Preservation,
  salvageCorpus,
  verifyRestorationArchive,
  verifySalvage,
  verifyT7Preservation,
} from "./Corpus.service.ts";

const decodeRestorationLegacyWordOptions = S.decodeEffect(RestorationLegacyWordOptions);
const decodeRestorationMailOptions = S.decodeEffect(RestorationMailOptions);
const decodeRestorationPreserveOptions = S.decodeEffect(RestorationPreserveOptions);
const decodeRestorationRecycleOptions = S.decodeEffect(RestorationRecycleOptions);
const decodeRestorationVerifyOptions = S.decodeEffect(RestorationVerifyOptions);

/** @since 0.0.0 */
const corpusRootFlag = Flag.Directory("corpus-root", { mustExist: true }).pipe(
  Flag.withFallbackConfig(Config.String("BEEP_OPPOLD_CORPUS_ROOT")),
  Flag.withDescription(
    "Salvaged corpus root containing raw/provenance.jsonl; outputs land under <corpus-root>/catalog and <corpus-root>/staging"
  )
);
/** @since 0.0.0 */
const tikaJarFlag = Flag.File("tika-jar", { mustExist: true }).pipe(
  Flag.withDescription("Apache tika-app jar used for text and metadata extraction")
);
/** @since 0.0.0 */
const pffexportFlag = Flag.String("pffexport").pipe(
  Flag.withDescription("pffexport binary used for PST archive export"),
  Flag.optional
);
/** @since 0.0.0 */
const javaFlag = Flag.String("java").pipe(
  Flag.withDescription("java binary used to run the tika-app jar"),
  Flag.optional
);
/** @since 0.0.0 */
const exportChildrenFlag = Flag.Boolean("export-children").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Export per-message child artifacts and attachments from PST archives")
);
/** @since 0.0.0 */
const includeDuplicatesFlag = Flag.Boolean("include-duplicates").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Process every manifest record instead of one representative per content digest")
);
/** @since 0.0.0 */
const sourceLabelFlag = Flag.String("source").pipe(
  Flag.withDescription("Restrict extraction to one salvage source label"),
  Flag.optional
);
/** @since 0.0.0 */
const extractOutLabelFlag = Flag.String("out-label").pipe(
  Flag.withDescription(
    "Write extraction output under staging/<out-label> instead of staging/extract; must be one directory name"
  ),
  Flag.optional
);
/** @since 0.0.0 */
const extractConcurrencyFlag = Flag.Int("concurrency").pipe(
  Flag.withDefault(4),
  Flag.withDescription("Bounded number of concurrent extraction subprocesses")
);
/** @since 0.0.0 */
const maxFilesFlag = Flag.Int("max-files").pipe(
  Flag.withDescription("Process at most this many sources (smoke runs)"),
  Flag.optional
);
/** @since 0.0.0 */
const extractOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replace an existing staging/extract output tree")
);
/** @since 0.0.0 */
const sampleStrideFlag = Flag.Int("sample-stride").pipe(
  Flag.withDescription("Verify every Nth provenance record instead of all records"),
  Flag.optional
);
/** @since 0.0.0 */
const salvageRunLabelFlag = Flag.String("run-label").pipe(
  Flag.withDescription("Write copied files and provenance under raw/<run-label>/"),
  Flag.optional
);
/** @since 0.0.0 */
const salvageDedupeFlag = Flag.Boolean("dedupe").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Hash each origin before copy and write provenance-only rows for already-known digests")
);
/** @since 0.0.0 */
const salvageSourceFlag = Flag.String("source").pipe(
  Flag.withDescription("Generic salvage source mapping in source-a=/path form; repeat for source-b, source-c, ..."),
  Flag.atMost(Number.MAX_SAFE_INTEGER)
);
/** @since 0.0.0 */
const archiveMoveSourceFlag = Flag.Path("source", { mustExist: true, pathType: "either" }).pipe(
  Flag.withDescription("Source directory or file to archive after provenance verification; repeat for each source"),
  Flag.atLeast(1)
);
/** @since 0.0.0 */
const archiveRootFlag = Flag.Directory("archive-root").pipe(
  Flag.withDescription("Archive root that will receive <source-basename> destinations")
);
/** @since 0.0.0 */
const archiveMoveProvenanceFlag = Flag.File("provenance", { mustExist: true }).pipe(
  Flag.withDescription("Run provenance.jsonl used to prove every source file before moving; repeat if needed"),
  Flag.atLeast(1)
);
/** @since 0.0.0 */
const t7RootFlag = Flag.Directory("t7-root", { mustExist: true }).pipe(
  Flag.withFallbackConfig(Config.String("BEEP_T7_ROOT")),
  Flag.withDescription("Mounted T7 root containing the salvage tree and the separate root archive object")
);
/** @since 0.0.0 */
const preservationCeilingFlag = Flag.Int("ceiling-bytes").pipe(
  Flag.withDescription("Operator-approved maximum bytes for the measured preservation scope")
);
/** @since 0.0.0 */
const preservationApproverFlag = Flag.String("approved-by").pipe(
  Flag.withDescription("Non-secret operator label approving the measured byte ceiling")
);

const restorationSourceRootFlag = Flag.Directory("source-root", { mustExist: true }).pipe(
  Flag.withDescription("Current source tree to preserve without transformation")
);
const restorationRootArchiveFlag = Flag.File("root-archive", { mustExist: true }).pipe(
  Flag.withDescription("Separately addressable verbatim root archive object")
);
const restorationCollectorManifestFlag = Flag.File("collector-manifest", { mustExist: true }).pipe(
  Flag.withDescription("Inherited collector JSONL ledger reconciled row by row before preservation")
);
const restorationAbsentTreeFlag = Flag.String("absent-recycle-tree").pipe(
  Flag.withDescription("Recorded absent recycle-tree path that must remain absent during opening reconciliation")
);
const restorationCapacityCeilingFlag = Flag.Int("capacity-ceiling-bytes").pipe(
  Flag.withDescription("Operator-approved maximum preserved payload bytes; required and checked before payload writes")
);
const restorationMinimumFreeFlag = Flag.Int("minimum-free-after-bytes").pipe(
  Flag.withDescription("Operator-approved free-space floor retained after the full required payload")
);
const restorationCollectorRowsFlag = Flag.Int("expected-collector-rows").pipe(
  Flag.withDefault(28_508),
  Flag.withDescription("Frozen inherited collector row denominator")
);
const restorationMissingRecycleFlag = Flag.Int("expected-missing-recycle-payloads").pipe(
  Flag.withDefault(13),
  Flag.withDescription("Ratified missing recycle-payload opening balance")
);
const restorationMutatedDestinationFlag = Flag.Int("expected-mutated-destinations").pipe(
  Flag.withDefault(1_021),
  Flag.withDescription("Ratified post-staging destination-mutation denominator")
);
const restorationRootArchiveBytesFlag = Flag.Int("expected-root-archive-bytes").pipe(
  Flag.withDefault(147_731_138_560),
  Flag.withDescription("Frozen byte denominator for the separately preserved root archive")
);
const restorationSourceDirectoriesFlag = Flag.Int("expected-source-directories").pipe(
  Flag.withDefault(755),
  Flag.withDescription("Frozen current-source directory denominator")
);
const restorationSourceFilesFlag = Flag.Int("expected-source-files").pipe(
  Flag.withDefault(12_156),
  Flag.withDescription("Frozen current-source file denominator")
);
const restorationSourceTreeBytesFlag = Flag.Int("expected-source-tree-bytes").pipe(
  Flag.withDefault(207_772_579_526),
  Flag.withDescription("Frozen current-source file-byte denominator")
);
const restorationChunkSizeFlag = Flag.Int("chunk-size-bytes").pipe(
  Flag.withDefault(8 * 1024 * 1024),
  Flag.withDescription("Bounded streaming copy and hashing chunk size")
);
const restorationRunLabelFlag = Flag.String("run-label").pipe(
  Flag.withDefault("t7-salvage-2026-08-10"),
  Flag.withDescription("Immutable destination label under corpus raw storage")
);
const restorationCrashPointFlag = Flag.ChoiceWithValue("crash-point", [
  ["none", "none"],
  ["after-payload-sync", "after-payload-sync"],
  ["after-rename", "after-rename"],
  ["before-pass", "before-pass"],
]).pipe(Flag.withDefault("none"), Flag.withDescription("Synthetic interruption boundary for recovery proofs"));
const restorationMailScopeFlag = Flag.ChoiceWithValue("scope", [
  ["slice", "slice"],
  ["full", "full"],
]).pipe(Flag.withDefault("slice"), Flag.withDescription("One metadata-selected PST or the complete mail estate"));
const restorationExpectedStoresFlag = Flag.Int("expected-stores").pipe(
  Flag.withDescription("Frozen terminal mail-store denominator for the selected scope")
);
const restorationMaxAmplificationFlag = Flag.Finite("max-amplification-ratio").pipe(
  Flag.withDescription("Approved maximum output-bytes to input-bytes ratio for each PST attempt")
);
const restorationMaxElapsedFlag = Flag.Int("max-elapsed-millis").pipe(
  Flag.withDescription("Approved maximum elapsed milliseconds for each individual transformation attempt")
);
const restorationMaxTotalOutputFlag = Flag.Int("max-total-output-bytes").pipe(
  Flag.withDescription("Approved cumulative retained-output byte ceiling for the selected restoration family")
);
const restorationMaxTotalElapsedFlag = Flag.Int("max-total-elapsed-millis").pipe(
  Flag.withDescription("Approved cumulative elapsed-time ceiling for the selected restoration family")
);
const restorationExpectedRecycleSurfacesFlag = Flag.Int("expected-surfaces").pipe(
  Flag.withDefault(3),
  Flag.withDescription("Frozen recycle-surface denominator")
);
const restorationConverterFlag = Flag.String("converter").pipe(
  Flag.withDescription("Absolute pinned LibreOffice converter path")
);
const restorationExpectedConverterVersionFlag = Flag.String("expected-converter-version").pipe(
  Flag.withDescription("Exact approved output of the pinned converter --version probe")
);
const restorationExpectedLegacyWordOccurrencesFlag = Flag.Int("expected-occurrences").pipe(
  Flag.withDefault(564),
  Flag.withDescription("Frozen legacy .doc occurrence denominator before distinct-digest grouping")
);
const restorationMaxVisualRmseFlag = Flag.Finite("max-visual-rmse").pipe(
  Flag.withDescription("Approved maximum normalized rendered-page RMSE")
);
const restorationBwrapFlag = Flag.String("bwrap").pipe(
  Flag.withDefault("bwrap"),
  Flag.withDescription("bubblewrap binary used to isolate transformation subprocesses")
);
const restorationCompareFlag = Flag.String("compare").pipe(
  Flag.withDefault("compare"),
  Flag.withDescription("ImageMagick compare binary used for rendered-page fidelity measurements")
);
const restorationPdfinfoFlag = Flag.String("pdfinfo").pipe(
  Flag.withDefault("pdfinfo"),
  Flag.withDescription("Poppler pdfinfo binary used to count converted PDF pages")
);
const restorationPdftoppmFlag = Flag.String("pdftoppm").pipe(
  Flag.withDefault("pdftoppm"),
  Flag.withDescription("Poppler pdftoppm binary used to render fidelity-check pages")
);

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
  // fallow-ignore-next-line complexity -- pre-existing extract-command flag adapter re-entered the diff through adjacent preserve subcommands; this function's control flow is unchanged
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

const clientMapFlag = Flag.File("client-map", { mustExist: true }).pipe(
  Flag.withDescription("JSON file mapping salvage source labels to client slugs"),
  Flag.optional
);
const organizeOverwriteFlag = Flag.Boolean("overwrite").pipe(
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

const maxLookupsFlag = Flag.Int("max-lookups").pipe(
  Flag.withDescription("Resolve at most this many identifier candidates against USPTO"),
  Flag.optional
);
const lookupDelayFlag = Flag.Int("lookup-delay-millis").pipe(
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
  // fallow-ignore-next-line complexity -- pre-existing salvage-command flag adapter re-entered the diff through adjacent preserve subcommands; this function's control flow is unchanged
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
    const options = yield* decodeRestorationPreserveOptions({
      absentRecycleTreePath: absentRecycleTree,
      capacityCeilingBytes,
      chunkSizeBytes,
      corpusRoot,
      crashPoint,
      expectedCollectorRowCount: expectedCollectorRows,
      expectedMissingRecyclePayloadCount: expectedMissingRecyclePayloads,
      expectedMutatedDestinationCount: expectedMutatedDestinations,
      expectedRootArchiveBytes,
      expectedSourceDirectoryCount: expectedSourceDirectories,
      expectedSourceFileCount: expectedSourceFiles,
      expectedSourceTreeBytes,
      minimumFreeAfterBytes,
      rootArchivePath: rootArchive,
      runLabel,
      sourceManifestPath: collectorManifest,
      sourceRoot,
    }).pipe(CorpusCommandError.mapError("Invalid restoration preservation options."));
    yield* preserveRestorationArchive(options).pipe(Effect.asVoid);
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
    const options = yield* decodeRestorationVerifyOptions({ corpusRoot, runLabel }).pipe(
      CorpusCommandError.mapError("Invalid restoration verification options.")
    );
    yield* verifyRestorationArchive(options).pipe(Effect.asVoid);
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
    const options = yield* decodeRestorationVerifyOptions({ corpusRoot, runLabel }).pipe(
      CorpusCommandError.mapError("Invalid restoration acceptance options.")
    );
    yield* reconcileRestorationAcceptance(options).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Reconcile four separate aggregate-only restoration acceptance records"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusRestorationMailCommand = Command.make(
  "restore-mail",
  {
    bwrap: restorationBwrapFlag,
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
    bwrap,
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
    const options = yield* decodeRestorationMailOptions({
      bwrapPath: bwrap,
      corpusRoot,
      expectedStoreCount: expectedStores,
      javaPath: O.getOrElse(java, () => "java"),
      maxAmplificationRatio,
      maxElapsedMillis,
      maxTotalElapsedMillis,
      maxTotalOutputBytes,
      pffexportPath: O.getOrElse(pffexport, () => "pffexport"),
      runLabel,
      scope,
      tikaJarPath: tikaJar,
    }).pipe(CorpusCommandError.mapError("Invalid restoration mail options."));
    yield* restoreMail(options).pipe(Effect.asVoid);
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
    const options = yield* decodeRestorationRecycleOptions({
      corpusRoot,
      expectedMissingContentCount: expectedMissingContent,
      expectedSurfaceCount: expectedSurfaces,
      maxTotalElapsedMillis,
      maxTotalOutputBytes,
      runLabel,
    }).pipe(CorpusCommandError.mapError("Invalid restoration recycle options."));
    yield* restoreRecycle(options).pipe(Effect.asVoid);
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
    const options = yield* decodeRestorationLegacyWordOptions({
      bwrapPath: bwrap,
      comparePath: compare,
      converterPath: converter,
      corpusRoot,
      expectedConverterVersion,
      expectedOccurrenceCount: expectedOccurrences,
      javaPath: O.getOrElse(java, () => "java"),
      maxElapsedMillis,
      maxTotalElapsedMillis,
      maxTotalOutputBytes,
      maxVisualRmse,
      pdfinfoPath: pdfinfo,
      pdftoppmPath: pdftoppm,
      runLabel,
      tikaJarPath: tikaJar,
    }).pipe(CorpusCommandError.mapError("Invalid restoration legacy-Word options."));
    yield* restoreLegacyWord(options).pipe(Effect.asVoid);
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

const corpusPreservePreflightCommand = Command.make(
  "preflight",
  { corpusRoot: corpusRootFlag, t7Root: t7RootFlag },
  Effect.fn(function* ({ corpusRoot, t7Root }) {
    yield* preflightT7Preservation(T7PreservationOptions.make({ corpusRoot, t7Root })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Measure the bounded T7 preservation scope and destination free space"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusPreserveApproveCommand = Command.make(
  "approve",
  {
    approvedBy: preservationApproverFlag,
    ceilingBytes: preservationCeilingFlag,
    corpusRoot: corpusRootFlag,
  },
  Effect.fn(function* ({ approvedBy, ceilingBytes, corpusRoot }) {
    yield* approveT7Preservation(corpusRoot, ceilingBytes, approvedBy).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Approve the persisted preservation measurement with an explicit byte ceiling"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusPreserveRunCommand = Command.make(
  "run",
  { corpusRoot: corpusRootFlag, t7Root: t7RootFlag },
  Effect.fn(function* ({ corpusRoot, t7Root }) {
    yield* runT7Preservation(T7PreservationOptions.make({ corpusRoot, t7Root })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Run the approved one-pass T7 archive operation"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusPreserveVerifyCommand = Command.make(
  "verify",
  { corpusRoot: corpusRootFlag },
  Effect.fn(function* ({ corpusRoot }) {
    yield* verifyT7Preservation(corpusRoot).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Freshly reparse the preservation manifest and re-hash terminal destinations"),
  Command.provide(CorpusCommandServiceLive)
);

const corpusPreserveCommand = Command.make("preserve", {}, () => printCorpusIndex).pipe(
  Command.withDescription("T7 restoration-bar-v2 preservation commands"),
  Command.withSubcommands([
    corpusPreserveApproveCommand,
    corpusPreservePreflightCommand,
    corpusPreserveRunCommand,
    corpusPreserveVerifyCommand,
  ])
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
    corpusPreserveCommand,
    corpusSalvageCommand,
  ])
);
