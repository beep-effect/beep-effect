/**
 * Service implementation for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import { printLines } from "../../internal/cli/Printer.ts";
import { archiveMoveImpl } from "./internal/ArchiveMove.ts";
import { catalogCorpusImpl } from "./internal/Catalog.ts";
import { enrichCorpusImpl } from "./internal/Enrich.ts";
import { extractCorpusImpl } from "./internal/Extract.ts";
import { organizeCorpusImpl } from "./internal/Organize.ts";
import { preserveRestorationArchiveImpl, verifyRestorationArchiveImpl } from "./internal/Restoration.ts";
import {
  reconcileRestorationAcceptanceImpl,
  restoreLegacyWordImpl,
  restoreMailImpl,
  restoreRecycleImpl,
} from "./internal/RestorationTransformations.ts";
import { salvageCorpusImpl, verifySalvageImpl } from "./internal/Salvage.ts";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CorpusArchiveMoveError, CorpusCommandError } from "./Corpus.errors.ts";
import type {
  CorpusArchiveMoveOptions,
  CorpusArchiveMoveSummary,
  CorpusCatalogOptions,
  CorpusCatalogSummary,
  CorpusEnrichOptions,
  CorpusEnrichSummary,
  CorpusExtractOptions,
  CorpusExtractSummary,
  CorpusOrganizeOptions,
  CorpusOrganizeSummary,
  CorpusSalvageOptions,
  CorpusSalvageSummary,
  RestorationAcceptanceRecord,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  RestorationPreserveOptions,
  RestorationRecycleOptions,
  RestorationRunSummary,
  RestorationVerifyOptions,
} from "./Corpus.schemas.ts";

/**
 * Re-export the public corpus docket parser from its internal parser module.
 *
 * **Example** (Extract docket from filename)
 *
 * ```ts
 * import { extractCorpusDocket } from "@beep/repo-cli/commands/Corpus"
 * import * as O from "effect/Option"
 *
 * const docket = extractCorpusDocket("10109WO02-US1 response.docx")
 * console.log(O.isSome(docket)) // true
 * ```
 *
 * @category parsers
 * @since 0.0.0
 */
export { extractCorpusDocket } from "./internal/Docket.ts";

const $I = $RepoCliId.create("commands/Corpus/Corpus.service");

type CorpusCommandServiceRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

/**
 * Service contract for corpus curation operations.
 *
 * **Example** (List service method keys)
 *
 * ```ts
 * import type { CorpusCommandServiceShape } from "@beep/repo-cli/commands/Corpus"
 *
 * const methodNames: ReadonlyArray<keyof CorpusCommandServiceShape> = ["catalogCorpus", "salvageCorpus"]
 * console.log(methodNames.length) // 2
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface CorpusCommandServiceShape {
  /**
   * Move provenance-covered source files into an archive root after validating
   * every raw digest referenced by the supplied run manifests.
   *
   * @since 0.0.0
   */
  readonly archiveMove: (
    options: CorpusArchiveMoveOptions
  ) => Effect.Effect<CorpusArchiveMoveSummary, CorpusArchiveMoveError>;

  /**
   * Build the corpus DuckDB catalog, duplicate-set report, and recycle-bin
   * name-restoration manifest from a salvaged corpus root.
   *
   * @since 0.0.0
   */
  readonly catalogCorpus: (options: CorpusCatalogOptions) => Effect.Effect<CorpusCatalogSummary, CorpusCommandError>;

  /**
   * Resolve corpus-derived patent and application numbers against USPTO.
   *
   * @since 0.0.0
   */
  readonly enrichCorpus: (options: CorpusEnrichOptions) => Effect.Effect<CorpusEnrichSummary, CorpusCommandError>;

  /**
   * Run libpff and Tika extraction over salvaged raw/ files into staging/.
   *
   * @since 0.0.0
   */
  readonly extractCorpus: (options: CorpusExtractOptions) => Effect.Effect<CorpusExtractSummary, CorpusCommandError>;

  /**
   * Build the organized/ client, docket, and email-archive taxonomy.
   *
   * @since 0.0.0
   */
  readonly organizeCorpus: (options: CorpusOrganizeOptions) => Effect.Effect<CorpusOrganizeSummary, CorpusCommandError>;

  /**
   * Preserve the ratified corpus state through the resumable archive boundary.
   *
   * @since 0.0.0
   */
  readonly preserveRestorationArchive: (
    options: RestorationPreserveOptions
  ) => Effect.Effect<RestorationRunSummary, CorpusCommandError>;

  /**
   * Reconcile preservation and all transformation families into separate immutable acceptance records.
   *
   * @since 0.0.0
   */
  readonly reconcileRestorationAcceptance: (
    options: RestorationVerifyOptions
  ) => Effect.Effect<ReadonlyArray<RestorationAcceptanceRecord>, CorpusCommandError>;

  /**
   * Convert every distinct legacy-Word digest through the pinned sandboxed fidelity pipeline.
   *
   * @since 0.0.0
   */
  readonly restoreLegacyWord: (
    options: RestorationLegacyWordOptions
  ) => Effect.Effect<RestorationRunSummary, CorpusCommandError>;

  /**
   * Restore the selected mail slice or full mail estate after preservation passes.
   *
   * @since 0.0.0
   */
  readonly restoreMail: (options: RestorationMailOptions) => Effect.Effect<RestorationRunSummary, CorpusCommandError>;

  /**
   * Restore all recycle surfaces through the four-class occurrence join.
   *
   * @since 0.0.0
   */
  readonly restoreRecycle: (
    options: RestorationRecycleOptions
  ) => Effect.Effect<RestorationRunSummary, CorpusCommandError>;

  /**
   * Copy labeled source files into corpus raw storage and write provenance.
   *
   * @since 0.0.0
   */
  readonly salvageCorpus: (options: CorpusSalvageOptions) => Effect.Effect<CorpusSalvageSummary, CorpusCommandError>;

  /**
   * Independently reparse and verify a sealed restoration archive.
   *
   * @since 0.0.0
   */
  readonly verifyRestorationArchive: (
    options: RestorationVerifyOptions
  ) => Effect.Effect<RestorationRunSummary, CorpusCommandError>;

  /**
   * Re-hash salvaged raw/ files against the provenance manifest.
   *
   * @since 0.0.0
   */
  readonly verifySalvage: (options: CorpusSalvageOptions) => Effect.Effect<CorpusSalvageSummary, CorpusCommandError>;
}

/**
 * Service tag for corpus curation operations.
 *
 * **Example** (Map catalog via service tag)
 *
 * ```ts
 * import { CorpusCommandService, CorpusCatalogOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(CorpusCommandService, (service) =>
 *   service.catalogCorpus(CorpusCatalogOptions.make({ corpusRoot: "/data/corpus" }))
 * )
 * console.log(program.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CorpusCommandService extends Context.Service<CorpusCommandService, CorpusCommandServiceShape>()(
  $I`CorpusCommandService`
) {}

const makeCorpusCommandService = Effect.fn("CorpusCommandService.make")(function* () {
  const runtimeContext = yield* Effect.context<CorpusCommandServiceRequirements>();

  return CorpusCommandService.of({
    archiveMove: Effect.fn("CorpusCommandService.archiveMove")((options) =>
      archiveMoveImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    catalogCorpus: Effect.fn("CorpusCommandService.catalogCorpus")((options) =>
      catalogCorpusImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    enrichCorpus: Effect.fn("CorpusCommandService.enrichCorpus")((options) =>
      enrichCorpusImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    extractCorpus: Effect.fn("CorpusCommandService.extractCorpus")((options) =>
      extractCorpusImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    organizeCorpus: Effect.fn("CorpusCommandService.organizeCorpus")((options) =>
      organizeCorpusImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    preserveRestorationArchive: Effect.fn("CorpusCommandService.preserveRestorationArchive")((options) =>
      preserveRestorationArchiveImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    reconcileRestorationAcceptance: Effect.fn("CorpusCommandService.reconcileRestorationAcceptance")((options) =>
      reconcileRestorationAcceptanceImpl(options.corpusRoot, options.runLabel).pipe(Effect.provide(runtimeContext))
    ),
    restoreMail: Effect.fn("CorpusCommandService.restoreMail")((options) =>
      restoreMailImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    restoreLegacyWord: Effect.fn("CorpusCommandService.restoreLegacyWord")((options) =>
      restoreLegacyWordImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    restoreRecycle: Effect.fn("CorpusCommandService.restoreRecycle")((options) =>
      restoreRecycleImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    salvageCorpus: Effect.fn("CorpusCommandService.salvageCorpus")((options) =>
      salvageCorpusImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    verifySalvage: Effect.fn("CorpusCommandService.verifySalvage")((options) =>
      verifySalvageImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    verifyRestorationArchive: Effect.fn("CorpusCommandService.verifyRestorationArchive")((options) =>
      verifyRestorationArchiveImpl(options).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live service layer for corpus curation operations.
 *
 * **Example** (Reference live corpus layer)
 *
 * ```ts
 * import { CorpusCommandServiceLive } from "@beep/repo-cli/commands/Corpus"
 *
 * const layers = { corpus: CorpusCommandServiceLive }
 * console.log(Object.keys(layers)) // ["corpus"]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CorpusCommandServiceLive: Layer.Layer<CorpusCommandService, never, CorpusCommandServiceRequirements> =
  Layer.effect(CorpusCommandService, makeCorpusCommandService());

/**
 * Move provenance-covered source files into an archive root.
 *
 * **Example** (Archive move with provenance)
 *
 * ```ts
 * import { archiveMoveCorpus, CorpusArchiveMoveOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusArchiveMoveOptions.make({
 *   archiveRoot: "/tmp/archive",
 *   provenancePaths: ["/tmp/corpus/raw/run-a/provenance.jsonl"],
 *   sourcePaths: ["/tmp/source-a"]
 * })
 * const moved = archiveMoveCorpus(options).pipe(Effect.map((summary) => summary.sourcesMoved))
 * console.log(moved.pipe !== undefined) // true
 * ```
 *
 * @param options - Archive move options naming sources, archive root, and run provenance manifests.
 * @returns Summary counts for the archive move.
 * @effects Delegates to `CorpusCommandService`; the live service validates provenance coverage and raw digests before moving any selected source.
 * @category use-cases
 * @since 0.0.0
 */
export const archiveMoveCorpus = Effect.fn("Corpus.archiveMoveCorpus")(function* (
  options: CorpusArchiveMoveOptions
): Effect.fn.Return<CorpusArchiveMoveSummary, CorpusArchiveMoveError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.archiveMove(options);
});

/**
 * Build the corpus catalog, duplicate-set report, and restoration manifest.
 *
 * **Example** (Catalog corpus source files)
 *
 * ```ts
 * import { catalogCorpus, CorpusCatalogOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusCatalogOptions.make({ corpusRoot: "/data/corpus" })
 * const sourceFileCount = catalogCorpus(options).pipe(Effect.map((summary) => summary.sourceFiles))
 * console.log(sourceFileCount.pipe !== undefined) // true
 * ```
 *
 * @param options - Catalog options naming the salvaged corpus root.
 * @returns Summary counts for the catalog run.
 * @effects Delegates to `CorpusCommandService`; the live service reads provenance JSONL, scans recycle-bin metadata, writes DuckDB/report artifacts, and logs a summary.
 * @category use-cases
 * @since 0.0.0
 */
export const catalogCorpus = Effect.fn("Corpus.catalogCorpus")(function* (
  options: CorpusCatalogOptions
): Effect.fn.Return<CorpusCatalogSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.catalogCorpus(options);
});

/**
 * Run libpff and Tika extraction over salvaged raw/ files into staging/.
 *
 * **Example** (Extract corpus with Tika)
 *
 * ```ts
 * import { extractCorpus, CorpusExtractOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusExtractOptions.make({
 *   corpusRoot: "/data/corpus",
 *   exportChildren: true,
 *   includeDuplicates: false,
 *   overwrite: false,
 *   tikaJarPath: "/opt/tika/tika-app.jar"
 * })
 * const sourceCount = extractCorpus(options).pipe(Effect.map((summary) => summary.sourceCount))
 * console.log(sourceCount.pipe !== undefined) // true
 * ```
 *
 * @param options - Extraction options naming the corpus root and Tika jar.
 * @returns Summary counts for the extraction run.
 * @effects Delegates to `CorpusCommandService`; the live service reads manifests, invokes libpff/Tika processing engines, writes staging artifacts, and logs extraction counts.
 * @category use-cases
 * @since 0.0.0
 */
export const extractCorpus = Effect.fn("Corpus.extractCorpus")(function* (
  options: CorpusExtractOptions
): Effect.fn.Return<CorpusExtractSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.extractCorpus(options);
});

/**
 * Resolve corpus-derived patent and application numbers against USPTO.
 *
 * **Example** (Enrich corpus USPTO lookups)
 *
 * ```ts
 * import { enrichCorpus, CorpusEnrichOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusEnrichOptions.make({ corpusRoot: "/data/corpus", maxLookups: 25 })
 * const resolvedCount = enrichCorpus(options).pipe(Effect.map((summary) => summary.resolved))
 * console.log(resolvedCount.pipe !== undefined) // true
 * ```
 *
 * @param options - Enrichment options naming the corpus root.
 * @returns Summary counts for the enrichment run.
 * @effects Delegates to `CorpusCommandService`; the live service reads organized/extracted text artifacts, calls USPTO APIs, writes enrichment manifests and DuckDB tables, and logs lookup counts.
 * @category use-cases
 * @since 0.0.0
 */
export const enrichCorpus = Effect.fn("Corpus.enrichCorpus")(function* (
  options: CorpusEnrichOptions
): Effect.fn.Return<CorpusEnrichSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.enrichCorpus(options);
});

/**
 * Build the organized/ client, docket, and email-archive taxonomy.
 *
 * **Example** (Organize corpus docket taxonomy)
 *
 * ```ts
 * import { organizeCorpus, CorpusOrganizeOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusOrganizeOptions.make({ corpusRoot: "/data/corpus", overwrite: false })
 * const docketFiles = organizeCorpus(options).pipe(Effect.map((summary) => summary.docketFiles))
 * console.log(docketFiles.pipe !== undefined) // true
 * ```
 *
 * @param options - Organize options naming the corpus root.
 * @returns Summary counts for the organize run.
 * @effects Delegates to `CorpusCommandService`; the live service reads catalog manifests, creates or clears organized output directories, copies or symlinks artifacts, writes manifests/tables, and logs taxonomy counts.
 * @category use-cases
 * @since 0.0.0
 */
export const organizeCorpus = Effect.fn("Corpus.organizeCorpus")(function* (
  options: CorpusOrganizeOptions
): Effect.fn.Return<CorpusOrganizeSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.organizeCorpus(options);
});

/**
 * Copy labeled source files into corpus raw storage and write provenance.
 *
 * **Example** (Salvage labeled source files)
 *
 * ```ts
 * import { salvageCorpus, CorpusSalvageOptions, CorpusSalvageSourceSpec } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusSalvageOptions.make({
 *   corpusRoot: "/tmp/corpus",
 *   sources: [CorpusSalvageSourceSpec.make({ sourceLabel: "source-a", sourcePath: "/tmp/source-a" })]
 * })
 * const records = salvageCorpus(options).pipe(Effect.map((summary) => summary.recordsChecked))
 * console.log(records.pipe !== undefined) // true
 * ```
 *
 * @param options - Salvage options naming corpus root, optional run label, dedupe mode, and generic source labels.
 * @returns Summary counts for the salvage copy run.
 * @effects Delegates to `CorpusCommandService`; the live service hashes sources, optionally dedupes by catalog/manifests, copies bytes, and writes JSONL provenance.
 * @category use-cases
 * @since 0.0.0
 */
export const salvageCorpus = Effect.fn("Corpus.salvageCorpus")(function* (
  options: CorpusSalvageOptions
): Effect.fn.Return<CorpusSalvageSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.salvageCorpus(options);
});

/**
 * Re-hash salvaged raw/ files against the provenance manifest.
 *
 * **Example** (Verify salvage file hashes)
 *
 * ```ts
 * import { verifySalvage, CorpusSalvageOptions } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const options = CorpusSalvageOptions.make({ corpusRoot: "/data/corpus", sampleStride: 10 })
 * const matchedCount = verifySalvage(options).pipe(Effect.map((summary) => summary.matched))
 * console.log(matchedCount.pipe !== undefined) // true
 * ```
 *
 * @param options - Verification options naming the corpus root.
 * @returns Summary counts for the verification run.
 * @effects Delegates to `CorpusCommandService`; the live service reads provenance records, hashes raw files, writes verification reports, and logs mismatch/missing counts.
 * @category use-cases
 * @since 0.0.0
 */
export const verifySalvage = Effect.fn("Corpus.verifySalvage")(function* (
  options: CorpusSalvageOptions
): Effect.fn.Return<CorpusSalvageSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.verifySalvage(options);
});

/**
 * Preserve a ratified corpus snapshot through a resumable, durably synced archive boundary.
 *
 * **Example** (Reference the preservation use case)
 *
 * ```ts
 * import { preserveRestorationArchive } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof preserveRestorationArchive === "function") // true
 * ```
 *
 * @param options - Explicit source paths, opening denominators, and approved byte ceilings.
 * @returns Aggregate object, byte, elapsed-time, and unapproved-terminal counts.
 * @effects Delegates to `CorpusCommandService`; the live service reconciles opening evidence, streams bytes into atomic destinations, fsyncs payload and ledger boundaries, and appends provenance.
 * @category use-cases
 * @since 0.0.0
 */
export const preserveRestorationArchive = Effect.fn("Corpus.preserveRestorationArchive")(function* (
  options: RestorationPreserveOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.preserveRestorationArchive(options);
});

/**
 * Reconcile the four restoration families into separate immutable acceptance records.
 *
 * **Example** (Reference final acceptance reconciliation)
 *
 * ```ts
 * import { reconcileRestorationAcceptance } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof reconcileRestorationAcceptance === "function") // true
 * ```
 *
 * @param options - Corpus root and immutable preservation run label shared by the transformation wave.
 * @returns Four separately persisted aggregate-only PASS records.
 * @effects Delegates to `CorpusCommandService`; the live service re-verifies P0, decodes and reconciles every transformation family, and atomically writes acceptance JSON outside the repo.
 * @category use-cases
 * @since 0.0.0
 */
export const reconcileRestorationAcceptance = Effect.fn("Corpus.reconcileRestorationAcceptance")(function* (
  options: RestorationVerifyOptions
): Effect.fn.Return<ReadonlyArray<RestorationAcceptanceRecord>, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.reconcileRestorationAcceptance(options);
});

/**
 * Restore the selected mail slice or full estate through the public source-path libpff runner.
 *
 * **Example** (Reference mail restoration)
 *
 * ```ts
 * import { restoreMail } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof restoreMail === "function") // true
 * ```
 *
 * @param options - Frozen engine paths, scope, denominator, and resource ceilings.
 * @returns Aggregate mail-store, child-byte, exception, and unapproved-terminal counts.
 * @effects Delegates to `CorpusCommandService`; the live service verifies P0, invokes libpff serially, preserves raw attempts, repairs attachment types non-destructively, and writes terminal ledgers.
 * @category use-cases
 * @since 0.0.0
 */
export const restoreMail = Effect.fn("Corpus.restoreMail")(function* (
  options: RestorationMailOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.restoreMail(options);
});

/**
 * Convert all distinct legacy-Word digests through a pinned sandboxed fidelity pipeline.
 *
 * **Example** (Reference legacy-Word restoration)
 *
 * ```ts
 * import { restoreLegacyWord } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof restoreLegacyWord === "function") // true
 * ```
 *
 * @param options - Pinned converter identity, source denominator, sandbox tools, and fidelity ceilings.
 * @returns Aggregate occurrence, terminal, byte, and unapproved counts.
 * @effects Delegates to `CorpusCommandService`; the live service verifies P0, converts distinct CFB digests inside bubblewrap, compares normalized text and rendered pages, and writes terminal ledgers.
 * @category use-cases
 * @since 0.0.0
 */
export const restoreLegacyWord = Effect.fn("Corpus.restoreLegacyWord")(function* (
  options: RestorationLegacyWordOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.restoreLegacyWord(options);
});

/**
 * Restore every preserved recycle surface through an occurrence-preserving join.
 *
 * **Example** (Reference recycle restoration)
 *
 * ```ts
 * import { restoreRecycle } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof restoreRecycle === "function") // true
 * ```
 *
 * @param options - Frozen preservation label and approved surface and missing-content denominators.
 * @returns Aggregate occurrence, mapping, exception, and byte counts.
 * @effects Delegates to `CorpusCommandService`; the live service verifies P0, performs the four-class join, applies a sanitized collision-aware path policy, and writes durable mapping evidence.
 * @category use-cases
 * @since 0.0.0
 */
export const restoreRecycle = Effect.fn("Corpus.restoreRecycle")(function* (
  options: RestorationRecycleOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.restoreRecycle(options);
});

/**
 * Independently reparse a sealed restoration ledger and verify every terminal destination.
 *
 * **Example** (Reference the independent verifier)
 *
 * ```ts
 * import { verifyRestorationArchive } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof verifyRestorationArchive === "function") // true
 * ```
 *
 * @param options - Corpus root and immutable restoration run label.
 * @returns Aggregate terminal counts and verified byte measurements.
 * @effects Delegates to `CorpusCommandService`; the live service reads and schema-decodes the sealed ledger and streams destination bytes without modifying payloads.
 * @category use-cases
 * @since 0.0.0
 */
export const verifyRestorationArchive = Effect.fn("Corpus.verifyRestorationArchive")(function* (
  options: RestorationVerifyOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, CorpusCommandService> {
  const corpus = yield* CorpusCommandService;
  return yield* corpus.verifyRestorationArchive(options);
});

/**
 * Print the corpus command index.
 *
 * **Example** (Print corpus command index)
 *
 * ```ts
 * import { printCorpusIndex } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(printCorpusIndex.pipe !== undefined) // true
 * ```
 *
 * @effects Writes the corpus command index to the configured console when the returned Effect is executed.
 * @category cli-commands
 * @since 0.0.0
 */
export const printCorpusIndex = printLines([
  "Corpus commands:",
  "- bun run beep corpus salvage --corpus-root /path/to/corpus --source source-a=/path/to/source --dedupe",
  "- bun run beep corpus salvage --corpus-root /path/to/corpus",
  "- bun run beep corpus archive-move --source /path/to/source --archive-root /path/to/archive --provenance /path/to/provenance.jsonl",
  "- bun run beep corpus catalog --corpus-root /path/to/corpus",
  "- bun run beep corpus extract --corpus-root /path/to/corpus --tika-jar /path/to/tika-app.jar --export-children",
  "- bun run beep corpus organize --corpus-root /path/to/corpus",
  "- bun run beep corpus enrich --corpus-root /path/to/corpus",
]);
