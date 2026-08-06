/**
 * Apply and verify stages of the JSDoc legacy-carrier migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, MutableHashMap, MutableHashSet, Order, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { formatJsonc, writeArtifact } from "../../../internal/artifacts/index.ts";
import { runCaptured } from "../../../internal/process/index.ts";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import {
  defaultJSDocMigrateExtractPath,
  defaultJSDocMigrateManifestPath,
  defaultJSDocMigrateOverridesPath,
  defaultJSDocMigrateTitlesPath,
  JSDocMigrateBindingReport,
  JSDocMigrateProofManifest,
  JSDocMigrateQuarantineRecord,
  JSDocMigrateTitleRecord,
} from "./JSDocMigrate.schemas.ts";
import {
  indexJSDocMigrateByAnchor,
  jsdocMigrateOverrideCodec,
  jsdocMigrateRunContext,
  jsdocMigrateTitleCodec,
  readJSDocMigrateExtractRequired,
  readJSDocMigrateJsonl,
} from "./JSDocMigrateData.ts";
import {
  jsdocMigrateExtractRecordsForFile,
  listJSDocMigrateCorpusFiles,
  readJSDocMigrateSourceText,
  scanJSDocMigrateBlocks,
} from "./JSDocMigrateExtract.ts";
import {
  jsdocMigrateConservationFindings,
  jsdocMigrateShapeRegressions,
  rewriteJSDocMigrateBlock,
} from "./JSDocMigrateRewrite.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  JSDocMigrateExtractRecord,
  JSDocMigrateMode,
  JSDocMigrateOverrideRecord,
} from "./JSDocMigrate.schemas.ts";
import type { JSDocMigrateScannedBlock } from "./JSDocMigrateExtract.ts";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocMigrateApply");

type FrozenRecordSets = {
  readonly titles: ReadonlyArray<JSDocMigrateTitleRecord>;
  readonly overrides: ReadonlyArray<JSDocMigrateOverrideRecord>;
  readonly titleByAnchor: MutableHashMap.MutableHashMap<string, JSDocMigrateTitleRecord>;
  readonly overrideByAnchor: MutableHashMap.MutableHashMap<string, JSDocMigrateOverrideRecord>;
};

const loadFrozenRecordSets = Effect.fn("JSDocMigrateApply.loadFrozenRecordSets")(function* (
  repoRoot: string,
  options: { readonly titles?: string | undefined; readonly overrides?: string | undefined },
  syntheticTitles: O.Option<ReadonlyArray<JSDocMigrateTitleRecord>>
): Effect.fn.Return<FrozenRecordSets, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const titles = O.isSome(syntheticTitles)
    ? syntheticTitles.value
    : yield* readJSDocMigrateJsonl(
        path.resolve(repoRoot, options.titles ?? defaultJSDocMigrateTitlesPath),
        jsdocMigrateTitleCodec.decode,
        "titles.jsonl"
      );
  const overrides = yield* readJSDocMigrateJsonl(
    path.resolve(repoRoot, options.overrides ?? defaultJSDocMigrateOverridesPath),
    jsdocMigrateOverrideCodec.decode,
    "overrides.jsonl"
  );
  return {
    titles,
    overrides,
    titleByAnchor: indexJSDocMigrateByAnchor(titles),
    overrideByAnchor: indexJSDocMigrateByAnchor(overrides),
  };
});

const migrateError = (message: string): QualityScriptCommandError =>
  QualityScriptCommandError.make({
    message,
    command: "bun run beep quality jsdoc-migrate",
    exitCode: 1,
  });

type FrozenVerificationFields = { readonly sourceHash: string; readonly kind: string };

const frozenVerificationIndex = (
  titles: ReadonlyArray<JSDocMigrateTitleRecord>,
  overrides: ReadonlyArray<JSDocMigrateOverrideRecord>
): MutableHashMap.MutableHashMap<string, FrozenVerificationFields> => {
  const records = MutableHashMap.empty<string, FrozenVerificationFields>();
  for (const record of titles) {
    MutableHashMap.set(records, record.anchor, { sourceHash: record.sourceHash, kind: record.kind });
  }
  for (const record of overrides) {
    MutableHashMap.set(records, record.anchor, { sourceHash: record.sourceHash, kind: record.kind });
  }
  return records;
};

const compareExtractToFrozen = (
  extract: ReadonlyArray<JSDocMigrateExtractRecord>,
  records: MutableHashMap.MutableHashMap<string, FrozenVerificationFields>
): {
  readonly extractAnchors: MutableHashSet.MutableHashSet<string>;
  readonly unmatchedExtractAnchors: Array<string>;
  readonly sourceHashMismatchAnchors: Array<string>;
  readonly kindMismatchAnchors: Array<string>;
} => {
  const extractAnchors = MutableHashSet.empty<string>();
  const unmatchedExtractAnchors: Array<string> = [];
  const sourceHashMismatchAnchors: Array<string> = [];
  const kindMismatchAnchors: Array<string> = [];
  for (const record of extract) {
    MutableHashSet.add(extractAnchors, record.anchor);
    const frozen = MutableHashMap.get(records, record.anchor);
    if (O.isNone(frozen)) {
      A.appendInPlace(unmatchedExtractAnchors, record.anchor);
      continue;
    }
    if (frozen.value.sourceHash !== record.sourceHash) {
      A.appendInPlace(sourceHashMismatchAnchors, record.anchor);
    }
    if (frozen.value.kind !== record.kind) {
      A.appendInPlace(kindMismatchAnchors, record.anchor);
    }
  }
  return { extractAnchors, unmatchedExtractAnchors, sourceHashMismatchAnchors, kindMismatchAnchors };
};

/**
 * Compute the fail-closed binding report between frozen records and an extract.
 *
 * **Details**
 *
 * Implements SPEC §5.2: every extract anchor must have exactly one frozen
 * record and vice versa (bijection), every record's `sourceHash` must equal
 * the hash of the block at its anchor (identity — this is what catches
 * reorders), and every record's `kind` must agree. Later records win when a
 * jsonl file carries duplicate anchors, matching append-only retry semantics.
 *
 * **Example** (Detect an orphan record)
 *
 * ```ts
 * import { computeJSDocMigrateBinding, JSDocMigrateTitleRecord } from "@beep/repo-cli/test/Quality"
 *
 * const report = computeJSDocMigrateBinding({
 *   extract: [],
 *   titles: [
 *     JSDocMigrateTitleRecord.make({
 *       anchor: "packages/x/src/Y.ts#gone#0",
 *       sourceHash: "sha256:0000",
 *       kind: "value",
 *       titles: ["Title"]
 *     })
 *   ],
 *   overrides: []
 * })
 * console.log(report.orphanRecordAnchors) // ["packages/x/src/Y.ts#gone#0"]
 * ```
 *
 * @param input - Live extract records with the frozen title and override sets.
 * @returns Binding report carrying all four fail-closed mismatch lists.
 * @category use-cases
 * @since 0.0.0
 */
export const computeJSDocMigrateBinding = (input: {
  readonly extract: ReadonlyArray<JSDocMigrateExtractRecord>;
  readonly titles: ReadonlyArray<JSDocMigrateTitleRecord>;
  readonly overrides: ReadonlyArray<JSDocMigrateOverrideRecord>;
}): JSDocMigrateBindingReport => {
  const records = frozenVerificationIndex(input.titles, input.overrides);
  const { extractAnchors, kindMismatchAnchors, sourceHashMismatchAnchors, unmatchedExtractAnchors } =
    compareExtractToFrozen(input.extract, records);
  const orphanRecordAnchors: Array<string> = [];
  for (const [anchor] of records) {
    if (!MutableHashSet.has(extractAnchors, anchor)) {
      A.appendInPlace(orphanRecordAnchors, anchor);
    }
  }
  return JSDocMigrateBindingReport.make({
    extractCount: input.extract.length,
    recordCount: MutableHashMap.size(records),
    orphanRecordAnchors: A.sort(orphanRecordAnchors, Order.String),
    unmatchedExtractAnchors: A.sort(unmatchedExtractAnchors, Order.String),
    sourceHashMismatchAnchors: A.sort(sourceHashMismatchAnchors, Order.String),
    kindMismatchAnchors: A.sort(kindMismatchAnchors, Order.String),
  });
};

/**
 * Split orphan record anchors into already-migrated blocks and true orphans.
 *
 * **Details**
 *
 * A record becomes an orphan when its anchor is absent from the affected
 * extract. When the anchor still resolves to a block in the current tree and
 * that block no longer carries a legacy tag, the block was already migrated —
 * a normal state while iterating apply over residue — so the record is
 * tolerated. Anchors that resolve nowhere remain hard failures.
 *
 * **Example** (Tolerate a migrated block)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import { partitionMigratedOrphans } from "@beep/repo-cli/test/Quality"
 *
 * const blocks = MutableHashMap.make([
 *   "packages/x/src/a.ts#done#0",
 *   { affected: false }
 * ])
 * const result = partitionMigratedOrphans(["packages/x/src/a.ts#done#0"], blocks)
 * console.log(result.missing) // []
 * ```
 *
 * @param orphanAnchors - Record anchors the bijection found no extract row for.
 * @param currentBlocksByAnchor - Every scanned block in the current tree keyed by anchor.
 * @returns Anchors of already-migrated blocks and anchors that resolve nowhere.
 * @category use-cases
 * @since 0.0.0
 */
export const partitionMigratedOrphans = (
  orphanAnchors: ReadonlyArray<string>,
  currentBlocksByAnchor: MutableHashMap.MutableHashMap<string, { readonly affected: boolean }>
): { readonly migrated: ReadonlyArray<string>; readonly missing: ReadonlyArray<string> } => {
  const migrated: Array<string> = [];
  const missing: Array<string> = [];
  for (const anchor of orphanAnchors) {
    const block = MutableHashMap.get(currentBlocksByAnchor, anchor);
    if (O.isSome(block) && !block.value.affected) {
      A.appendInPlace(migrated, anchor);
    } else {
      A.appendInPlace(missing, anchor);
    }
  }
  return { migrated, missing };
};

const bindingIsClean = (report: JSDocMigrateBindingReport): boolean =>
  A.isReadonlyArrayEmpty(report.orphanRecordAnchors) &&
  A.isReadonlyArrayEmpty(report.unmatchedExtractAnchors) &&
  A.isReadonlyArrayEmpty(report.sourceHashMismatchAnchors) &&
  A.isReadonlyArrayEmpty(report.kindMismatchAnchors);

/**
 * Build the placeholder title record used by the dry-run residue measurement.
 *
 * **Details**
 *
 * Placeholder titles keep the rewrite machinery honest without inventing
 * shippable prose: titles are unique within the block, remarks route to
 * Details, and no lead split or see purposes are synthesized. Placeholders
 * can never reach a file: apply refuses `--synthetic-titles` without
 * `--dry-run` before any rewrite happens.
 *
 * **Example** (Synthesize a record for a two-example block)
 *
 * ```ts
 * import { JSDocMigrateExtractRecord, syntheticJSDocMigrateTitleRecord } from "@beep/repo-cli/test/Quality"
 *
 * const extract = JSDocMigrateExtractRecord.make({
 *   anchor: "packages/x/src/Y.ts#f#0",
 *   filePath: "packages/x/src/Y.ts",
 *   symbol: "f",
 *   ordinal: 0,
 *   kind: "value",
 *   sourceHash: "sha256:0000",
 *   start: 0,
 *   end: 10,
 *   blockText: "/** Doc. *" + "/",
 *   leadParagraphCount: 1,
 *   exampleTagCount: 2,
 *   unfencedExampleCount: 0,
 *   remarksTagCount: 0,
 *   undescribedSeeCount: 0
 * })
 * const record = syntheticJSDocMigrateTitleRecord(extract)
 * console.log(record.titles) // ["Placeholder title", "Placeholder title 2"]
 * ```
 *
 * @param record - Extract record to synthesize a placeholder for.
 * @returns Placeholder title record bound to the extract record.
 * @category use-cases
 * @since 0.0.0
 */
export const syntheticJSDocMigrateTitleRecord = (record: JSDocMigrateExtractRecord): JSDocMigrateTitleRecord => {
  // A.makeBy clamps its size to at least 1, so remarks-only blocks must map to
  // an empty title list explicitly.
  const titles =
    record.exampleTagCount === 0
      ? []
      : A.makeBy(record.exampleTagCount, (index) =>
          index === 0 ? "Placeholder title" : `Placeholder title ${index + 1}`
        );
  return record.remarksTagCount > 0
    ? JSDocMigrateTitleRecord.make({
        anchor: record.anchor,
        sourceHash: record.sourceHash,
        kind: record.kind,
        titles,
        remarks: "details",
      })
    : JSDocMigrateTitleRecord.make({
        anchor: record.anchor,
        sourceHash: record.sourceHash,
        kind: record.kind,
        titles,
      });
};

const applyReplacements = (
  sourceText: string,
  replacements: ReadonlyArray<{ readonly start: number; readonly end: number; readonly text: string }>
): string => {
  let result = sourceText;
  const descending = A.sortWith(replacements, (replacement) => -replacement.start, Order.Number);
  for (const replacement of descending) {
    result = `${Str.slice(0, replacement.start)(result)}${replacement.text}${Str.slice(replacement.end)(result)}`;
  }
  return result;
};

type AffectedFile = {
  readonly filePath: string;
  readonly sourceText: string;
  readonly blocks: ReadonlyArray<JSDocMigrateScannedBlock>;
};

const readAffectedFiles = Effect.fn("JSDocMigrateApply.readAffectedFiles")(function* (
  repoRoot: string,
  files: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<AffectedFile>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const perFile = yield* Effect.forEach(
    files,
    (filePath) =>
      readJSDocMigrateSourceText(repoRoot, filePath).pipe(
        Effect.map(
          O.flatMap((sourceText) => {
            const blocks = scanJSDocMigrateBlocks(filePath, sourceText);
            return A.some(blocks, (block) => block.affected)
              ? O.some<AffectedFile>({ filePath, sourceText, blocks })
              : O.none<AffectedFile>();
          })
        )
      ),
    { concurrency: 8 }
  );
  return A.getSomes(perFile);
});

const formatBiome = Effect.fn("JSDocMigrateApply.formatBiome")(function* (
  repoRoot: string,
  files: ReadonlyArray<string>
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  for (const chunk of A.chunksOf(files, 50)) {
    const step = yield* runCaptured({
      command: "bun",
      args: ["x", "biome", "format", "--write", ...chunk],
      cwd: repoRoot,
    }).pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, "Failed to run biome format.")));
    if (step.exitCode !== 0) {
      return yield* migrateError(`biome format exited ${step.exitCode}: ${Str.slice(0, 2000)(step.output)}`);
    }
  }
});

const writeManifest = Effect.fn("JSDocMigrateApply.writeManifest")(function* (
  repoRoot: string,
  manifestPath: string,
  manifest: JSDocMigrateProofManifest
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const jsonc = yield* formatJsonc(manifest).pipe(
    QualityScriptCommandError.mapError("Failed to format jsdoc-migrate proof manifest.")
  );
  yield* writeArtifact({
    path: path.resolve(repoRoot, manifestPath),
    body: `// jsdoc-migrate conservation proof manifest. Generated by bun run beep quality jsdoc-migrate.\n${jsonc}\n`,
    onError: (cause) => QualityScriptCommandError.new(cause, `Failed to write ${manifestPath}.`),
  });
});

const renderAnchors = (label: string, anchors: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(anchors)
    ? []
    : [`  ${label} (${anchors.length}):`, ...A.map(A.take(anchors, 10), (anchor) => `    - ${anchor}`)];

const failOnDirtyBinding = Effect.fn("JSDocMigrateApply.failOnDirtyBinding")(function* (
  binding: JSDocMigrateBindingReport
): Effect.fn.Return<void, QualityScriptCommandError> {
  if (bindingIsClean(binding)) {
    return;
  }
  const lines = [
    "[jsdoc-migrate] binding verification failed; refusing to continue:",
    ...renderAnchors("orphan records", binding.orphanRecordAnchors),
    ...renderAnchors("extract anchors without records", binding.unmatchedExtractAnchors),
    ...renderAnchors("sourceHash mismatches (re-title these)", binding.sourceHashMismatchAnchors),
    ...renderAnchors("kind mismatches", binding.kindMismatchAnchors),
  ];
  yield* Console.error(A.join(lines, "\n"));
  return yield* migrateError("jsdoc-migrate binding verification failed.");
});

/**
 * Options accepted by {@link runJSDocMigrateApply}.
 *
 * **Example** (Configure a dry run)
 *
 * ```ts
 * import { RunJSDocMigrateApplyOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options = RunJSDocMigrateApplyOptions.make({ dryRun: true, syntheticTitles: true })
 * console.log(options.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunJSDocMigrateApplyOptions extends S.Class<RunJSDocMigrateApplyOptions>($I`RunJSDocMigrateApplyOptions`)(
  {
    titles: S.optionalKey(S.String),
    overrides: S.optionalKey(S.String),
    manifest: S.optionalKey(S.String),
    dryRun: S.Boolean,
    syntheticTitles: S.Boolean,
  },
  $I.annote("RunJSDocMigrateApplyOptions", {
    description: "Options for the jsdoc-migrate apply stage: data-file paths, dry-run, and synthetic titles.",
  })
) {}

const anchorFilePath = (anchor: string): string => Str.split("#")(anchor)[0] ?? anchor;

const scanAnchorsForOrphans = Effect.fn("JSDocMigrateApply.scanAnchorsForOrphans")(function* (
  repoRoot: string,
  affectedFiles: ReadonlyArray<AffectedFile>,
  orphanAnchors: ReadonlyArray<string>
): Effect.fn.Return<
  MutableHashMap.MutableHashMap<string, JSDocMigrateScannedBlock>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const blocksByAnchor = MutableHashMap.empty<string, JSDocMigrateScannedBlock>();
  const scannedFiles = MutableHashSet.empty<string>();
  for (const file of affectedFiles) {
    MutableHashSet.add(scannedFiles, file.filePath);
    for (const block of file.blocks) {
      MutableHashMap.set(blocksByAnchor, block.anchor, block);
    }
  }
  const orphanFiles = A.dedupe(
    A.filter(A.map(orphanAnchors, anchorFilePath), (filePath) => !MutableHashSet.has(scannedFiles, filePath))
  );
  yield* Effect.forEach(
    orphanFiles,
    Effect.fnUntraced(function* (filePath: string) {
      const exists = yield* fs.exists(path.join(repoRoot, filePath)).pipe(Effect.orElseSucceed(thunkFalse));
      if (!exists) {
        return;
      }
      const sourceText = yield* fs
        .readFileString(path.join(repoRoot, filePath))
        .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to read ${filePath}.`)));
      for (const block of scanJSDocMigrateBlocks(filePath, sourceText)) {
        MutableHashMap.set(blocksByAnchor, block.anchor, block);
      }
    }),
    { concurrency: 8 }
  );
  return blocksByAnchor;
});

type BlockOutcome =
  | { readonly _tag: "Rewritten"; readonly replacement: string }
  | { readonly _tag: "Overridden"; readonly replacement: string }
  | { readonly _tag: "Quarantined"; readonly quarantine: JSDocMigrateQuarantineRecord }
  | { readonly _tag: "DataMismatch"; readonly reasons: ReadonlyArray<string> };

const blockOutcome = (
  block: JSDocMigrateScannedBlock,
  title: O.Option<JSDocMigrateTitleRecord>,
  override: O.Option<JSDocMigrateOverrideRecord>
): BlockOutcome => {
  if (O.isSome(override)) {
    return { _tag: "Overridden", replacement: override.value.block };
  }
  if (O.isNone(title)) {
    return { _tag: "DataMismatch", reasons: [`missing-title-record: ${block.anchor}`] };
  }
  const result = rewriteJSDocMigrateBlock({
    blockText: block.text,
    indent: block.indent,
    data: {
      titles: title.value.titles,
      remarks: title.value.remarks,
      leadEnd: title.value.leadEnd,
      seePurposes: title.value.seePurposes,
    },
  });
  if (result._tag === "Rewritten") {
    return { _tag: "Rewritten", replacement: result.text };
  }
  if (result._tag === "DataMismatch") {
    return { _tag: "DataMismatch", reasons: A.map(result.reasons, (reason) => `${block.anchor}: ${reason}`) };
  }
  return {
    _tag: "Quarantined",
    quarantine: JSDocMigrateQuarantineRecord.make({
      anchor: block.anchor,
      filePath: block.filePath,
      reasons: result.reasons,
    }),
  };
};

/**
 * Run the apply stage: rewrite every affected block that binds cleanly.
 *
 * **Details**
 *
 * Re-extracts the live corpus, verifies the frozen records against it (fail
 * closed on any orphan, hash mismatch, or kind disagreement), rewrites blocks
 * text-surgically by byte offset from the bottom of each file up, quarantines
 * conservation violations instead of writing them, and formats the touched
 * files with biome so verify always sees post-format bytes. With `dryRun` no
 * file is written and the reported quarantine count is the migration's
 * residue measurement; with `syntheticTitles` placeholder records are
 * generated in memory for exactly that measurement.
 *
 * **Example** (Build a dry-run Effect)
 *
 * ```ts
 * import { runJSDocMigrateApply, RunJSDocMigrateApplyOptions } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = runJSDocMigrateApply(RunJSDocMigrateApplyOptions.make({ dryRun: true, syntheticTitles: true }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- the apply pipeline is the SPEC §5 order of operations (bind, rewrite, quarantine, write, format) kept as one auditable sequence
export const runJSDocMigrateApply = Effect.fn("JSDocMigrateApply.run")(function* (
  options: RunJSDocMigrateApplyOptions
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (options.syntheticTitles && !options.dryRun) {
    return yield* migrateError("--synthetic-titles is a measurement mode; combine it with --dry-run.");
  }
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const path = yield* Path.Path;
  const files = yield* listJSDocMigrateCorpusFiles(repoRoot);
  const affectedFiles = yield* readAffectedFiles(repoRoot, files);
  const liveExtract = A.flatMap(affectedFiles, (file) =>
    jsdocMigrateExtractRecordsForFile(file.filePath, file.sourceText)
  );

  const { overrideByAnchor, overrides, titleByAnchor, titles } = yield* loadFrozenRecordSets(
    repoRoot,
    options,
    options.syntheticTitles ? O.some(A.map(liveExtract, syntheticJSDocMigrateTitleRecord)) : O.none()
  );

  const rawBinding = computeJSDocMigrateBinding({ extract: liveExtract, titles, overrides });
  const currentBlocksByAnchor = yield* scanAnchorsForOrphans(repoRoot, affectedFiles, rawBinding.orphanRecordAnchors);
  const orphanSplit = partitionMigratedOrphans(rawBinding.orphanRecordAnchors, currentBlocksByAnchor);
  const binding = JSDocMigrateBindingReport.make({
    ...rawBinding,
    orphanRecordAnchors: orphanSplit.missing,
  });
  yield* failOnDirtyBinding(binding);
  if (A.isReadonlyArrayNonEmpty(orphanSplit.migrated)) {
    yield* Console.log(
      `[jsdoc-migrate] tolerating ${orphanSplit.migrated.length} record(s) whose blocks are already migrated`
    );
  }

  const quarantines: Array<JSDocMigrateQuarantineRecord> = [];
  const mismatches: Array<string> = [];
  const pendingWrites: Array<{ readonly filePath: string; readonly nextText: string }> = [];
  let rewritten = 0;
  let overridden = 0;

  for (const file of affectedFiles) {
    const replacements: Array<{ readonly start: number; readonly end: number; readonly text: string }> = [];
    for (const block of A.filter(file.blocks, (candidate) => candidate.affected)) {
      const outcome = blockOutcome(
        block,
        MutableHashMap.get(titleByAnchor, block.anchor),
        MutableHashMap.get(overrideByAnchor, block.anchor)
      );
      if (outcome._tag === "Rewritten" || outcome._tag === "Overridden") {
        A.appendInPlace(replacements, { start: block.start, end: block.end, text: outcome.replacement });
        if (outcome._tag === "Rewritten") {
          rewritten += 1;
        } else {
          overridden += 1;
        }
        continue;
      }
      if (outcome._tag === "Quarantined") {
        A.appendInPlace(quarantines, outcome.quarantine);
        continue;
      }
      A.appendAllInPlace(mismatches, outcome.reasons);
    }
    if (replacements.length > 0) {
      A.appendInPlace(pendingWrites, {
        filePath: file.filePath,
        nextText: applyReplacements(file.sourceText, replacements),
      });
    }
  }

  if (mismatches.length > 0) {
    yield* Console.error(
      A.join([`[jsdoc-migrate] frozen-data mismatches (${mismatches.length}):`, ...A.take(mismatches, 20)], "\n")
    );
    return yield* migrateError("jsdoc-migrate apply found frozen-data mismatches.");
  }

  const changedFiles = A.map(pendingWrites, (write) => write.filePath);
  let biomeFailure: QualityScriptCommandError | undefined;
  if (!options.dryRun && pendingWrites.length > 0) {
    const fs = yield* FileSystem.FileSystem;
    yield* Effect.forEach(
      pendingWrites,
      (write) =>
        fs
          .writeFileString(path.join(repoRoot, write.filePath), write.nextText)
          .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to write ${write.filePath}.`))),
      { concurrency: 8 }
    );
    // The manifest below must still be written when formatting fails, so a
    // retry sees the applied state instead of an unexplained partial write.
    const formatted = yield* formatBiome(repoRoot, changedFiles).pipe(Effect.result);
    if (formatted._tag === "Failure") {
      biomeFailure = formatted.failure;
    }
  }

  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const mode: JSDocMigrateMode = options.dryRun ? "dry-run" : "apply";
  const manifest = JSDocMigrateProofManifest.make({
    schema_version: 1,
    generated_at: generatedAt,
    mode,
    files: affectedFiles.length,
    blocksAffected: liveExtract.length,
    rewritten,
    overridden,
    quarantined: quarantines.length,
    conservationViolations: 0,
    shapeRegressions: 0,
    residueLegacyBlocks: quarantines.length,
    binding,
    quarantines,
  });
  yield* writeManifest(repoRoot, options.manifest ?? defaultJSDocMigrateManifestPath, manifest);
  if (biomeFailure !== undefined) {
    return yield* biomeFailure;
  }
  yield* Console.log(
    `[jsdoc-migrate] ${mode} ok: files=${affectedFiles.length} blocks=${liveExtract.length} rewritten=${rewritten} ` +
      `overridden=${overridden} residue=${quarantines.length}`
  );
});

/**
 * Options accepted by {@link runJSDocMigrateVerify}.
 *
 * **Example** (Configure a verify run)
 *
 * ```ts
 * import { RunJSDocMigrateVerifyOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options = RunJSDocMigrateVerifyOptions.make({})
 * console.log(options.extract === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunJSDocMigrateVerifyOptions extends S.Class<RunJSDocMigrateVerifyOptions>(
  $I`RunJSDocMigrateVerifyOptions`
)(
  {
    extract: S.optionalKey(S.String),
    titles: S.optionalKey(S.String),
    overrides: S.optionalKey(S.String),
    manifest: S.optionalKey(S.String),
  },
  $I.annote("RunJSDocMigrateVerifyOptions", {
    description: "Options for the jsdoc-migrate verify stage: frozen data-file paths and the manifest output.",
  })
) {}

/**
 * Run the verify stage: prove conservation between frozen originals and the tree.
 *
 * **Details**
 *
 * Reads the frozen `extract.jsonl` (the original block bytes), re-scans the
 * current tree, and for every record either matches the exact expected
 * rewrite, re-proves conservation on the post-format bytes, confirms an
 * override was applied verbatim, or reports the block as residue when it
 * still carries its legacy form. Any conservation violation or binding
 * failure exits non-zero; the proof manifest records the exhaustive result.
 *
 * **Example** (Build a verify Effect)
 *
 * ```ts
 * import { runJSDocMigrateVerify, RunJSDocMigrateVerifyOptions } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = runJSDocMigrateVerify(RunJSDocMigrateVerifyOptions.make({}))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- the verify decision tree mirrors the SPEC §7 verification matrix case-by-case; splitting it would hide which row each branch proves
export const runJSDocMigrateVerify = Effect.fn("JSDocMigrateApply.runVerify")(function* (
  options: RunJSDocMigrateVerifyOptions
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const { fs, path, repoRoot } = yield* jsdocMigrateRunContext();

  const extractPath = path.resolve(repoRoot, options.extract ?? defaultJSDocMigrateExtractPath);
  const frozen = yield* readJSDocMigrateExtractRequired(extractPath);
  const { overrideByAnchor, titleByAnchor, titles, overrides } = yield* loadFrozenRecordSets(
    repoRoot,
    options,
    O.none()
  );
  const binding = computeJSDocMigrateBinding({ extract: frozen, titles, overrides });

  const frozenFiles = A.dedupe(A.map(frozen, (record) => record.filePath));
  const currentBlocks = MutableHashMap.empty<string, JSDocMigrateScannedBlock>();
  const loadCurrentBlocks = Effect.fnUntraced(function* (filePath: string) {
    const sourceText = yield* fs
      .readFileString(path.join(repoRoot, filePath))
      .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to read ${filePath}.`)));
    for (const block of scanJSDocMigrateBlocks(filePath, sourceText)) {
      MutableHashMap.set(currentBlocks, block.anchor, block);
    }
  });
  yield* Effect.forEach(frozenFiles, loadCurrentBlocks, { concurrency: 8 });

  const violations: Array<string> = [];
  const quarantines: Array<JSDocMigrateQuarantineRecord> = [];
  let conserved = 0;
  let overridden = 0;
  let residue = 0;
  let shapeRegressionCount = 0;
  let conservationViolationCount = 0;

  for (const record of frozen) {
    const current = MutableHashMap.get(currentBlocks, record.anchor);
    if (O.isNone(current)) {
      A.appendInPlace(violations, `anchor-missing: ${record.anchor}`);
      continue;
    }
    const override = MutableHashMap.get(overrideByAnchor, record.anchor);
    if (O.isSome(override)) {
      if (current.value.text === override.value.block) {
        overridden += 1;
      } else if (current.value.text === record.blockText) {
        residue += 1;
      } else {
        A.appendInPlace(violations, `override-not-applied: ${record.anchor}`);
      }
      continue;
    }
    if (current.value.text === record.blockText) {
      residue += 1;
      continue;
    }
    const title = MutableHashMap.get(titleByAnchor, record.anchor);
    if (O.isNone(title)) {
      A.appendInPlace(violations, `changed-without-record: ${record.anchor}`);
      continue;
    }
    const expected = rewriteJSDocMigrateBlock({
      blockText: record.blockText,
      indent: current.value.indent,
      data: {
        titles: title.value.titles,
        remarks: title.value.remarks,
        leadEnd: title.value.leadEnd,
        seePurposes: title.value.seePurposes,
      },
    });
    if (expected._tag === "Quarantined") {
      A.appendInPlace(
        quarantines,
        JSDocMigrateQuarantineRecord.make({
          anchor: record.anchor,
          filePath: record.filePath,
          reasons: expected.reasons,
        })
      );
      A.appendInPlace(violations, `quarantined-block-changed: ${record.anchor}`);
      continue;
    }
    if (expected._tag === "DataMismatch") {
      A.appendInPlace(violations, `data-mismatch: ${record.anchor}`);
      continue;
    }
    if (current.value.text === expected.text) {
      conserved += 1;
      continue;
    }
    const conservation = jsdocMigrateConservationFindings({
      original: record.blockText,
      candidate: current.value.text,
      allowedAddedTokens: expected.allowedAddedTokens,
      allowedRemovedTokens: expected.allowedRemovedTokens,
    });
    const shape = jsdocMigrateShapeRegressions(record.blockText, current.value.text);
    if (A.isReadonlyArrayEmpty(conservation) && A.isReadonlyArrayEmpty(shape)) {
      conserved += 1;
      continue;
    }
    conservationViolationCount += conservation.length > 0 ? 1 : 0;
    shapeRegressionCount += shape.length > 0 ? 1 : 0;
    for (const reason of [...conservation, ...shape]) {
      A.appendInPlace(violations, `${record.anchor}: ${reason}`);
    }
  }

  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const manifest = JSDocMigrateProofManifest.make({
    schema_version: 1,
    generated_at: generatedAt,
    mode: "verify",
    files: frozenFiles.length,
    blocksAffected: frozen.length,
    rewritten: conserved,
    overridden,
    quarantined: quarantines.length,
    conservationViolations: conservationViolationCount,
    shapeRegressions: shapeRegressionCount,
    residueLegacyBlocks: residue,
    binding,
    quarantines,
  });
  yield* writeManifest(repoRoot, options.manifest ?? defaultJSDocMigrateManifestPath, manifest);

  if (!bindingIsClean(binding)) {
    yield* failOnDirtyBinding(binding);
  }
  if (A.isReadonlyArrayNonEmpty(violations)) {
    yield* Console.error(
      A.join([`[jsdoc-migrate] verify violations (${violations.length}):`, ...A.take(violations, 25)], "\n")
    );
    return yield* migrateError("jsdoc-migrate verify found conservation violations.");
  }
  yield* Console.log(
    `[jsdoc-migrate] verify ok: blocks=${frozen.length} conserved=${conserved} overridden=${overridden} residue=${residue}`
  );
});
