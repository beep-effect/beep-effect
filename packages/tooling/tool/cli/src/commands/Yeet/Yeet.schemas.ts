/**
 * Shared schema-first models for the Yeet command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { DEFAULT_YEET_PACKET_DIR, YeetProofTier, YeetRunMode } from "./internal/Planner.ts";

const $I = $RepoCliId.create("commands/Yeet/Yeet.schemas");

/**
 * Classification domain for normalized yeet quality findings.
 *
 * @example
 * ```ts
 * import { QualityIssueCategory } from "@beep/repo-cli/commands/Yeet"
 *
 * console.log(QualityIssueCategory.is.typecheck("typecheck"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityIssueCategory = LiteralKit([
  "typecheck",
  "effect-tsgo-policy",
  "docgen-jsdoc-quality",
  "repo-law",
  "schema-first-policy",
  "lint-tool",
  "test",
  "build",
  "changeset-policy",
  "repo-export-policy",
  "security-audit",
  "pr-review",
  "greptile-review",
  "bot-review",
  "command-failure",
  "parser-error",
  "unknown-raw",
]).pipe(
  $I.annoteSchema("QualityIssueCategory", {
    description: "Category for a normalized yeet quality issue.",
  })
);

/**
 * Type-level union of normalized yeet quality finding categories.
 *
 * @example
 * ```ts
 * import type { QualityIssueCategory } from "@beep/repo-cli/commands/Yeet"
 *
 * const category: QualityIssueCategory = "typecheck"
 * console.log(category) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type QualityIssueCategory = typeof QualityIssueCategory.Type;

/**
 * Blocking level assigned to a normalized yeet quality finding.
 *
 * @example
 * ```ts
 * import { QualityIssueSeverity } from "@beep/repo-cli/commands/Yeet"
 *
 * console.log(QualityIssueSeverity.is.error("error"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityIssueSeverity = LiteralKit(["info", "warning", "error", "fatal"]).pipe(
  $I.annoteSchema("QualityIssueSeverity", {
    description: "Severity assigned to a yeet quality issue.",
  })
);

/**
 * Type-level union of yeet quality severity literals.
 *
 * @example
 * ```ts
 * import type { QualityIssueSeverity } from "@beep/repo-cli/commands/Yeet"
 *
 * const severity: QualityIssueSeverity = "error"
 * console.log(severity) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type QualityIssueSeverity = typeof QualityIssueSeverity.Type;

/**
 * Parser confidence for a normalized issue.
 *
 * @example
 * ```ts
 * import { QualityIssueConfidence } from "@beep/repo-cli/commands/Yeet"
 *
 * console.log(QualityIssueConfidence.is.raw("raw"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityIssueConfidence = LiteralKit(["structured", "partial", "raw"]).pipe(
  $I.annoteSchema("QualityIssueConfidence", {
    description: "Confidence level for a yeet quality issue parser result.",
  })
);

/**
 * Parser confidence for a normalized issue.
 *
 * @example
 * ```ts
 * import type { QualityIssueConfidence } from "@beep/repo-cli/commands/Yeet"
 *
 * const confidence: QualityIssueConfidence = "structured"
 * console.log(confidence) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type QualityIssueConfidence = typeof QualityIssueConfidence.Type;

/**
 * Source attribution carried by normalized advisory analyzer issues.
 *
 * @example
 * ```ts
 * import { QualityIssueAttribution } from "@beep/repo-cli/commands/Yeet"
 *
 * console.log(QualityIssueAttribution.is.introduced("introduced"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityIssueAttribution = LiteralKit(["introduced", "inherited-adjacent", "not-applicable"]).pipe(
  $I.annoteSchema("QualityIssueAttribution", {
    description: "Attribution class for advisory analyzer issues normalized into Yeet packets.",
  })
);

/**
 * Source attribution carried by normalized advisory analyzer issues.
 *
 * @example
 * ```ts
 * import type { QualityIssueAttribution } from "@beep/repo-cli/commands/Yeet"
 *
 * const attribution: QualityIssueAttribution = "introduced"
 * console.log(attribution) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type QualityIssueAttribution = typeof QualityIssueAttribution.Type;

/**
 * Specialist routing hint for one issue.
 *
 * @example
 * ```ts
 * import { QualityIssueRouting } from "@beep/repo-cli/commands/Yeet"
 *
 * const routing = QualityIssueRouting.make({ skill: "effect-first-development", reason: "Effect law failure" })
 * console.log(routing.skill)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityIssueRouting extends S.Class<QualityIssueRouting>($I`QualityIssueRouting`)(
  {
    skill: S.String,
    reason: S.String,
  },
  $I.annote("QualityIssueRouting", {
    description: "Suggested specialist skill or agent route for a quality issue.",
  })
) {}

/**
 * One normalized quality issue.
 *
 * @example
 * ```ts
 * import { QualityIssue } from "@beep/repo-cli/commands/Yeet"
 *
 * const issue = QualityIssue.make({
 *   blocking: true,
 *   category: "command-failure",
 *   confidence: "raw",
 *   evidence: [],
 *   id: "issue-1",
 *   message: "Command failed",
 *   routing: [],
 *   severity: "error",
 *   tool: "yeet",
 *   parser: "yeet/raw"
 * })
 * console.log(issue.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityIssue extends S.Class<QualityIssue>($I`QualityIssue`)(
  {
    id: S.String,
    category: QualityIssueCategory,
    subCategory: S.optionalKey(S.String),
    severity: QualityIssueSeverity,
    blocking: S.Boolean,
    confidence: QualityIssueConfidence,
    message: S.String,
    evidence: S.Array(S.String),
    remediation: S.optionalKey(S.String),
    packageName: S.optionalKey(S.String),
    packagePath: S.optionalKey(S.String),
    file: S.optionalKey(S.String),
    line: S.optionalKey(S.Finite),
    column: S.optionalKey(S.Finite),
    endLine: S.optionalKey(S.Finite),
    endColumn: S.optionalKey(S.Finite),
    symbol: S.optionalKey(S.String),
    exportName: S.optionalKey(S.String),
    sourceAnchor: S.optionalKey(S.String),
    tool: S.String,
    parser: S.String,
    attribution: QualityIssueAttribution.pipe(S.optionalKey),
    task: S.optionalKey(S.String),
    label: S.optionalKey(S.String),
    command: S.optionalKey(S.String),
    cwd: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    rawOutputRef: S.optionalKey(S.String),
    rawExcerpt: S.optionalKey(S.String),
    truncated: S.optionalKey(S.Boolean),
    turboTaskId: S.optionalKey(S.String),
    turboHash: S.optionalKey(S.String),
    cacheState: S.optionalKey(S.String),
    routing: S.Array(QualityIssueRouting),
  },
  $I.annote("QualityIssue", {
    description: "One normalized quality issue captured by yeet.",
  })
) {}

/**
 * Package-level issue report rendered into a quality packet.
 *
 * @example
 * ```ts
 * import { PackageQualityReport } from "@beep/repo-cli/commands/Yeet"
 *
 * const report = PackageQualityReport.make({ issueCount: 0, blockingCount: 0, issues: [], packageName: "@beep/root" })
 * console.log(report.issueCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageQualityReport extends S.Class<PackageQualityReport>($I`PackageQualityReport`)(
  {
    packageName: S.String,
    packagePath: S.optionalKey(S.String),
    issueCount: S.Finite,
    blockingCount: S.Finite,
    issues: S.Array(QualityIssue),
  },
  $I.annote("PackageQualityReport", {
    description: "Package-grouped view of yeet quality issues.",
  })
) {}

/**
 * Complete quality issue index for a yeet run.
 *
 * @example
 * ```ts
 * import { QualityIssueIndex } from "@beep/repo-cli/commands/Yeet"
 *
 * const index = QualityIssueIndex.make({ issues: [], packages: [], rawOutputRefs: [], schemaVersion: "yeet-quality-issue-index/v1" })
 * console.log(index.schemaVersion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityIssueIndex extends S.Class<QualityIssueIndex>($I`QualityIssueIndex`)(
  {
    schemaVersion: S.Literal("yeet-quality-issue-index/v1"),
    issues: S.Array(QualityIssue),
    packages: S.Array(PackageQualityReport),
    rawOutputRefs: S.Array(S.String),
  },
  $I.annote("QualityIssueIndex", {
    description: "Schema-first collection of issues and package packet summaries for yeet.",
  })
) {}

/**
 * Runtime options accepted by the yeet handler.
 *
 * @example
 * ```ts
 * import { YeetRunOptions } from "@beep/repo-cli/commands/Yeet"
 *
 * const options = YeetRunOptions.make({
 *   allowStaleBase: false,
 *   amend: false,
 *   base: "origin/main",
 *   bots: "greptile,coderabbit,chatgpt",
 *   collectAll: false,
 *   fast: false,
 *   head: "HEAD",
 *   json: false,
 *   message: "",
 *   mode: "verify",
 *   monitor: false,
 *   noEdit: false,
 *   packetDir: ".beep/yeet",
 *   plan: true,
 *   pr: false,
 *   pushOnly: false,
 *   remote: false,
 *   replyBody: "",
 *   replyThread: "",
 *   requireGreptileIssues: -1,
 *   requireGreptileScore: "",
 *   requireReviewComments: -1,
 *   resolveThreads: "",
 *   retriggerGreptile: false,
 *   reuseVerified: false,
 *   stagedOnly: false,
 *   summary: false,
 *   startPrEarly: false,
 *   tier: "full"
 * })
 * console.log(options.base)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetRunOptions extends S.Class<YeetRunOptions>($I`YeetRunOptions`)(
  {
    allowStaleBase: S.Boolean,
    amend: S.Boolean,
    base: S.String,
    bots: S.String,
    collectAll: S.Boolean,
    fast: S.Boolean,
    head: S.String,
    json: S.Boolean,
    message: S.String,
    mode: YeetRunMode,
    monitor: S.Boolean,
    noEdit: S.Boolean,
    packetDir: S.String,
    plan: S.Boolean,
    pr: S.Boolean,
    pushOnly: S.Boolean,
    remote: S.Boolean,
    replyBody: S.String,
    replyThread: S.String,
    requireGreptileIssues: S.Finite,
    requireGreptileScore: S.String,
    requireReviewComments: S.Finite,
    resolveThreads: S.String,
    retriggerGreptile: S.Boolean,
    reuseVerified: S.Boolean,
    stagedOnly: S.Boolean,
    summary: S.Boolean,
    startPrEarly: S.Boolean,
    tier: YeetProofTier,
  },
  $I.annote("YeetRunOptions", {
    description: "Runtime options accepted by the yeet handler.",
  })
) {}

/**
 * Result returned by a yeet execution attempt.
 *
 * @example
 * ```ts
 * import { YeetRunResult } from "@beep/repo-cli/commands/Yeet"
 *
 * const result = YeetRunResult.make({ artifactDir: ".beep/yeet", committed: false, packetPaths: [], pushed: false })
 * console.log(result.artifactDir)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetRunResult extends S.Class<YeetRunResult>($I`YeetRunResult`)(
  {
    artifactDir: S.String,
    committed: S.Boolean,
    pushed: S.Boolean,
    packetPaths: S.Array(S.String),
    indexPath: S.optionalKey(S.String),
  },
  $I.annote("YeetRunResult", {
    description: "Execution result and artifact paths emitted by yeet.",
  })
) {}

/**
 * Reviewed staged paths that Yeet is allowed to commit and publish.
 *
 * @example
 * ```ts
 * import { YeetStagedPublishIntent } from "@beep/repo-cli/commands/Yeet"
 *
 * const intent = YeetStagedPublishIntent.make({ paths: ["packages/tooling/tool/cli/src/index.ts"] })
 * console.log(intent.paths.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetStagedPublishIntent extends S.Class<YeetStagedPublishIntent>($I`YeetStagedPublishIntent`)(
  {
    kind: S.tag("staged"),
    paths: S.Array(S.String),
  },
  $I.annote("YeetStagedPublishIntent", {
    description: "Reviewed staged paths that yeet is allowed to commit and publish.",
  })
) {}

/**
 * Clean local commit state that Yeet may prove and push without creating a new
 * commit.
 *
 * **Example** (Resume from an existing commit)
 *
 * ```ts
 * import { YeetExistingCommitPublishIntent } from "@beep/repo-cli/commands/Yeet"
 *
 * const intent = YeetExistingCommitPublishIntent.make({ commitSha: "abc123", paths: ["src/index.ts"] })
 * console.log(intent.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetExistingCommitPublishIntent extends S.Class<YeetExistingCommitPublishIntent>(
  $I`YeetExistingCommitPublishIntent`
)(
  {
    kind: S.tag("existing-commit"),
    commitSha: S.String,
    paths: S.Array(S.String),
  },
  $I.annote("YeetExistingCommitPublishIntent", {
    description: "Clean local commit state ahead of the publish target that yeet may prove and push.",
  })
) {}

/**
 * Publish intent state selected from reviewed staged changes or a clean local
 * commit ahead of the publish target.
 *
 * **Example** (Decode a staged intent)
 *
 * ```ts
 * import { YeetPublishIntent } from "@beep/repo-cli/commands/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(YeetPublishIntent)({ kind: "staged", paths: ["src/index.ts"] })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPublishIntent = S.Union([YeetStagedPublishIntent, YeetExistingCommitPublishIntent]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("YeetPublishIntent", {
    description: "Publish intent selected from reviewed staged changes or a clean local commit ahead of the target.",
  })
);

/** Decoded staged-or-existing-commit publish intent.
 *
 * @see {@link YeetPublishIntent} for the runtime tagged-union schema.
 * @category models
 * @since 0.0.0
 */
export type YeetPublishIntent = typeof YeetPublishIntent.Type;

/**
 * Construct baseline yeet options for focused tests.
 *
 * @param overrides - Partial option values to replace the defaults.
 * @returns Runtime options with repo-standard defaults applied.
 * @example
 * ```ts
 * import { defaultYeetRunOptions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(defaultYeetRunOptions({ mode: "verify" }).mode)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const defaultYeetRunOptions = (overrides: Partial<YeetRunOptions> = {}): YeetRunOptions =>
  YeetRunOptions.make({
    allowStaleBase: false,
    amend: false,
    base: "origin/main",
    bots: "greptile",
    collectAll: false,
    fast: false,
    head: "HEAD",
    json: false,
    message: "",
    mode: "publish",
    monitor: false,
    noEdit: false,
    packetDir: DEFAULT_YEET_PACKET_DIR,
    plan: false,
    pr: false,
    pushOnly: false,
    remote: false,
    replyBody: "",
    replyThread: "",
    requireGreptileIssues: -1,
    requireGreptileScore: "",
    requireReviewComments: -1,
    resolveThreads: "",
    retriggerGreptile: false,
    reuseVerified: false,
    stagedOnly: false,
    summary: false,
    startPrEarly: false,
    tier: "full",
    ...overrides,
  });
