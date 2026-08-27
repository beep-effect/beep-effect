/**
 * Command definitions for corpus curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Effect } from "effect";
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
  printCorpusIndex,
  runT7Preservation,
  salvageCorpus,
  verifySalvage,
  verifyT7Preservation,
} from "./Corpus.service.ts";

/** @since 0.0.0 */
const corpusRootFlag = Flag.directory("corpus-root", { mustExist: true }).pipe(
  Flag.withFallbackConfig(Config.string("BEEP_OPPOLD_CORPUS_ROOT")),
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
/** @since 0.0.0 */
const t7RootFlag = Flag.directory("t7-root", { mustExist: true }).pipe(
  Flag.withFallbackConfig(Config.string("BEEP_T7_ROOT")),
  Flag.withDescription("Mounted T7 root containing the salvage tree and the separate root archive object")
);
/** @since 0.0.0 */
const preservationCeilingFlag = Flag.integer("ceiling-bytes").pipe(
  Flag.withDescription("Operator-approved maximum bytes for the measured preservation scope")
);
/** @since 0.0.0 */
const preservationApproverFlag = Flag.string("approved-by").pipe(
  Flag.withDescription("Non-secret operator label approving the measured byte ceiling")
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
    corpusPreserveCommand,
    corpusSalvageCommand,
  ])
);
