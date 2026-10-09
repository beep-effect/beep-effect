/**
 * S2 carrier conversion for ported modules: extract every JSDoc block that
 * still uses `@example`, `@remarks` or an undescribed `@see`, then apply
 * editor-supplied titles and routing through the repo's conservation-checked
 * rewriter (`beep quality jsdoc-migrate`'s pure core).
 *
 * **Details**
 *
 * The repo pipeline extracts from `git ls-files packages apps` only, so the
 * lab drives its pure block rewriter directly. A block whose rewrite would
 * change prose or code beyond the declared carrier edits is quarantined and
 * reported, never written.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Node, Project } from "ts-morph";
import {
  JSDocMigrateBlockInput,
  JSDocMigrateRewriteData,
  rewriteJSDocMigrateBlock,
} from "../../../packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateRewrite.ts";
import { ManifestInvalid } from "./Audit.errors.ts";
import { listTsFiles } from "./Copy.ts";
import type { ModuleName } from "./Ledger.schema.ts";
import { labPaths, type RunnerConfig } from "./Paths.ts";
import type { SourceFile } from "ts-morph";

const $I = $ScratchpadId.create("effected/runner/DocsMigrate");

/**
 * One block that still needs carrier conversion, addressed by
 * `file#symbol#ordinal`.
 *
 * **Example** (Describe a block)
 *
 * ```ts
 * import { DocBlock } from "@beep/scratchpad/effected/runner/DocsMigrate"
 *
 * const block = DocBlock.make({ anchor: "a.ts#x#0", file: "a.ts", symbol: "x", line: 3, examples: 1, remarks: 1, bareSees: 0, text: "/** x *" + "/" })
 * console.log(block.examples) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocBlock extends S.Class<DocBlock>($I`DocBlock`)(
  {
    anchor: S.NonEmptyString,
    file: S.NonEmptyString,
    symbol: S.String,
    line: S.Int,
    examples: S.Int,
    remarks: S.Int,
    bareSees: S.Int,
    text: S.String,
  },
  $I.annote("DocBlock", { description: "A JSDoc block that still uses a legacy carrier." })
) {}

/**
 * Editor-supplied conversion data for one block: one title per `@example`, the
 * `@remarks` routing, how many lead paragraphs stay lead, and purposes for
 * undescribed `@see` tags (the repo rewriter's `JSDocMigrateRewriteData`).
 *
 * **Example** (Decode a data row)
 *
 * ```ts
 * import { DocBlockData } from "@beep/scratchpad/effected/runner/DocsMigrate"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(DocBlockData)({ anchor: "a.ts#x#0", titles: ["Parse a document"], remarks: "details" })
 * console.log(row.titles) // ["Parse a document"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocBlockData = S.Struct({
  anchor: S.NonEmptyString,
  ...JSDocMigrateRewriteData.fields,
}).annotate($I.annote("DocBlockData", { description: "Titles and routing for one legacy JSDoc block." }));

/**
 * The decoded data row.
 *
 * @see {@link DocBlockData} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type DocBlockData = typeof DocBlockData.Type;

const DocBlockDataFile = DocBlockData.pipe(S.Array, S.fromJsonString);
const decodeDataFile = S.decodeUnknownEffect(DocBlockDataFile);

const countOf = (pattern: RegExp, text: string): number => A.length(A.fromIterable(text.matchAll(pattern)));

const ownerName = (jsdoc: Node): string => {
  const parent = jsdoc.getParent();
  if (parent === undefined) return "";
  if (Node.isVariableStatement(parent)) {
    return A.join(A.map(parent.getDeclarations(), (declaration) => declaration.getName()), ",");
  }
  return Node.hasName(parent) ? parent.getName() : parent.getKindName();
};

const blocksOf = (sourceFile: SourceFile, file: string): ReadonlyArray<DocBlock> => {
  const ordinals = MutableHashMap.empty<string, number>();
  const blocks: Array<DocBlock> = [];
  for (const node of sourceFile.getDescendants()) {
    if (!Node.isJSDoc(node)) continue;
    const text = node.getText();
    const examples = countOf(/@example\b/g, text);
    const remarks = countOf(/@remarks\b/g, text);
    const bareSees = countOf(/@see\s+\{@link\s+[^}]+\}\s*(?:\n|\*\/)/g, text);
    if (examples === 0 && remarks === 0 && bareSees === 0) continue;
    const symbol = ownerName(node);
    const ordinal = O.getOrElse(MutableHashMap.get(ordinals, symbol), () => 0);
    MutableHashMap.set(ordinals, symbol, ordinal + 1);
    blocks.push(
      DocBlock.make({
        anchor: `${file}#${symbol}#${ordinal}`,
        file,
        symbol,
        line: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
        examples,
        remarks,
        bareSees,
        text,
      })
    );
  }
  return blocks;
};

/**
 * Every legacy-carrier block in a module's source files.
 *
 * **Example** (Extract a module's blocks)
 *
 * ```ts
 * import { extractDocBlocks } from "@beep/scratchpad/effected/runner/DocsMigrate"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(extractDocBlocks(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "glob"))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const extractDocBlocks = Effect.fn("DocsMigrate.extract")(function* (config: RunnerConfig, module: ModuleName) {
  const path = yield* Path.Path;
  const files = yield* listTsFiles(config.repoRoot, labPaths(module).sourceDir);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  return A.flatMap(files, (file) => blocksOf(project.addSourceFileAtPath(path.join(config.repoRoot, file)), file));
});

/**
 * What applying a data file did.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ApplyReport {
  readonly rewritten: number;
  readonly quarantined: ReadonlyArray<string>;
  readonly unmatched: ReadonlyArray<string>;
}

const indentOf = (sourceFile: SourceFile, start: number): string => {
  const column = sourceFile.getLineAndColumnAtPos(start).column;
  return Str.repeat(column - 1)(" ");
};

/**
 * Applies a data file (a JSON array of {@link DocBlockData}) to a module's
 * legacy blocks through the conservation-checked rewriter, writing only
 * rewrites that pass and reporting quarantines and unmatched anchors.
 *
 * **Example** (Apply titles to a module)
 *
 * ```ts
 * import { applyDocBlockData } from "@beep/scratchpad/effected/runner/DocsMigrate"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" })
 * console.log(Effect.isEffect(applyDocBlockData(config, "glob", "[]"))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const applyDocBlockData = Effect.fn("DocsMigrate.apply")(function* (
  config: RunnerConfig,
  module: ModuleName,
  json: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rows = yield* decodeDataFile(json).pipe(
    Effect.mapError((issue) => ManifestInvalid.make({ path: "docs data", detail: String(issue) }))
  );
  const files = yield* listTsFiles(config.repoRoot, labPaths(module).sourceDir);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const quarantined: Array<string> = [];
  const matched: Array<string> = [];
  let rewritten = 0;
  for (const file of files) {
    const absolute = path.join(config.repoRoot, file);
    const sourceFile = project.addSourceFileAtPath(absolute);
    const blocks = blocksOf(sourceFile, file);
    const edits: Array<{ readonly start: number; readonly end: number; readonly text: string }> = [];
    for (const block of blocks) {
      const row = A.findFirst(rows, (candidate) => candidate.anchor === block.anchor);
      if (O.isNone(row)) continue;
      matched.push(block.anchor);
      const node = A.findFirst(sourceFile.getDescendants(), (candidate) => Node.isJSDoc(candidate) && candidate.getText() === block.text);
      if (O.isNone(node)) continue;
      const { anchor: _anchor, ...data } = row.value;
      const result = rewriteJSDocMigrateBlock(
        JSDocMigrateBlockInput.make({ blockText: block.text, indent: indentOf(sourceFile, node.value.getStart()), data })
      );
      if (result._tag === "Rewritten") {
        edits.push({ start: node.value.getStart(), end: node.value.getEnd(), text: result.text });
      } else {
        quarantined.push(`${block.anchor} ${result._tag}: ${A.join(result.reasons, "; ")}`);
      }
    }
    if (A.isReadonlyArrayNonEmpty(edits)) {
      let text = sourceFile.getFullText();
      for (const edit of A.sort(edits, Order.mapInput(Order.flip(Order.Number), (candidate: (typeof edits)[number]) => candidate.start))) {
        text = `${Str.slice(0, edit.start)(text)}${edit.text}${Str.slice(edit.end)(text)}`;
      }
      yield* fs.writeFileString(absolute, text);
      rewritten += edits.length;
    }
  }
  const report: ApplyReport = {
    rewritten,
    quarantined,
    unmatched: A.filter(A.map(rows, (row) => row.anchor), (anchor) => !A.contains(matched, anchor)),
  };
  return report;
});
