/**
 * Schema models for doctest fence analysis, marker planning, and reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Docgen/Doctest.schemas");

/**
 * Identifies a TypeScript fence and the JSDoc Example that owns it.
 *
 * **Example** (Locate a fence)
 *
 * ```ts
 * import { FenceLocation } from "@beep/repo-cli/commands/Docgen"
 *
 * const location = FenceLocation.make({
 *   file: "packages/example/src/index.ts",
 *   startLine: 12,
 *   endLine: 16,
 *   enclosingSymbol: "decodeName",
 *   exampleTitle: "Decode a name"
 * })
 * console.log(location.startLine)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FenceLocation extends S.Class<FenceLocation>($I`FenceLocation`)(
  {
    file: S.NonEmptyString,
    startLine: S.Natural,
    endLine: S.Natural,
    enclosingSymbol: S.optionalKey(S.NonEmptyString),
    exampleTitle: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("FenceLocation", {
    description: "Source location and JSDoc ownership of one TypeScript fence.",
  })
) {}

/**
 * Accepts the TypeScript fence language identifiers supported by docgen.
 *
 * **Example** (Decode a fence language)
 *
 * ```ts
 * import { FenceLanguage } from "@beep/repo-cli/commands/Docgen"
 * import * as S from "effect/Schema"
 *
 * const language = S.decodeUnknownSync(FenceLanguage)("tsx")
 * console.log(language)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FenceLanguage = LiteralKit(["ts", "typescript", "tsx"]).pipe(
  $I.annoteSchema("FenceLanguage", {
    description: "Fence info-string languages the doctest analyzer recognises.",
  })
);

/**
 * TypeScript fence language accepted by {@link FenceLanguage}.
 *
 * @see {@link FenceLanguage} for the runtime schema and accepted literals.
 * @category type-level
 * @since 0.0.0
 */
export type FenceLanguage = typeof FenceLanguage.Type;

/**
 * Records normalized metadata parsed from a TypeScript fence opener.
 *
 * **Example** (Describe a runnable fence)
 *
 * ```ts
 * import { FenceInfo } from "@beep/repo-cli/commands/Docgen"
 *
 * const info = FenceInfo.make({ lang: "ts", markerPresent: true, name: "Decode a name" })
 * console.log(info.markerPresent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FenceInfo extends S.Class<FenceInfo>($I`FenceInfo`)(
  {
    lang: FenceLanguage,
    markerPresent: S.Boolean,
    name: S.optionalKey(S.String),
  },
  $I.annote("FenceInfo", {
    description: "Normalized language, runnable marker, and optional doctest name.",
  })
) {}

/**
 * Enumerates the stable reasons that prevent a fence from running as a doctest.
 *
 * **Example** (Decode an impurity reason)
 *
 * ```ts
 * import { ImpurityReason } from "@beep/repo-cli/commands/Docgen"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(ImpurityReason)("network")
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImpurityReason = LiteralKit([
  "process-env",
  "node-import",
  "file-system",
  "network",
  "child-process",
  "bun-runtime",
  "database",
  "external-package-import",
  "relative-import",
  "jsx-react",
]).pipe(
  $I.annoteSchema("ImpurityReason", {
    description: "Stable reasons a fence is rejected by the purity classifier.",
  })
);

/**
 * Stable rejection reason decoded by {@link ImpurityReason}.
 *
 * @see {@link ImpurityReason} for the runtime schema and accepted literals.
 * @category type-level
 * @since 0.0.0
 */
export type ImpurityReason = typeof ImpurityReason.Type;

/**
 * Marks a fence whose code is safe for the runtime doctest lane.
 *
 * **Example** (Accept a pure fence)
 *
 * ```ts
 * import { PureFence } from "@beep/repo-cli/commands/Docgen"
 *
 * const verdict = PureFence.make({})
 * console.log(verdict._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PureFence extends S.TaggedClass<PureFence>($I`PureFence`)(
  "pure",
  {},
  $I.annote("PureFence", { description: "Fence accepted by the purity classifier." })
) {}

/**
 * Rejects a fence with a stable reason and the source text that triggered it.
 *
 * **Example** (Reject a network fence)
 *
 * ```ts
 * import { ImpureFence } from "@beep/repo-cli/commands/Docgen"
 *
 * const verdict = ImpureFence.make({ reason: "network", evidence: "fetch(" })
 * console.log(verdict.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImpureFence extends S.TaggedClass<ImpureFence>($I`ImpureFence`)(
  "impure",
  {
    reason: ImpurityReason,
    evidence: S.NonEmptyString,
  },
  $I.annote("ImpureFence", { description: "Fence rejected with a stable reason and evidence." })
) {}

/**
 * Marks a safe fence that contains no executable statements after type erasure.
 *
 * **Example** (Identify a type-only fence)
 *
 * ```ts
 * import { TypeOnlyFence } from "@beep/repo-cli/commands/Docgen"
 *
 * const verdict = TypeOnlyFence.make({})
 * console.log(verdict._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypeOnlyFence extends S.TaggedClass<TypeOnlyFence>($I`TypeOnlyFence`)(
  "typeOnly",
  {},
  $I.annote("TypeOnlyFence", {
    description: "Markable fence that becomes vacuous after TypeScript syntax is stripped.",
  })
) {}

/**
 * Decodes the complete result of classifying a fence for runtime doctesting.
 *
 * **Example** (Decode a purity verdict)
 *
 * ```ts
 * import { PurityVerdict } from "@beep/repo-cli/commands/Docgen"
 * import * as S from "effect/Schema"
 *
 * const verdict = S.decodeUnknownSync(PurityVerdict)({ _tag: "pure" })
 * console.log(verdict._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PurityVerdict = S.Union([PureFence, ImpureFence, TypeOnlyFence]).pipe(
  $I.annoteSchema("PurityVerdict", {
    description: "Pure, impure, or markable-but-vacuous classification.",
  })
);

/**
 * Classification produced by the {@link PurityVerdict} runtime schema.
 *
 * @see {@link PurityVerdict} for the runtime schema and union members.
 * @category type-level
 * @since 0.0.0
 */
export type PurityVerdict = typeof PurityVerdict.Type;

/**
 * Describes one safe conversion from a console observation to an inline assertion.
 *
 * **Example** (Plan an assertion rewrite)
 *
 * ```ts
 * import { ConsoleRewrite } from "@beep/repo-cli/commands/Docgen"
 *
 * const rewrite = ConsoleRewrite.make({ line: 8, expression: "1 + 1", expectedExpression: "2" })
 * console.log(rewrite.line)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConsoleRewrite extends S.Class<ConsoleRewrite>($I`ConsoleRewrite`)(
  {
    line: S.Natural,
    expression: S.NonEmptyString,
    expectedExpression: S.NonEmptyString,
  },
  $I.annote("ConsoleRewrite", {
    description: "One console observation replaced by an inline doctest assertion.",
  })
) {}

/**
 * Captures the idempotent metadata and assertion edits for one analyzed fence.
 *
 * **Example** (Plan a marker edit)
 *
 * ```ts
 * import { FenceLocation, MarkPlan } from "@beep/repo-cli/commands/Docgen"
 *
 * const plan = MarkPlan.make({
 *   location: FenceLocation.make({ file: "packages/example/src/index.ts", startLine: 4, endLine: 6 }),
 *   sourceDigest: "effect-hash:123",
 *   expectedInfoString: 'ts import.meta.vitest name="Add numbers"',
 *   addMarker: true,
 *   addName: "Add numbers",
 *   consoleRewrites: []
 * })
 * console.log(plan.addMarker)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkPlan extends S.Class<MarkPlan>($I`MarkPlan`)(
  {
    location: FenceLocation,
    sourceDigest: S.NonEmptyString,
    expectedInfoString: S.String,
    addMarker: S.Boolean,
    addName: S.optionalKey(S.NonEmptyString),
    consoleRewrites: S.Array(ConsoleRewrite),
  },
  $I.annote("MarkPlan", {
    description: "Idempotent marker, name, and assertion edits for one fence.",
  })
) {}

/**
 * Enumerates findings emitted while verifying or planning doctest fences.
 *
 * **Example** (Decode a finding kind)
 *
 * ```ts
 * import { DoctestFindingKind } from "@beep/repo-cli/commands/Docgen"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(DoctestFindingKind)("pure-unmarked")
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DoctestFindingKind = LiteralKit([
  "pure-unmarked",
  "marked-impure",
  "type-only",
  "invalid-assertion",
  "missing-example-title",
  "unnameable-example-title",
  "marker-metadata-drift",
  "console-rewrite",
]).pipe(
  $I.annoteSchema("DoctestFindingKind", {
    description: "Kinds of findings the doctest analyzer and verifier report.",
  })
);

/**
 * Finding identifier decoded by {@link DoctestFindingKind}.
 *
 * @see {@link DoctestFindingKind} for the runtime schema and accepted literals.
 * @category type-level
 * @since 0.0.0
 */
export type DoctestFindingKind = typeof DoctestFindingKind.Type;

/**
 * Carries one doctest result with its source location, classification, and optional edit plan.
 *
 * **Example** (Record a type-only finding)
 *
 * ```ts
 * import { DoctestFinding, FenceInfo, FenceLocation, TypeOnlyFence } from "@beep/repo-cli/commands/Docgen"
 *
 * const finding = DoctestFinding.make({
 *   kind: "type-only",
 *   location: FenceLocation.make({ file: "packages/example/src/index.ts", startLine: 4, endLine: 6 }),
 *   info: FenceInfo.make({ lang: "ts", markerPresent: false }),
 *   verdict: TypeOnlyFence.make({}),
 *   message: "The fence has no runtime statements."
 * })
 * console.log(finding.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DoctestFinding extends S.Class<DoctestFinding>($I`DoctestFinding`)(
  {
    kind: DoctestFindingKind,
    location: FenceLocation,
    info: FenceInfo,
    verdict: PurityVerdict,
    message: S.NonEmptyString,
    plan: S.optionalKey(MarkPlan),
  },
  $I.annote("DoctestFinding", { description: "One actionable or informational fence result." })
) {}

/**
 * Summarizes fence classifications, marker state, planned edits, and findings.
 *
 * **Example** (Count analyzed fences)
 *
 * ```ts
 * import { DoctestCounts } from "@beep/repo-cli/commands/Docgen"
 *
 * const counts = DoctestCounts.make({
 *   files: 1,
 *   fences: 2,
 *   pure: 1,
 *   impure: 0,
 *   typeOnly: 1,
 *   marked: 1,
 *   unmarked: 1,
 *   plannedMarkers: 1,
 *   plannedConsoleRewrites: 0,
 *   findings: 1
 * })
 * console.log(counts.fences)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DoctestCounts extends S.Class<DoctestCounts>($I`DoctestCounts`)(
  {
    files: S.Natural,
    fences: S.Natural,
    pure: S.Natural,
    impure: S.Natural,
    typeOnly: S.Natural,
    marked: S.Natural,
    unmarked: S.Natural,
    plannedMarkers: S.Natural,
    plannedConsoleRewrites: S.Natural,
    findings: S.Natural,
  },
  $I.annote("DoctestCounts", { description: "Aggregate counts for a doctest analysis." })
) {}

/**
 * Holds the decoded command options shared by doctest mark and verify operations.
 *
 * **Example** (Configure verification)
 *
 * ```ts
 * import { DoctestCliConfig } from "@beep/repo-cli/commands/Docgen"
 *
 * const config = DoctestCliConfig.make({ write: false, include: ["src/index.ts"], json: true })
 * console.log(config.write)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DoctestCliConfig extends S.Class<DoctestCliConfig>($I`DoctestCliConfig`)(
  {
    write: S.Boolean,
    filter: S.optionalKey(S.NonEmptyString),
    include: S.Array(S.NonEmptyString),
    json: S.Boolean,
  },
  $I.annote("DoctestCliConfig", {
    description: "Decoded --write, --filter, --include, and --json command configuration.",
  })
) {}

/**
 * Provides the machine-readable result of a doctest mark or verify run.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { DoctestCliConfig, DoctestCounts, DoctestReport } from "@beep/repo-cli/commands/Docgen"
 *
 * const report = DoctestReport.make({
 *   schemaVersion: "doctest-report/v1",
 *   config: DoctestCliConfig.make({ write: false, include: [], json: true }),
 *   counts: DoctestCounts.make({
 *     files: 0,
 *     fences: 0,
 *     pure: 0,
 *     impure: 0,
 *     typeOnly: 0,
 *     marked: 0,
 *     unmarked: 0,
 *     plannedMarkers: 0,
 *     plannedConsoleRewrites: 0,
 *     findings: 0
 *   }),
 *   findings: [],
 *   changedFiles: []
 * })
 * console.log(report.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DoctestReport extends S.Class<DoctestReport>($I`DoctestReport`)(
  {
    schemaVersion: S.Literal("doctest-report/v1"),
    config: DoctestCliConfig,
    counts: DoctestCounts,
    findings: S.Array(DoctestFinding),
    changedFiles: S.Array(S.NonEmptyString),
  },
  $I.annote("DoctestReport", {
    description: "Machine-readable mark or verify result.",
  })
) {}
