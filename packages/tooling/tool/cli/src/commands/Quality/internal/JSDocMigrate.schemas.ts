/**
 * Data-file schemas for the JSDoc legacy-carrier migration pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocMigrate.schemas");

const JSDocMigrateProxyHost = LiteralKit(["127.0.0.1", "[::1]"]);
const isJSDocMigrateProxyHost = S.is(JSDocMigrateProxyHost);

/**
 * Single-line model output that is safe to interpolate inside a JSDoc block.
 *
 * **Details**
 *
 * Line breaks and the closing comment delimiter are rejected at decode time,
 * before model output can reach the source rewriter.
 *
 * **Example** (Reject a comment breakout)
 *
 * ```ts
 * import { JSDocMigrateInlineText } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateInlineText)("Decode a value")) // true
 * console.log(S.is(JSDocMigrateInlineText)("Close *" + "/")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateInlineText = S.NonEmptyString.check(
  S.isPattern(/^(?!.*\*\/)[^\r\n]+$/u, {
    identifier: $I`JSDocMigrateInlineTextPattern`,
    title: "JSDoc migration inline text pattern",
    description: "Non-empty single-line text that cannot terminate a JSDoc comment.",
    message: "Expected single-line text without a closing comment delimiter",
  })
).pipe(
  $I.annoteSchema("JSDocMigrateInlineText", {
    description: "Model-produced inline text safe to interpolate into a JSDoc block.",
  })
);

/**
 * Model-produced inline text safe to interpolate into a JSDoc block.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateInlineText = typeof JSDocMigrateInlineText.Type;

/**
 * Loopback HTTP endpoint accepted by the JSDoc title migration proxy.
 *
 * **Example** (Reject a remote proxy)
 *
 * ```ts
 * import { JSDocMigrateProxyUrl } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateProxyUrl)(new URL("http://127.0.0.1:8317"))) // true
 * console.log(S.is(JSDocMigrateProxyUrl)(new URL("https://example.com"))) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateProxyUrl = S.URLFromString.pipe(
  S.check(
    S.makeFilter((url) => url.protocol === "http:" && isJSDocMigrateProxyHost(url.hostname), {
      identifier: $I`JSDocMigrateProxyUrlCheck`,
      title: "JSDoc migration loopback proxy URL",
      description: "An HTTP URL whose host is a literal IPv4 or IPv6 loopback address.",
      message: "Expected an HTTP proxy URL on 127.0.0.1 or [::1]",
    })
  ),
  $I.annoteSchema("JSDocMigrateProxyUrl", {
    description: "Loopback-only HTTP endpoint for the local JSDoc title migration proxy.",
  })
);

/**
 * Loopback-only HTTP endpoint for the local JSDoc title migration proxy.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateProxyUrl = typeof JSDocMigrateProxyUrl.Type;

/**
 * Classification of the declaration a migrated doc block binds to.
 *
 * **Details**
 *
 * The kind is a verification field: a frozen title or override record may only
 * be applied when its stored kind agrees with what ts-morph reports for the
 * block currently at the anchor, so a value-level record never lands on a
 * type-level companion. `module` marks fileoverview blocks and `detached`
 * marks comments ts-morph binds to no declaration.
 *
 * **Example** (Check a block kind)
 *
 * ```ts
 * import { JSDocMigrateBlockKind } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateBlockKind)("value")) // true
 * console.log(S.is(JSDocMigrateBlockKind)("function")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateBlockKind = LiteralKit(["value", "type-level", "module", "detached"]).pipe(
  $I.annoteSchema("JSDocMigrateBlockKind", {
    description: "Declaration kind a migrated JSDoc block binds to, used for fail-closed record verification.",
  })
);

/**
 * Declaration kind a migrated JSDoc block binds to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateBlockKind = typeof JSDocMigrateBlockKind.Type;

/**
 * Routing target for consumed `@remarks` content.
 *
 * **Example** (Validate a routing value)
 *
 * ```ts
 * import { JSDocMigrateRemarksRouting } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateRemarksRouting)("details")) // true
 * console.log(S.is(JSDocMigrateRemarksRouting)("summary")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateRemarksRouting = LiteralKit(["details", "gotchas"]).pipe(
  $I.annoteSchema("JSDocMigrateRemarksRouting", {
    description: "Body section that receives a consumed @remarks tag's content.",
  })
);

/**
 * Body section that receives a consumed `@remarks` tag's content.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateRemarksRouting = typeof JSDocMigrateRemarksRouting.Type;

/**
 * One affected doc block emitted by `beep quality jsdoc-migrate extract`.
 *
 * **Details**
 *
 * The anchor is `path#symbol#ordinal` and is used for addressing only; the
 * `sourceHash` (sha256 of the original block bytes) and `kind` are
 * verification fields that make freezing the downstream data files safe.
 * `blockText` carries the original block verbatim so the title pass and the
 * conservation law never need to re-read a moving working tree.
 *
 * **Example** (Construct an extract record)
 *
 * ```ts
 * import { JSDocMigrateExtractRecord } from "@beep/repo-cli/test/Quality"
 *
 * const record = JSDocMigrateExtractRecord.make({
 *   anchor: "packages/x/src/Y.ts#decode#0",
 *   filePath: "packages/x/src/Y.ts",
 *   symbol: "decode",
 *   ordinal: 0,
 *   kind: "value",
 *   sourceHash: "sha256:0000",
 *   start: 0,
 *   end: 40,
 *   blockText: "/** Doc. *" + "/",
 *   leadParagraphCount: 1,
 *   exampleTagCount: 1,
 *   unfencedExampleCount: 0,
 *   remarksTagCount: 0,
 *   undescribedSeeCount: 0
 * })
 * console.log(record.anchor) // "packages/x/src/Y.ts#decode#0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMigrateExtractRecord extends S.Class<JSDocMigrateExtractRecord>($I`JSDocMigrateExtractRecord`)(
  {
    anchor: S.String,
    filePath: S.String,
    symbol: S.String,
    ordinal: S.Int,
    kind: JSDocMigrateBlockKind,
    sourceHash: S.String,
    start: S.Int,
    end: S.Int,
    blockText: S.String,
    leadParagraphCount: S.Int,
    exampleTagCount: S.Int,
    unfencedExampleCount: S.Int,
    remarksTagCount: S.Int,
    undescribedSeeCount: S.Int,
  },
  $I.annote("JSDocMigrateExtractRecord", {
    description: "One affected JSDoc block: anchor, verification fields, and the original block bytes.",
  })
) {}

/**
 * One frozen title-pass record consumed by `jsdoc-migrate apply`.
 *
 * **Details**
 *
 * `titles` carries one Example title per `@example` tag in block order; it is
 * empty for blocks whose only legacy carrier is `@remarks`. `leadEnd` is the
 * number of lead paragraphs to keep; paragraphs after it move into
 * `**Details**`. `seePurposes` supplies one purpose phrase per undescribed
 * `@see`, in source order. The codemod adds no prose beyond these fields.
 *
 * **Example** (Construct a title record)
 *
 * ```ts
 * import { JSDocMigrateTitleRecord } from "@beep/repo-cli/test/Quality"
 *
 * const record = JSDocMigrateTitleRecord.make({
 *   anchor: "packages/x/src/Y.ts#decode#0",
 *   sourceHash: "sha256:0000",
 *   kind: "value",
 *   titles: ["Decode a user name"],
 *   remarks: "details"
 * })
 * console.log(record.titles[0]) // "Decode a user name"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMigrateTitleRecord extends S.Class<JSDocMigrateTitleRecord>($I`JSDocMigrateTitleRecord`)(
  {
    anchor: S.String,
    sourceHash: S.String,
    kind: JSDocMigrateBlockKind,
    titles: S.Array(JSDocMigrateInlineText),
    remarks: S.optionalKey(JSDocMigrateRemarksRouting),
    leadEnd: S.optionalKey(S.Int),
    seePurposes: S.Array(JSDocMigrateInlineText).pipe(S.optionalKey),
  },
  $I.annote("JSDocMigrateTitleRecord", {
    description: "Frozen per-anchor title-pass output: Example titles, remarks routing, lead split, see purposes.",
  })
) {}

/**
 * One frozen full-block replacement for a quarantined block.
 *
 * **Details**
 *
 * Overrides carry the same `anchor`/`sourceHash`/`kind` verification fields as
 * title records: a hand-authored replacement applied to the wrong declaration
 * is exactly as damaging as a mis-bound title, so apply fails closed on any
 * mismatch.
 *
 * **Example** (Construct an override record)
 *
 * ```ts
 * import { JSDocMigrateOverrideRecord } from "@beep/repo-cli/test/Quality"
 *
 * const record = JSDocMigrateOverrideRecord.make({
 *   anchor: "packages/x/src/Y.ts#thing#0",
 *   sourceHash: "sha256:9c02",
 *   kind: "value",
 *   block: "/** Rewritten. *" + "/"
 * })
 * console.log(record.kind) // "value"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMigrateOverrideRecord extends S.Class<JSDocMigrateOverrideRecord>($I`JSDocMigrateOverrideRecord`)(
  {
    anchor: S.String,
    sourceHash: S.String,
    kind: JSDocMigrateBlockKind,
    block: S.String,
  },
  $I.annote("JSDocMigrateOverrideRecord", {
    description: "Frozen full replacement block text for a quarantined JSDoc block.",
  })
) {}

/**
 * One block the codemod refused to rewrite, with its violation reasons.
 *
 * **Example** (Construct a quarantine record)
 *
 * ```ts
 * import { JSDocMigrateQuarantineRecord } from "@beep/repo-cli/test/Quality"
 *
 * const record = JSDocMigrateQuarantineRecord.make({
 *   anchor: "packages/x/src/Y.ts#thing#0",
 *   filePath: "packages/x/src/Y.ts",
 *   reasons: ["unfenced-example"]
 * })
 * console.log(record.reasons[0]) // "unfenced-example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMigrateQuarantineRecord extends S.Class<JSDocMigrateQuarantineRecord>(
  $I`JSDocMigrateQuarantineRecord`
)(
  {
    anchor: S.String,
    filePath: S.String,
    reasons: S.Array(S.String),
  },
  $I.annote("JSDocMigrateQuarantineRecord", {
    description: "One JSDoc block the codemod quarantined instead of writing, with violation reasons.",
  })
) {}

/**
 * Fail-closed binding verification result between frozen records and a live extract.
 *
 * **Details**
 *
 * All four arrays must be empty before apply writes anything: orphans on
 * either side catch additions and removals, hash mismatches catch reorders and
 * in-place edits where counts still match, and kind mismatches stop a
 * value-level record landing on a type-level companion.
 *
 * **Example** (Inspect a clean binding report)
 *
 * ```ts
 * import { JSDocMigrateBindingReport } from "@beep/repo-cli/test/Quality"
 *
 * const report = JSDocMigrateBindingReport.make({
 *   extractCount: 1,
 *   recordCount: 1,
 *   orphanRecordAnchors: [],
 *   unmatchedExtractAnchors: [],
 *   sourceHashMismatchAnchors: [],
 *   kindMismatchAnchors: []
 * })
 * console.log(report.extractCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMigrateBindingReport extends S.Class<JSDocMigrateBindingReport>($I`JSDocMigrateBindingReport`)(
  {
    extractCount: S.Int,
    recordCount: S.Int,
    orphanRecordAnchors: S.Array(S.String),
    unmatchedExtractAnchors: S.Array(S.String),
    sourceHashMismatchAnchors: S.Array(S.String),
    kindMismatchAnchors: S.Array(S.String),
  },
  $I.annote("JSDocMigrateBindingReport", {
    description: "Bijection, sourceHash, and kind agreement results between frozen records and a live extract.",
  })
) {}

/**
 * Pipeline mode recorded in the proof manifest.
 *
 * **Example** (Validate a mode)
 *
 * ```ts
 * import { JSDocMigrateMode } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateMode)("dry-run")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateMode = LiteralKit(["dry-run", "apply", "verify"]).pipe(
  $I.annoteSchema("JSDocMigrateMode", {
    description: "Which jsdoc-migrate pipeline stage produced a proof manifest.",
  })
);

/**
 * Which jsdoc-migrate pipeline stage produced a proof manifest.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateMode = typeof JSDocMigrateMode.Type;

/**
 * Schema-versioned conservation proof manifest for a jsdoc-migrate run.
 *
 * **Details**
 *
 * Follows the `DocgenProofManifest` / `AcceptedProofManifest` idiom: a
 * committed, decodable artifact that records exhaustive per-block results
 * rather than a sample. `quarantines` lists every block the codemod refused
 * to rewrite; the run is only clean when each quarantine is explained by an
 * override record.
 *
 * **Example** (Construct an empty manifest)
 *
 * ```ts
 * import { JSDocMigrateBindingReport, JSDocMigrateProofManifest } from "@beep/repo-cli/test/Quality"
 *
 * const manifest = JSDocMigrateProofManifest.make({
 *   schema_version: 1,
 *   generated_at: "2026-08-06T00:00:00.000Z",
 *   mode: "dry-run",
 *   files: 0,
 *   blocksAffected: 0,
 *   rewritten: 0,
 *   overridden: 0,
 *   quarantined: 0,
 *   conservationViolations: 0,
 *   shapeRegressions: 0,
 *   residueLegacyBlocks: 0,
 *   binding: JSDocMigrateBindingReport.make({
 *     extractCount: 0,
 *     recordCount: 0,
 *     orphanRecordAnchors: [],
 *     unmatchedExtractAnchors: [],
 *     sourceHashMismatchAnchors: [],
 *     kindMismatchAnchors: []
 *   }),
 *   quarantines: []
 * })
 * console.log(manifest.mode) // "dry-run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMigrateProofManifest extends S.Class<JSDocMigrateProofManifest>($I`JSDocMigrateProofManifest`)(
  {
    schema_version: S.Literal(1),
    generated_at: S.String,
    mode: JSDocMigrateMode,
    files: S.Int,
    blocksAffected: S.Int,
    rewritten: S.Int,
    overridden: S.Int,
    quarantined: S.Int,
    conservationViolations: S.Int,
    shapeRegressions: S.Int,
    residueLegacyBlocks: S.Int,
    binding: JSDocMigrateBindingReport,
    quarantines: S.Array(JSDocMigrateQuarantineRecord),
  },
  $I.annote("JSDocMigrateProofManifest", {
    description: "Schema-versioned exhaustive conservation and binding proof for a jsdoc-migrate run.",
  })
) {}

/**
 * Default repo-relative directory holding jsdoc-migrate data files.
 *
 * **Example** (Inspect the default data directory)
 *
 * ```ts
 * import { defaultJSDocMigrateDataDir } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateDataDir.startsWith("goals/")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateDataDir = "goals/jsdoc-carrier-migration/data";

/**
 * Default repo-relative path of the extract output.
 *
 * **Example** (Inspect the default extract path)
 *
 * ```ts
 * import { defaultJSDocMigrateExtractPath } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateExtractPath.endsWith("extract.jsonl")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateExtractPath = `${defaultJSDocMigrateDataDir}/extract.jsonl`;

/**
 * Default repo-relative path of the frozen title-pass output.
 *
 * **Example** (Inspect the default titles path)
 *
 * ```ts
 * import { defaultJSDocMigrateTitlesPath } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateTitlesPath.endsWith("titles.jsonl")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateTitlesPath = `${defaultJSDocMigrateDataDir}/titles.jsonl`;

/**
 * Default repo-relative path of the frozen override records.
 *
 * **Example** (Inspect the default overrides path)
 *
 * ```ts
 * import { defaultJSDocMigrateOverridesPath } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateOverridesPath.endsWith("overrides.jsonl")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateOverridesPath = `${defaultJSDocMigrateDataDir}/overrides.jsonl`;

/**
 * Default repo-relative path of the emitted proof manifest.
 *
 * **Example** (Inspect the default manifest path)
 *
 * ```ts
 * import { defaultJSDocMigrateManifestPath } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateManifestPath.endsWith(".jsonc")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateManifestPath = `${defaultJSDocMigrateDataDir}/jsdoc-migrate.proof-manifest.jsonc`;
