/**
 * Schema models for the Docgen quality report contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Struct } from "@beep/utils";
import { Order } from "effect";
import * as S from "effect/Schema";
import type { DocgenWorkspacePackage } from "../../Docgen.schemas.js";

const $I = $RepoCliId.create("commands/Docgen/internal/quality/Quality.schemas");

/**
 * Schema version emitted by `beep docgen quality` reports.
 *
 * @example
 * ```ts
 * import { QUALITY_SCHEMA_VERSION } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(QUALITY_SCHEMA_VERSION)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const QUALITY_SCHEMA_VERSION = 2 as const;

/**
 * Deterministic rubric version used by the local quality scorer.
 *
 * @example
 * ```ts
 * import { QUALITY_RUBRIC_VERSION } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(QUALITY_RUBRIC_VERSION)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const QUALITY_RUBRIC_VERSION = "jsdoc-quality-v1" as const;

/**
 * Scope mode supported by `docgen quality`.
 *
 * @example
 * ```ts
 * import { DocgenQualityScopeMode } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(DocgenQualityScopeMode.is.affected("affected"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityScopeMode = LiteralKit(["affected", "package", "changed-files", "all"]).pipe(
  $I.annoteSchema("DocgenQualityScopeMode", {
    description: "Scope mode supported by docgen quality.",
  })
);

/**
 * Scope mode supported by `docgen quality`.
 *
 * @example
 * ```ts
 * import type { DocgenQualityScopeMode } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const mode: DocgenQualityScopeMode = "affected"
 * console.log(mode)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityScopeMode = typeof DocgenQualityScopeMode.Type;

/**
 * Optional advisory scoring mode for `docgen quality`.
 *
 * @example
 * ```ts
 * import { DocgenQualityScoreMode } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(DocgenQualityScoreMode.is.rubric("rubric"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityScoreMode = LiteralKit(["none", "rubric", "codex"]).pipe(
  $I.annoteSchema("DocgenQualityScoreMode", {
    description: "Optional advisory scoring mode for docgen quality.",
  })
);

/**
 * Optional advisory scoring mode for `docgen quality`.
 *
 * @example
 * ```ts
 * import type { DocgenQualityScoreMode } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const mode: DocgenQualityScoreMode = "rubric"
 * console.log(mode)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityScoreMode = typeof DocgenQualityScoreMode.Type;

/**
 * Quality tier assigned to a JSDoc review subject.
 *
 * @example
 * ```ts
 * import { DocgenQualityTier } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(DocgenQualityTier.is.warn("warn"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityTier = LiteralKit(["pass", "warn", "fail"]).pipe(
  $I.annoteSchema("DocgenQualityTier", {
    description: "Quality tier assigned to a JSDoc review subject.",
  })
);

/**
 * Quality tier assigned to a JSDoc review subject.
 *
 * @example
 * ```ts
 * import type { DocgenQualityTier } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const tier: DocgenQualityTier = "warn"
 * console.log(tier)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityTier = typeof DocgenQualityTier.Type;

/**
 * Completion status for a package-local quality analysis.
 *
 * @example
 * ```ts
 * import { DocgenQualityPackageStatus } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(DocgenQualityPackageStatus.is.completed("completed"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityPackageStatus = LiteralKit(["completed", "partial", "failed"]).pipe(
  $I.annoteSchema("DocgenQualityPackageStatus", {
    description: "Completion status for a package-local docgen quality analysis.",
  })
);

/**
 * Completion status for a package-local quality analysis.
 *
 * @example
 * ```ts
 * import type { DocgenQualityPackageStatus } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const status: DocgenQualityPackageStatus = "completed"
 * console.log(status)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityPackageStatus = typeof DocgenQualityPackageStatus.Type;

/**
 * Typed finding code emitted by the v1 quality rubric.
 *
 * @example
 * ```ts
 * import { DocgenQualityFindingCode } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(DocgenQualityFindingCode.is["missing-example"]("missing-example"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenQualityFindingCode = LiteralKit([
  "missing-description",
  "missing-example",
  "missing-category",
  "missing-since",
  "invalid-category",
  "example-not-code-fenced",
  "example-too-trivial",
  "example-only-voids-result",
  "example-discards-result",
  "example-lacks-observable-result",
  "example-logs-export-symbol",
  "example-empty-effect-gen",
  "example-too-many-blank-lines",
  "missing-effects-for-effectful-symbol",
  "insufficient-agent-context",
]).pipe(
  $I.annoteSchema("DocgenQualityFindingCode", {
    description: "Typed finding code emitted by the v1 quality rubric.",
  })
);

/**
 * Typed finding code emitted by the v1 quality rubric.
 *
 * @example
 * ```ts
 * import type { DocgenQualityFindingCode } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const code: DocgenQualityFindingCode = "missing-example"
 * console.log(code)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenQualityFindingCode = typeof DocgenQualityFindingCode.Type;

/**
 * Single typed quality finding for one JSDoc subject.
 *
 * @example
 * ```ts
 * import { DocgenQualityFinding } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const finding = DocgenQualityFinding.make({
 *   code: "missing-example",
 *   tier: "fail",
 *   scoreImpact: 4,
 *   message: "JSDoc is missing required @example.",
 *   evidence: ["src/index.ts:10"],
 *   remediation: "Add a realistic @example."
 * })
 * console.log(finding.code)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityFinding extends S.Class<DocgenQualityFinding>($I`DocgenQualityFinding`)(
  {
    code: DocgenQualityFindingCode,
    tier: DocgenQualityTier,
    scoreImpact: S.Finite,
    message: S.String,
    evidence: S.Array(S.String),
    remediation: S.String,
  },
  $I.annote("DocgenQualityFinding", {
    description: "Single typed quality finding for one JSDoc subject.",
  })
) {}

/**
 * Nearby TypeScript diagnostic carried as quality-review evidence.
 *
 * @example
 * ```ts
 * import { DocgenQualityDiagnostic } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const diagnostic = DocgenQualityDiagnostic.make({
 *   category: "error",
 *   code: 2322,
 *   message: "Type mismatch",
 *   line: 12
 * })
 * console.log(diagnostic.code)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityDiagnostic extends S.Class<DocgenQualityDiagnostic>($I`DocgenQualityDiagnostic`)(
  {
    category: S.String,
    code: S.Finite,
    message: S.String,
    line: S.Finite,
  },
  $I.annote("DocgenQualityDiagnostic", {
    description: "Nearby TypeScript diagnostic carried as quality-review evidence.",
  })
) {}

/**
 * Nearby exported symbol carried as review context.
 *
 * @example
 * ```ts
 * import { DocgenRelatedSymbol } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const symbol = DocgenRelatedSymbol.make({
 *   name: "docgenCommand",
 *   kind: "const",
 *   line: 10,
 *   signature: "export const docgenCommand = Command.make(...)"
 * })
 * console.log(symbol.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenRelatedSymbol extends S.Class<DocgenRelatedSymbol>($I`DocgenRelatedSymbol`)(
  {
    name: S.String,
    kind: S.String,
    line: S.Finite,
    signature: S.String,
  },
  $I.annote("DocgenRelatedSymbol", {
    description: "Nearby exported symbol carried as review context.",
  })
) {}

/**
 * Stable evidence packet for one exported-symbol JSDoc quality review.
 *
 * @example
 * ```ts
 * import type { DocgenQualitySubject } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const subject: Pick<DocgenQualitySubject, "exportName"> = { exportName: "makeUser" }
 * console.log(subject.exportName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualitySubject extends S.Class<DocgenQualitySubject>($I`DocgenQualitySubject`)(
  {
    packageName: S.String,
    packagePath: S.String,
    filePath: S.String,
    repoPath: S.String,
    sourceAnchor: S.String,
    exportName: S.String,
    declarationKind: S.String,
    signature: S.String,
    declarationSource: S.String,
    rawJsDoc: S.String,
    description: S.NullOr(S.String),
    tags: S.Record(S.String, S.Array(S.String)),
    parsedExamples: S.Array(S.String),
    generatedDocSnippet: S.NullOr(S.String),
    stableIdentity: S.String,
    contentHash: S.String,
    diagnostics: S.Array(DocgenQualityDiagnostic),
    relatedSymbols: S.Array(DocgenRelatedSymbol),
    deterministicMissingTags: S.Array(S.String),
    categoryValues: S.Array(S.String),
    categoryIssues: S.Array(S.String),
  },
  $I.annote("DocgenQualitySubject", {
    description: "Stable evidence packet for one exported-symbol JSDoc quality review.",
  })
) {}

/**
 * Rubric outcome for one JSDoc quality subject.
 *
 * @example
 * ```ts
 * import { DocgenQualityReview } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const review = DocgenQualityReview.make({
 *   subjectId: "pkg:src/index.ts:const:thing:abc123",
 *   tier: "pass",
 *   score: 10,
 *   findings: [],
 *   rationale: "JSDoc block supplies the required metadata."
 * })
 * console.log(review.score)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityReview extends S.Class<DocgenQualityReview>($I`DocgenQualityReview`)(
  {
    subjectId: S.String,
    tier: DocgenQualityTier,
    score: S.Finite,
    findings: S.Array(DocgenQualityFinding),
    rationale: S.String,
  },
  $I.annote("DocgenQualityReview", {
    description: "Rubric outcome for one JSDoc quality subject.",
  })
) {}

/**
 * Aggregate summary for a JSDoc quality run.
 *
 * @example
 * ```ts
 * import { DocgenQualitySummary } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const summary = DocgenQualitySummary.make({
 *   packages: 1,
 *   subjects: 2,
 *   passing: 2,
 *   warnings: 0,
 *   failures: 0,
 *   remediationPackets: 0
 * })
 * console.log(summary.subjects)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualitySummary extends S.Class<DocgenQualitySummary>($I`DocgenQualitySummary`)(
  {
    packages: S.Finite,
    subjects: S.Finite,
    passing: S.Finite,
    warnings: S.Finite,
    failures: S.Finite,
    remediationPackets: S.Finite,
  },
  $I.annote("DocgenQualitySummary", {
    description: "Aggregate summary for a JSDoc quality run.",
  })
) {}

/**
 * Package-scoped JSDoc quality report.
 *
 * @example
 * ```ts
 * import {
 *   DocgenQualityPackageReport,
 *   DocgenQualitySummary
 * } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const report = DocgenQualityPackageReport.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   status: "completed",
 *   durationMs: 1,
 *   error: null,
 *   timedOut: false,
 *   omittedPacketCount: 0,
 *   subjects: [],
 *   reviews: [],
 *   summary: DocgenQualitySummary.make({
 *     packages: 1,
 *     subjects: 0,
 *     passing: 0,
 *     warnings: 0,
 *     failures: 0,
 *     remediationPackets: 0
 *   })
 * })
 * console.log(report.packagePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityPackageReport extends S.Class<DocgenQualityPackageReport>($I`DocgenQualityPackageReport`)(
  {
    packageName: S.String,
    packagePath: S.String,
    status: DocgenQualityPackageStatus,
    durationMs: S.Finite,
    error: S.NullOr(S.String),
    timedOut: S.Boolean,
    omittedPacketCount: S.Finite,
    subjects: S.Array(DocgenQualitySubject),
    reviews: S.Array(DocgenQualityReview),
    summary: DocgenQualitySummary,
  },
  $I.annote("DocgenQualityPackageReport", {
    description: "Package-scoped JSDoc quality report.",
  })
) {}

/**
 * Bounded advisory packet for future Codex remediation.
 *
 * @example
 * ```ts
 * import { DocgenQualityRemediationPacket } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const packet = DocgenQualityRemediationPacket.make({
 *   id: "abc123:jsdoc-quality",
 *   subjectId: "pkg:src/index.ts:const:thing:abc123",
 *   title: "Improve JSDoc for thing",
 *   prompt: "Add a realistic @example.",
 *   verificationCommand: "bun run beep docgen quality -p packages/tooling/tool/cli --json",
 *   verificationArgv: ["bun", "run", "beep", "docgen", "quality"]
 * })
 * console.log(packet.title)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityRemediationPacket extends S.Class<DocgenQualityRemediationPacket>(
  $I`DocgenQualityRemediationPacket`
)(
  {
    id: S.String,
    subjectId: S.String,
    title: S.String,
    prompt: S.String,
    verificationCommand: S.String,
    verificationArgv: S.Array(S.String),
  },
  $I.annote("DocgenQualityRemediationPacket", {
    description: "Bounded advisory packet for future Codex remediation.",
  })
) {}

/**
 * Consolidated report emitted by `beep docgen quality`.
 *
 * @example
 * ```ts
 * import type { DocgenQualityReport } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const report: Pick<DocgenQualityReport, "schemaVersion"> = { schemaVersion: 2 }
 * console.log(report.schemaVersion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityReport extends S.Class<DocgenQualityReport>($I`DocgenQualityReport`)(
  {
    schemaVersion: S.Literal(QUALITY_SCHEMA_VERSION),
    rubricVersion: S.String,
    generatedAt: S.String,
    scope: DocgenQualityScopeMode,
    scorer: S.String,
    summary: DocgenQualitySummary,
    packages: S.Array(DocgenQualityPackageReport),
    remediationPackets: S.Array(DocgenQualityRemediationPacket),
  },
  $I.annote("DocgenQualityReport", {
    description: "Consolidated report emitted by beep docgen quality.",
  })
) {}

/**
 * Pre-hash subject candidate collected before stable identity finalization.
 *
 * @example
 * ```ts
 * import type { DocgenQualitySubjectCandidate } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const candidate: Pick<DocgenQualitySubjectCandidate, "exportName" | "identityStem"> = {
 *   exportName: "docgenCommand",
 *   identityStem: "@beep/repo-cli:src/index.ts:const:docgenCommand"
 * }
 * console.log(candidate.exportName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenQualitySubjectCandidate extends S.Class<DocgenQualitySubjectCandidate>(
  $I`DocgenQualitySubjectCandidate`
)(
  {
    hashSourceText: S.String,
    identityStem: S.String,
    ...DocgenQualitySubject.mapFields(Struct.omit(["contentHash", "stableIdentity"])).fields,
  },
  $I.annote("DocgenQualitySubjectCandidate", {
    description: "Subject candidate for docgen quality analysis",
  })
) {}

/**
 * Stable ordering by workspace-relative package path for quality analysis.
 *
 * @example
 * ```ts
 * import { byPackagePathAscending } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(byPackagePathAscending)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const byPackagePathAscending: Order.Order<DocgenWorkspacePackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenWorkspacePackage) => pkg.relativePath
);

/**
 * Stable ordering by subject identity for deterministic quality reports.
 *
 * @example
 * ```ts
 * import { bySubjectIdentityAscending } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * console.log(bySubjectIdentityAscending)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const bySubjectIdentityAscending: Order.Order<DocgenQualitySubject> = Order.mapInput(
  Order.String,
  (subject: DocgenQualitySubject) => subject.stableIdentity
);
