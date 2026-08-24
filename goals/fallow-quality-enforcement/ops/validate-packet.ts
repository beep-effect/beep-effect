#!/usr/bin/env bun

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem, Inspectable, Layer, Path, pipe, Runtime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse, printParseErrorCode } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";

const $I = $RepoCliId.create("goals/fallow-quality-enforcement/ops/validate-packet");

class PacketValidationFailed extends S.TaggedError<PacketValidationFailed>($I`PacketValidationFailed`)(
  "PacketValidationFailed",
  {},
  $I.annote("PacketValidationFailed", {
    description: "Packet validation failed after its diagnostics were reported.",
  })
) {
  override readonly [Runtime.errorExitCode] = 1;
  override readonly [Runtime.errorReported] = false;
}

const validatorVersion = "fallow-quality-enforcement-validator/v1";
const effectSchemaAuthority = "goals/fallow-quality-enforcement/ops/validate-packet.ts";
const commandPattern = /^(?:bun|bunx|git|ruby|test|beep|fallow)(?:\s|$)/;
const repoRefPattern = /^(?:\.?[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/[A-Za-z0-9._-]+)*(?:#[A-Za-z0-9._/-]+)?$/;
const architectureDoctrineRefPattern =
  /^standards\/(?:ARCHITECTURE\.md|architecture\/[0-9]{2}-[A-Za-z0-9._-]+\.md)(?:#[A-Za-z0-9._/-]+)?$/;

const isTrimmedNonEmpty = (value: string): boolean => value.length > 0 && value === value.trim();

const PositiveInt = S.Int.check(
  S.isGreaterThan(0, {
    description: "A positive integer used for packet task ranking.",
    identifier: $I`PositiveIntCheck`,
    message: "Task rank must be greater than zero",
    title: "Positive Int",
  })
).pipe(
  $I.annoteSchema("PositiveInt", {
    description: "Positive integer schema for ordered packet tasks.",
  })
);

const TrimmedNonEmptyString = S.String.check(
  S.makeFilter((value) => isTrimmedNonEmpty(value) || "Expected a trimmed non-empty string.")
).pipe(
  $I.annoteSchema("TrimmedNonEmptyString", {
    description: "String value that cannot be empty or whitespace-only.",
  })
);

const RepoRefString = S.String.check(
  S.makeFilter((value) => (isTrimmedNonEmpty(value) && repoRefPattern.test(value)) || "Expected a repo-relative ref.")
).pipe(
  $I.annoteSchema("RepoRefString", {
    description: "Repository-relative path, markdown anchor, or checked-in evidence reference.",
  })
);

const ArchitectureDoctrineRefString = S.String.check(
  S.makeFilter(
    (value) =>
      (isTrimmedNonEmpty(value) && architectureDoctrineRefPattern.test(value)) ||
      "Expected a canonical architecture doctrine reference."
  )
).pipe(
  $I.annoteSchema("ArchitectureDoctrineRefString", {
    description:
      "Canonical architecture doctrine reference under standards/ARCHITECTURE.md or numbered architecture docs.",
  })
);

const CommandString = S.String.check(
  S.makeFilter(
    (value) => (isTrimmedNonEmpty(value) && commandPattern.test(value)) || "Expected a known repo command prefix."
  )
).pipe(
  $I.annoteSchema("CommandString", {
    description: "Command string tracked by the packet.",
  })
);

const UrlString = S.String.check(
  S.makeFilter((value) => /^https?:\/\//.test(value) || "Expected an HTTP(S) documentation URL.")
).pipe(
  $I.annoteSchema("UrlString", {
    description: "HTTP(S) documentation URL.",
  })
);

const OwnerString = S.String.check(
  S.makeFilter((value) => /^@[A-Za-z0-9._/-]+$/.test(value) || "Expected an owner handle starting with @.")
).pipe(
  $I.annoteSchema("OwnerString", {
    description: "Repository owner handle for packet accountability.",
  })
);

const FeatureFamily = LiteralKit([
  "audit",
  "dead-code",
  "health",
  "boundaries",
  "flags",
  "security",
  "fix-preview",
  "runtime-coverage",
  "editor-mcp-hooks",
]).pipe(
  $I.annoteSchema("FeatureFamily", {
    description: "Fallow feature family tracked by the quality-enforcement packet.",
  })
);

const RuleSourceClass = LiteralKit([
  "manifest-derived",
  "doctrine-pinned",
  "architecture-derived-hard-check",
  "review-gate-only",
  "tool-native",
  "external-service",
]).pipe(
  $I.annoteSchema("RuleSourceClass", {
    description: "Authority class for a Fallow rule candidate.",
  })
);

const BoundaryEnforcementScope = LiteralKit([
  "declared-dependency-consistency",
  "layer-legality",
  "architecture-legal-edge",
  "review-only",
]).pipe(
  $I.annoteSchema("BoundaryEnforcementScope", {
    description: "Semantic enforcement scope for Fallow boundary rule provenance.",
  })
);

const BaselineStatus = LiteralKit(["pending", "measured", "not-applicable", "blocked"]).pipe(
  $I.annoteSchema("BaselineStatus", {
    description: "Measurement status for a feature row baseline.",
  })
);

const FalsePositiveStatus = LiteralKit([
  "none-known",
  "waived-with-expiry",
  "config-gap",
  "tool-bug",
  "doctrine-gap",
  "unknown",
]).pipe(
  $I.annoteSchema("FalsePositiveStatus", {
    description: "Triage state for known false-positive risk.",
  })
);

const CiMode = LiteralKit(["none", "advisory-artifact", "warning-check", "blocking-check"]).pipe(
  $I.annoteSchema("CiMode", {
    description: "CI behavior for a Fallow feature row.",
  })
);

const PromotionStatus = LiteralKit([
  "research",
  "advisory",
  "candidate-blocking",
  "blocking",
  "deferred",
  "rejected",
]).pipe(
  $I.annoteSchema("PromotionStatus", {
    description: "Promotion state for a Fallow feature or parity row.",
  })
);

const RuntimeScope = LiteralKit(["static-only", "research-only", "pilot", "out-of-scope"]).pipe(
  $I.annoteSchema("RuntimeScope", {
    description: "Runtime participation scope for a feature row.",
  })
);

const QualityIssueCategory = LiteralKit(["repo-law", "security-audit", "parser-error", "command-failure"]).pipe(
  $I.annoteSchema("QualityIssueCategory", {
    description: "Yeet quality issue category used by Fallow mapping.",
  })
);

const KnipRemovalRecommendation = LiteralKit(["keep-knip", "eligible-to-retire", "undecided"]).pipe(
  $I.annoteSchema("KnipRemovalRecommendation", {
    description: "Whole-document Knip removal recommendation.",
  })
);

const GapStatus = LiteralKit(["parity", "fallow-gap", "knip-only", "repo-policy-gap", "unknown"]).pipe(
  $I.annoteSchema("GapStatus", {
    description: "Parity status for a Knip behavior row.",
  })
);

const RetirementDecision = LiteralKit(["research-pending", "keep-knip", "ready-to-retire-knip"]).pipe(
  $I.annoteSchema("RetirementDecision", {
    description: "Per-row Knip retirement decision.",
  })
);

const TaskStatus = LiteralKit(["seeded", "selected", "in-progress", "done", "deferred", "rejected", "blocked"]).pipe(
  $I.annoteSchema("TaskStatus", {
    description: "Status for a Fallow quality enforcement task.",
  })
);

const TaskPhase = LiteralKit(["P0", "P1", "P2", "P3"]).pipe(
  $I.annoteSchema("TaskPhase", {
    description: "Packet phase for a task.",
  })
);

const RepoCommandPhase = LiteralKit(["P1", "P2", "P3", "none"]).pipe(
  $I.annoteSchema("RepoCommandPhase", {
    description: "Packet phase in which a repo command target becomes available.",
  })
);

const CommandImplementationStatus = LiteralKit([
  "target-contract",
  "implemented",
  "compatibility-alias",
  "research-only",
]).pipe(
  $I.annoteSchema("CommandImplementationStatus", {
    description: "Whether a command target exists today or is a future packet contract.",
  })
);

const RiskLevel = LiteralKit(["low", "medium", "high"]).pipe(
  $I.annoteSchema("RiskLevel", {
    description: "Implementation risk level.",
  })
);

const DecisionGateStatus = LiteralKit(["open", "blocked", "passed", "failed"]).pipe(
  $I.annoteSchema("DecisionGateStatus", {
    description: "State of a task decision gate.",
  })
);

const AttributionMode = LiteralKit(["diff-introduced", "cleanup-on-touch", "research-only"]).pipe(
  $I.annoteSchema("AttributionMode", {
    description: "Finding attribution mode for a Fallow feature family.",
  })
);

const BasePolicy = LiteralKit(["origin-main-default", "github-pr-base", "github-push-before", "not-applicable"]).pipe(
  $I.annoteSchema("BasePolicy", {
    description: "Base reference policy for diff-aware Fallow commands.",
  })
);

const AdjacentFindingPolicy = LiteralKit(["review-inherited-adjacent", "ignore-inherited", "not-applicable"]).pipe(
  $I.annoteSchema("AdjacentFindingPolicy", {
    description: "Handling for inherited findings adjacent to touched policy surfaces.",
  })
);

const FindingAttributionKind = LiteralKit(["introduced", "inherited-adjacent", "not-applicable"]).pipe(
  $I.annoteSchema("FindingAttributionKind", {
    description: "Attribution class used in Fallow envelopes and Yeet issue fixtures.",
  })
);

const ResidualRiskLevel = LiteralKit(["low", "medium", "high"]).pipe(
  $I.annoteSchema("ResidualRiskLevel", {
    description: "Residual risk accepted by a waived critic finding.",
  })
);

const ReviewFindingSeverity = LiteralKit(["required", "nice-to-have"]).pipe(
  $I.annoteSchema("ReviewFindingSeverity", {
    description: "Severity for structured critic findings.",
  })
);

const ReviewClosureStatus = LiteralKit(["open", "fixed", "waived"]).pipe(
  $I.annoteSchema("ReviewClosureStatus", {
    description: "Closure status for structured critic findings.",
  })
);

const FallowEnvelopeStatus = LiteralKit([
  "ok",
  "tool-failed",
  "invalid-json",
  "invalid-report",
  "base-resolution-failed",
]).pipe(
  $I.annoteSchema("FallowEnvelopeStatus", {
    description: "Discriminant values for Fallow report envelopes.",
  })
);

class RepoCommandTarget extends S.Class<RepoCommandTarget>($I`RepoCommandTarget`)(
  {
    command: CommandString,
    phase: RepoCommandPhase,
    implementationStatus: CommandImplementationStatus,
    defaultOutputPath: RepoRefString,
  },
  $I.annote("RepoCommandTarget", {
    description: "Repo command surface targeted by a Fallow feature row.",
  })
) {}

class BaselineSummary extends S.Class<BaselineSummary>($I`BaselineSummary`)(
  {
    status: TrimmedNonEmptyString,
    counts: TrimmedNonEmptyString,
    notes: TrimmedNonEmptyString,
  },
  $I.annote("BaselineSummary", {
    description: "Human-readable measured baseline summary for a feature row.",
  })
) {}

const SuppressionClass = LiteralKit([
  "false-positive",
  "transitional-compatibility",
  "generated-code",
  "intentional-public-api",
  "accepted-duplication",
  "tool-threshold",
  "legacy-hotspot",
  "review-gate-only",
  "active-rollout",
  "migration-flag",
  "verified-false-positive",
  "covered-by-existing-security-lane",
  "unsafe-fix-preview",
  "license-deferred",
  "privacy-deferred",
  "integration-deferred",
]).pipe(
  $I.annoteSchema("SuppressionClass", {
    description: "Allowed suppression classes for packet policy.",
  })
);

class SuppressionPolicy extends S.Class<SuppressionPolicy>($I`SuppressionPolicy`)(
  {
    recordRequired: S.Boolean,
    allowedClasses: S.NonEmptyArray(SuppressionClass),
    inlineAllowed: S.Boolean,
    expiryRequired: S.Boolean,
  },
  $I.annote("SuppressionPolicy", {
    description: "Suppression policy for one Fallow feature family.",
  })
) {}

class BoundaryRuleSource extends S.Class<BoundaryRuleSource>($I`BoundaryRuleSource`)(
  {
    ruleId: TrimmedNonEmptyString,
    sourceClass: RuleSourceClass,
    enforcementScope: BoundaryEnforcementScope,
    sourceRefs: S.NonEmptyArray(RepoRefString),
    doctrineRefs: S.NonEmptyArray(ArchitectureDoctrineRefString),
    catalogRefs: S.Array(RepoRefString),
    promotionEligible: S.Boolean,
  },
  $I.annote("BoundaryRuleSource", {
    description: "Per-rule provenance for Fallow boundary enforcement candidates.",
  })
) {}

class AttributionPolicy extends S.Class<AttributionPolicy>($I`AttributionPolicy`)(
  {
    modes: S.NonEmptyArray(AttributionMode),
    basePolicy: BasePolicy,
    cleanupOnTouchTriggers: S.NonEmptyArray(TrimmedNonEmptyString),
    adjacentFindingPolicy: AdjacentFindingPolicy,
    reviewArtifactRefs: S.NonEmptyArray(RepoRefString),
  },
  $I.annote("AttributionPolicy", {
    description: "Diff attribution and cleanup-on-touch contract for a Fallow feature row.",
  })
) {}

class YeetMapping extends S.Class<YeetMapping>($I`YeetMapping`)(
  {
    category: QualityIssueCategory,
    parser: TrimmedNonEmptyString,
    subCategoryPrefix: TrimmedNonEmptyString,
    blockingDefault: S.Boolean,
    routingSkills: S.NonEmptyArray(TrimmedNonEmptyString),
  },
  $I.annote("YeetMapping", {
    description: "Mapping from Fallow findings into Yeet quality issue packets.",
  })
) {}

class FindingAttributionSummary extends S.Class<FindingAttributionSummary>($I`FindingAttributionSummary`)(
  {
    introduced: NonNegativeInt,
    inheritedAdjacent: NonNegativeInt,
    notApplicable: NonNegativeInt,
  },
  $I.annote("FindingAttributionSummary", {
    description: "Count summary for Fallow finding attribution.",
  })
) {}

class FallowReportFinding extends S.Class<FallowReportFinding>($I`FallowReportFinding`)(
  {
    id: TrimmedNonEmptyString,
    featureFamily: FeatureFamily,
    attribution: FindingAttributionKind,
    parser: TrimmedNonEmptyString,
    subCategory: TrimmedNonEmptyString,
    blocking: S.Boolean,
    sourceRef: RepoRefString,
  },
  $I.annote("FallowReportFinding", {
    description: "Normalized finding fixture inside a successful Fallow report envelope.",
  })
) {}

class FallowReportPayload extends S.Class<FallowReportPayload>($I`FallowReportPayload`)(
  {
    findingCount: NonNegativeInt,
    findings: S.Array(FallowReportFinding),
  },
  $I.annote("FallowReportPayload", {
    description: "Decoded Fallow report payload used by Yeet parser fixtures.",
  })
) {}

class YeetIssueFixture extends S.Class<YeetIssueFixture>($I`YeetIssueFixture`)(
  {
    id: TrimmedNonEmptyString,
    sourceFeature: FeatureFamily,
    sourceEnvelopeRef: RepoRefString,
    sourceFindingId: TrimmedNonEmptyString,
    tool: S.Literal("fallow"),
    parser: TrimmedNonEmptyString,
    subCategory: TrimmedNonEmptyString,
    blocking: S.Literal(false),
    attribution: FindingAttributionKind,
  },
  $I.annote("YeetIssueFixture", {
    description: "Fixture proving Fallow attribution survives Yeet quality issue mapping.",
  })
) {}

class PromotionCriteria extends S.Class<PromotionCriteria>($I`PromotionCriteria`)(
  {
    requiredCommands: S.NonEmptyArray(CommandString),
    requiredEvidenceRefs: S.NonEmptyArray(RepoRefString),
    requiredReviewerRoles: S.NonEmptyArray(TrimmedNonEmptyString),
    minimumCleanRuns: NonNegativeInt,
  },
  $I.annote("PromotionCriteria", {
    description: "Evidence gate required before a feature can be promoted.",
  })
) {}

class FeatureRow extends S.Class<FeatureRow>($I`FeatureRow`)(
  {
    id: TrimmedNonEmptyString,
    featureFamily: FeatureFamily,
    fallowDocsUrls: S.NonEmptyArray(UrlString),
    fallowCommand: CommandString,
    repoCommandTarget: RepoCommandTarget,
    configSurfaces: S.NonEmptyArray(RepoRefString),
    doctrineTargetRefs: S.NonEmptyArray(RepoRefString),
    ruleSourceClass: RuleSourceClass,
    boundaryRuleSources: S.Array(BoundaryRuleSource),
    attributionPolicy: AttributionPolicy,
    baselineStatus: BaselineStatus,
    baselineArtifact: RepoRefString,
    baselineSummary: BaselineSummary,
    falsePositiveStatus: FalsePositiveStatus,
    falsePositiveOwner: OwnerString,
    falsePositiveEvidence: S.NonEmptyArray(RepoRefString),
    suppressionPolicy: SuppressionPolicy,
    yeetMapping: YeetMapping,
    ciMode: CiMode,
    promotionStatus: PromotionStatus,
    promotionCriteria: PromotionCriteria,
    runtimeScope: RuntimeScope,
    owner: OwnerString,
    acceptanceCommands: S.NonEmptyArray(CommandString),
    rollbackNotes: TrimmedNonEmptyString,
    evidenceRefs: S.NonEmptyArray(RepoRefString),
  },
  $I.annote("FeatureRow", {
    description: "One feature-family row in the Fallow enforcement matrix.",
  })
) {}

class FeatureMatrixDocument extends S.Class<FeatureMatrixDocument>($I`FeatureMatrixDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/feature-matrix/v1"),
    updated: S.String,
    validatorVersion: S.Literal(validatorVersion),
    features: S.NonEmptyArray(FeatureRow),
  },
  $I.annote("FeatureMatrixDocument", {
    description: "Feature-family matrix for the Fallow quality enforcement goal.",
  })
) {}

class KnipParityRow extends S.Class<KnipParityRow>($I`KnipParityRow`)(
  {
    id: TrimmedNonEmptyString,
    knipConfigSurface: TrimmedNonEmptyString,
    currentKnipBehavior: TrimmedNonEmptyString,
    fallowEquivalent: TrimmedNonEmptyString,
    gapStatus: GapStatus,
    localKnipBaseline: RepoRefString,
    localFallowBaseline: RepoRefString,
    falsePositiveOwner: OwnerString,
    promotionStatus: PromotionStatus,
    retirementDecision: RetirementDecision,
    retirementRationale: TrimmedNonEmptyString,
    acceptanceCommands: S.NonEmptyArray(CommandString),
    evidenceRefs: S.NonEmptyArray(RepoRefString),
  },
  $I.annote("KnipParityRow", {
    description: "One parity row comparing a Knip behavior to Fallow.",
  })
) {}

class KnipParityDocument extends S.Class<KnipParityDocument>($I`KnipParityDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/knip-parity/v1"),
    updated: S.String,
    validatorVersion: S.Literal(validatorVersion),
    knipRemovalRecommendation: KnipRemovalRecommendation,
    rows: S.NonEmptyArray(KnipParityRow),
  },
  $I.annote("KnipParityDocument", {
    description: "Knip parity matrix for the Fallow quality enforcement goal.",
  })
) {}

class DecisionGate extends S.Class<DecisionGate>($I`DecisionGate`)(
  {
    kind: TrimmedNonEmptyString,
    status: DecisionGateStatus,
    evidence: S.NonEmptyArray(RepoRefString),
  },
  $I.annote("DecisionGate", {
    description: "Decision gate attached to a task.",
  })
) {}

class TaskRow extends S.Class<TaskRow>($I`TaskRow`)(
  {
    id: TrimmedNonEmptyString,
    rank: PositiveInt,
    status: TaskStatus,
    phase: TaskPhase,
    title: TrimmedNonEmptyString,
    summary: TrimmedNonEmptyString,
    implementationScope: S.NonEmptyArray(RepoRefString),
    proofCommands: S.NonEmptyArray(CommandString),
    acceptanceCommands: S.NonEmptyArray(CommandString),
    dependencies: S.Array(TrimmedNonEmptyString),
    rollbackPlan: TrimmedNonEmptyString,
    evidenceRefs: S.NonEmptyArray(RepoRefString),
    owner: OwnerString,
    riskLevel: RiskLevel,
    decisionGate: DecisionGate,
  },
  $I.annote("TaskRow", {
    description: "Implementation task row for the Fallow quality enforcement goal.",
  })
) {}

class TasksDocument extends S.Class<TasksDocument>($I`TasksDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/tasks/v1"),
    updated: S.String,
    validatorVersion: S.Literal(validatorVersion),
    tasks: S.NonEmptyArray(TaskRow),
  },
  $I.annote("TasksDocument", {
    description: "Task inventory for the Fallow quality enforcement goal.",
  })
) {}

const FallowReportBaseFields = {
  schemaVersion: S.Literal("fallow-report-envelope/v1"),
  toolVersion: TrimmedNonEmptyString,
  command: CommandString,
  subcommand: FeatureFamily,
  baseRef: TrimmedNonEmptyString,
  generatedAt: TrimmedNonEmptyString,
  advisory: S.Boolean,
  dirtyWorktree: S.Boolean,
  reportPath: RepoRefString,
  rawOutputRef: RepoRefString,
  attributionKinds: S.NonEmptyArray(FindingAttributionKind),
  findingAttributionSummary: FindingAttributionSummary,
};

class FallowReportBase extends S.Class<FallowReportBase>($I`FallowReportBase`)(
  FallowReportBaseFields,
  $I.annote("FallowReportBase", {
    description: "Common metadata required on every Fallow report envelope.",
  })
) {}

class FallowReportOk extends S.Class<FallowReportOk>($I`FallowReportOk`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("ok"),
    exitStatus: NonNegativeInt,
    report: FallowReportPayload,
  },
  $I.annote("FallowReportOk", {
    description: "Successful Fallow report envelope.",
  })
) {}

class FallowReportToolFailed extends S.Class<FallowReportToolFailed>($I`FallowReportToolFailed`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("tool-failed"),
    exitStatus: PositiveInt,
    stderrExcerpt: TrimmedNonEmptyString,
  },
  $I.annote("FallowReportToolFailed", {
    description: "Fallow report envelope for a nonzero Fallow tool exit.",
  })
) {}

class FallowReportInvalidJson extends S.Class<FallowReportInvalidJson>($I`FallowReportInvalidJson`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("invalid-json"),
    exitStatus: NonNegativeInt,
    stderrExcerpt: TrimmedNonEmptyString,
  },
  $I.annote("FallowReportInvalidJson", {
    description: "Fallow report envelope for invalid JSON emitted by Fallow.",
  })
) {}

class FallowReportInvalidReport extends S.Class<FallowReportInvalidReport>($I`FallowReportInvalidReport`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("invalid-report"),
    exitStatus: NonNegativeInt,
    stderrExcerpt: TrimmedNonEmptyString,
  },
  $I.annote("FallowReportInvalidReport", {
    description: "Fallow report envelope for decoded JSON that fails the expected feature report shape.",
  })
) {}

class FallowReportBaseResolutionFailed extends S.Class<FallowReportBaseResolutionFailed>(
  $I`FallowReportBaseResolutionFailed`
)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("base-resolution-failed"),
    exitStatus: PositiveInt,
    stderrExcerpt: TrimmedNonEmptyString,
  },
  $I.annote("FallowReportBaseResolutionFailed", {
    description: "Fallow report envelope for an unresolved comparison base ref.",
  })
) {}

const FallowReportEnvelope = S.Union([
  FallowReportOk,
  FallowReportToolFailed,
  FallowReportInvalidJson,
  FallowReportInvalidReport,
  FallowReportBaseResolutionFailed,
]).pipe(
  $I.annoteSchema("FallowReportEnvelope", {
    description: "Internal decoded discriminated union for repo-cli Fallow output.",
  })
);

class ReportFixtureDocument extends S.Class<ReportFixtureDocument>($I`ReportFixtureDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/report-fixtures/v1"),
    updated: S.String,
    validatorVersion: S.Literal(validatorVersion),
    fixtures: S.NonEmptyArray(FallowReportEnvelope),
    yeetIssueFixtures: S.NonEmptyArray(YeetIssueFixture),
  },
  $I.annote("ReportFixtureDocument", {
    description: "Fixture set proving each Fallow report envelope variant decodes.",
  })
) {}

class ReviewWaiver extends S.Class<ReviewWaiver>($I`ReviewWaiver`)(
  {
    owner: OwnerString,
    sourceStandardRefs: S.NonEmptyArray(RepoRefString),
    rationale: TrimmedNonEmptyString,
    expiresOrReviewBy: TrimmedNonEmptyString,
    residualRisk: ResidualRiskLevel,
    approver: OwnerString,
    acceptanceEvidenceRefs: S.NonEmptyArray(RepoRefString),
  },
  $I.annote("ReviewWaiver", {
    description: "Required evidence for waiving a critic finding.",
  })
) {}

class ReviewFinding extends S.Class<ReviewFinding>($I`ReviewFinding`)(
  {
    id: TrimmedNonEmptyString,
    severity: ReviewFindingSeverity,
    title: TrimmedNonEmptyString,
    sourceRefs: S.NonEmptyArray(RepoRefString),
    concreteFix: TrimmedNonEmptyString,
    closureStatus: ReviewClosureStatus,
    closureEvidenceRefs: S.NonEmptyArray(RepoRefString),
    waiver: S.optionalKey(ReviewWaiver),
  },
  $I.annote("ReviewFinding", {
    description: "Structured critic finding and closure record.",
  })
) {}

class GeneratedBoundaryRule extends S.Class<GeneratedBoundaryRule>($I`GeneratedBoundaryRule`)(
  {
    from: TrimmedNonEmptyString,
    allow: S.Array(TrimmedNonEmptyString),
    allowTypeOnly: S.Array(TrimmedNonEmptyString),
  },
  $I.annote("GeneratedBoundaryRule", {
    description: "Minimal generated Fallow boundary rule shape.",
  })
) {}

class GeneratedBoundaryConfigBoundaries extends S.Class<GeneratedBoundaryConfigBoundaries>(
  $I`GeneratedBoundaryConfigBoundaries`
)(
  {
    rules: S.NonEmptyArray(GeneratedBoundaryRule),
  },
  $I.annote("GeneratedBoundaryConfigBoundaries", {
    description: "Generated Fallow boundary config boundaries section.",
  })
) {}

class GeneratedBoundaryConfig extends S.Class<GeneratedBoundaryConfig>($I`GeneratedBoundaryConfig`)(
  {
    boundaries: GeneratedBoundaryConfigBoundaries,
  },
  $I.annote("GeneratedBoundaryConfig", {
    description: "Minimal generated Fallow boundary config used for provenance checks.",
  })
) {}

class BoundaryGeneratedRuleProvenance extends S.Class<BoundaryGeneratedRuleProvenance>(
  $I`BoundaryGeneratedRuleProvenance`
)(
  {
    ruleId: TrimmedNonEmptyString,
    generatedRuleFrom: TrimmedNonEmptyString,
    sourceClass: RuleSourceClass,
    enforcementScope: BoundaryEnforcementScope,
    sourceRefs: S.NonEmptyArray(RepoRefString),
    doctrineRefs: S.NonEmptyArray(ArchitectureDoctrineRefString),
    catalogRefs: S.Array(RepoRefString),
    promotionEligible: S.Boolean,
  },
  $I.annote("BoundaryGeneratedRuleProvenance", {
    description: "Per-generated-rule provenance sidecar entry for Fallow boundary rules.",
  })
) {}

class BoundaryProvenanceDocument extends S.Class<BoundaryProvenanceDocument>($I`BoundaryProvenanceDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/boundary-provenance/v1"),
    updated: S.String,
    validatorVersion: S.Literal(validatorVersion),
    generatedConfigRef: S.Literal("standards/fallow.boundaries.generated.jsonc"),
    rules: S.NonEmptyArray(BoundaryGeneratedRuleProvenance),
  },
  $I.annote("BoundaryProvenanceDocument", {
    description: "Sidecar provenance records for every generated Fallow boundary rule.",
  })
) {}

class ReviewRound extends S.Class<ReviewRound>($I`ReviewRound`)(
  {
    roundId: TrimmedNonEmptyString,
    criticId: TrimmedNonEmptyString,
    criticRole: TrimmedNonEmptyString,
    requiredFindingCount: NonNegativeInt,
    openRequiredFindingCount: NonNegativeInt,
    findings: S.Array(ReviewFinding),
    acceptanceCommands: S.NonEmptyArray(CommandString),
  },
  $I.annote("ReviewRound", {
    description: "One critic round in the packet review/fix loop.",
  })
) {}

class ReviewRoundsDocument extends S.Class<ReviewRoundsDocument>($I`ReviewRoundsDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/review-rounds/v1"),
    updated: S.String,
    validatorVersion: S.Literal(validatorVersion),
    rounds: S.NonEmptyArray(ReviewRound),
  },
  $I.annote("ReviewRoundsDocument", {
    description: "Structured review/fix-loop inventory for the packet.",
  })
) {}

class SchemaCompanionDocument extends S.Class<SchemaCompanionDocument>($I`SchemaCompanionDocument`)(
  {
    $schema: S.String,
    $id: S.String,
    title: S.String,
    type: S.Literal("object"),
    required: S.Array(S.String),
    properties: S.Record(S.String, S.Unknown),
    additionalProperties: S.Literal(false),
    "x-effectSchemaAuthority": S.Literal(effectSchemaAuthority),
    "x-requiredFields": S.Array(S.String),
    "x-enumValues": S.Record(S.String, S.Array(S.String)),
    "x-rowRequiredFields": S.optionalKey(S.Array(S.String)),
  },
  $I.annote("SchemaCompanionDocument", {
    description: "JSON Schema companion metadata checked against Effect Schema constants.",
  })
) {}

class InitiativeManifestSummary extends S.Class<InitiativeManifestSummary>($I`InitiativeManifestSummary`)(
  {
    id: TrimmedNonEmptyString,
    title: TrimmedNonEmptyString,
    status: TrimmedNonEmptyString,
    created: TrimmedNonEmptyString,
    updated: TrimmedNonEmptyString,
    packetAnchorDocument: RepoRefString,
  },
  $I.annote("InitiativeManifestSummary", {
    description: "Initiative metadata for the Fallow packet manifest.",
  })
) {}

class InitiativeManifestPackage extends S.Class<InitiativeManifestPackage>($I`InitiativeManifestPackage`)(
  {
    name: TrimmedNonEmptyString,
    path: RepoRefString,
    family: TrimmedNonEmptyString,
    kind: TrimmedNonEmptyString,
    role: TrimmedNonEmptyString,
  },
  $I.annote("InitiativeManifestPackage", {
    description: "Package touched by the Fallow packet.",
  })
) {}

class InitiativeManifestDecisions extends S.Class<InitiativeManifestDecisions>($I`InitiativeManifestDecisions`)(
  {
    branch: TrimmedNonEmptyString,
    operatorSurface: TrimmedNonEmptyString,
    ciPosture: TrimmedNonEmptyString,
    knipEndgame: TrimmedNonEmptyString,
    runtimeCoverage: TrimmedNonEmptyString,
    autofix: TrimmedNonEmptyString,
    doctrineRole: TrimmedNonEmptyString,
  },
  $I.annote("InitiativeManifestDecisions", {
    description: "High-level decisions recorded in the packet manifest.",
  })
) {}

class InitiativeManifestDocument extends S.Class<InitiativeManifestDocument>($I`InitiativeManifestDocument`)(
  {
    schemaVersion: S.Literal("initiative-manifest/v1"),
    initiative: InitiativeManifestSummary,
    mission: TrimmedNonEmptyString,
    currentSourceOfTruth: RepoRefString,
    currentTargetPhase: TaskPhase,
    requiredArtifacts: S.NonEmptyArray(RepoRefString),
    packages: S.NonEmptyArray(InitiativeManifestPackage),
    verification: S.NonEmptyArray(CommandString),
    decisions: InitiativeManifestDecisions,
  },
  $I.annote("InitiativeManifestDocument", {
    description: "Machine-readable manifest for the Fallow quality enforcement packet.",
  })
) {}

const decodeFeatureMatrixDocument = S.decodeUnknownEffect(FeatureMatrixDocument);
const decodeKnipParityDocument = S.decodeUnknownEffect(KnipParityDocument);
const decodeTasksDocument = S.decodeUnknownEffect(TasksDocument);
const decodeReportFixtureDocument = S.decodeUnknownEffect(ReportFixtureDocument);
const decodeReviewRoundsDocument = S.decodeUnknownEffect(ReviewRoundsDocument);
const decodeGeneratedBoundaryConfig = S.decodeUnknownEffect(GeneratedBoundaryConfig);
const decodeBoundaryProvenanceDocument = S.decodeUnknownEffect(BoundaryProvenanceDocument);
const decodeSchemaCompanionDocument = S.decodeUnknownEffect(SchemaCompanionDocument);
const decodeInitiativeManifestDocument = S.decodeUnknownEffect(InitiativeManifestDocument);

const expectedFeatureFamilies = FeatureFamily.Options;
const expectedKnipSurfaces = [
  "entry",
  "project",
  "ignore",
  "ignoreDependencies",
  "ignoreBinaries",
  "ignoreWorkspaces",
  "rules.catalog",
  "rules.duplicates",
  "workspaces",
  "plugins",
  "reporter",
];
const promotedStatuses = ["candidate-blocking", "blocking"];
const unresolvedFalsePositiveStatuses = ["unknown", "config-gap", "tool-bug", "doctrine-gap"];
const featureMatrixRootRequired = ["$schema", "schemaVersion", "updated", "validatorVersion", "features"];
const featureRowRequired = [
  "id",
  "featureFamily",
  "fallowDocsUrls",
  "fallowCommand",
  "repoCommandTarget",
  "configSurfaces",
  "doctrineTargetRefs",
  "ruleSourceClass",
  "boundaryRuleSources",
  "attributionPolicy",
  "baselineStatus",
  "baselineArtifact",
  "baselineSummary",
  "falsePositiveStatus",
  "falsePositiveOwner",
  "falsePositiveEvidence",
  "suppressionPolicy",
  "yeetMapping",
  "ciMode",
  "promotionStatus",
  "promotionCriteria",
  "runtimeScope",
  "owner",
  "acceptanceCommands",
  "rollbackNotes",
  "evidenceRefs",
];
const knipParityRootRequired = [
  "$schema",
  "schemaVersion",
  "updated",
  "validatorVersion",
  "knipRemovalRecommendation",
  "rows",
];
const knipParityRowRequired = [
  "id",
  "knipConfigSurface",
  "currentKnipBehavior",
  "fallowEquivalent",
  "gapStatus",
  "localKnipBaseline",
  "localFallowBaseline",
  "falsePositiveOwner",
  "promotionStatus",
  "retirementDecision",
  "retirementRationale",
  "acceptanceCommands",
  "evidenceRefs",
];
const taskRootRequired = ["$schema", "schemaVersion", "updated", "validatorVersion", "tasks"];
const taskRowRequired = [
  "id",
  "rank",
  "status",
  "phase",
  "title",
  "summary",
  "implementationScope",
  "proofCommands",
  "acceptanceCommands",
  "dependencies",
  "rollbackPlan",
  "evidenceRefs",
  "owner",
  "riskLevel",
  "decisionGate",
];
const reportFixtureRootRequired = [
  "$schema",
  "schemaVersion",
  "updated",
  "validatorVersion",
  "fixtures",
  "yeetIssueFixtures",
];
const reviewRoundsRootRequired = ["$schema", "schemaVersion", "updated", "validatorVersion", "rounds"];
const reportFixtureItemRequired = [
  "schemaVersion",
  "toolVersion",
  "command",
  "subcommand",
  "baseRef",
  "generatedAt",
  "advisory",
  "dirtyWorktree",
  "reportPath",
  "rawOutputRef",
  "attributionKinds",
  "findingAttributionSummary",
  "status",
  "exitStatus",
];
const yeetIssueFixtureItemRequired = [
  "id",
  "sourceFeature",
  "sourceEnvelopeRef",
  "sourceFindingId",
  "tool",
  "parser",
  "subCategory",
  "blocking",
  "attribution",
];
const boundaryProvenanceRootRequired = [
  "$schema",
  "schemaVersion",
  "updated",
  "validatorVersion",
  "generatedConfigRef",
  "rules",
];
const boundaryProvenanceRowRequired = [
  "ruleId",
  "generatedRuleFrom",
  "sourceClass",
  "enforcementScope",
  "sourceRefs",
  "doctrineRefs",
  "catalogRefs",
  "promotionEligible",
];
const reviewRoundItemRequired = [
  "roundId",
  "criticId",
  "criticRole",
  "requiredFindingCount",
  "openRequiredFindingCount",
  "findings",
  "acceptanceCommands",
];
const manifestRootRequired = [
  "schemaVersion",
  "initiative",
  "mission",
  "currentSourceOfTruth",
  "currentTargetPhase",
  "requiredArtifacts",
  "packages",
  "verification",
  "decisions",
];
const reportEnvelopeStatuses = FallowEnvelopeStatus.Options;
const reportEnvelopeSharedKeys = [
  "schemaVersion",
  "toolVersion",
  "command",
  "subcommand",
  "baseRef",
  "generatedAt",
  "advisory",
  "dirtyWorktree",
  "reportPath",
  "rawOutputRef",
  "attributionKinds",
  "findingAttributionSummary",
  "status",
  "exitStatus",
];
const reportEnvelopeOkKeys = [...reportEnvelopeSharedKeys, "report"];
const reportEnvelopeFailureKeys = [...reportEnvelopeSharedKeys, "stderrExcerpt"];
const blockingPromotionCommand = "bun run audit:github pre-push";
const canonicalFallowCommandPrefix = "beep quality fallow ";
const staleKnipBlockingPhrase = "Knip as blocking gate";
const expectedFallowCommandSubcommands = [
  "audit",
  "dead-code",
  "health",
  "boundaries",
  "flags",
  "security",
  "fix-preview",
];
const fallowCommandContractCommand =
  "bun run beep quality fallow command-contract-check --assert audit,dead-code,health,boundaries,flags,security,fix-preview --require-envelope --out-dir .beep/fallow";
const fallowBoundaryConfigCheckCommand = "bun run beep quality fallow boundaries config-check --check";
const fallowAuditBaselineCommand = "bun goals/fallow-quality-enforcement/ops/validate-fallow-audit-baseline.ts";
const knipParityBaselineCommand = "bun goals/fallow-quality-enforcement/ops/validate-knip-parity-baselines.ts";
const knownNonzeroRawAcceptanceCommands = [
  "bun run fallow:audit -- --base origin/main --gate new-only",
  "bun run fallow:dead-code:json -- --summary",
  "bun run knip --reporter json",
];
const yeetPlanContractCommand =
  'bun run beep yeet verify --plan --json | bun run beep yeet plan-contract-check --from-stdin --expect-step-id advisory:01-fallow-feedback --expect-step-label fallow-advisory-feedback --expect-command bun --expect-args "run beep yeet fallow-feedback --from .beep/fallow --emit .beep/yeet/fallow-quality-issues.json --advisory"';
const yeetPublishAdvisoryPlanContractCommand =
  'bun run beep yeet publish --message "chore(fallow): advisory plan proof" --plan --json | bun run beep yeet plan-contract-check --from-stdin --expect-step-id advisory:01-fallow-feedback --expect-step-label fallow-advisory-feedback --expect-command bun --expect-args "run beep yeet fallow-feedback --from .beep/fallow --emit .beep/yeet/fallow-quality-issues.json --advisory"';
const yeetPublishPlanContractCommand =
  'bun run beep yeet publish --message "chore(fallow): plan proof" --plan --json | bun run beep yeet plan-contract-check --from-stdin --expect-step-id full:01-pre-push --expect-step-label full:pre-push --expect-command bun --expect-args "run beep quality github-checks pre-push"';
const yeetFallowFixtureCheckCommand =
  "bun run beep yeet fallow-fixture-check goals/fallow-quality-enforcement/reports/report-envelope-fixtures.jsonc --emit .beep/yeet/fallow-quality-issues.json --assert QualityIssueIndex,tool=fallow,blocking=false,attribution";
const yeetPackageCheckCommand = "bun run --cwd packages/tooling/tool/cli check";
const requiredLatestReviewAcceptanceCommands = [
  yeetPackageCheckCommand,
  yeetPlanContractCommand,
  yeetPublishAdvisoryPlanContractCommand,
  yeetFallowFixtureCheckCommand,
] as const;
const githubChecksPlanContractCommand =
  "bun run beep quality github-checks plan-contract-check --mode pre-push --feature-matrix goals/fallow-quality-enforcement/research/feature-matrix.jsonc --expect-promoted-fallow-lanes";
const ciFallowContractCommand =
  "bun run beep quality fallow ci-contract-check .github/workflows/check.yml --expect-lanes health,boundaries,flags,security,fix-preview --expect-blocking-lanes audit,dead-code --expect-out-dir .beep/fallow --require-upload --if-no-files-found error --advisory";
const expectedFallowAuditBaseline = {
  changedFilesMinimum: 90,
  deadCodeIssues: 30,
  complexityFindings: 37,
  duplicationCloneGroups: 143,
  deadCodeIntroduced: 3,
  deadCodeInherited: 27,
  complexityIntroduced: 6,
  complexityInherited: 30,
  complexityUnattributed: 1,
  duplicationIntroduced: 3,
  duplicationInherited: 140,
} as const;
const auditCountsNarrative =
  "Counts: at least 90 changed files in the current dirty worktree, verdict `fail`, 30 changed-scope dead-code issues, 37 raw complexity findings, 143 duplication clone groups";
const auditAttributionNarrative =
  "Attribution: 3 introduced dead-code issues, 6 introduced complexity findings, 3 introduced duplication clone groups; 37 raw complexity findings = 6 introduced + 30 inherited + 1 unattributed";
const auditBaselineSummaryCounts =
  "Post-remediation audit against origin/main passes under the new-only gate with 0 dead-code issues and 0 introduced dead-code, complexity, or duplication findings (goals/fallow-zero-dead-code).";
const requiredBoundarySourceRefs = ["package.json", "standards/fallow.boundaries.generated.jsonc"];
const requiredBoundaryDoctrineRefPrefix = "standards/ARCHITECTURE.md";
const requiredResearchReportArtifacts = [
  "research/audit.md",
  "research/dead-code.md",
  "research/health.md",
  "research/boundaries.md",
  "research/flags.md",
  "research/security.md",
  "research/fix-preview.md",
  "research/runtime-coverage.md",
  "research/editor-mcp-hooks.md",
];
const requiredResearchReportSections = [
  "## Summary",
  "## Baseline",
  "## Repo Fit",
  "## False Positives And Suppressions",
  "## Yeet And CI",
  "## Promotion Gate",
];
const requiredManifestArtifacts = [
  "research/feature-matrix.jsonc",
  "research/knip-parity.jsonc",
  ...requiredResearchReportArtifacts,
  "tasks/tasks.jsonc",
  "reports/report-envelope-fixtures.jsonc",
  "history/review-rounds.jsonc",
  "ops/validate-packet.ts",
  "ops/validate-fallow-audit-baseline.ts",
  "ops/validate-knip-parity-baselines.ts",
  "research/feature-matrix.schema.json",
  "research/knip-parity.schema.json",
  "tasks/tasks.schema.json",
  "reports/report-envelope-fixtures.schema.json",
  "history/review-rounds.schema.json",
  "standards/fallow.pilot.inventory.jsonc",
  "standards/fallow.dead-code.regression-baseline.jsonc",
  "standards/fallow.boundaries.generated.jsonc",
  "standards/fallow.boundaries.provenance.jsonc",
  "standards/fallow.boundaries.provenance.schema.json",
];
const requiredManifestVerificationFragments = [
  ['test "$(wc -m < goals/fallow-quality-enforcement/GOAL.md)" -le 4000'],
  ["bun goals/fallow-quality-enforcement/ops/validate-packet.ts"],
  ["bun goals/fallow-quality-enforcement/ops/validate-fallow-audit-baseline.ts"],
  ["bun goals/fallow-quality-enforcement/ops/validate-knip-parity-baselines.ts"],
  [
    "bunx biome check",
    "goals/fallow-quality-enforcement",
    "standards/fallow.pilot.inventory.jsonc",
    "standards/fallow.dead-code.regression-baseline.jsonc",
    "standards/fallow.boundaries.generated.jsonc",
    "standards/fallow.boundaries.provenance.jsonc",
    "standards/fallow.boundaries.provenance.schema.json",
  ],
  [
    "git diff --check -- goals/fallow-quality-enforcement standards/fallow.pilot.inventory.jsonc standards/fallow.dead-code.regression-baseline.jsonc standards/fallow.boundaries.generated.jsonc standards/fallow.boundaries.provenance.jsonc standards/fallow.boundaries.provenance.schema.json",
  ],
];
const cleanupOnTouchTriggerSet = [
  "package-manifest",
  "export-map",
  "boundary-sensitive-import",
  "ownership-doc",
  "config-or-layer-surface",
  "architecture-example",
];

const parseErrorsMessage = (filePath: string, errors: ReadonlyArray<ParseError>): string =>
  `${filePath}: JSONC parse failed: ${A.join(
    A.map(errors, (error) => `${printParseErrorCode(error.error)} at ${error.offset}`),
    ", "
  )}`;

const readJsonc = Effect.fn("readJsonc")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(relativePath)
    .pipe(Effect.mapError((cause) => [`${relativePath}: ${Inspectable.toStringUnknown(cause, 0)}`]));
  const parseErrors: Array<ParseError> = [];
  const parsed = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (parseErrors.length > 0) {
    return yield* Effect.fail([parseErrorsMessage(relativePath, parseErrors)]);
  }

  return parsed;
});

const decodeJsonc = <A>(
  relativePath: string,
  decode: (input: unknown) => Effect.Effect<A, unknown, never>
): Effect.Effect<A, ReadonlyArray<string>, FileSystem.FileSystem> =>
  readJsonc(relativePath).pipe(
    Effect.flatMap((parsed) =>
      decode(parsed).pipe(
        Effect.mapError((cause) => [`${relativePath}: schema decode failed: ${Inspectable.toStringUnknown(cause, 0)}`])
      )
    )
  );

const uniqueDiagnostics = (label: string, values: ReadonlyArray<string>): ReadonlyArray<string> => {
  const unique = A.dedupe(values);
  return unique.length === values.length ? [] : [`${label}: contains duplicate values`];
};

const missingValues = (expected: ReadonlyArray<string>, observed: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(expected, (value) => !A.contains(observed, value));

const sameSetDiagnostics = (
  label: string,
  expected: ReadonlyArray<string>,
  observed: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const missing = missingValues(expected, observed);
  const unexpected = missingValues(observed, expected);
  return [
    ...uniqueDiagnostics(label, observed),
    ...(A.isReadonlyArrayEmpty(missing) ? [] : [`${label}: missing ${A.join(missing, ", ")}`]),
    ...(A.isReadonlyArrayEmpty(unexpected) ? [] : [`${label}: unexpected ${A.join(unexpected, ", ")}`]),
  ];
};

const includesCommand = (commands: ReadonlyArray<string>, expected: string): boolean =>
  A.some(commands, (command) => Str.includes(expected)(command));

const isArchitectureDoctrineRef = (ref: string): boolean => architectureDoctrineRefPattern.test(ref);

const hasCommand = (commands: ReadonlyArray<string>, expected: string): boolean =>
  A.some(commands, (command) => command === expected || Str.includes(expected)(command));

const hasAllCommandFragments = (commands: ReadonlyArray<string>, fragments: ReadonlyArray<string>): boolean =>
  A.some(commands, (command) => A.every(fragments, (fragment) => Str.includes(fragment)(command)));

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : []);

const asStringArray = (value: unknown): ReadonlyArray<string> =>
  pipe(
    asArray(value),
    A.filter((item): item is string => typeof item === "string")
  );

const asNumber = (value: unknown): O.Option<number> => (typeof value === "number" ? O.some(value) : O.none());

const numberFieldDiagnostics = (
  label: string,
  record: Record<string, unknown>,
  key: string,
  expected: number
): ReadonlyArray<string> =>
  pipe(
    asNumber(record[key]),
    O.match({
      onNone: () => [`${label}.${key}: expected ${expected}, got missing or non-number`],
      onSome: (actual) => (actual === expected ? [] : [`${label}.${key}: expected ${expected}, got ${actual}`]),
    })
  );

const schemaStatusConstValues = (branches: ReadonlyArray<unknown>): ReadonlyArray<string> =>
  pipe(
    branches,
    A.flatMap((branch) => {
      const status = asRecord(asRecord(asRecord(branch).properties).status);
      const constValue = status.const;
      return typeof constValue === "string" ? [constValue] : asStringArray(status.enum);
    })
  );

const concreteJsonSchemaPropertyDiagnostics = (
  label: string,
  properties: Record<string, unknown>,
  expectedKeys: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    expectedKeys,
    A.filter((key) => properties[key] === true),
    A.map((key) => `${label}: ${key} must use a concrete JSON Schema property, not boolean true`)
  );

const reportOneOfBranchDiagnostics = (label: string, branches: ReadonlyArray<unknown>): ReadonlyArray<string> =>
  pipe(
    branches,
    A.flatMap((branch) => {
      const record = asRecord(branch);
      const status = asRecord(asRecord(record.properties).status).const;
      const forbiddenRequired = asStringArray(asRecord(record.not).required);
      const exitStatusMinimum = asRecord(asRecord(record.properties).exitStatus).minimum;
      const diagnostics: Array<string> = [];

      if (status === "ok" && !A.contains(forbiddenRequired, "stderrExcerpt")) {
        diagnostics.push(`${label} ok oneOf branch must forbid stderrExcerpt`);
      }
      if (status !== "ok" && !A.contains(forbiddenRequired, "report")) {
        diagnostics.push(`${label} ${String(status)} oneOf branch must forbid report`);
      }
      if ((status === "tool-failed" || status === "base-resolution-failed") && exitStatusMinimum !== 1) {
        diagnostics.push(`${label} ${status} oneOf branch must require exitStatus minimum 1`);
      }

      return diagnostics;
    })
  );

const reportSchemaWireKeyDiagnostics = (document: SchemaCompanionDocument): ReadonlyArray<string> => {
  const fixtureItems = asRecord(asRecord(document.properties.fixtures).items);
  const itemProperties = asRecord(fixtureItems.properties);
  const diagnostics: Array<string> = [];

  if (fixtureItems.additionalProperties !== false) {
    diagnostics.push("report fixture schema companion wire item additionalProperties must be false");
  }
  diagnostics.push(
    ...sameSetDiagnostics(
      "report fixture schema companion wire item shared/variant properties",
      [...reportEnvelopeSharedKeys, "report", "stderrExcerpt"],
      Object.keys(itemProperties)
    )
  );

  return diagnostics;
};

const attributionSummaryRecord = (summary: FindingAttributionSummary): Record<FindingAttributionKind, number> => ({
  introduced: summary.introduced,
  "inherited-adjacent": summary.inheritedAdjacent,
  "not-applicable": summary.notApplicable,
});

const fallowReportWireDiagnostics = (value: unknown, label: string): ReadonlyArray<string> => {
  const record = asRecord(value);
  const status = record.status;
  const hasReport = Object.hasOwn(record, "report");
  const hasStderrExcerpt = Object.hasOwn(record, "stderrExcerpt");
  const exitStatus = record.exitStatus;
  const allowedKeys = status === "ok" ? reportEnvelopeOkKeys : reportEnvelopeFailureKeys;
  const diagnostics: Array<string> = [];

  for (const key of Object.keys(record)) {
    if (!A.contains(allowedKeys, key)) {
      diagnostics.push(`${label}: wire envelope contains unexpected key ${key}`);
    }
  }
  if (status === "ok" && hasStderrExcerpt) {
    diagnostics.push(`${label}: ok wire envelope must not include stderrExcerpt`);
  }
  if (status === "ok" && !hasReport) {
    diagnostics.push(`${label}: ok wire envelope must include report`);
  }
  if (status !== "ok" && hasReport) {
    diagnostics.push(`${label}: failure wire envelope must not include report`);
  }
  if (status !== "ok" && !hasStderrExcerpt) {
    diagnostics.push(`${label}: failure wire envelope must include stderrExcerpt`);
  }
  if ((status === "tool-failed" || status === "base-resolution-failed") && exitStatus === 0) {
    diagnostics.push(`${label}: ${status} wire envelope requires nonzero exitStatus`);
  }

  return diagnostics;
};

const FallowReportWireEnvelope = S.Unknown.check(
  S.makeFilter((value) => {
    const diagnostics = fallowReportWireDiagnostics(value, "FallowReportWireEnvelope");
    return A.isReadonlyArrayEmpty(diagnostics) || A.join(diagnostics, "; ");
  })
).pipe(
  $I.annoteSchema("FallowReportWireEnvelope", {
    description: "Exact wire-level Fallow envelope guard used before internal S.Class decode.",
  })
);

const decodeFallowReportWireEnvelope = S.decodeUnknownEffect(FallowReportWireEnvelope);

const findingAttributionCounts = (
  findings: ReadonlyArray<FallowReportFinding>
): Record<FindingAttributionKind, number> => ({
  introduced: A.filter(findings, (finding) => finding.attribution === "introduced").length,
  "inherited-adjacent": A.filter(findings, (finding) => finding.attribution === "inherited-adjacent").length,
  "not-applicable": A.filter(findings, (finding) => finding.attribution === "not-applicable").length,
});

const findingAttributionKinds = (
  findings: ReadonlyArray<FallowReportFinding>
): ReadonlyArray<FindingAttributionKind> => {
  const kinds = pipe(
    findings,
    A.map((finding) => finding.attribution),
    A.dedupe
  );
  return A.isReadonlyArrayEmpty(kinds) ? ["not-applicable"] : kinds;
};

const attributionKindListDiagnostics = (
  label: string,
  expected: ReadonlyArray<FindingAttributionKind>,
  actual: ReadonlyArray<FindingAttributionKind>
): ReadonlyArray<string> => [
  ...sameSetDiagnostics(label, expected, actual),
  ...(expected.length === actual.length ? [] : [`${label}: expected ${expected.length} kind(s), got ${actual.length}`]),
];

const manifestArtifactPath = (artifact: string): string =>
  Str.startsWith("standards/")(artifact) ? artifact : `goals/fallow-quality-enforcement/${artifact}`;

const reportRefPath = (ref: string): string =>
  Str.startsWith("research/") ? `goals/fallow-quality-enforcement/${ref}` : ref;

const isPlannedResearchReportRef = (ref: string): boolean => A.contains(requiredResearchReportArtifacts, ref);

const stripAnchor = (ref: string): string => Str.split(ref, "#")[0] ?? ref;

const packetEvidenceRefPath = (ref: string): string => {
  const path = stripAnchor(ref);
  if (
    Str.startsWith("research/")(path) ||
    Str.startsWith("tasks/")(path) ||
    Str.startsWith("reports/")(path) ||
    Str.startsWith("history/")(path) ||
    Str.startsWith("ops/")(path)
  ) {
    return `goals/fallow-quality-enforcement/${path}`;
  }
  if (path === "SPEC.md" || path === "PLAN.md" || path === "README.md" || path === "GOAL.md") {
    return `goals/fallow-quality-enforcement/${path}`;
  }
  return path;
};

const frontmatterValue = (content: string, key: string): O.Option<string> => {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content)?.[1];
  if (frontmatter === undefined) {
    return O.none();
  }
  const line = Str.split(frontmatter, "\n").find((entry) => Str.startsWith(`${key}:`)(entry));
  return line === undefined ? O.none() : O.some(line.slice(key.length + 1).trim());
};

const reportCommand = (content: string): O.Option<string> => {
  const line = Str.split(content, "\n").find((entry) => Str.startsWith("- Command: `")(entry));
  if (line === undefined) {
    return O.none();
  }
  const match = /- Command: `([^`]+)`/.exec(line);
  return match?.[1] === undefined ? O.none() : O.some(match[1]);
};

const reportCiMode = (content: string): O.Option<string> => {
  const line = Str.split(content, "\n").find((entry) => Str.startsWith("- CI mode:")(entry));
  return line === undefined ? O.none() : O.some(Str.trim(line.slice("- CI mode:".length)));
};

const normalizeReportCiMode = (value: string): O.Option<typeof CiMode.Type> => {
  const normalized = pipe(value, Str.toLowerCase, Str.trim);
  if (Str.startsWith("none")(normalized)) {
    return O.some("none");
  }
  if (Str.startsWith("advisory artifact")(normalized)) {
    return O.some("advisory-artifact");
  }
  if (Str.startsWith("warning check")(normalized) || Str.includes("warning-check")(normalized)) {
    return O.some("warning-check");
  }
  if (Str.startsWith("blocking check")(normalized) || Str.includes("blocking-check")(normalized)) {
    return O.some("blocking-check");
  }
  return O.none();
};

const phaseOrder = (phase: TaskPhase): number => {
  switch (phase) {
    case "P0":
      return 0;
    case "P1":
      return 1;
    case "P2":
      return 2;
    case "P3":
      return 3;
  }
};

const featureMatrixDiagnostics = (document: FeatureMatrixDocument): ReadonlyArray<string> => {
  const featureFamilies = A.map(document.features, (row) => row.featureFamily);
  const ids = A.map(document.features, (row) => row.id);
  const promotedRows = A.filter(document.features, (row) => A.contains(promotedStatuses, row.promotionStatus));

  return [
    ...uniqueDiagnostics("feature-matrix ids", ids),
    ...uniqueDiagnostics("feature families", featureFamilies),
    ...sameSetDiagnostics("feature families", expectedFeatureFamilies, featureFamilies),
    ...A.flatMap(promotedRows, (row) => {
      const diagnostics: Array<string> = [];
      if (A.contains(unresolvedFalsePositiveStatuses, row.falsePositiveStatus)) {
        diagnostics.push(`${row.id}: promoted row has unresolved falsePositiveStatus ${row.falsePositiveStatus}`);
      }
      if (row.baselineStatus !== "measured") {
        diagnostics.push(`${row.id}: promoted row requires a measured baseline`);
      }
      if (row.promotionCriteria.minimumCleanRuns < 3) {
        diagnostics.push(`${row.id}: promoted row requires at least 3 clean runs`);
      }
      for (const evidenceRef of row.promotionCriteria.requiredEvidenceRefs) {
        if (!A.contains(row.evidenceRefs, evidenceRef)) {
          diagnostics.push(`${row.id}: promotion evidence ${evidenceRef} is not listed in evidenceRefs`);
        }
      }
      if (row.ciMode !== "blocking-check" && row.promotionStatus === "candidate-blocking") {
        diagnostics.push(`${row.id}: candidate-blocking promotion requires ciMode blocking-check`);
      }
      if (row.ciMode !== "blocking-check" && row.promotionStatus === "blocking") {
        diagnostics.push(`${row.id}: blocking promotion requires ciMode blocking-check`);
      }
      if (!includesCommand(row.promotionCriteria.requiredCommands, blockingPromotionCommand)) {
        diagnostics.push(`${row.id}: blocking promotion path must prove ${blockingPromotionCommand}`);
      }
      if (row.yeetMapping.blockingDefault && row.promotionStatus !== "blocking") {
        diagnostics.push(`${row.id}: Yeet blockingDefault can only be true for blocking rows`);
      }
      return diagnostics;
    }),
    ...A.flatMap(document.features, (row) => {
      const diagnostics: Array<string> = [];
      const canonicalCommand = `${canonicalFallowCommandPrefix}${row.featureFamily}`;
      const expectedOutputPath = `.beep/fallow/${row.featureFamily}.json`;
      if (row.repoCommandTarget.phase !== "none" && row.repoCommandTarget.command !== canonicalCommand) {
        diagnostics.push(`${row.id}: repo command target must be ${canonicalCommand}`);
      }
      for (const command of row.acceptanceCommands) {
        if (A.contains(knownNonzeroRawAcceptanceCommands, command)) {
          diagnostics.push(`${row.id}: acceptanceCommands must wrap known-nonzero analyzer command ${command}`);
        }
      }
      if (row.baselineStatus === "measured" && /<[^>]+>/.test(row.fallowCommand)) {
        diagnostics.push(`${row.id}: measured fallowCommand must be concrete, not a placeholder template`);
      }
      if (row.baselineStatus === "measured" && !Str.startsWith("bun ")(row.fallowCommand)) {
        diagnostics.push(`${row.id}: measured fallowCommand must use the runnable repo command form`);
      }
      if (row.repoCommandTarget.defaultOutputPath !== expectedOutputPath) {
        diagnostics.push(`${row.id}: default output path must be ${expectedOutputPath}`);
      }
      if (row.repoCommandTarget.phase === "none" && row.repoCommandTarget.implementationStatus !== "research-only") {
        diagnostics.push(`${row.id}: phase none command targets must be research-only`);
      }
      if (row.repoCommandTarget.phase !== "none" && row.repoCommandTarget.implementationStatus === "research-only") {
        diagnostics.push(`${row.id}: implemented command phases cannot be research-only`);
      }
      if (row.featureFamily === "boundaries" && row.ruleSourceClass === "review-gate-only") {
        diagnostics.push(`${row.id}: review-gate-only boundary rules cannot be the boundary feature source class`);
      }
      if (
        row.ruleSourceClass === "architecture-derived-hard-check" &&
        !A.every(row.doctrineTargetRefs, isArchitectureDoctrineRef)
      ) {
        diagnostics.push(`${row.id}: architecture-derived hard checks require canonical architecture doctrine refs`);
      }
      if (row.featureFamily === "boundaries" && A.isReadonlyArrayEmpty(row.boundaryRuleSources)) {
        diagnostics.push(`${row.id}: boundary feature requires per-rule provenance records`);
      }
      if (row.featureFamily !== "boundaries" && A.isReadonlyArrayNonEmpty(row.boundaryRuleSources)) {
        diagnostics.push(`${row.id}: only the boundaries feature may carry boundaryRuleSources`);
      }
      for (const source of row.boundaryRuleSources) {
        if (source.sourceClass === "review-gate-only" && source.promotionEligible) {
          diagnostics.push(`${row.id}: ${source.ruleId} cannot be promotionEligible while review-gate-only`);
        }
        if (
          source.sourceClass === "manifest-derived" &&
          source.enforcementScope !== "declared-dependency-consistency"
        ) {
          diagnostics.push(
            `${row.id}: ${source.ruleId} manifest-derived rules only prove declared dependency consistency`
          );
        }
        if (source.sourceClass === "doctrine-pinned" && source.enforcementScope !== "layer-legality") {
          diagnostics.push(`${row.id}: ${source.ruleId} doctrine-pinned rules must use layer-legality scope`);
        }
        if (source.sourceClass === "review-gate-only" && source.enforcementScope !== "review-only") {
          diagnostics.push(`${row.id}: ${source.ruleId} review-gate-only rules must use review-only enforcementScope`);
        }
        if (
          source.sourceClass === "architecture-derived-hard-check" &&
          source.enforcementScope !== "architecture-legal-edge"
        ) {
          diagnostics.push(
            `${row.id}: ${source.ruleId} architecture hard checks must use architecture-legal-edge scope`
          );
        }
        if (A.contains(promotedStatuses, row.promotionStatus) && !source.promotionEligible) {
          diagnostics.push(`${row.id}: promoted boundary row has non-promotion-eligible rule ${source.ruleId}`);
        }
        if (A.contains(promotedStatuses, row.promotionStatus) && A.isReadonlyArrayEmpty(source.catalogRefs)) {
          diagnostics.push(`${row.id}: promoted boundary rule ${source.ruleId} requires catalogRefs`);
        }
      }
      if (row.suppressionPolicy.inlineAllowed) {
        diagnostics.push(`${row.id}: inline suppressions must stay disabled in the packet contract`);
      }
      if (!row.suppressionPolicy.recordRequired) {
        diagnostics.push(`${row.id}: suppression records are required`);
      }
      if (!row.suppressionPolicy.expiryRequired) {
        diagnostics.push(`${row.id}: suppression expiry or review date is required`);
      }
      if (Str.includes(staleKnipBlockingPhrase)(row.rollbackNotes)) {
        diagnostics.push(`${row.id}: rollback notes must say Knip reference analyzer/parity gate, not blocking gate`);
      }
      if (row.featureFamily === "audit" && row.baselineSummary.counts !== auditBaselineSummaryCounts) {
        diagnostics.push(`${row.id}: audit baselineSummary.counts must match the recorded audit baseline`);
      }
      if (row.ruleSourceClass === "review-gate-only" && A.contains(promotedStatuses, row.promotionStatus)) {
        diagnostics.push(`${row.id}: review-gate-only rows cannot be promoted`);
      }
      if (
        row.featureFamily === "boundaries" &&
        row.ruleSourceClass === "architecture-derived-hard-check" &&
        !A.some(row.boundaryRuleSources, (source) => source.enforcementScope === "architecture-legal-edge")
      ) {
        diagnostics.push(`${row.id}: architecture boundary hard checks require architecture-legal-edge provenance`);
      }
      if (row.runtimeScope !== "research-only") {
        const triggerDiagnostics = sameSetDiagnostics(
          `${row.id} cleanup-on-touch triggers`,
          cleanupOnTouchTriggerSet,
          row.attributionPolicy.cleanupOnTouchTriggers
        );
        diagnostics.push(...triggerDiagnostics);
        if (
          A.isReadonlyArrayEmpty(triggerDiagnostics) &&
          row.attributionPolicy.adjacentFindingPolicy !== "review-inherited-adjacent"
        ) {
          diagnostics.push(`${row.id}: cleanup-on-touch rows must review inherited adjacent findings`);
        }
      }
      return diagnostics;
    }),
  ];
};

const taskFeatureCiContractDiagnostics = (
  tasks: TasksDocument,
  featureMatrix: FeatureMatrixDocument
): ReadonlyArray<string> => {
  const advisoryLaneCsv = pipe(
    featureMatrix.features,
    A.filter((feature) => feature.ciMode === "advisory-artifact" && feature.repoCommandTarget.phase === "P1"),
    A.map((feature) => feature.featureFamily),
    A.join(",")
  );
  const blockingLaneCsv = pipe(
    featureMatrix.features,
    A.filter((feature) => feature.ciMode === "blocking-check" && feature.repoCommandTarget.phase === "P1"),
    A.map((feature) => feature.featureFamily),
    A.join(",")
  );
  const expectedCiContractCommand = `bun run beep quality fallow ci-contract-check .github/workflows/check.yml --expect-lanes ${advisoryLaneCsv} --expect-blocking-lanes ${blockingLaneCsv} --expect-out-dir .beep/fallow --require-upload --if-no-files-found error --advisory`;
  const fqe005 = pipe(
    tasks.tasks,
    A.findFirst((task) => task.id === "fqe-005"),
    O.getOrUndefined
  );
  if (fqe005 === undefined) {
    return ["fqe-005: CI hardening task is required"];
  }
  const allCommands = [...fqe005.proofCommands, ...fqe005.acceptanceCommands];
  return hasCommand(allCommands, expectedCiContractCommand)
    ? []
    : [`fqe-005: CI contract command must match advisory-artifact feature rows: ${expectedCiContractCommand}`];
};

const knipParityDiagnostics = (document: KnipParityDocument): ReadonlyArray<string> => {
  const ids = A.map(document.rows, (row) => row.id);
  const surfaces = A.map(document.rows, (row) => row.knipConfigSurface);
  const removalDiagnostics =
    document.knipRemovalRecommendation !== "eligible-to-retire"
      ? []
      : A.flatMap(document.rows, (row) => {
          if (
            row.retirementDecision === "ready-to-retire-knip" &&
            row.gapStatus === "parity" &&
            A.isReadonlyArrayNonEmpty(row.evidenceRefs) &&
            includesCommand(row.acceptanceCommands, knipParityBaselineCommand) &&
            includesCommand(row.acceptanceCommands, "fallow")
          ) {
            return [];
          }
          return [
            `${row.id}: eligible-to-retire requires ready-to-retire-knip, parity status, parity assertion helper, Fallow commands, and evidence`,
          ];
        });
  const rowDiagnostics = A.flatMap(document.rows, (row) => {
    const diagnostics: Array<string> = [];
    if (row.retirementDecision === "ready-to-retire-knip" && row.gapStatus !== "parity") {
      diagnostics.push(`${row.id}: ready-to-retire-knip requires gapStatus parity`);
    }
    if (row.retirementDecision === "ready-to-retire-knip" && !includesCommand(row.acceptanceCommands, "fallow")) {
      diagnostics.push(`${row.id}: ready-to-retire-knip requires a Fallow acceptance command`);
    }
    if (
      row.retirementDecision === "ready-to-retire-knip" &&
      !includesCommand(row.acceptanceCommands, knipParityBaselineCommand)
    ) {
      diagnostics.push(`${row.id}: ready-to-retire-knip requires the Knip/Fallow parity baseline helper`);
    }
    return diagnostics;
  });

  return [
    ...uniqueDiagnostics("knip parity ids", ids),
    ...uniqueDiagnostics("knip config surfaces", surfaces),
    ...sameSetDiagnostics("knip config surfaces", expectedKnipSurfaces, surfaces),
    ...removalDiagnostics,
    ...rowDiagnostics,
  ];
};

const tasksDiagnostics = (document: TasksDocument, featureMatrix: FeatureMatrixDocument): ReadonlyArray<string> => {
  const promotedLaneRowsExist = A.some(featureMatrix.features, (row) =>
    A.contains(promotedStatuses, row.promotionStatus)
  );
  const ids = A.map(document.tasks, (task) => task.id);
  const ranks = A.map(document.tasks, (task) => `${task.rank}`);
  const gateKinds = A.map(document.tasks, (task) => task.decisionGate.kind);
  const findTask = (id: string) => A.findFirst(document.tasks, (task) => task.id === id);
  return [
    ...uniqueDiagnostics("task ids", ids),
    ...uniqueDiagnostics("task ranks", ranks),
    ...uniqueDiagnostics("task decision gate kinds", gateKinds),
    ...A.flatMap(document.tasks, (task) =>
      pipe(
        task.dependencies,
        A.filter((dependency) => !A.contains(ids, dependency)),
        A.map((dependency) => `${task.id}: unknown dependency ${dependency}`)
      )
    ),
    ...A.flatMap(document.tasks, (task) =>
      pipe(
        task.dependencies,
        A.flatMap((dependency) =>
          pipe(
            findTask(dependency),
            O.match({
              onNone: () => [],
              onSome: (dependencyTask) => {
                const diagnostics: Array<string> = [];
                if (dependencyTask.rank >= task.rank) {
                  diagnostics.push(`${task.id}: dependency ${dependency} must have a lower rank`);
                }
                if (phaseOrder(dependencyTask.phase) > phaseOrder(task.phase)) {
                  diagnostics.push(`${task.id}: dependency ${dependency} cannot be from a later phase`);
                }
                if (
                  phaseOrder(task.phase) > phaseOrder(dependencyTask.phase) &&
                  task.status !== "seeded" &&
                  dependencyTask.status !== "done"
                ) {
                  diagnostics.push(`${task.id}: later-phase active task requires completed dependency ${dependency}`);
                }
                return diagnostics;
              },
            })
          )
        )
      )
    ),
    ...A.flatMap(document.tasks, (task) => {
      const diagnostics: Array<string> = [];
      const allCommands = [...task.proofCommands, ...task.acceptanceCommands];
      if (
        Str.includes(staleKnipBlockingPhrase)(task.summary) ||
        Str.includes(staleKnipBlockingPhrase)(task.rollbackPlan)
      ) {
        diagnostics.push(`${task.id}: task text must not call Knip a blocking gate without live blocking proof`);
      }
      if (
        A.some(
          allCommands,
          (command) => Str.includes("plan-contract-check --from-stdin")(command) && !Str.includes("|")(command)
        )
      ) {
        diagnostics.push(`${task.id}: --from-stdin contract checks must be connected to a producer with a pipe`);
      }
      if (A.some(allCommands, (command) => Str.includes("--expect-step ")(command))) {
        diagnostics.push(`${task.id}: Yeet plan checks must distinguish step id from step label`);
      }
      if (A.some(allCommands, (command) => /<[^>]+>/.test(command))) {
        diagnostics.push(`${task.id}: proof and acceptance commands must not contain shell placeholder syntax`);
      }
      if (task.id === "fqe-001") {
        for (const report of requiredResearchReportArtifacts) {
          if (!A.contains(task.evidenceRefs, report)) {
            diagnostics.push(`${task.id}: evidenceRefs must include ${report}`);
          }
          if (!A.contains(task.decisionGate.evidence, report)) {
            diagnostics.push(`${task.id}: decisionGate.evidence must include ${report}`);
          }
        }
        if (A.contains(task.evidenceRefs, "research/report-template.md")) {
          diagnostics.push(`${task.id}: report-template.md cannot be completion evidence`);
        }
      }
      if (task.id === "fqe-002" && !hasCommand(allCommands, knipParityBaselineCommand)) {
        diagnostics.push(`${task.id}: Knip parity acceptance must use the baseline assertion helper`);
      }
      if (task.id === "fqe-003") {
        const missingSubcommands = A.filter(
          expectedFallowCommandSubcommands,
          (subcommand) => !hasAllCommandFragments(allCommands, ["beep quality fallow", subcommand])
        );
        if (!A.isReadonlyArrayEmpty(missingSubcommands) && !hasCommand(allCommands, fallowCommandContractCommand)) {
          diagnostics.push(
            `${task.id}: P1 command contract must exercise every target subcommand or run command-contract-check for ${A.join(missingSubcommands, ", ")}`
          );
        }
        if (!hasCommand(allCommands, fallowBoundaryConfigCheckCommand)) {
          diagnostics.push(`${task.id}: P1 command proof must include boundaries config-check --check`);
        }
        if (!hasAllCommandFragments(allCommands, ["beep quality fallow audit", ".beep/fallow/audit.json"])) {
          diagnostics.push(`${task.id}: P1 command proof must execute a concrete Fallow subcommand and envelope path`);
        }
        if (!hasAllCommandFragments(allCommands, ["envelope-check", ".beep/fallow/audit.json"])) {
          diagnostics.push(`${task.id}: P1 command acceptance must assert the generated envelope`);
        }
        if (A.every(allCommands, (command) => Str.includes("--help")(command))) {
          diagnostics.push(`${task.id}: --help-only proof is forbidden for target-contract commands`);
        }
      }
      if (
        task.id === "fqe-004" &&
        A.some(allCommands, (command) => {
          const yeetSegment = Str.split(command, "|")[0] ?? command;
          return Str.includes("beep yeet verify")(yeetSegment) && Str.includes("--expect-step")(yeetSegment);
        })
      ) {
        diagnostics.push(`${task.id}: Yeet verify does not own --expect-step; use a plan contract check instead`);
      }
      if (task.id === "fqe-004" && !hasCommand(allCommands, yeetPlanContractCommand)) {
        diagnostics.push(
          `${task.id}: Yeet advisory task must assert the fallow-advisory-feedback step via plan-contract-check`
        );
      }
      if (task.id === "fqe-004" && !hasCommand(allCommands, yeetPublishAdvisoryPlanContractCommand)) {
        diagnostics.push(`${task.id}: Yeet advisory task must assert fallow feedback in the publish plan too`);
      }
      if (task.id === "fqe-004" && !hasCommand(allCommands, yeetFallowFixtureCheckCommand)) {
        diagnostics.push(`${task.id}: Yeet advisory task must decode Fallow fixtures into a QualityIssueIndex`);
      }
      if (task.id === "fqe-004" && (task.status !== "done" || task.decisionGate.status !== "passed")) {
        diagnostics.push(`${task.id}: P3 Yeet advisory feedback must be done/passed after implementation`);
      }
      if (
        task.id === "fqe-004" &&
        task.decisionGate.status === "passed" &&
        !A.contains(
          task.decisionGate.evidence,
          "packages/tooling/tool/cli/src/commands/Yeet/internal/FallowFeedback.ts"
        )
      ) {
        diagnostics.push(`${task.id}: passed decision gate requires FallowFeedback.ts evidence`);
      }
      if (
        task.id === "fqe-005" &&
        !hasAllCommandFragments(allCommands, ["envelope-check", ".beep/fallow/audit.json"])
      ) {
        diagnostics.push(`${task.id}: CI envelope hardening must prove envelope-check against .beep/fallow/audit.json`);
      }
      if (task.id === "fqe-005" && !hasCommand(allCommands, ciFallowContractCommand)) {
        diagnostics.push(`${task.id}: CI envelope hardening must assert workflow upload of the repo-cli envelope`);
      }
      if (task.id === "fqe-005" && task.status !== "done" && task.decisionGate.status !== "blocked") {
        diagnostics.push(`${task.id}: unfinished CI hardening must keep decisionGate.status blocked`);
      }
      if (task.id === "fqe-005" && task.decisionGate.status === "passed" && task.status !== "done") {
        diagnostics.push(`${task.id}: passed decision gate requires task status done`);
      }
      if (task.id === "fqe-005" && (task.status !== "done" || task.decisionGate.status !== "passed")) {
        diagnostics.push(`${task.id}: P2 CI envelope hardening must be done/passed after implementation`);
      }
      if (
        task.id === "fqe-005" &&
        task.decisionGate.status === "passed" &&
        !A.contains(task.decisionGate.evidence, ".github/workflows/check.yml")
      ) {
        diagnostics.push(`${task.id}: passed decision gate requires .github/workflows/check.yml evidence`);
      }
      if (task.id === "fqe-006" && !hasCommand(allCommands, githubChecksPlanContractCommand)) {
        diagnostics.push(
          `${task.id}: blocking promotion must assert named Fallow lane wiring in github-checks pre-push`
        );
      }
      if (task.id === "fqe-006" && !hasCommand(allCommands, yeetPublishPlanContractCommand)) {
        diagnostics.push(`${task.id}: blocking promotion must prove the normal Yeet publish pre-push plan path`);
      }
      if (
        task.id === "fqe-006" &&
        A.some(allCommands, (command) => Str.includes("beep quality github-checks --plan")(command))
      ) {
        diagnostics.push(`${task.id}: github-checks plan assertions must use the plan-contract-check helper`);
      }
      if (
        task.id === "fqe-006" &&
        !promotedLaneRowsExist &&
        (task.status !== "seeded" || task.decisionGate.status !== "blocked")
      ) {
        diagnostics.push(`${task.id}: blocking pre-push promotion must remain seeded/blocked until parity gates pass`);
      }
      if (
        task.id === "fqe-006" &&
        promotedLaneRowsExist &&
        (task.status !== "done" || task.decisionGate.status !== "passed")
      ) {
        diagnostics.push(`${task.id}: promoted feature-matrix lanes require fqe-006 to be done with a passed gate`);
      }
      return diagnostics;
    }),
  ];
};

const taskParityGateDiagnostics = (tasks: TasksDocument, knipParity: KnipParityDocument): ReadonlyArray<string> => {
  const diagnostics: Array<string> = [];
  const fqe002 = pipe(
    tasks.tasks,
    A.findFirst((task) => task.id === "fqe-002"),
    O.getOrUndefined
  );
  if (fqe002?.decisionGate.status === "passed") {
    for (const row of knipParity.rows) {
      if (row.gapStatus === "unknown") {
        diagnostics.push(`fqe-002: passed decision gate cannot include unknown gapStatus row ${row.id}`);
      }
    }
  }
  return diagnostics;
};

const enumValues = {
  featureFamily: expectedFeatureFamilies,
  ruleSourceClass: RuleSourceClass.Options,
  boundaryEnforcementScope: BoundaryEnforcementScope.Options,
  baselineStatus: BaselineStatus.Options,
  falsePositiveStatus: FalsePositiveStatus.Options,
  ciMode: CiMode.Options,
  promotionStatus: PromotionStatus.Options,
  runtimeScope: RuntimeScope.Options,
  knipRemovalRecommendation: KnipRemovalRecommendation.Options,
  gapStatus: GapStatus.Options,
  retirementDecision: RetirementDecision.Options,
  status: TaskStatus.Options,
  riskLevel: RiskLevel.Options,
  phase: TaskPhase.Options,
  repoCommandPhase: RepoCommandPhase.Options,
  commandImplementationStatus: CommandImplementationStatus.Options,
  attributionMode: AttributionMode.Options,
  basePolicy: BasePolicy.Options,
  adjacentFindingPolicy: AdjacentFindingPolicy.Options,
  findingAttributionKind: FindingAttributionKind.Options,
  residualRiskLevel: ResidualRiskLevel.Options,
  reviewFindingSeverity: ReviewFindingSeverity.Options,
  reviewClosureStatus: ReviewClosureStatus.Options,
  fallowEnvelopeStatus: FallowEnvelopeStatus.Options,
};

const schemaCompanionDiagnostics = (
  label: string,
  document: SchemaCompanionDocument,
  expectedRequired: ReadonlyArray<string>,
  expectedRowRequired: O.Option<ReadonlyArray<string>>,
  expectedEnumKeys: ReadonlyArray<keyof typeof enumValues>,
  collectionKey: O.Option<string> = O.none(),
  requireOneOf = false,
  optionalItemProperties: ReadonlyArray<string> = []
): ReadonlyArray<string> => {
  const observedEnumKeys = Object.keys(document["x-enumValues"]);
  const observedPropertyKeys = Object.keys(document.properties);
  const nestedDiagnostics = pipe(
    expectedRowRequired,
    O.flatMap((rowRequired) =>
      pipe(
        collectionKey,
        O.map((key) => {
          const collection = asRecord(document.properties[key]);
          const items = asRecord(collection.items);
          const itemProperties = asRecord(items.properties);
          const oneOf = asArray(items.oneOf);
          const expectedItemProperties = [...rowRequired, ...optionalItemProperties];
          const oneOfStatuses = schemaStatusConstValues(oneOf);
          return [
            ...sameSetDiagnostics(`${label} item required`, rowRequired, asStringArray(items.required)),
            ...sameSetDiagnostics(`${label} item properties`, expectedItemProperties, Object.keys(itemProperties)),
            ...concreteJsonSchemaPropertyDiagnostics(
              `${label} item properties`,
              itemProperties,
              expectedItemProperties
            ),
            ...(items.additionalProperties === false ? [] : [`${label} item additionalProperties must be false`]),
            ...(requireOneOf && A.isReadonlyArrayEmpty(oneOf)
              ? [`${label} item oneOf must declare status variants`]
              : []),
            ...(requireOneOf
              ? [
                  ...sameSetDiagnostics(`${label} item oneOf statuses`, reportEnvelopeStatuses, oneOfStatuses),
                  ...(oneOf.length === reportEnvelopeStatuses.length
                    ? []
                    : [`${label} item oneOf must define one branch per Fallow envelope status`]),
                  ...reportOneOfBranchDiagnostics(`${label} item`, oneOf),
                ]
              : []),
          ];
        })
      )
    ),
    O.getOrElse((): ReadonlyArray<string> => [])
  );
  return [
    ...sameSetDiagnostics(`${label} json schema required`, expectedRequired, document.required),
    ...sameSetDiagnostics(`${label} properties`, expectedRequired, observedPropertyKeys),
    ...sameSetDiagnostics(`${label} root required`, expectedRequired, document["x-requiredFields"]),
    ...pipe(
      expectedRowRequired,
      O.match({
        onNone: () => [],
        onSome: (rowRequired) =>
          sameSetDiagnostics(`${label} row required`, rowRequired, document["x-rowRequiredFields"] ?? []),
      })
    ),
    ...sameSetDiagnostics(`${label} enum keys`, expectedEnumKeys, observedEnumKeys),
    ...A.flatMap(expectedEnumKeys, (key) =>
      sameSetDiagnostics(`${label} enum ${key}`, enumValues[key], document["x-enumValues"][key] ?? [])
    ),
    ...nestedDiagnostics,
  ];
};

const reportSchemaYeetIssueFixtureDiagnostics = (document: SchemaCompanionDocument): ReadonlyArray<string> => {
  const collection = asRecord(document.properties.yeetIssueFixtures);
  const items = asRecord(collection.items);
  const itemProperties = asRecord(items.properties);
  return [
    ...sameSetDiagnostics(
      "report fixture schema companion Yeet issue item required",
      yeetIssueFixtureItemRequired,
      asStringArray(items.required)
    ),
    ...sameSetDiagnostics(
      "report fixture schema companion Yeet issue item properties",
      yeetIssueFixtureItemRequired,
      Object.keys(itemProperties)
    ),
    ...concreteJsonSchemaPropertyDiagnostics(
      "report fixture schema companion Yeet issue item properties",
      itemProperties,
      yeetIssueFixtureItemRequired
    ),
    ...(items.additionalProperties === false
      ? []
      : ["report fixture schema companion Yeet issue item additionalProperties must be false"]),
  ];
};

const rawReportFixtureDiagnostics = (document: unknown): ReadonlyArray<string> =>
  pipe(
    asArray(asRecord(document).fixtures),
    A.flatMap((fixture, index) => [
      ...fallowReportWireDiagnostics(fixture, `raw report fixture ${index}`),
      ...pipe(
        decodeFallowReportWireEnvelope(fixture),
        Effect.match({
          onFailure: (cause) => [
            `raw report fixture ${index}: wire schema decode failed: ${Inspectable.toStringUnknown(cause, 0)}`,
          ],
          onSuccess: () => [],
        }),
        Effect.runSync
      ),
    ])
  );

const reportFixtureDiagnostics = (document: ReportFixtureDocument): ReadonlyArray<string> => {
  const statuses = A.map(document.fixtures, (fixture) => fixture.status);
  const envelopeAttributionKinds = pipe(
    document.fixtures,
    A.flatMap((fixture) => fixture.attributionKinds),
    A.dedupe
  );
  const yeetAttributionKinds = pipe(
    document.yeetIssueFixtures,
    A.map((fixture) => fixture.attribution),
    A.dedupe
  );
  const fixturesByPath = new Map(A.map(document.fixtures, (fixture) => [fixture.reportPath, fixture] as const));
  const findingByEnvelopeAndId = new Map<string, FallowReportFinding>();
  const expectedYeetIssueRefs: Array<string> = [];
  for (const fixture of document.fixtures) {
    if (fixture.status === "ok") {
      for (const finding of fixture.report.findings) {
        findingByEnvelopeAndId.set(`${fixture.reportPath}#${finding.id}`, finding);
        expectedYeetIssueRefs.push(`${fixture.reportPath}#${finding.id}`);
      }
    } else {
      expectedYeetIssueRefs.push(`${fixture.reportPath}#${fixture.status}`);
    }
  }
  const actualYeetIssueRefs = A.map(
    document.yeetIssueFixtures,
    (fixture) => `${fixture.sourceEnvelopeRef}#${fixture.sourceFindingId}`
  );
  return [
    ...sameSetDiagnostics("report envelope fixture statuses", reportEnvelopeStatuses, statuses),
    ...sameSetDiagnostics("Yeet issue fixture source refs", expectedYeetIssueRefs, actualYeetIssueRefs),
    ...sameSetDiagnostics(
      "report envelope attribution kinds",
      FindingAttributionKind.Options,
      envelopeAttributionKinds
    ),
    ...sameSetDiagnostics("Yeet issue attribution kinds", FindingAttributionKind.Options, yeetAttributionKinds),
    ...A.flatMap(document.fixtures, (fixture) => {
      const diagnostics: Array<string> = [];
      const expectedPath = `.beep/fallow/${fixture.subcommand}.json`;
      if (fixture.reportPath !== expectedPath) {
        diagnostics.push(`${fixture.status}: reportPath must be ${expectedPath}`);
      }
      if (fixture.rawOutputRef === fixture.reportPath) {
        diagnostics.push(`${fixture.status}: rawOutputRef must point to raw tool output, not the envelope path`);
      }
      if (fixture.status === "ok") {
        const counts = findingAttributionCounts(fixture.report.findings);
        const summary = attributionSummaryRecord(fixture.findingAttributionSummary);
        diagnostics.push(
          ...attributionKindListDiagnostics(
            `${fixture.status}: attributionKinds must match report.findings`,
            findingAttributionKinds(fixture.report.findings),
            fixture.attributionKinds
          )
        );
        if (fixture.report.findingCount !== fixture.report.findings.length) {
          diagnostics.push(`${fixture.status}: report.findingCount must match report.findings length`);
        }
        for (const kind of FindingAttributionKind.Options) {
          if (summary[kind] !== counts[kind]) {
            diagnostics.push(`${fixture.status}: findingAttributionSummary.${kind} must match report.findings`);
          }
        }
        for (const finding of fixture.report.findings) {
          if (finding.featureFamily !== fixture.subcommand) {
            diagnostics.push(`${fixture.status}/${finding.id}: featureFamily must match envelope subcommand`);
          }
          if (!Str.startsWith("fallow/")(finding.parser)) {
            diagnostics.push(`${fixture.status}/${finding.id}: parser must use fallow/<feature>/v1`);
          }
          if (!Str.startsWith("fallow:")(finding.subCategory)) {
            diagnostics.push(`${fixture.status}/${finding.id}: subCategory must start with fallow:`);
          }
        }
      } else {
        const summary = attributionSummaryRecord(fixture.findingAttributionSummary);
        diagnostics.push(
          ...attributionKindListDiagnostics(
            `${fixture.status}: failure attributionKinds`,
            ["not-applicable"],
            fixture.attributionKinds
          )
        );
        for (const kind of FindingAttributionKind.Options) {
          if (summary[kind] !== 0) {
            diagnostics.push(`${fixture.status}: failure envelopes must not claim decoded finding counts`);
          }
        }
      }
      return diagnostics;
    }),
    ...A.flatMap(document.yeetIssueFixtures, (fixture) => {
      const diagnostics: Array<string> = [];
      const sourceEnvelope = fixturesByPath.get(fixture.sourceEnvelopeRef);
      const sourceFinding = findingByEnvelopeAndId.get(`${fixture.sourceEnvelopeRef}#${fixture.sourceFindingId}`);
      if (sourceEnvelope === undefined) {
        diagnostics.push(`${fixture.id}: sourceEnvelopeRef must reference a report fixture`);
      }
      if (sourceFinding === undefined) {
        if (sourceEnvelope === undefined || sourceEnvelope.status === "ok") {
          diagnostics.push(`${fixture.id}: sourceFindingId must reference a finding from the source envelope`);
        } else if (fixture.sourceFindingId !== sourceEnvelope.status) {
          diagnostics.push(`${fixture.id}: failure sourceFindingId must match source envelope status`);
        }
      }
      if (sourceEnvelope !== undefined && sourceEnvelope.subcommand !== fixture.sourceFeature) {
        diagnostics.push(`${fixture.id}: sourceFeature must match source envelope subcommand`);
      }
      if (sourceFinding !== undefined) {
        if (fixture.parser !== sourceFinding.parser) {
          diagnostics.push(`${fixture.id}: parser must match source finding parser`);
        }
        if (fixture.subCategory !== sourceFinding.subCategory) {
          diagnostics.push(`${fixture.id}: subCategory must match source finding subCategory`);
        }
        if (fixture.attribution !== sourceFinding.attribution) {
          diagnostics.push(`${fixture.id}: attribution must match source finding attribution`);
        }
      } else if (sourceEnvelope !== undefined && sourceEnvelope.status !== "ok") {
        const expectedParser = `fallow/${sourceEnvelope.subcommand}/v1`;
        const expectedSubCategory = `fallow:${sourceEnvelope.subcommand}:${sourceEnvelope.status}`;
        if (fixture.parser !== expectedParser) {
          diagnostics.push(`${fixture.id}: failure parser must be ${expectedParser}`);
        }
        if (fixture.subCategory !== expectedSubCategory) {
          diagnostics.push(`${fixture.id}: failure subCategory must be ${expectedSubCategory}`);
        }
        if (fixture.attribution !== "not-applicable") {
          diagnostics.push(`${fixture.id}: failure attribution must be not-applicable`);
        }
      }
      if (fixture.blocking) {
        diagnostics.push(`${fixture.id}: advisory Yeet issue fixtures must be non-blocking`);
      }
      if (!Str.startsWith("fallow/")(fixture.parser)) {
        diagnostics.push(`${fixture.id}: Yeet issue parser must use fallow/<feature>/v1`);
      }
      if (!Str.startsWith("fallow:")(fixture.subCategory)) {
        diagnostics.push(`${fixture.id}: Yeet issue subCategory must start with fallow:`);
      }
      return diagnostics;
    }),
  ];
};

const reviewRoundsDiagnostics = (document: ReviewRoundsDocument): ReadonlyArray<string> => {
  const latestRound = document.rounds[document.rounds.length - 1];
  const latestRoundDiagnostics =
    latestRound !== undefined &&
    latestRound.requiredFindingCount === 0 &&
    latestRound.openRequiredFindingCount === 0 &&
    A.isReadonlyArrayEmpty(latestRound.findings)
      ? []
      : ["review rounds must end with a post-fix zero-finding critic round"];
  const latestRoundAcceptanceDiagnostics =
    latestRound === undefined
      ? []
      : pipe(
          requiredLatestReviewAcceptanceCommands,
          A.filter((command) => !hasCommand(latestRound.acceptanceCommands, command)),
          A.map((command) => `${latestRound.roundId}: final zero round acceptanceCommands must include ${command}`)
        );

  return [
    ...uniqueDiagnostics(
      "review round ids",
      A.map(document.rounds, (round) => round.roundId)
    ),
    ...latestRoundDiagnostics,
    ...latestRoundAcceptanceDiagnostics,
    ...A.flatMap(document.rounds, (round) => {
      const requiredFindings = A.filter(round.findings, (finding) => finding.severity === "required");
      const openRequiredFindings = A.filter(requiredFindings, (finding) => finding.closureStatus === "open");
      const diagnostics: Array<string> = [];
      if (requiredFindings.length !== round.requiredFindingCount) {
        diagnostics.push(`${round.roundId}: requiredFindingCount does not match required findings`);
      }
      if (openRequiredFindings.length !== round.openRequiredFindingCount) {
        diagnostics.push(`${round.roundId}: openRequiredFindingCount does not match open required findings`);
      }
      for (const finding of requiredFindings) {
        if (finding.closureStatus === "open") {
          diagnostics.push(`${round.roundId}/${finding.id}: required finding remains open`);
        }
        if (finding.closureStatus === "waived" && finding.waiver === undefined) {
          diagnostics.push(`${round.roundId}/${finding.id}: waived finding requires waiver evidence`);
        }
        if (finding.closureStatus !== "waived" && finding.waiver !== undefined) {
          diagnostics.push(`${round.roundId}/${finding.id}: non-waived finding must not carry waiver evidence`);
        }
      }
      return diagnostics;
    }),
  ];
};

const boundaryProvenanceDiagnostics = (
  generatedConfig: GeneratedBoundaryConfig,
  provenance: BoundaryProvenanceDocument,
  packageNamesByManifestRef: ReadonlyMap<string, string>
): ReadonlyArray<string> => {
  const generatedFroms = A.map(generatedConfig.boundaries.rules, (rule) => rule.from);
  const manifestProvenanceFroms = pipe(
    provenance.rules,
    A.filter((rule) => rule.sourceClass === "manifest-derived"),
    A.map((rule) => rule.generatedRuleFrom)
  );
  return [
    ...sameSetDiagnostics("generated boundary provenance rules", generatedFroms, manifestProvenanceFroms),
    ...uniqueDiagnostics(
      "generated boundary provenance ids",
      A.map(provenance.rules, (rule) => rule.ruleId)
    ),
    ...A.flatMap(provenance.rules, (rule) => {
      const diagnostics: Array<string> = [];
      const workspaceManifestRefs = A.filter(
        rule.sourceRefs,
        (ref) => ref !== "package.json" && Str.endsWith("/package.json")(ref)
      );
      if (rule.ruleId !== rule.generatedRuleFrom) {
        diagnostics.push(`${rule.ruleId}: ruleId must match generatedRuleFrom`);
      }
      if (rule.sourceClass === "review-gate-only") {
        diagnostics.push(`${rule.ruleId}: generated boundary rules cannot be review-gate-only`);
      }
      if (rule.sourceClass === "doctrine-pinned") {
        if (rule.enforcementScope !== "layer-legality") {
          diagnostics.push(`${rule.ruleId}: doctrine-pinned boundary rules must use layer-legality`);
        }
        if (!A.some(rule.doctrineRefs, (ref) => Str.startsWith(requiredBoundaryDoctrineRefPrefix)(ref))) {
          diagnostics.push(`${rule.ruleId}: doctrine-pinned boundary rules require standards/ARCHITECTURE.md ref`);
        }
        if (!rule.promotionEligible) {
          diagnostics.push(`${rule.ruleId}: doctrine-pinned boundary rules must be promotionEligible`);
        }
        return diagnostics;
      }
      if (rule.sourceClass !== "manifest-derived") {
        diagnostics.push(`${rule.ruleId}: generated boundary rules must be manifest-derived`);
      }
      if (rule.enforcementScope !== "declared-dependency-consistency") {
        diagnostics.push(`${rule.ruleId}: generated manifest-derived rules only prove declared dependency consistency`);
      }
      if (A.isReadonlyArrayEmpty(workspaceManifestRefs)) {
        diagnostics.push(`${rule.ruleId}: generated boundary provenance requires the owning workspace package.json`);
      }
      if (!A.some(workspaceManifestRefs, (ref) => packageNamesByManifestRef.get(ref) === rule.generatedRuleFrom)) {
        diagnostics.push(`${rule.ruleId}: workspace package manifest name must match generatedRuleFrom`);
      }
      for (const requiredRef of requiredBoundarySourceRefs) {
        if (!A.contains(rule.sourceRefs, requiredRef)) {
          diagnostics.push(`${rule.ruleId}: generated boundary provenance requires sourceRef ${requiredRef}`);
        }
      }
      if (!A.some(rule.doctrineRefs, (ref) => Str.startsWith(requiredBoundaryDoctrineRefPrefix)(ref))) {
        diagnostics.push(
          `${rule.ruleId}: generated boundary provenance requires standards/ARCHITECTURE.md doctrine ref`
        );
      }
      if (!rule.promotionEligible) {
        diagnostics.push(`${rule.ruleId}: generated manifest-derived boundary rules must be promotionEligible`);
      }
      return diagnostics;
    }),
  ];
};

const manifestDiagnostics = (document: InitiativeManifestDocument): ReadonlyArray<string> => [
  ...sameSetDiagnostics("manifest root fields", manifestRootRequired, Object.keys(asRecord(document))),
  ...sameSetDiagnostics("manifest required artifacts", requiredManifestArtifacts, document.requiredArtifacts),
  ...A.flatMap(requiredManifestVerificationFragments, (fragments) =>
    hasAllCommandFragments(document.verification, fragments)
      ? []
      : [`manifest verification: missing command containing ${A.join(fragments, " + ")}`]
  ),
  ...(document.decisions.branch === "feat/fallow-quality-enforcement"
    ? []
    : ["manifest decisions.branch must match feat/fallow-quality-enforcement"]),
  ...(document.decisions.operatorSurface === "beep quality fallow"
    ? []
    : ["manifest decisions.operatorSurface must be beep quality fallow"]),
  ...(document.decisions.knipEndgame === "parity-then-decide"
    ? []
    : ["manifest decisions.knipEndgame must keep Knip retirement gated by parity"]),
  ...(document.currentTargetPhase === "P3" ? [] : ["manifest currentTargetPhase must be P3 after P2 CI hardening"]),
];

const manifestArtifactDiagnostics = Effect.fn("manifestArtifactDiagnostics")(function* (
  document: InitiativeManifestDocument
) {
  const fs = yield* FileSystem.FileSystem;
  const checks = yield* Effect.forEach(document.requiredArtifacts, (artifact) =>
    fs.exists(manifestArtifactPath(artifact)).pipe(
      Effect.map((exists) => (exists ? [] : [`manifest required artifact missing: ${artifact}`])),
      Effect.orElseSucceed(() => [`manifest required artifact check failed for ${artifact}`])
    )
  );
  return A.flatten(checks);
});

const featureReportRefDiagnostics = Effect.fn("featureReportRefDiagnostics")(function* (
  document: FeatureMatrixDocument,
  manifest: InitiativeManifestDocument
) {
  const fs = yield* FileSystem.FileSystem;
  const featureByFamily = new Map<string, FeatureRow>(
    A.map(document.features, (feature) => [feature.featureFamily, feature] as const)
  );
  const reportRefs = pipe(
    [
      ...requiredResearchReportArtifacts,
      ...A.flatMap(document.features, (feature) => [
        ...feature.attributionPolicy.reviewArtifactRefs,
        ...feature.promotionCriteria.requiredEvidenceRefs,
      ]),
    ],
    A.filter((ref) => Str.startsWith("research/")(ref) && Str.endsWith(".md")(ref)),
    A.dedupe
  );
  const existenceChecks = yield* Effect.forEach(reportRefs, (ref) =>
    fs.exists(reportRefPath(ref)).pipe(
      Effect.map((exists) => (exists ? [] : [`feature matrix report ref missing: ${ref}`])),
      Effect.orElseSucceed(() => [`feature matrix report ref check failed for ${ref}`])
    )
  );
  const completenessChecks = yield* Effect.forEach(reportRefs, (ref) =>
    fs.readFileString(reportRefPath(ref)).pipe(
      Effect.map((content) => {
        const diagnostics: Array<string> = [];
        const schemaVersion = pipe(frontmatterValue(content, "schemaVersion"), O.getOrUndefined);
        const featureFamily = pipe(frontmatterValue(content, "featureFamily"), O.getOrUndefined);
        const status = pipe(frontmatterValue(content, "status"), O.getOrUndefined);
        const command = pipe(reportCommand(content), O.getOrUndefined);
        const ciMode = pipe(reportCiMode(content), O.getOrUndefined);
        const feature = featureFamily === undefined ? undefined : featureByFamily.get(featureFamily);
        if (schemaVersion !== "fallow-quality-enforcement/research-report/v1") {
          diagnostics.push(`feature matrix report ref has invalid schemaVersion frontmatter: ${ref}`);
        }
        if (featureFamily === undefined) {
          diagnostics.push(`feature matrix report ref missing featureFamily frontmatter: ${ref}`);
        } else {
          if (feature === undefined) {
            diagnostics.push(`feature matrix report ref has no matching feature row: ${ref} -> ${featureFamily}`);
          }
          if (ref !== `research/${featureFamily}.md`) {
            diagnostics.push(`feature matrix report ref filename must match featureFamily: ${ref} -> ${featureFamily}`);
          }
        }
        if (command === undefined) {
          diagnostics.push(`feature matrix report ref missing measured Command line: ${ref}`);
        } else if (feature !== undefined && feature.fallowCommand !== command) {
          diagnostics.push(`feature matrix report ref command must match feature matrix fallowCommand: ${ref}`);
        }
        if (feature !== undefined) {
          const expectedStatus =
            feature.runtimeScope === "research-only" || feature.baselineStatus === "not-applicable"
              ? "researched"
              : "measured";
          if (status !== expectedStatus) {
            diagnostics.push(`feature matrix report ref must have ${expectedStatus} status frontmatter: ${ref}`);
          }
          if (ciMode === undefined) {
            diagnostics.push(`feature matrix report ref missing CI mode line: ${ref}`);
          } else {
            const normalizedCiMode = pipe(normalizeReportCiMode(ciMode), O.getOrUndefined);
            if (normalizedCiMode === undefined) {
              diagnostics.push(`feature matrix report ref has unrecognized CI mode prose: ${ref}`);
            } else if (normalizedCiMode !== feature.ciMode) {
              diagnostics.push(
                `feature matrix report ref CI mode must match feature matrix for ${ref}: expected ${feature.ciMode}, got ${normalizedCiMode}`
              );
            }
          }
        } else if (status !== "measured" && status !== "researched") {
          diagnostics.push(`feature matrix report ref has invalid status frontmatter: ${ref}`);
        }
        for (const section of requiredResearchReportSections) {
          if (!Str.includes(section)(content)) {
            diagnostics.push(`feature matrix report ref missing section ${section}: ${ref}`);
          }
        }
        if (Str.includes("status: planned")(content)) {
          diagnostics.push(`feature matrix report ref still has planned frontmatter: ${ref}`);
        }
        if (Str.includes("Current status: planned P0 research report")(content)) {
          diagnostics.push(`feature matrix report ref still has placeholder status text: ${ref}`);
        }
        if (Str.includes("Complete this report in `fqe-001`")(content)) {
          diagnostics.push(`feature matrix report ref still has placeholder next-evidence text: ${ref}`);
        }
        if (Str.includes("future P1 wrapper writes")(content)) {
          diagnostics.push(`feature matrix report ref still describes implemented P1 wrapper as future work: ${ref}`);
        }
        if (Str.includes("not a live command yet")(content)) {
          diagnostics.push(`feature matrix report ref still describes implemented P1 wrapper as not live: ${ref}`);
        }
        if (
          feature?.repoCommandTarget.implementationStatus === "implemented" &&
          Str.includes("CI mode: none in P0")(content)
        ) {
          diagnostics.push(
            `feature matrix report ref still describes implemented advisory artifact lane as no-CI: ${ref}`
          );
        }
        if (ref === "research/audit.md" && !Str.includes(auditAttributionNarrative)(content)) {
          diagnostics.push(`feature matrix audit report must match recorded audit attribution narrative: ${ref}`);
        }
        if (ref === "research/audit.md" && !Str.includes(auditCountsNarrative)(content)) {
          diagnostics.push(`feature matrix audit report must match recorded audit counts narrative: ${ref}`);
        }
        return diagnostics;
      }),
      Effect.orElseSucceed(() => [`feature matrix report ref could not be read: ${ref}`])
    )
  );
  return [
    ...A.flatMap(reportRefs, (ref) =>
      isPlannedResearchReportRef(ref) && A.contains(manifest.requiredArtifacts, ref)
        ? []
        : [`feature matrix report ref must be registered as a planned P0 artifact: ${ref}`]
    ),
    ...A.flatten(existenceChecks),
    ...A.flatten(completenessChecks),
  ];
});

const featureArtifactRefDiagnostics = Effect.fn("featureArtifactRefDiagnostics")(function* (
  document: FeatureMatrixDocument,
  manifest: InitiativeManifestDocument
) {
  const fs = yield* FileSystem.FileSystem;
  const refs = pipe(
    document.features,
    A.flatMap((feature) => [
      feature.baselineArtifact,
      ...feature.falsePositiveEvidence,
      ...feature.evidenceRefs,
      ...feature.configSurfaces,
      ...feature.doctrineTargetRefs,
      ...feature.promotionCriteria.requiredEvidenceRefs,
    ]),
    A.filter((ref) => !Str.startsWith("https://")(ref) && !Str.startsWith("http://")(ref)),
    A.dedupe
  );
  const manifestTrackedRefs = pipe(
    document.features,
    A.flatMap((feature) => [feature.baselineArtifact, ...feature.falsePositiveEvidence, ...feature.evidenceRefs]),
    A.filter((ref) => {
      const path = stripAnchor(ref);
      return Str.startsWith("standards/")(path) && /\.(?:json|jsonc)$/.test(path);
    }),
    A.dedupe
  );
  const existenceChecks = yield* Effect.forEach(refs, (ref) =>
    fs.exists(packetEvidenceRefPath(ref)).pipe(
      Effect.map((exists) => (exists ? [] : [`feature matrix artifact ref missing: ${ref}`])),
      Effect.orElseSucceed(() => [`feature matrix artifact ref check failed for ${ref}`])
    )
  );
  return [
    ...A.flatMap(manifestTrackedRefs, (ref) =>
      Str.startsWith("standards/")(ref) && !A.contains(manifest.requiredArtifacts, stripAnchor(ref))
        ? [`manifest requiredArtifacts must include measured standards artifact: ${stripAnchor(ref)}`]
        : []
    ),
    ...A.flatten(existenceChecks),
  ];
});

const workspacePackageNameMap = Effect.fn("workspacePackageNameMap")(function* (
  provenance: BoundaryProvenanceDocument
) {
  const workspaceManifestRefs = pipe(
    provenance.rules,
    A.flatMap((rule) => rule.sourceRefs),
    A.filter((ref) => ref !== "package.json" && Str.endsWith("/package.json")(ref)),
    A.dedupe
  );
  const entries = yield* Effect.forEach(workspaceManifestRefs, (ref) =>
    readJsonc(ref).pipe(
      Effect.flatMap((parsed) => {
        const name = asRecord(parsed).name;
        return typeof name === "string" && isTrimmedNonEmpty(name)
          ? Effect.succeed([ref, name] as const)
          : Effect.fail([`${ref}: package manifest requires a trimmed name`]);
      })
    )
  );
  return new Map(entries);
});

const pilotInventoryDiagnostics = (document: unknown): ReadonlyArray<string> => {
  const root = asRecord(document);
  const decision = asRecord(root.decision);
  const implementationPolicy = asRecord(root.implementationPolicy);
  const knipStrengths = asStringArray(asRecord(root.featureComparison).knipStrengths);
  const fallowAudit = asRecord(asRecord(root.localProbeSnapshot).fallowAudit);
  const fallowAuditSummary = asRecord(fallowAudit.summary);
  const fallowAuditIntroduced = asRecord(fallowAudit.introduced);
  const fallowAuditInherited = asRecord(fallowAudit.inherited);
  const fallowAuditUnattributed = asRecord(fallowAudit.unattributed);
  const diagnostics: Array<string> = [];

  if (decision.keepKnipAsBlockingGate === true) {
    diagnostics.push(
      "standards/fallow.pilot.inventory.jsonc: keepKnipAsBlockingGate must not be true without live blocking proof"
    );
  }
  if (implementationPolicy.blockingQualityGate === "knip") {
    diagnostics.push(
      "standards/fallow.pilot.inventory.jsonc: blockingQualityGate must not name knip without live pre-push proof"
    );
  }
  if (A.some(knipStrengths, (strength) => Str.includes("Existing blocking gate")(strength))) {
    diagnostics.push(
      "standards/fallow.pilot.inventory.jsonc: Knip strengths must say reference analyzer/parity gate, not existing blocking gate"
    );
  }
  if (implementationPolicy.advisoryCiJob !== "fallow-advisory") {
    diagnostics.push(
      "standards/fallow.pilot.inventory.jsonc: implementationPolicy.advisoryCiJob must be fallow-advisory"
    );
  }
  diagnostics.push(
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit",
      fallowAudit,
      "changedFilesMinimum",
      expectedFallowAuditBaseline.changedFilesMinimum
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.summary",
      fallowAuditSummary,
      "deadCodeIssues",
      expectedFallowAuditBaseline.deadCodeIssues
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.summary",
      fallowAuditSummary,
      "complexityFindings",
      expectedFallowAuditBaseline.complexityFindings
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.summary",
      fallowAuditSummary,
      "duplicationCloneGroups",
      expectedFallowAuditBaseline.duplicationCloneGroups
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.introduced",
      fallowAuditIntroduced,
      "deadCodeIssues",
      expectedFallowAuditBaseline.deadCodeIntroduced
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.introduced",
      fallowAuditIntroduced,
      "complexityFindings",
      expectedFallowAuditBaseline.complexityIntroduced
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.introduced",
      fallowAuditIntroduced,
      "duplicationCloneGroups",
      expectedFallowAuditBaseline.duplicationIntroduced
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.inherited",
      fallowAuditInherited,
      "deadCodeIssues",
      expectedFallowAuditBaseline.deadCodeInherited
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.inherited",
      fallowAuditInherited,
      "complexityFindings",
      expectedFallowAuditBaseline.complexityInherited
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.inherited",
      fallowAuditInherited,
      "duplicationCloneGroups",
      expectedFallowAuditBaseline.duplicationInherited
    ),
    ...numberFieldDiagnostics(
      "standards/fallow.pilot.inventory.jsonc.localProbeSnapshot.fallowAudit.unattributed",
      fallowAuditUnattributed,
      "complexityFindings",
      expectedFallowAuditBaseline.complexityUnattributed
    )
  );

  return diagnostics;
};

const validate = Effect.fn("validate")(function* () {
  const manifest = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/ops/manifest.json",
    decodeInitiativeManifestDocument
  );
  const featureMatrix = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/research/feature-matrix.jsonc",
    decodeFeatureMatrixDocument
  );
  const knipParity = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/research/knip-parity.jsonc",
    decodeKnipParityDocument
  );
  const tasks = yield* decodeJsonc("goals/fallow-quality-enforcement/tasks/tasks.jsonc", decodeTasksDocument);
  const rawReportFixtures = yield* readJsonc("goals/fallow-quality-enforcement/reports/report-envelope-fixtures.jsonc");
  const reportFixtures = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/reports/report-envelope-fixtures.jsonc",
    decodeReportFixtureDocument
  );
  const reviewRounds = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/history/review-rounds.jsonc",
    decodeReviewRoundsDocument
  );
  const generatedBoundaryConfig = yield* decodeJsonc(
    "standards/fallow.boundaries.generated.jsonc",
    decodeGeneratedBoundaryConfig
  );
  const boundaryProvenance = yield* decodeJsonc(
    "standards/fallow.boundaries.provenance.jsonc",
    decodeBoundaryProvenanceDocument
  );
  const packageNamesByManifestRef = yield* workspacePackageNameMap(boundaryProvenance);
  const pilotInventory = yield* readJsonc("standards/fallow.pilot.inventory.jsonc");
  const featureSchema = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/research/feature-matrix.schema.json",
    decodeSchemaCompanionDocument
  );
  const knipSchema = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/research/knip-parity.schema.json",
    decodeSchemaCompanionDocument
  );
  const taskSchema = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/tasks/tasks.schema.json",
    decodeSchemaCompanionDocument
  );
  const reportSchema = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/reports/report-envelope-fixtures.schema.json",
    decodeSchemaCompanionDocument
  );
  const reviewSchema = yield* decodeJsonc(
    "goals/fallow-quality-enforcement/history/review-rounds.schema.json",
    decodeSchemaCompanionDocument
  );
  const boundaryProvenanceSchema = yield* decodeJsonc(
    "standards/fallow.boundaries.provenance.schema.json",
    decodeSchemaCompanionDocument
  );
  const manifestArtifactResults = yield* manifestArtifactDiagnostics(manifest);
  const featureReportRefResults = yield* featureReportRefDiagnostics(featureMatrix, manifest);
  const featureArtifactRefResults = yield* featureArtifactRefDiagnostics(featureMatrix, manifest);

  return [
    ...manifestDiagnostics(manifest),
    ...manifestArtifactResults,
    ...featureReportRefResults,
    ...featureArtifactRefResults,
    ...featureMatrixDiagnostics(featureMatrix),
    ...knipParityDiagnostics(knipParity),
    ...tasksDiagnostics(tasks, featureMatrix),
    ...taskFeatureCiContractDiagnostics(tasks, featureMatrix),
    ...taskParityGateDiagnostics(tasks, knipParity),
    ...rawReportFixtureDiagnostics(rawReportFixtures),
    ...reportFixtureDiagnostics(reportFixtures),
    ...reviewRoundsDiagnostics(reviewRounds),
    ...boundaryProvenanceDiagnostics(generatedBoundaryConfig, boundaryProvenance, packageNamesByManifestRef),
    ...pilotInventoryDiagnostics(pilotInventory),
    ...schemaCompanionDiagnostics(
      "feature schema companion",
      featureSchema,
      featureMatrixRootRequired,
      O.some(featureRowRequired),
      [
        "featureFamily",
        "ruleSourceClass",
        "boundaryEnforcementScope",
        "baselineStatus",
        "falsePositiveStatus",
        "ciMode",
        "promotionStatus",
        "runtimeScope",
        "repoCommandPhase",
        "commandImplementationStatus",
        "attributionMode",
        "basePolicy",
        "adjacentFindingPolicy",
      ],
      O.some("features")
    ),
    ...schemaCompanionDiagnostics(
      "knip schema companion",
      knipSchema,
      knipParityRootRequired,
      O.some(knipParityRowRequired),
      ["knipRemovalRecommendation", "gapStatus", "promotionStatus", "retirementDecision"],
      O.some("rows")
    ),
    ...schemaCompanionDiagnostics(
      "tasks schema companion",
      taskSchema,
      taskRootRequired,
      O.some(taskRowRequired),
      ["status", "riskLevel", "phase"],
      O.some("tasks")
    ),
    ...schemaCompanionDiagnostics(
      "report fixture schema companion",
      reportSchema,
      reportFixtureRootRequired,
      O.some(reportFixtureItemRequired),
      ["fallowEnvelopeStatus", "featureFamily", "findingAttributionKind"],
      O.some("fixtures"),
      true,
      ["report", "stderrExcerpt"]
    ),
    ...reportSchemaWireKeyDiagnostics(reportSchema),
    ...reportSchemaYeetIssueFixtureDiagnostics(reportSchema),
    ...schemaCompanionDiagnostics(
      "review rounds schema companion",
      reviewSchema,
      reviewRoundsRootRequired,
      O.some(reviewRoundItemRequired),
      ["reviewFindingSeverity", "reviewClosureStatus", "residualRiskLevel"],
      O.some("rounds")
    ),
    ...schemaCompanionDiagnostics(
      "boundary provenance schema companion",
      boundaryProvenanceSchema,
      boundaryProvenanceRootRequired,
      O.some(boundaryProvenanceRowRequired),
      ["ruleSourceClass", "boundaryEnforcementScope"],
      O.some("rules")
    ),
  ];
});

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const diagnostics = yield* validate();

  if (A.isReadonlyArrayEmpty(diagnostics)) {
    yield* Console.log(`fallow-quality-enforcement packet ok (${path.relative(process.cwd(), process.cwd()) || "."})`);
    return;
  }

  yield* Console.error("fallow-quality-enforcement packet failed:");
  for (const diagnostic of diagnostics) {
    yield* Console.error(`- ${diagnostic}`);
  }
  return yield* PacketValidationFailed.make({});
});

NodeRuntime.runMain(program.pipe(Effect.provide(Layer.mergeAll(NodeServices.layer))));
