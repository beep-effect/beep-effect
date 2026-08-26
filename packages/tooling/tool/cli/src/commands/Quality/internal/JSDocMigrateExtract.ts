/**
 * Corpus extraction for the JSDoc legacy-carrier migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Console, Effect, FileSystem, MutableHashMap, MutableHashSet, Path } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Node } from "ts-morph";
import { writeArtifact } from "../../../internal/artifacts/index.ts";
import { jsdocOwnersByStart, ownJSDocNodeName, rawJSDocSpans } from "../../../internal/jsdoc/JSDocSections.ts";
import { runGitLines } from "../../../internal/repo-run/index.ts";
import { createInMemoryTsMorphProject } from "../../../internal/tsmorph/index.ts";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import {
  defaultJSDocMigrateExtractPath,
  JSDocMigrateBlockKind,
  JSDocMigrateExtractRecord,
} from "./JSDocMigrate.schemas.ts";
import { jsdocMigrateExtractCodec } from "./JSDocMigrateData.ts";
import { jsdocMigrateBlockStats } from "./JSDocMigrateRewrite.ts";
import { hasGeneratedFileHeader, isPackageSourceFile, jsdocGitErrorAdapter } from "./JSDocRatchet.ts";
import { tagsFromComment } from "./QualityArtifactSupport.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocMigrateExtract");

/**
 * One JSDoc block located in a source file with its verified anchor identity.
 *
 * **Example** (Decode a scanned block)
 *
 * ```ts
 * import { JSDocMigrateScannedBlock } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateScannedBlock)({})) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateScannedBlock = S.Struct({
  anchor: S.String,
  filePath: S.String,
  symbol: S.String,
  ordinal: S.Int,
  kind: JSDocMigrateBlockKind,
  start: S.Int,
  end: S.Int,
  text: S.String,
  indent: S.String,
  affected: S.Boolean,
}).pipe(
  $I.annoteSchema("JSDocMigrateScannedBlock", {
    description: "One anchored JSDoc block located in a scanned source file.",
  })
);

/**
 * One anchored JSDoc block located in a scanned source file.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateScannedBlock = typeof JSDocMigrateScannedBlock.Type;

/**
 * Hash JSDoc block bytes into the `sourceHash` verification field.
 *
 * **Example** (Hash a block)
 *
 * ```ts
 * import { jsdocMigrateSourceHash } from "@beep/repo-cli/test/Quality"
 *
 * console.log(jsdocMigrateSourceHash("/** Doc. *" + "/").startsWith("sha256:")) // true
 * ```
 *
 * @param blockText - Exact block bytes to hash.
 * @returns `sha256:`-prefixed hex digest of the block bytes.
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateSourceHash = (blockText: string): string =>
  `sha256:${createHash("sha256").update(blockText).digest("hex")}`;

const containerName = (node: Node): string | undefined =>
  Node.isClassDeclaration(node) ||
  Node.isInterfaceDeclaration(node) ||
  Node.isEnumDeclaration(node) ||
  Node.isModuleDeclaration(node) ||
  Node.isFunctionDeclaration(node)
    ? node.getName()
    : undefined;

const qualifiedSymbol = (owner: Node): string => {
  const base = O.getOrElse(ownJSDocNodeName(owner), () => "<anonymous>");
  const ancestors: Array<string> = [];
  let current = owner.getParent();
  while (current !== undefined && !Node.isSourceFile(current)) {
    const name = containerName(current);
    if (name !== undefined && name !== base) {
      A.appendInPlace(ancestors, name);
    }
    current = current.getParent();
  }
  return A.join([...A.reverse(ancestors), base], ".");
};

const isTypeLevelDeclaration = (node: Node): boolean =>
  Node.isTypeAliasDeclaration(node) || Node.isInterfaceDeclaration(node) || Node.isModuleDeclaration(node);

const blockKindOf = (owner: Node): JSDocMigrateBlockKind => {
  if (isTypeLevelDeclaration(owner)) {
    return "type-level";
  }
  let current = owner.getParent();
  while (current !== undefined && !Node.isSourceFile(current)) {
    if (Node.isInterfaceDeclaration(current) || Node.isTypeAliasDeclaration(current)) {
      return "type-level";
    }
    current = current.getParent();
  }
  return "value";
};

const fileoverviewPreamblePattern = /^(?:#![^\n]*\n)?\s*$/;

const indentBefore = (sourceText: string, start: number): string => {
  const lineStart = sourceText.lastIndexOf("\n", start - 1) + 1;
  const prefix = Str.slice(lineStart, start)(sourceText);
  return /^[ \t]*$/.test(prefix) ? prefix : "";
};

const legacyCarrierTags = ["@example", "@remarks"];

const isAffectedBlock = (blockText: string): boolean => {
  const tags = tagsFromComment(blockText);
  return A.some(legacyCarrierTags, (tag) => A.contains(tags, tag));
};

const scanBlocks = (filePath: string, sourceText: string): ReadonlyArray<JSDocMigrateScannedBlock> => {
  const spans = rawJSDocSpans(sourceText);
  if (spans.length === 0) {
    return [];
  }
  const project = createInMemoryTsMorphProject();
  const sourceFile = project.createSourceFile(filePath, sourceText, { overwrite: true });
  const owners = jsdocOwnersByStart(sourceFile);
  const fileoverviewStart =
    spans[0] !== undefined && fileoverviewPreamblePattern.test(Str.slice(0, spans[0].start)(sourceText))
      ? spans[0].start
      : -1;

  const bound = A.map(
    spans,
    (
      span
    ): { readonly span: (typeof spans)[number]; readonly symbol: string; readonly kind: JSDocMigrateBlockKind } => {
      const owner = MutableHashMap.get(owners, span.start);
      if (O.isSome(owner)) {
        const node = owner.value;
        if (Node.isJSDocable(node)) {
          const docs = node.getJsDocs();
          const lastStart = docs[docs.length - 1]?.getStart();
          if (docs.length > 1 && span.start !== lastStart && span.start === fileoverviewStart) {
            return { span, symbol: "<fileoverview>", kind: "module" };
          }
        }
        return { span, symbol: qualifiedSymbol(node), kind: blockKindOf(node) };
      }
      if (span.start === fileoverviewStart) {
        return { span, symbol: "<fileoverview>", kind: "module" };
      }
      return { span, symbol: "<detached>", kind: "detached" };
    }
  );

  const ordinals = MutableHashMap.empty<string, number>();
  return A.map(bound, ({ kind, span, symbol }) => {
    const ordinal = O.getOrElse(MutableHashMap.get(ordinals, symbol), () => 0);
    MutableHashMap.set(ordinals, symbol, ordinal + 1);
    return {
      anchor: `${filePath}#${symbol}#${ordinal}`,
      filePath,
      symbol,
      ordinal,
      kind,
      start: span.start,
      end: span.end,
      text: span.text,
      indent: indentBefore(sourceText, span.start),
      affected: isAffectedBlock(span.text),
    };
  });
};

/**
 * Scan one source file into anchored JSDoc blocks.
 *
 * **Details**
 *
 * Blocks are discovered with the same fence-aware raw scanner the quality
 * gate uses, then bound to declarations through ts-morph. Anchors are
 * `path#symbol#ordinal` where the ordinal counts every doc block sharing the
 * `path#symbol` prefix in source order — over all blocks, not only affected
 * ones, so anchors stay stable when the affected subset shrinks. The first
 * block of a multi-doc leading run (a fileoverview above a symbol doc) binds
 * to `<fileoverview>`.
 *
 * **Example** (Scan a file with a companion type)
 *
 * ```ts
 * import { scanJSDocMigrateBlocks } from "@beep/repo-cli/test/Quality"
 *
 * const source = [
 *   "/** Runtime schema. *" + "/",
 *   "export const Foo = 1",
 *   "/** Companion type. *" + "/",
 *   "export type Foo = typeof Foo",
 *   ""
 * ].join("\n")
 * const blocks = scanJSDocMigrateBlocks("packages/x/src/Foo.ts", source)
 * console.log(blocks.map((block) => block.anchor))
 * // ["packages/x/src/Foo.ts#Foo#0", "packages/x/src/Foo.ts#Foo#1"]
 * ```
 *
 * @param filePath - Repo-relative path used in anchors.
 * @param sourceText - Full source text to scan.
 * @returns Anchored blocks in source order.
 * @category use-cases
 * @since 0.0.0
 */
export const scanJSDocMigrateBlocks: {
  (sourceText: string): (filePath: string) => ReadonlyArray<JSDocMigrateScannedBlock>;
  (filePath: string, sourceText: string): ReadonlyArray<JSDocMigrateScannedBlock>;
} = dual(2, scanBlocks);

const extractRecordsForFile = (filePath: string, sourceText: string): ReadonlyArray<JSDocMigrateExtractRecord> =>
  A.map(
    A.filter(scanBlocks(filePath, sourceText), (block) => block.affected),
    (block) => {
      const stats = jsdocMigrateBlockStats(block.text);
      return JSDocMigrateExtractRecord.make({
        anchor: block.anchor,
        filePath: block.filePath,
        symbol: block.symbol,
        ordinal: block.ordinal,
        kind: block.kind,
        sourceHash: jsdocMigrateSourceHash(block.text),
        start: block.start,
        end: block.end,
        blockText: block.text,
        leadParagraphCount: stats.leadParagraphCount,
        exampleTagCount: stats.exampleTagCount,
        unfencedExampleCount: stats.unfencedExampleCount,
        remarksTagCount: stats.remarksTagCount,
        undescribedSeeCount: stats.undescribedSeeCount,
      });
    }
  );

/**
 * Build extract records for the affected blocks of one source file.
 *
 * **Example** (Extract records from a legacy file)
 *
 * ```ts
 * import { jsdocMigrateExtractRecordsForFile } from "@beep/repo-cli/test/Quality"
 *
 * const source = [
 *   "/**",
 *   " * Lead.",
 *   " *",
 *   " * @example",
 *   " * ```ts",
 *   " * const a = 1",
 *   " * ```",
 *   " *" + "/",
 *   "export const a = 1",
 *   ""
 * ].join("\n")
 * const records = jsdocMigrateExtractRecordsForFile("packages/x/src/a.ts", source)
 * console.log(records.length) // 1
 * console.log(records[0]?.exampleTagCount) // 1
 * ```
 *
 * @param filePath - Repo-relative path used in anchors.
 * @param sourceText - Full source text to scan.
 * @returns Extract records for the affected blocks in source order.
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateExtractRecordsForFile: {
  (sourceText: string): (filePath: string) => ReadonlyArray<JSDocMigrateExtractRecord>;
  (filePath: string, sourceText: string): ReadonlyArray<JSDocMigrateExtractRecord>;
} = dual(2, extractRecordsForFile);

/**
 * List the non-generated package source files the migration covers.
 *
 * **Details**
 *
 * Uses `git ls-files packages apps` so untracked scratch files never enter the
 * corpus, then applies the same path filters as the quality gate. The
 * generated-header probe still runs per file at read time.
 *
 * **Example** (Build the corpus listing Effect)
 *
 * ```ts
 * import { listJSDocMigrateCorpusFiles } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = listJSDocMigrateCorpusFiles("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const listJSDocMigrateCorpusFiles = Effect.fn("JSDocMigrateExtract.listCorpusFiles")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const lines = yield* runGitLines(repoRoot, ["ls-files", "packages", "apps"], jsdocGitErrorAdapter);
  return A.filter(lines, isPackageSourceFile);
});

/**
 * Options accepted by {@link runJSDocMigrateExtract}.
 *
 * **Example** (Configure an extract run)
 *
 * ```ts
 * import { RunJSDocMigrateExtractOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options = RunJSDocMigrateExtractOptions.make({
 *   output: "goals/jsdoc-carrier-migration/data/extract.jsonl"
 * })
 * console.log(options.output)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunJSDocMigrateExtractOptions extends S.Class<RunJSDocMigrateExtractOptions>(
  $I`RunJSDocMigrateExtractOptions`
)(
  {
    output: S.optionalKey(S.String),
  },
  $I.annote("RunJSDocMigrateExtractOptions", {
    description: "Options accepted by the jsdoc-migrate extract stage: the extract.jsonl output path.",
  })
) {}

/**
 * Read one corpus file's text when it is a live migration subject.
 *
 * **Details**
 *
 * Returns `O.none()` for generated files (header probe) and for files that
 * carry no legacy-carrier substring, so extract and apply share one
 * definition of "worth scanning".
 *
 * **Example** (Build the source reader Effect)
 *
 * ```ts
 * import { readJSDocMigrateSourceText } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = readJSDocMigrateSourceText("/repo", "packages/x/src/a.ts")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readJSDocMigrateSourceText = Effect.fn("JSDocMigrateExtract.readSourceText")(function* (
  repoRoot: string,
  filePath: string
): Effect.fn.Return<O.Option<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceText = yield* fs
    .readFileString(path.join(repoRoot, filePath))
    .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to read ${filePath}.`)));
  if (hasGeneratedFileHeader(sourceText)) {
    return O.none();
  }
  if (!Str.includes("@example")(sourceText) && !Str.includes("@remarks")(sourceText)) {
    return O.none();
  }
  return O.some(sourceText);
});

const readCorpusFileRecords = Effect.fn("JSDocMigrateExtract.readCorpusFileRecords")(function* (
  repoRoot: string,
  filePath: string
): Effect.fn.Return<
  ReadonlyArray<JSDocMigrateExtractRecord>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const sourceText = yield* readJSDocMigrateSourceText(repoRoot, filePath);
  return O.match(sourceText, {
    onNone: () => [],
    onSome: (text) => jsdocMigrateExtractRecordsForFile(filePath, text),
  });
});

/**
 * Run the extract stage: scan the corpus and emit `extract.jsonl`.
 *
 * **Details**
 *
 * Fails loudly when two blocks produce the same anchor anywhere in the
 * corpus — a duplicate would let a frozen title bind to the wrong block, and
 * the conservation law cannot catch that. The emitted file is the input to
 * both the title pass and the fail-closed binding checks in apply and verify.
 *
 * **Example** (Build the extract Effect)
 *
 * ```ts
 * import { runJSDocMigrateExtract, RunJSDocMigrateExtractOptions } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = runJSDocMigrateExtract(RunJSDocMigrateExtractOptions.make({}))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocMigrateExtract = Effect.fn("JSDocMigrateExtract.run")(function* (
  options: RunJSDocMigrateExtractOptions
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const path = yield* Path.Path;
  const outputPath = path.resolve(repoRoot, options.output ?? defaultJSDocMigrateExtractPath);
  const files = yield* listJSDocMigrateCorpusFiles(repoRoot);
  const perFile = yield* Effect.forEach(files, (filePath) => readCorpusFileRecords(repoRoot, filePath), {
    concurrency: 8,
  });
  const records = A.flatten(perFile);

  const seenAnchors = MutableHashSet.empty<string>();
  const duplicates: Array<string> = [];
  for (const record of records) {
    if (MutableHashSet.has(seenAnchors, record.anchor)) {
      A.appendInPlace(duplicates, record.anchor);
    }
    MutableHashSet.add(seenAnchors, record.anchor);
  }
  if (duplicates.length > 0) {
    return yield* QualityScriptCommandError.make({
      message: `jsdoc-migrate extract found ${duplicates.length} duplicate anchor(s): ${A.join(A.take(duplicates, 10), ", ")}`,
      command: "bun run beep quality jsdoc-migrate extract",
      exitCode: 1,
    });
  }

  const lines = yield* Effect.forEach(records, (record) =>
    jsdocMigrateExtractCodec
      .encode(record)
      .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to encode ${record.anchor}.`)))
  );
  yield* writeArtifact({
    path: outputPath,
    body: `${A.join(lines, "\n")}\n`,
    onError: (cause) => QualityScriptCommandError.new(cause, `Failed to write ${outputPath}.`),
  });

  const affectedFiles = MutableHashSet.empty<string>();
  for (const record of records) {
    MutableHashSet.add(affectedFiles, record.filePath);
  }
  const unfenced = A.reduce(records, 0, (total, record) => total + record.unfencedExampleCount);
  const multiExample = A.filter(records, (record) => record.exampleTagCount > 1).length;
  const withRemarks = A.filter(records, (record) => record.remarksTagCount > 0).length;
  yield* Console.log(
    `[jsdoc-migrate] extract ok: files=${MutableHashSet.size(affectedFiles)} blocks=${records.length} ` +
      `multiExample=${multiExample} remarks=${withRemarks} unfencedExamples=${unfenced} -> ${outputPath}`
  );
});
