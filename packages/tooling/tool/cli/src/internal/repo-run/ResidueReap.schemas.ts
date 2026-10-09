/**
 * Schema-first report models for the home-residue janitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/ResidueReap.schemas");
const ResidueTerminalState = LiteralKit([
  "completed",
  "failed",
  "cancelled",
  "active",
  "paused",
  "unknown",
  "unverified",
]);
const ResidueDisposition = LiteralKit(["regenerable", "redundant", "retain"]);
const ResidueReapMode = LiteralKit(["dry-run", "apply", "resume", "restore"]);
const ResidueArchivePhase = LiteralKit(["intent", "moved", "restored", "fenced-live"]);

/**
 * Home-residue families owned by the janitor's closed policy.
 *
 * **Example** (Recognize a cleanup class)
 *
 * ```ts
 * import { ResidueReapClass } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ResidueReapClass.is["turbo-cache"]("turbo-cache")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapClass = LiteralKit([
  "codex-sessions",
  "codex-worktrees",
  "turbo-cache",
  "beep-cache-disposable",
  "merged-preview",
  "turbo-runs",
  "shared-turbo-cache",
  "qualification-views",
  "checkout-qa",
  "checkout-qualification",
  "checkout-generated",
  "checkout-jobs",
  "checkout-ledgers",
  "checkout-pids",
  "checkout-material",
]).pipe(
  $I.annoteSchema("ResidueReapClass", {
    description: "Home-residue family recognized by the janitor's closed discovery policy.",
  })
);

/**
 * Home-residue family recognized by the janitor.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapClass = typeof ResidueReapClass.Type;

/**
 * Filesystem action selected for one home-residue candidate.
 *
 * **Example** (Recognize a directory removal action)
 *
 * ```ts
 * import { ResidueReapAction } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ResidueReapAction.is["remove-dir"]("remove-dir")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapAction = LiteralKit([
  "remove-file",
  "remove-dir",
  "worktree-remove",
  "archive-move",
  "skip",
]).pipe(
  $I.annoteSchema("ResidueReapAction", {
    description: "Filesystem action selected after a residue candidate's evidence is evaluated.",
  })
);

/**
 * Filesystem action selected for one candidate.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapAction = typeof ResidueReapAction.Type;

/**
 * Fail-closed reason that prevented removal of a residue candidate.
 *
 * **Example** (Recognize a liveness refusal)
 *
 * ```ts
 * import { ResidueReapSkipReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ResidueReapSkipReason.is["live-cwd-ref"]("live-cwd-ref")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapSkipReason = LiteralKit([
  "too-young",
  "protected-name",
  "wrong-shape",
  "stat-failed",
  "census-failed",
  "census-overflow",
  "dirty-tree",
  "git-probe-failed",
  "live-cwd-ref",
  "process-probe-failed",
  "path-changed",
  "removal-failed",
  "pid-alive",
  "within-size-budget",
  "kept-newest",
  "evidence-referenced",
  "worktree-remove-failed",
  "owner-ruling-required",
  "foreign-owner",
  "terminal-state-unverified",
  "lock-held",
  "draft-unresolved",
  "checkout-recent-write",
]).pipe(
  $I.annoteSchema("ResidueReapSkipReason", {
    description: "Precise missing or negative safety evidence that prevented residue removal.",
  })
);

/**
 * Fail-closed reason that prevented candidate removal.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapSkipReason = typeof ResidueReapSkipReason.Type;

/**
 * Non-negative finite age threshold measured in days.
 *
 * **Example** (Validate a threshold)
 *
 * ```ts
 * import { ResidueReapAgeDays } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResidueReapAgeDays)(30)) // true
 * console.log(S.is(ResidueReapAgeDays)(-1)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapAgeDays = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ResidueReapAgeDays", {
    description: "Schema-validated non-negative finite cleanup threshold in days.",
  })
);

/**
 * Non-negative finite age threshold measured in days.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapAgeDays = typeof ResidueReapAgeDays.Type;

/**
 * Non-negative finite byte budget for size-based eviction.
 *
 * **Example** (Validate a byte cap)
 *
 * ```ts
 * import { ResidueReapByteCap } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResidueReapByteCap)(21474836480)) // true
 * console.log(S.is(ResidueReapByteCap)(-1)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapByteCap = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ResidueReapByteCap", {
    description: "Schema-validated non-negative byte budget a size-evicted residue class is trimmed down to.",
  })
);

/**
 * Non-negative finite byte budget for size-based eviction.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapByteCap = typeof ResidueReapByteCap.Type;

/**
 * Non-negative count of newest entries a residue class always retains.
 *
 * **Example** (Validate a keep count)
 *
 * ```ts
 * import { ResidueReapKeepCount } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResidueReapKeepCount)(2)) // true
 * console.log(S.is(ResidueReapKeepCount)(1.5)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapKeepCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ResidueReapKeepCount", {
    description: "Schema-validated non-negative number of newest entries a residue class always keeps.",
  })
);

/**
 * Non-negative count of newest entries a residue class always retains.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapKeepCount = typeof ResidueReapKeepCount.Type;

/**
 * The one field of a qualification dependency receipt the janitor reads.
 *
 * **Details**
 *
 * A `cache-dependency-materialization/v1` receipt under the qualification
 * `evidence/` tree names the dependency view it was proven against. A view any
 * receipt still cites must survive so the receipt stays replayable. Every other
 * receipt field is ignored here, so a receipt that grows new fields still
 * decodes; one that loses `directory` or changes version fails closed.
 *
 * **Example** (Decode a receipt's cited view)
 *
 * ```ts
 * import { QualificationViewReceipt } from "@beep/repo-cli/test/RepoRun"
 *
 * const receipt = QualificationViewReceipt.make({
 *   schemaVersion: "cache-dependency-materialization/v1",
 *   directory: "/home/me/.cache/beep/turbo-qualification/dependencies/view-abc",
 * })
 * console.log(receipt.directory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QualificationViewReceipt extends S.Class<QualificationViewReceipt>($I`QualificationViewReceipt`)(
  {
    schemaVersion: S.Literal("cache-dependency-materialization/v1"),
    directory: S.String,
  },
  $I.annote("QualificationViewReceipt", {
    description: "Dependency-view citation read from a qualification evidence receipt.",
  })
) {}

/**
 * Absolute, non-empty home directory accepted as a cleanup root.
 *
 * **Details**
 *
 * A sanitized environment can carry `HOME` as an empty string; resolving that
 * through `path.resolve` silently turns the current working directory into the
 * cleanup root. This schema fails such inputs closed before any discovery.
 *
 * **Example** (Reject an empty home)
 *
 * ```ts
 * import { ResidueReapHomeRoot } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResidueReapHomeRoot)("/home/me")) // true
 * console.log(S.is(ResidueReapHomeRoot)("")) // false
 * console.log(S.is(ResidueReapHomeRoot)("relative/home")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapHomeRoot = S.Trim.check(
  S.isNonEmpty({ message: "String must not be empty" }),
  S.isPattern(/^\//u)
).pipe(
  $I.annoteSchema("ResidueReapHomeRoot", {
    description: "Absolute, non-empty home directory accepted as a residue cleanup root.",
  })
);

/**
 * Absolute, non-empty home directory accepted as a cleanup root.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapHomeRoot = typeof ResidueReapHomeRoot.Type;

/**
 * One residue candidate and the complete evidence used to choose its action.
 *
 * **Details**
 *
 * `checkoutRoot` names the checkout a repository-scoped candidate belongs to,
 * which is also its apply-time outer boundary. `mtimeMillis` is the modification
 * time the assessment saw; size-evicted entries are removed only while it is
 * unchanged. `groupKey` ties together the files of one shared Turbo cache entry.
 *
 * **Example** (Describe an eligible session file)
 *
 * ```ts
 * import { ResidueReapCandidate } from "@beep/repo-cli/test/RepoRun"
 *
 * const candidate = ResidueReapCandidate.make({
 *   root: "/home/me/.codex/sessions",
 *   path: "/home/me/.codex/sessions/old.jsonl",
 *   reapClass: "codex-sessions",
 *   ageDays: 45,
 *   action: "remove-file",
 * })
 * console.log(candidate.action) // "remove-file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueReapCandidate extends S.Class<ResidueReapCandidate>($I`ResidueReapCandidate`)(
  {
    root: S.String,
    path: S.String,
    reapClass: ResidueReapClass,
    ageDays: S.optional(S.Finite),
    action: ResidueReapAction,
    skipReason: S.optional(ResidueReapSkipReason),
    entriesScanned: S.optional(S.Int),
    bytes: S.optional(S.Finite),
    checkoutRoot: S.optional(S.String),
    mtimeMillis: S.optional(S.Finite),
    groupKey: S.optional(S.String),
    owner: S.optional(S.String),
    terminalState: S.optional(ResidueTerminalState),
    recoveryDestination: S.optional(S.String),
    retentionReason: S.optional(S.String),
    bytesExclusive: S.optional(ResidueReapByteCap),
  },
  $I.annote("ResidueReapCandidate", {
    description: "One home-residue candidate with age, census, action, and fail-closed skip evidence.",
  })
) {}

/**
 * Auditable result of one dry-run or applied home-residue janitor pass.
 *
 * **Details**
 *
 * Version 3 adds persisted archive runs, ownership and terminal-state metadata,
 * recovery destinations, and checkout retention classes. Earlier version
 * decoders reject the new tag instead of treating archive moves as deletions.
 *
 * **Example** (Construct an empty dry-run report)
 *
 * ```ts
 * import { ResidueReapReport } from "@beep/repo-cli/test/RepoRun"
 *
 * const report = ResidueReapReport.make({
 *   scannedAt: "2026-09-03T12:00:00.000Z",
 *   homeRoot: "/home/me",
 *   repoRoot: "/repo",
 *   maxAgeDays: 30,
 *   turboMaxAgeDays: 14,
 *   turboRunsMaxAgeDays: 1,
 *   sharedTurboCacheRoot: "/home/me/.cache/beep/turbo",
 *   sharedTurboMaxAgeDays: 14,
 *   sharedTurboMaxBytes: 21474836480,
 *   qualificationViewsKeep: 2,
 *   fleet: false,
 *   checkoutRoots: ["/repo"],
 *   applied: false,
 *   classes: ["codex-sessions"],
 *   candidates: [],
 *   reapedCount: 0,
 *   reclaimedBytes: 0,
 *   warnings: [],
 * })
 * console.log(report.schemaVersion) // "residue-reap/v3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueReapReport extends S.Class<ResidueReapReport>($I`ResidueReapReport`)(
  {
    schemaVersion: S.tag("residue-reap/v3"),
    runId: S.optional(S.String),
    reportPath: S.optional(S.String),
    scannedAt: S.String,
    homeRoot: S.String,
    repoRoot: S.String,
    maxAgeDays: ResidueReapAgeDays,
    turboMaxAgeDays: ResidueReapAgeDays,
    turboRunsMaxAgeDays: ResidueReapAgeDays,
    sharedTurboCacheRoot: S.String,
    sharedTurboMaxAgeDays: ResidueReapAgeDays,
    sharedTurboMaxBytes: ResidueReapByteCap,
    qualificationViewsKeep: ResidueReapKeepCount,
    fleet: S.Boolean,
    checkoutRoots: S.Array(S.String),
    applied: S.Boolean,
    mode: S.optional(ResidueReapMode),
    classes: S.Array(ResidueReapClass),
    candidates: S.Array(ResidueReapCandidate),
    reapedCount: S.Int,
    reclaimedBytes: S.Finite,
    warnings: S.Array(S.String),
  },
  $I.annote("ResidueReapReport", {
    description: "Versioned report for a dry-run or applied home-residue cleanup pass.",
  })
) {}

/**
 * Owner-issued retention ruling bound to one checkout-relative residue path.
 *
 * **Details**
 *
 * Place the ruling in `.beep/retention/<class>.json` as an array. Missing,
 * malformed, active, paused, or retained rulings never authorize archival.
 * `evidence` names a tracked JSON ruling with exactly the same decoded fields.
 * The tracked ruling binds the owner, path, state and regeneration policy;
 * its address is bookkeeping rather than a replay dependency. Durable proof remains protected
 * by the citation index.
 *
 * **Example** (Record redundant generated output)
 *
 * ```ts
 * import { ResidueRetentionRuling } from "@beep/repo-cli/test/RepoRun"
 * const ruling = ResidueRetentionRuling.make({
 *   path: ".beep/ci/old-report", owner: "quality", state: "completed",
 *   disposition: "regenerable", evidence: "standards/retention/old-report.json",
 *   regeneration: "bun run beep quality audit", reason: "obsolete scanner derivative",
 * })
 * console.log(ruling.state) // "completed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueRetentionRuling extends S.Class<ResidueRetentionRuling>($I`ResidueRetentionRuling`)(
  {
    schemaVersion: S.tag("residue-retention/v1"),
    path: S.NonEmptyString,
    owner: S.NonEmptyString,
    state: ResidueTerminalState,
    disposition: ResidueDisposition,
    evidence: S.NonEmptyString,
    regeneration: S.NonEmptyString,
    reason: S.NonEmptyString,
  },
  $I.annote("ResidueRetentionRuling", {
    description: "Explicit owner, terminal state, and recovery policy for checkout residue.",
  })
) {}

/**
 * Fsynced archive intent and its last confirmed transition.
 *
 * **Example** (Construct an intent)
 *
 * ```ts
 * import { ResidueArchiveIntent } from "@beep/repo-cli/test/RepoRun"
 * const intent = ResidueArchiveIntent.make({
 *   source: "/repo/.beep/ci/old", lexicalSource: "/repo/.beep/ci/old", destination: "/repo/.beep/residue-reap/run/archive/0",
 *   dev: 1, ino: 42, phase: "intent",
 * })
 * console.log(intent.phase) // "intent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueArchiveIntent extends S.Class<ResidueArchiveIntent>($I`ResidueArchiveIntent`)(
  {
    source: S.String,
    lexicalSource: S.String,
    destination: S.String,
    dev: S.Int,
    ino: S.Int,
    phase: ResidueArchivePhase,
  },
  $I.annote("ResidueArchiveIntent", {
    description: "Inode-bound archive journal row supporting interruption recovery.",
  })
) {}

/**
 * Refusal or recovery failure that leaves residue and its journal intact.
 *
 * **Example** (Construct a recovery refusal)
 *
 * ```ts
 * import { ResidueArchiveError } from "@beep/repo-cli/test/RepoRun"
 * const error = ResidueArchiveError.make({ message: "Restore refuses an occupied source" })
 * console.log(error._tag) // "ResidueArchiveError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ResidueArchiveError extends S.TaggedError<ResidueArchiveError>($I`ResidueArchiveError`)(
  "ResidueArchiveError",
  { message: S.String, skipReason: S.optional(ResidueReapSkipReason) },
  $I.annoteError<ResidueArchiveError>("ResidueArchiveError", {
    description: "Archive recovery refused a changed boundary, inode, or live owner.",
  })
) {}
