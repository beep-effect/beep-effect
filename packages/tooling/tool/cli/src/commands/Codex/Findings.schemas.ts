/**
 * Normalized findings records, the packet plan they produce, and the validated
 * option models for every `beep codex findings` subcommand.
 *
 * A {@link CodexFindingRecord} is a captured row that has been assigned a stable
 * `CSF-NNN` identity. It carries only the six fields a capture can actually
 * prove: identity, title, severity, dashboard status, and source commit. Every
 * judgment field a packet eventually needs — owner area, verdict, disposition,
 * remediation lane — is written later by a triage agent, never invented here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  CaptureDate,
  CodexFindingId,
  CodexFindingSeverity,
  CodexFindingStatus,
  CodexFindingTitle,
  GitCommitSha,
  GitHubRepoSlug,
} from "./Findings.capture.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Codex/Findings.schemas");

/**
 * Stable `CSF-NNN` identity the CLI assigns to one captured finding.
 *
 * **Details**
 *
 * Identities are assigned from a deterministic sort, never from the dashboard's
 * row order, so re-capturing the same batch reproduces the same numbering. They
 * are the only value a packet filename is ever built from.
 *
 * **Example** (Validating a record identity)
 *
 * ```ts
 * import { CodexRecordId } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexRecordId)("CSF-001")) // true
 * console.log(S.is(CodexRecordId)("CSF-1")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexRecordId = S.String.check(
  S.isPattern(/^CSF-\d{3,}$/, {
    identifier: $I`CodexRecordIdPatternCheck`,
    title: "Codex Record Id Pattern",
    description: "Record identities are CSF- followed by at least three digits.",
    message: "Expected a CSF-NNN record identifier",
  })
).pipe(
  $I.annoteSchema("CodexRecordId", {
    description: "Stable CSF-NNN identity assigned to a captured finding.",
  })
);

/**
 * Record identity of one normalized finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexRecordId = typeof CodexRecordId.Type;

/**
 * Packet directory name under `goals/`.
 *
 * **Gotchas**
 *
 * The pattern admits no dot, slash, or leading hyphen, so a slug can never
 * express a parent-directory traversal or a hidden directory. Path containment
 * is still enforced again at the filesystem boundary; this check exists so a
 * bad slug fails with a readable message before any path is built.
 *
 * **Example** (Rejecting a traversal slug)
 *
 * ```ts
 * import { CodexPacketSlug } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexPacketSlug)("codex-security-findings-2026-08-04")) // true
 * console.log(S.is(CodexPacketSlug)("../../etc")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexPacketSlug = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9-]{0,80}$/, {
    identifier: $I`CodexPacketSlugPatternCheck`,
    title: "Codex Packet Slug Pattern",
    description: "Packet slugs are bounded lowercase path segments.",
    message: "Expected a lowercase hyphenated packet slug",
  })
).pipe(
  $I.annoteSchema("CodexPacketSlug", {
    description: "Bounded lowercase directory name of a generated goal packet.",
  })
);

/**
 * Directory name of a generated packet.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexPacketSlug = typeof CodexPacketSlug.Type;

/**
 * Git branch name a generated packet declares as its remediation branch.
 *
 * **Example** (Validating a branch name)
 *
 * ```ts
 * import { CodexPacketBranch } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexPacketBranch)("security/codex-findings-2026-08-04")) // true
 * console.log(S.is(CodexPacketBranch)("branch with spaces")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexPacketBranch = S.String.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._\-/]{0,100}$/, {
    identifier: $I`CodexPacketBranchPatternCheck`,
    title: "Codex Packet Branch Pattern",
    description: "Branch names are bounded and free of shell-significant characters.",
    message: "Expected a plain git branch name",
  })
).pipe(
  $I.annoteSchema("CodexPacketBranch", {
    description: "Remediation branch name recorded in a generated packet.",
  })
);

/**
 * Remediation branch declared by a packet.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexPacketBranch = typeof CodexPacketBranch.Type;

/**
 * One captured finding after stable identity assignment.
 *
 * **Details**
 *
 * These six fields are exactly what a capture can prove. Renderers accept this
 * shape and nothing wider, so no generated packet file can carry prose that was
 * not written by a human or a triage agent.
 *
 * **Example** (Constructing a normalized record)
 *
 * ```ts
 * import { CodexFindingRecord } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 *
 * const record = CodexFindingRecord.make({
 *   id: "CSF-001",
 *   codexId: "d2b9e11e8550819193516057a336ff90",
 *   title: "Unbounded source resolution enables sidecar memory DoS",
 *   severity: "Medium",
 *   codexStatus: "Open",
 *   commit: "244529aa4f560421cd096c2a4a4cb3cd21923070",
 * })
 *
 * console.log(record.id) // "CSF-001"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexFindingRecord extends S.Class<CodexFindingRecord>($I`CodexFindingRecord`)(
  {
    id: CodexRecordId.pipe(
      $I.annoteKey("CodexFindingRecord.id", {
        description: "Stable CSF-NNN identity used for filenames and cross-references.",
      })
    ),
    codexId: CodexFindingId.pipe(
      $I.annoteKey("CodexFindingRecord.codexId", {
        description: "Codex Cloud identifier used to reconcile reruns and post-merge closure.",
      })
    ),
    title: CodexFindingTitle.pipe(
      $I.annoteKey("CodexFindingRecord.title", {
        description: "Single-line finding title, escaped again at render time.",
      })
    ),
    severity: CodexFindingSeverity.pipe(
      $I.annoteKey("CodexFindingRecord.severity", {
        description: "Severity reported by the dashboard.",
      })
    ),
    codexStatus: CodexFindingStatus.pipe(
      $I.annoteKey("CodexFindingRecord.codexStatus", {
        description: "Dashboard lifecycle status at capture time.",
      })
    ),
    commit: GitCommitSha.pipe(
      $I.annoteKey("CodexFindingRecord.commit", {
        description: "Source commit the finding was reported against.",
      })
    ),
  },
  $I.annote("CodexFindingRecord", {
    description: "A captured Codex finding after stable CSF-NNN identity assignment.",
  })
) {}

/**
 * Finding totals per severity, in severity-domain order.
 *
 * **Gotchas**
 *
 * Severities with a zero count are omitted rather than written as `0`, matching
 * the `catalog.severityCounts` block every hand-written Codex packet already
 * ships.
 *
 * **Example** (Reading a count map)
 *
 * ```ts
 * import { CodexSeverityCounts } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexSeverityCounts)({ Medium: 13, Low: 7 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexSeverityCounts extends S.Class<CodexSeverityCounts>($I`CodexSeverityCounts`)(
  {
    High: S.optionalKey(S.Int),
    Medium: S.optionalKey(S.Int),
    Low: S.optionalKey(S.Int),
    Informational: S.optionalKey(S.Int),
  },
  $I.annote("CodexSeverityCounts", {
    description: "Captured finding totals per severity, omitting zero-count severities.",
  })
) {}

/**
 * Everything the packet renderers need, resolved and ordered.
 *
 * **When to use**
 *
 * Use as the single argument to every packet renderer. Building the plan is the
 * last stage that can fail on data; rendering from a plan is total.
 *
 * **Example** (Constructing a packet plan)
 *
 * ```ts
 * import { CodexPacketPlan } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 *
 * const plan = CodexPacketPlan.make({
 *   slug: "codex-security-findings-2026-08-04",
 *   branch: "security/codex-findings-2026-08-04",
 *   capturedAt: "2026-08-04",
 *   repository: "kriegcloud/beep-effect",
 *   sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
 *   findingsView: "repo-scoped, status=open",
 *   expectedCount: 0,
 *   records: [],
 *   severityCounts: {},
 * })
 *
 * console.log(plan.slug) // "codex-security-findings-2026-08-04"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexPacketPlan extends S.Class<CodexPacketPlan>($I`CodexPacketPlan`)(
  {
    slug: CodexPacketSlug.pipe(
      $I.annoteKey("CodexPacketPlan.slug", {
        description: "Directory name of the packet under goals/.",
      })
    ),
    branch: CodexPacketBranch.pipe(
      $I.annoteKey("CodexPacketPlan.branch", {
        description: "Remediation branch the packet declares.",
      })
    ),
    capturedAt: CaptureDate.pipe(
      $I.annoteKey("CodexPacketPlan.capturedAt", {
        description: "Calendar date of the capture run.",
      })
    ),
    repository: GitHubRepoSlug.pipe(
      $I.annoteKey("CodexPacketPlan.repository", {
        description: "Repository the findings view was scoped to.",
      })
    ),
    sourceUrl: S.String.pipe(
      $I.annoteKey("CodexPacketPlan.sourceUrl", {
        description: "Dashboard URL recorded as packet provenance.",
      })
    ),
    findingsView: S.String.pipe(
      $I.annoteKey("CodexPacketPlan.findingsView", {
        description: "Filter description of the captured dashboard view.",
      })
    ),
    expectedCount: S.Int.pipe(
      $I.annoteKey("CodexPacketPlan.expectedCount", {
        description: "Finding total the dashboard reported, reconciled against the records.",
      })
    ),
    records: S.Array(CodexFindingRecord).pipe(
      $I.annoteKey("CodexPacketPlan.records", {
        description: "Normalized findings in assigned CSF-NNN order.",
      })
    ),
    severityCounts: CodexSeverityCounts.pipe(
      $I.annoteKey("CodexPacketPlan.severityCounts", {
        description: "Per-severity totals rendered into the manifest catalog.",
      })
    ),
  },
  $I.annote("CodexPacketPlan", {
    description: "Resolved, ordered input to every generated packet document.",
  })
) {}

/**
 * Validated options accepted by `beep codex findings ingest`.
 *
 * **Details**
 *
 * `date`, `slug`, and `branch` are overrides; when absent they are derived from
 * the payload's own capture provenance rather than from the wall clock, which
 * is what makes a re-ingest of the same payload byte-identical.
 *
 * **Example** (Constructing ingest options)
 *
 * ```ts
 * import { CodexFindingsIngestOptions } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import * as O from "effect/Option"
 *
 * const options = CodexFindingsIngestOptions.make({
 *   from: O.some("payload.json"),
 *   slug: O.none(),
 *   date: O.none(),
 *   branch: O.none(),
 *   expectedCount: O.none(),
 *   refresh: false,
 *   force: false,
 *   dryRun: true,
 *   json: false,
 * })
 *
 * console.log(options.dryRun) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexFindingsIngestOptions extends S.Class<CodexFindingsIngestOptions>($I`CodexFindingsIngestOptions`)(
  {
    from: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    slug: S.OptionFromOptionalKey(CodexPacketSlug).pipe(SchemaUtils.withNoneDefault),
    date: S.OptionFromOptionalKey(CaptureDate).pipe(SchemaUtils.withNoneDefault),
    branch: S.OptionFromOptionalKey(CodexPacketBranch).pipe(SchemaUtils.withNoneDefault),
    expectedCount: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    refresh: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    force: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    dryRun: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    json: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("CodexFindingsIngestOptions", {
    description: "Validated options accepted by `beep codex findings ingest`.",
  })
) {}

/**
 * Decode raw CLI flags into validated `beep codex findings ingest` options.
 *
 * **Example** (Rejecting a traversal slug from the command line)
 *
 * ```ts
 * import { decodeCodexFindingsIngestOptions } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import { Effect } from "effect"
 *
 * const program = decodeCodexFindingsIngestOptions({ slug: "../../etc" }).pipe(
 *   Effect.map(() => "accepted"),
 *   Effect.orElseSucceed(() => "rejected")
 * )
 *
 * console.log(Effect.runSync(program)) // "rejected"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCodexFindingsIngestOptions: {
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<CodexFindingsIngestOptions, S.SchemaError>;
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<CodexFindingsIngestOptions, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(CodexFindingsIngestOptions));
