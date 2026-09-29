/**
 * Schemas for the `schema-inventory/v1` fixture owned by `beep lint effect-schema-inventory`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type * as O from "effect/Option";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Lint/EffectSchemaInventory.schemas");

/**
 * Repository-relative directory holding the committed inventory rows, index, and contract.
 *
 * **Example** (Inspect the fixture directory)
 *
 * ```ts
 * import { EffectSchemaInventoryFixturePath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectSchemaInventoryFixturePath.endsWith("effect-schema-rc118/inventory")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectSchemaInventoryFixturePath = "packages/tooling/tool/cli/test/fixtures/effect-schema-rc118/inventory";

/**
 * Repository-relative path of the Effect reference clone read with `git show` at the pin.
 *
 * **Example** (Inspect the reference path)
 *
 * ```ts
 * import { EffectSchemaInventoryReferencePath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectSchemaInventoryReferencePath) // ".repos/effect"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectSchemaInventoryReferencePath = ".repos/effect";

/**
 * Repository-relative directory that receives generated lane prompts by default.
 *
 * **Example** (Inspect the default prompt directory)
 *
 * ```ts
 * import { EffectSchemaInventoryPromptRoot } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectSchemaInventoryPromptRoot) // "goals/effect-schema-parity/ops/prompts"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectSchemaInventoryPromptRoot = "goals/effect-schema-parity/ops/prompts";

/**
 * Full 40-character Effect commit sha read from the root `package.json` catalog (`inventoryPin`).
 *
 * **Example** (Accept a full sha and reject an abbreviation)
 *
 * ```ts
 * import { EffectSchemaInventoryPin } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffectSchemaInventoryPin)("df77fff9396fe31de72d1947ecb5b74f8cee89e1")) // true
 * console.log(S.is(EffectSchemaInventoryPin)("df77fff939")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffectSchemaInventoryPin = S.String.check(S.isPattern(/^[0-9a-f]{40}$/u)).pipe(
  $I.annoteSchema("EffectSchemaInventoryPin", {
    description: "Full 40-character lowercase Effect commit sha pinned by the root package.json catalog.",
  })
);

/**
 * Decoded inventory pin.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectSchemaInventoryPin = typeof EffectSchemaInventoryPin.Type;

/**
 * Declaration-facet kinds recorded by `schema-inventory/v1`.
 *
 * **Details**
 *
 * `method`, `property`, `accessor`, `call`, and `constructor` are one-level members of an
 * exported declaration; `re-export` marks a named export resolved to another module.
 *
 * **Example** (Validate a row kind)
 *
 * ```ts
 * import { EffectSchemaInventoryKind } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectSchemaInventoryKind.is.namespace("namespace")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffectSchemaInventoryKind = LiteralKit([
  "function",
  "const",
  "class",
  "interface",
  "type",
  "namespace",
  "method",
  "property",
  "accessor",
  "call",
  "constructor",
  "re-export",
]).pipe(
  $I.annoteSchema("EffectSchemaInventoryKind", {
    description: "Declaration-facet kind recorded by one schema-inventory/v1 row.",
  })
);

/**
 * Decoded row kind.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectSchemaInventoryKind = typeof EffectSchemaInventoryKind.Type;

/**
 * Effect import path of an inventoried module, such as `effect/Schema`.
 *
 * **Example** (Accept an Effect module path)
 *
 * ```ts
 * import { EffectSchemaInventoryModuleName } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffectSchemaInventoryModuleName)("effect/SchemaIssue")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffectSchemaInventoryModuleName = S.String.check(S.isStartingWith("effect/")).pipe(
  $I.annoteSchema("EffectSchemaInventoryModuleName", {
    description: "Effect import path of an inventoried module.",
  })
);

/**
 * Decoded module import path.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectSchemaInventoryModuleName = typeof EffectSchemaInventoryModuleName.Type;

const EffectSchemaInventorySourcePath = S.String.check(
  S.isStartingWith("packages/effect/src/"),
  S.isEndingWith(".ts")
).pipe(
  $I.annoteSchema("EffectSchemaInventorySourcePath", {
    description: "Upstream-relative TypeScript source path under packages/effect/src.",
  })
);

const EffectSchemaInventoryLine = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("EffectSchemaInventoryLine", { description: "One-based source line at the pin." })
);

const EffectSchemaInventoryCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("EffectSchemaInventoryCount", { description: "Non-negative row, byte, or signature count." })
);

const singleLine = S.isPattern(/^[^\r\n]*$/u);

const EffectSchemaInventorySignature = S.String.check(S.isMaxLength(300), singleLine).pipe(
  $I.annoteSchema("EffectSchemaInventorySignature", {
    description: "Whitespace-collapsed declaration preview of at most 300 UTF-16 code units.",
  })
);

const EffectSchemaInventorySummary = S.String.check(S.isMaxLength(400), singleLine).pipe(
  $I.annoteSchema("EffectSchemaInventorySummary", {
    description: "First JSDoc paragraph preview of at most 400 UTF-16 code units.",
  })
);

/**
 * One `schema-inventory/v1` row: a declaration facet of an Effect module at the pin.
 *
 * **Details**
 *
 * Identity is `(module, symbol, kind)`. Field order is the committed JSONL key order, so
 * encoding a decoded row reproduces its line byte for byte. `category` and `since` encode
 * as JSON `null` when the declaration carries no such tag.
 *
 * **Example** (Build a row)
 *
 * ```ts
 * import { EffectSchemaInventoryRow } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const row = EffectSchemaInventoryRow.make({
 *   sha: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   module: "effect/SchemaIssue",
 *   file: "packages/effect/src/SchemaIssue.ts",
 *   line: 51,
 *   symbol: "isIssue",
 *   kind: "function",
 *   category: O.some("guards"),
 *   since: O.some("4.0.0"),
 *   deprecated: false,
 *   internal: false,
 *   summary: "Returns `true` if the given value is an {@link Issue}.",
 *   hasExample: true,
 *   signature: "export function isIssue(u: unknown): u is Issue",
 *   overloads: 0,
 *   importable: true
 * })
 * console.log(row.symbol) // "isIssue"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryRow extends S.Class<EffectSchemaInventoryRow>($I`EffectSchemaInventoryRow`)(
  {
    sha: EffectSchemaInventoryPin,
    module: EffectSchemaInventoryModuleName,
    file: EffectSchemaInventorySourcePath,
    line: EffectSchemaInventoryLine,
    symbol: S.NonEmptyString,
    kind: EffectSchemaInventoryKind,
    category: S.OptionFromNullOr(S.String),
    since: S.OptionFromNullOr(S.String),
    deprecated: S.Boolean,
    internal: S.Boolean,
    summary: EffectSchemaInventorySummary,
    hasExample: S.Boolean,
    signature: EffectSchemaInventorySignature,
    overloads: EffectSchemaInventoryCount,
    importable: S.Boolean,
  },
  $I.annote("EffectSchemaInventoryRow", {
    description: "One schema-inventory/v1 declaration-facet row of an Effect module at the pinned sha.",
  })
) {}

/**
 * One entry of the tool-owned module list: an upstream source file and its import facts.
 *
 * **Details**
 *
 * `importable` is `false` when Effect's exports map nulls the path (`./internal/*`), so the
 * rows are provenance only.
 *
 * **Example** (Describe a public module)
 *
 * ```ts
 * import { EffectSchemaInventoryModule } from "@beep/repo-cli/commands/Lint"
 *
 * const entry = EffectSchemaInventoryModule.make({
 *   file: "packages/effect/src/SchemaIssue.ts",
 *   module: "effect/SchemaIssue",
 *   slug: "effect-SchemaIssue",
 *   importable: true
 * })
 * console.log(entry.slug) // "effect-SchemaIssue"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryModule extends S.Class<EffectSchemaInventoryModule>($I`EffectSchemaInventoryModule`)(
  {
    file: EffectSchemaInventorySourcePath,
    module: EffectSchemaInventoryModuleName,
    slug: S.NonEmptyString,
    importable: S.Boolean,
  },
  $I.annote("EffectSchemaInventoryModule", {
    description: "Upstream source file, Effect import path, JSONL file stem, and importability of one module.",
  })
) {}

/**
 * The rows extracted for one module, in committed order.
 *
 * **Example** (Describe a module without exports)
 *
 * ```ts
 * import { EffectSchemaInventoryModule, EffectSchemaInventoryModuleRows } from "@beep/repo-cli/commands/Lint"
 *
 * const module = EffectSchemaInventoryModule.make({
 *   file: "packages/effect/src/schema/SchemaJITCompiler/enable.ts",
 *   module: "effect/schema/SchemaJITCompiler/enable",
 *   slug: "effect-schema-SchemaJITCompiler-enable",
 *   importable: true
 * })
 * console.log(EffectSchemaInventoryModuleRows.make({ module, rows: [] }).rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryModuleRows extends S.Class<EffectSchemaInventoryModuleRows>(
  $I`EffectSchemaInventoryModuleRows`
)(
  {
    module: EffectSchemaInventoryModule,
    rows: S.Array(EffectSchemaInventoryRow),
  },
  $I.annote("EffectSchemaInventoryModuleRows", {
    description: "One module-list entry and its sorted schema-inventory/v1 rows.",
  })
) {}

/**
 * Output of one syntax-only extraction pass over the pinned module sources.
 *
 * **Details**
 *
 * `parser` is the TypeScript version that parsed the sources; it is stamped into `INDEX.md`
 * because a parser change alone can change row bytes.
 *
 * **Example** (Describe an empty extraction)
 *
 * ```ts
 * import { EffectSchemaInventoryExtraction } from "@beep/repo-cli/commands/Lint"
 *
 * const extraction = EffectSchemaInventoryExtraction.make({ parser: "6.0.2", bareStarDeclarationsOmitted: 0, modules: [] })
 * console.log(extraction.parser) // "6.0.2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryExtraction extends S.Class<EffectSchemaInventoryExtraction>(
  $I`EffectSchemaInventoryExtraction`
)(
  {
    parser: S.NonEmptyString,
    bareStarDeclarationsOmitted: EffectSchemaInventoryCount,
    modules: S.Array(EffectSchemaInventoryModuleRows),
  },
  $I.annote("EffectSchemaInventoryExtraction", {
    description: "Parser version, omitted bare star re-exports, and per-module rows of one extraction pass.",
  })
) {}

/**
 * Provenance header read back from a committed `INDEX.md`.
 *
 * **Example** (Build an index header)
 *
 * ```ts
 * import { EffectSchemaInventoryIndexHeader } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const header = EffectSchemaInventoryIndexHeader.make({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(header.parser) // "6.0.2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryIndexHeader extends S.Class<EffectSchemaInventoryIndexHeader>(
  $I`EffectSchemaInventoryIndexHeader`
)(
  {
    pin: EffectSchemaInventoryPin,
    parser: S.NonEmptyString,
    digest: Sha256Hex,
  },
  $I.annote("EffectSchemaInventoryIndexHeader", {
    description: "Pin, TypeScript parser version, and row digest recorded in the committed INDEX.md.",
  })
) {}

/**
 * One generated fixture file: its name inside the inventory directory and its full text.
 *
 * **Example** (Describe the index file)
 *
 * ```ts
 * import { EffectSchemaInventoryFile } from "@beep/repo-cli/commands/Lint"
 *
 * const file = EffectSchemaInventoryFile.make({ name: "INDEX.md", content: "# Schema inventory index\n" })
 * console.log(file.name) // "INDEX.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryFile extends S.Class<EffectSchemaInventoryFile>($I`EffectSchemaInventoryFile`)(
  {
    name: S.NonEmptyString,
    content: S.String,
  },
  $I.annote("EffectSchemaInventoryFile", {
    description: "Name and exact text of one generated inventory fixture file.",
  })
) {}

/**
 * Totals of one inventory generation, logged by `--write` and `--check`.
 *
 * **Example** (Build a receipt)
 *
 * ```ts
 * import { EffectSchemaInventoryReceipt } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const receipt = EffectSchemaInventoryReceipt.make({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   modules: 0,
 *   rows: 0,
 *   bytes: 0,
 *   internalRows: 0,
 *   deprecatedRows: 0,
 *   bareStarDeclarationsOmitted: 0
 * })
 * console.log(receipt.rows) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryReceipt extends S.Class<EffectSchemaInventoryReceipt>(
  $I`EffectSchemaInventoryReceipt`
)(
  {
    pin: EffectSchemaInventoryPin,
    parser: S.NonEmptyString,
    digest: Sha256Hex,
    modules: EffectSchemaInventoryCount,
    rows: EffectSchemaInventoryCount,
    bytes: EffectSchemaInventoryCount,
    internalRows: EffectSchemaInventoryCount,
    deprecatedRows: EffectSchemaInventoryCount,
    bareStarDeclarationsOmitted: EffectSchemaInventoryCount,
  },
  $I.annote("EffectSchemaInventoryReceipt", {
    description: "Pin, parser, digest, and totals of one inventory generation.",
  })
) {}

/**
 * A complete in-memory generation: its receipt and every fixture file it owns.
 *
 * **Example** (Build an empty generation)
 *
 * ```ts
 * import { EffectSchemaInventoryReceipt, EffectSchemaInventoryRendered } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const receipt = EffectSchemaInventoryReceipt.make({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   modules: 0, rows: 0, bytes: 0, internalRows: 0, deprecatedRows: 0, bareStarDeclarationsOmitted: 0
 * })
 * console.log(EffectSchemaInventoryRendered.make({ receipt, files: [] }).files.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryRendered extends S.Class<EffectSchemaInventoryRendered>(
  $I`EffectSchemaInventoryRendered`
)(
  {
    receipt: EffectSchemaInventoryReceipt,
    files: S.Array(EffectSchemaInventoryFile),
  },
  $I.annote("EffectSchemaInventoryRendered", {
    description: "Receipt and owned files of one in-memory inventory generation.",
  })
) {}

/**
 * One difference between the committed fixture and a fresh generation.
 *
 * **Details**
 *
 * `stale` records the first differing line and column, one-based, with a display window of both
 * sides that starts shortly before the first differing character.
 *
 * **Example** (Match a drift case)
 *
 * ```ts
 * import { EffectSchemaInventoryDrift } from "@beep/repo-cli/commands/Lint"
 *
 * const drift = EffectSchemaInventoryDrift.cases.missing.make({ file: "INDEX.md" })
 * console.log(EffectSchemaInventoryDrift.match(drift, {
 *   missing: ({ file }) => `missing ${file}`,
 *   stale: ({ file }) => `stale ${file}`,
 *   unexpected: ({ file }) => `unexpected ${file}`
 * })) // "missing INDEX.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffectSchemaInventoryDrift = S.TaggedUnion({
  missing: { file: S.NonEmptyString },
  stale: {
    file: S.NonEmptyString,
    line: EffectSchemaInventoryLine,
    column: EffectSchemaInventoryLine,
    expected: S.String,
    actual: S.String,
  },
  unexpected: { file: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("EffectSchemaInventoryDrift", {
    description: "Missing, stale, or unexpected fixture file found by effect-schema-inventory --check.",
  })
);

/**
 * Decoded drift case.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectSchemaInventoryDrift = typeof EffectSchemaInventoryDrift.Type;

/**
 * Result of comparing the committed fixture with a fresh generation.
 *
 * **Example** (Report a current fixture)
 *
 * ```ts
 * import { EffectSchemaInventoryCheckReport, EffectSchemaInventoryReceipt } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const receipt = EffectSchemaInventoryReceipt.make({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   modules: 0, rows: 0, bytes: 0, internalRows: 0, deprecatedRows: 0, bareStarDeclarationsOmitted: 0
 * })
 * console.log(EffectSchemaInventoryCheckReport.make({ receipt, drift: [] }).drift.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryCheckReport extends S.Class<EffectSchemaInventoryCheckReport>(
  $I`EffectSchemaInventoryCheckReport`
)(
  {
    receipt: EffectSchemaInventoryReceipt,
    drift: S.Array(EffectSchemaInventoryDrift),
  },
  $I.annote("EffectSchemaInventoryCheckReport", {
    description: "Generation receipt plus every drift between the committed fixture and the pinned sources.",
  })
) {}

/**
 * One `graft skeleton --json` entry for a module source file.
 *
 * **Example** (Decode a skeleton entry)
 *
 * ```ts
 * import { EffectSchemaInventoryGraftEntry } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const entry = EffectSchemaInventoryGraftEntry.make({
 *   name: "isIssue",
 *   kind: "function",
 *   span: "L51-L53",
 *   signature: O.none(),
 *   summary: O.some("Narrows an unknown value to a schema Issue.")
 * })
 * console.log(entry.span) // "L51-L53"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryGraftEntry extends S.Class<EffectSchemaInventoryGraftEntry>(
  $I`EffectSchemaInventoryGraftEntry`
)(
  {
    name: S.String,
    kind: S.String,
    span: S.String,
    signature: S.OptionFromOptionalKey(S.String),
    summary: S.OptionFromOptionalKey(S.String),
  },
  $I.annote("EffectSchemaInventoryGraftEntry", {
    description: "Name, kind, line span, signature, and summary graft reports for one declaration.",
  })
) {}

/**
 * The `graft skeleton --json` document for one module source file.
 *
 * **Example** (Build an empty skeleton)
 *
 * ```ts
 * import { EffectSchemaInventoryGraftSkeleton } from "@beep/repo-cli/commands/Lint"
 *
 * const skeleton = EffectSchemaInventoryGraftSkeleton.make({ file: "packages/effect/src/SchemaIssue.ts", entries: [] })
 * console.log(skeleton.entries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryGraftSkeleton extends S.Class<EffectSchemaInventoryGraftSkeleton>(
  $I`EffectSchemaInventoryGraftSkeleton`
)(
  {
    file: S.String,
    entries: S.Array(EffectSchemaInventoryGraftEntry),
  },
  $I.annote("EffectSchemaInventoryGraftSkeleton", {
    description: "Declarations graft reports for one module source file.",
  })
) {}

/**
 * Local graft context for a lane prompt, or the reason it is absent.
 *
 * **Details**
 *
 * Graft indexes the reference working tree, not the pin. `available` records that tree's HEAD
 * and whether the module file is byte-identical at HEAD and at the pin; graft is never a
 * hosted-CI dependency, so `unavailable` is an expected outcome.
 *
 * **Example** (Record an absent graft)
 *
 * ```ts
 * import { EffectSchemaInventoryGraftContext } from "@beep/repo-cli/commands/Lint"
 *
 * const context = EffectSchemaInventoryGraftContext.cases.unavailable.make({ reason: "graft is not on PATH" })
 * console.log(context._tag) // "unavailable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffectSchemaInventoryGraftContext = S.TaggedUnion({
  available: {
    head: EffectSchemaInventoryPin,
    identicalAtPin: S.Boolean,
    entries: S.Array(EffectSchemaInventoryGraftEntry),
  },
  unavailable: { reason: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("EffectSchemaInventoryGraftContext", {
    description: "Graft skeleton of a module at the reference HEAD, or why it could not be read.",
  })
);

/**
 * Decoded graft context.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectSchemaInventoryGraftContext = typeof EffectSchemaInventoryGraftContext.Type;

/**
 * Outcome of one lane prompt generation.
 *
 * **Example** (Describe a written prompt)
 *
 * ```ts
 * import { EffectSchemaInventoryPromptReceipt } from "@beep/repo-cli/commands/Lint"
 *
 * const receipt = EffectSchemaInventoryPromptReceipt.make({
 *   module: "effect/SchemaIssue",
 *   target: "goals/effect-schema-parity/ops/prompts/effect-SchemaIssue.md",
 *   rows: 65,
 *   graftAvailable: true
 * })
 * console.log(receipt.rows) // 65
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSchemaInventoryPromptReceipt extends S.Class<EffectSchemaInventoryPromptReceipt>(
  $I`EffectSchemaInventoryPromptReceipt`
)(
  {
    module: EffectSchemaInventoryModuleName,
    target: S.NonEmptyString,
    rows: EffectSchemaInventoryCount,
    graftAvailable: S.Boolean,
  },
  $I.annote("EffectSchemaInventoryPromptReceipt", {
    description: "Module, repository-relative output path, row count, and graft availability of a written lane prompt.",
  })
) {}

/**
 * Operation selected by the `lint effect-schema-inventory` flags.
 *
 * **Example** (Select prompt generation)
 *
 * ```ts
 * import { EffectSchemaInventoryRequest } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const request = EffectSchemaInventoryRequest.cases.prompt.make({ module: "effect/SchemaIssue", out: O.none() })
 * console.log(request._tag) // "prompt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffectSchemaInventoryRequest = S.TaggedUnion({
  check: {},
  write: {},
  prompt: { module: EffectSchemaInventoryModuleName, out: S.Option(S.String) },
}).pipe(
  $I.annoteSchema("EffectSchemaInventoryRequest", {
    description: "Check, write, or prompt-generation request for the schema inventory command.",
  })
);

/**
 * Decoded command request.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectSchemaInventoryRequest = typeof EffectSchemaInventoryRequest.Type;

const EffectSchemaInventoryRowJson = S.fromJsonString(EffectSchemaInventoryRow);

/**
 * Decode one JSONL line as an inventory row in the Effect error channel.
 *
 * **Example** (Reject a malformed line)
 *
 * ```ts
 * import { decodeEffectSchemaInventoryRowJson } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runPromiseExit(decodeEffectSchemaInventoryRowJson("{}")).then((exit) => console.log(exit._tag)) // "Failure"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEffectSchemaInventoryRowJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<EffectSchemaInventoryRow, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<EffectSchemaInventoryRow, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(EffectSchemaInventoryRowJson));

/**
 * Decode one JSONL line as an inventory row, returning `O.none()` for anything else.
 *
 * **Example** (Ignore an unrelated record)
 *
 * ```ts
 * import { decodeEffectSchemaInventoryRowOption } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(decodeEffectSchemaInventoryRowOption('{"producer":"other"}'))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEffectSchemaInventoryRowOption: {
  (options?: AST.ParseOptions): (input: unknown) => O.Option<EffectSchemaInventoryRow>;
  (input: unknown, options?: AST.ParseOptions): O.Option<EffectSchemaInventoryRow>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownOption(EffectSchemaInventoryRowJson));

/**
 * Encode one row as its committed JSONL line, keys in contract order.
 *
 * **Example** (Encode a row)
 *
 * ```ts
 * import { EffectSchemaInventoryRow, encodeEffectSchemaInventoryRowJson } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const row = EffectSchemaInventoryRow.make({
 *   sha: "df77fff9396fe31de72d1947ecb5b74f8cee89e1", module: "effect/Schema", file: "packages/effect/src/Schema.ts",
 *   line: 1, symbol: "Top", kind: "interface", category: O.none(), since: O.none(), deprecated: false,
 *   internal: false, summary: "", hasExample: false, signature: "export interface Top", overloads: 0, importable: true
 * })
 * Effect.runPromise(encodeEffectSchemaInventoryRowJson(row)).then((line) => console.log(line.startsWith('{"sha":'))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEffectSchemaInventoryRowJson: {
  (options?: AST.ParseOptions): (input: EffectSchemaInventoryRow) => Effect.Effect<string, S.SchemaError>;
  (input: EffectSchemaInventoryRow, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeEffect(EffectSchemaInventoryRowJson));
