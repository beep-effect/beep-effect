/**
 * Schema-first report models for the home-residue janitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { GitObjectId } from "@beep/schema/Conformance";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { PosInt } from "../schema/PosInt.ts";

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
export class QualificationViewReceipt extends S.Opaque<QualificationViewReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-dependency-materialization/v1"),
    directory: S.String,
  }).pipe(
    $I.annoteSchema("QualificationViewReceipt", {
      description: "Dependency-view citation read from a qualification evidence receipt.",
    })
  )
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
export class ResidueReapCandidate extends S.Opaque<ResidueReapCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    root: S.String,
    path: S.String,
    reapClass: ResidueReapClass,
    ageDays: S.optionalKey(S.Finite),
    action: ResidueReapAction,
    skipReason: S.optionalKey(ResidueReapSkipReason),
    entriesScanned: S.optionalKey(S.Int),
    bytes: S.optionalKey(S.Finite),
    checkoutRoot: S.optionalKey(S.String),
    mtimeMillis: S.optionalKey(S.Finite),
    groupKey: S.optionalKey(S.String),
    owner: S.optionalKey(S.String),
    terminalState: S.optionalKey(ResidueTerminalState),
    recoveryDestination: S.optionalKey(S.String),
    retentionReason: S.optionalKey(S.String),
    bytesExclusive: S.optionalKey(ResidueReapByteCap),
  }).pipe(
    $I.annoteSchema("ResidueReapCandidate", {
      description: "One home-residue candidate with age, census, action, and fail-closed skip evidence.",
    })
  )
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
export class ResidueReapReport extends S.Opaque<ResidueReapReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("residue-reap/v3"),
    runId: S.optionalKey(S.String),
    reportPath: S.optionalKey(S.String),
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
    mode: S.optionalKey(ResidueReapMode),
    classes: S.Array(ResidueReapClass),
    candidates: S.Array(ResidueReapCandidate),
    reapedCount: S.Int,
    reclaimedBytes: S.Finite,
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ResidueReapReport", {
      description: "Versioned report for a dry-run or applied home-residue cleanup pass.",
    })
  )
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
export class ResidueRetentionRuling extends S.Opaque<ResidueRetentionRuling, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("residue-retention/v1"),
    path: S.NonEmptyString,
    owner: S.NonEmptyString,
    state: ResidueTerminalState,
    disposition: ResidueDisposition,
    evidence: S.NonEmptyString,
    regeneration: S.NonEmptyString,
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ResidueRetentionRuling", {
      description: "Explicit owner, terminal state, and recovery policy for checkout residue.",
    })
  )
) {}

/**
 * How a terminal lane's HEAD relates to the head of its merged pull request.
 *
 * **Details**
 *
 * `equal` means the checkout sits exactly on the merged head; `ancestor` means
 * HEAD is an ancestor of it, so every local commit is part of what merged. A
 * HEAD with commits beyond the merged head has no relation and is never
 * terminal.
 *
 * **Example** (Recognize an ancestor relation)
 *
 * ```ts
 * import { ResidueTerminalLaneHeadRelation } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ResidueTerminalLaneHeadRelation.is.ancestor("ancestor")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueTerminalLaneHeadRelation = LiteralKit(["equal", "ancestor"]).pipe(
  $I.annoteSchema("ResidueTerminalLaneHeadRelation", {
    description: "Whether a terminal lane's HEAD equals, or is an ancestor of, its merged pull request head.",
  })
);

/**
 * How a terminal lane's HEAD relates to its merged pull request head.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueTerminalLaneHeadRelation = typeof ResidueTerminalLaneHeadRelation.Type;

/**
 * Git and pull-request proof that a lane worktree is finished, checked live.
 *
 * **Details**
 *
 * The record names every fact the probe checked: the checkout is a linked
 * worktree (not the primary clone) on `branch`, the branch's pull request is
 * merged, HEAD equals or precedes the merged head, the tree is clean, no live
 * process has its cwd inside, and no live session-ledger row names the
 * checkout. The passed checks are fixed literals (`true`, `0`, `"MERGED"`), so
 * a record describing a dirty, live or unmerged lane cannot be constructed or
 * decoded. Residue reap accepts it in place of the tracked evidence a
 * retention ruling needs; it never makes `checkout-material` eligible.
 *
 * **Example** (Describe a merged lane)
 *
 * ```ts
 * import { ResidueTerminalLaneAuthority } from "@beep/repo-cli/test/RepoRun"
 * import * as DateTime from "effect/DateTime"
 *
 * const head = "1ed08f66df016a18c6d7d56bd97aa778912cb37b"
 * const authority = ResidueTerminalLaneAuthority.make({
 *   checkoutRoot: "/work/beep-effect-worktrees/lane",
 *   commonDir: "/work/beep-effect/.git",
 *   branch: "feat/lane",
 *   pullRequest: 1871,
 *   pullRequestHead: head,
 *   head,
 *   headRelation: "equal",
 *   verifiedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(authority.pullRequestState, authority.liveProcesses) // "MERGED" 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueTerminalLaneAuthority extends S.Opaque<
  ResidueTerminalLaneAuthority,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("residue-terminal-lane/v1"),
    checkoutRoot: S.NonEmptyString,
    commonDir: S.NonEmptyString,
    branch: S.NonEmptyString,
    pullRequest: PosInt,
    pullRequestState: S.tag("MERGED"),
    pullRequestHead: GitObjectId,
    head: GitObjectId,
    headRelation: ResidueTerminalLaneHeadRelation,
    linkedWorktree: S.tag(true),
    cleanTree: S.tag(true),
    liveProcesses: S.tag(0),
    liveSessionRows: S.tag(0),
    verifiedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("ResidueTerminalLaneAuthority", {
      description:
        "Live git and pull-request proof that a linked lane worktree is merged, clean, and unused, accepted in place of tracked retention evidence.",
    })
  )
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
export class ResidueArchiveIntent extends S.Opaque<ResidueArchiveIntent, { readonly brand: unique symbol }>()(
  S.Struct({
    source: S.String,
    lexicalSource: S.String,
    destination: S.String,
    dev: S.Int,
    ino: S.Int,
    phase: ResidueArchivePhase,
  }).pipe(
    $I.annoteSchema("ResidueArchiveIntent", {
      description: "Inode-bound archive journal row supporting interruption recovery.",
    })
  )
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
export class ResidueArchiveError extends S.TaggedError<ResidueArchiveError, { readonly brand: unique symbol }>(
  $I`ResidueArchiveError`
)(
  "ResidueArchiveError",
  { message: S.String, skipReason: S.optionalKey(ResidueReapSkipReason) },
  $I.annoteError<ResidueArchiveError>("ResidueArchiveError", {
    description: "Archive recovery refused a changed boundary, inode, or live owner.",
  })
) {}
