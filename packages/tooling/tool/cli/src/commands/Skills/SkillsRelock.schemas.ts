/**
 * Report and plan schemas for the skills update train: `skills replay`,
 * `skills relock`, and the batch tracking issue.
 *
 * **Details**
 *
 * A Renovate pin bump moves a vendored entry's `upstream.sourceRevision`, so
 * the lock's snapshot and effective hashes describe the old pin until they are
 * recorded again. The replay loads the new pin's pristine tree, replays the
 * entry's patch series onto it, and reports every hunk by identity:
 *
 * - `applied`: the hunk matched exactly where its header says, which is the
 *   only case the strict applier accepts.
 * - `fuzz-applied`: the hunk's lines match exactly somewhere else in the file.
 *   This is a report classification only (B27): nothing is ever written from
 *   it, and a replay with such a hunk is not clean.
 * - `conflicted`: the hunk matches nowhere, or its file section cannot apply
 *   (missing file, existing file, mode mismatch, unparseable patch).
 *
 * A clean replay is what lets `skills relock` record the new hashes through a
 * digest-sealed plan, the same plan and `--expect` discipline the lock
 * migration write uses.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SkillEffective, SkillGitRevision, SkillSnapshot } from "@beep/ai-sync/Skills.schemas";
import { SkillsLockWrittenFile } from "@beep/ai-sync/SkillsLock.schemas";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Skills/SkillsRelock.schemas");

/**
 * How one hunk of a patch series replays onto a new pristine tree.
 *
 * **Details**
 *
 * `applied`: exact match at the recorded position. `fuzz-applied`: an exact
 * match only at a shifted position, reported and never written (B27).
 * `conflicted`: no match, or the hunk's file section cannot apply at all.
 *
 * **Example** (Check a hunk status)
 *
 * ```ts
 * import { SkillHunkStatus } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(SkillHunkStatus.is["fuzz-applied"]("fuzz-applied")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillHunkStatus = LiteralKit(["applied", "fuzz-applied", "conflicted"]).pipe(
  $I.annoteSchema("SkillHunkStatus", {
    description: "Per-hunk replay outcome: exact apply, shifted-only match (report only), or conflict.",
  })
);

/**
 * How one hunk of a patch series replays onto a new pristine tree.
 *
 * **Example** (Annotate a hunk status)
 *
 * ```ts
 * import type { SkillHunkStatus } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * const status: SkillHunkStatus = "conflicted"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillHunkStatus = typeof SkillHunkStatus.Type;

/**
 * The verdict for a whole skill's replay.
 *
 * **Details**
 *
 * `clean`: every hunk applied exactly, so the strict applier reproduces the
 * effective tree and `skills relock` may record it. `fuzz-only`: no hunk
 * conflicted but at least one matched only at a shifted position; the patch
 * must be regenerated at the new pin before relock accepts it. `conflicted`:
 * at least one hunk conflicted, so the update waits for the review ritual.
 *
 * **Example** (Check a replay status)
 *
 * ```ts
 * import { SkillReplayStatus } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(SkillReplayStatus.is.clean("clean")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillReplayStatus = LiteralKit(["clean", "fuzz-only", "conflicted"]).pipe(
  $I.annoteSchema("SkillReplayStatus", {
    description: "Whole-skill replay verdict: clean, shifted-only matches, or at least one conflict.",
  })
);

/**
 * The verdict for a whole skill's replay.
 *
 * **Example** (Annotate a replay status)
 *
 * ```ts
 * import type { SkillReplayStatus } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * const status: SkillReplayStatus = "fuzz-only"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReplayStatus = typeof SkillReplayStatus.Type;

/**
 * One hunk's replay outcome, keyed by its identity.
 *
 * **Details**
 *
 * `hunkHash` is the hunk's position-free identity: the file path and every
 * body line with its kind and newline state, never the line numbers, so the
 * same hunk keeps its identity when upstream shifts it (the key the B-6 hunk
 * ledger records decisions under). `hunk` is the 1-based hunk index within
 * the file section; `0` is a section-level row, used for a section with no
 * hunks (a mode change, an empty file) or for a patch that does not parse.
 * `shift` is the line offset of a `fuzz-applied` match and `0` otherwise.
 * `detail` says why a row is not `applied`.
 *
 * **Example** (Record a shifted hunk)
 *
 * ```ts
 * import { SkillHunkReport } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const row = SkillHunkReport.make({
 *   patch: ".agents/skill-patches/oracle/0001-skill-md.patch",
 *   file: "SKILL.md",
 *   hunk: 1,
 *   hunkHash: Sha256Hex.make("0".repeat(64)),
 *   oldStart: 12,
 *   status: "fuzz-applied",
 *   shift: 3,
 *   detail: "Matches 3 line(s) below its recorded position.",
 * })
 * console.log(row.status) // "fuzz-applied"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillHunkReport extends S.Opaque<SkillHunkReport, { readonly brand: unique symbol }>()(
  S.Struct({
    patch: S.String,
    file: S.String,
    hunk: S.Natural,
    hunkHash: Sha256Hex,
    oldStart: S.Natural,
    status: SkillHunkStatus,
    shift: S.Int,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("SkillHunkReport", {
      description: "One hunk's replay outcome keyed by its position-free identity hash.",
    })
  )
) {}

/**
 * One vendored skill's replay at its current lock pin.
 *
 * **Details**
 *
 * `sourceRevision` is the pin the replay loaded. `pristineTreeHash` is that
 * tree's hash; `recorded` is true when it and the replayed effective tree
 * already equal the lock's snapshot and effective hashes, so no relock is
 * needed. `licenseMatches` is false when the license bytes at the new pin no
 * longer hash to the recorded digest, which relock refuses. `effectiveTreeHash`
 * is the strict replay's result, present only when the replay is `clean`.
 * `diff` is the unified diff from the new pristine tree to the replayed tree
 * (best effort when the replay is not clean: conflicted hunks are left out).
 * `promoteCandidates` lists the identities of unresolved hunks that the hunk
 * ledger already records as unresolved at another pin: the two-strike rule
 * (B4) marks them as candidates for the semantic-guide form, and graduation
 * stays a human decision. It defaults to empty, so markers written before
 * B-6 still decode.
 *
 * **Example** (Record a clean replay)
 *
 * ```ts
 * import { SkillReplayReport } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SkillGitRevision } from "@beep/ai-sync/Skills.schemas"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const revision = await Effect.runPromise(S.decodeEffect(SkillGitRevision)("d6e773a562dc85c2a81b7c571f40ca2d81896679"))
 * const report = SkillReplayReport.make({
 *   skill: "oracle",
 *   repository: "steipete/oracle",
 *   sourceRevision: revision,
 *   pristineTreeHash: digest,
 *   patchSetHash: digest,
 *   status: "clean",
 *   recorded: true,
 *   licenseMatches: true,
 *   effectiveTreeHash: O.some(digest),
 *   hunks: [],
 *   diff: "",
 * })
 * console.log(report.status) // "clean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReplayReport extends S.Opaque<SkillReplayReport, { readonly brand: unique symbol }>()(
  S.Struct({
    skill: S.String,
    repository: S.String,
    sourceRevision: SkillGitRevision,
    pristineTreeHash: Sha256Hex,
    patchSetHash: Sha256Hex,
    status: SkillReplayStatus,
    recorded: S.Boolean,
    licenseMatches: S.Boolean,
    effectiveTreeHash: S.OptionFromOptionalKey(Sha256Hex),
    hunks: S.Array(SkillHunkReport),
    diff: S.String,
    promoteCandidates: ArrayKeyDefaultEmpty(Sha256Hex),
  }).pipe(
    $I.annoteSchema("SkillReplayReport", {
      description: "One vendored skill's replay at its lock pin: verdict, per-hunk report, and upstream diff.",
    })
  )
) {}

/**
 * Every replayed vendored skill, in lock-key order.
 *
 * **Example** (Build an empty batch)
 *
 * ```ts
 * import { SkillReplayBatch } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(SkillReplayBatch.make({ reports: [] }).reports.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReplayBatch extends S.Opaque<SkillReplayBatch, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skills-replay/v1"),
    reports: S.Array(SkillReplayReport),
  }).pipe(
    $I.annoteSchema("SkillReplayBatch", {
      description: "Replay reports for the selected vendored skills, sorted by lock key.",
    })
  )
) {}

/**
 * What `skills relock` did with a plan.
 *
 * **Details**
 *
 * `planned`: no `--expect` was given, so the plan was only reported.
 * `written`: the lock was rewritten with the plan's hashes. `already-current`:
 * the lock already records exactly the plan's hashes, so nothing was written.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { SkillRelockOutcome } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(SkillRelockOutcome.is.written("written")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillRelockOutcome = LiteralKit(["planned", "written", "already-current"]).pipe(
  $I.annoteSchema("SkillRelockOutcome", {
    description: "Whether skills relock only planned, wrote the lock, or found it already current.",
  })
);

/**
 * What `skills relock` did with a plan.
 *
 * **Example** (Annotate an outcome)
 *
 * ```ts
 * import type { SkillRelockOutcome } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * const outcome: SkillRelockOutcome = "planned"
 * console.log(outcome)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillRelockOutcome = typeof SkillRelockOutcome.Type;

/**
 * A digest-sealed relock plan and what the run did with it.
 *
 * **Details**
 *
 * `planDigest` seals the schema version, the SHA-256 of the lock bytes the
 * plan read (`lockSha256`), the skill, its pin, and the new `snapshot` and
 * `effective` blocks. `relock --expect <planDigest>` writes only when a fresh
 * recomputation yields the same digest and the lock bytes are unchanged at
 * the rename. `lock` is the written lock file's digest; it is present only
 * when the outcome is `written`.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { SkillRelockReceipt } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(typeof SkillRelockReceipt.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillRelockReceipt extends S.Opaque<SkillRelockReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skills-relock-plan/v1"),
    planDigest: Sha256Hex,
    lockSha256: Sha256Hex,
    skill: S.String,
    sourceRevision: SkillGitRevision,
    snapshot: SkillSnapshot,
    effective: SkillEffective,
    outcome: SkillRelockOutcome,
    lock: S.OptionFromOptionalKey(SkillsLockWrittenFile),
  }).pipe(
    $I.annoteSchema("SkillRelockReceipt", {
      description: "A digest-sealed relock plan for one vendored skill and the outcome of the run.",
    })
  )
) {}

/**
 * One GitHub pull-request comment, as `gh pr list --json comments` prints it.
 *
 * **Example** (Decode a comment)
 *
 * ```ts
 * import { SkillTrainPullRequestComment } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import * as S from "effect/Schema"
 *
 * const comment = S.decodeUnknownSync(SkillTrainPullRequestComment)({
 *   author: { login: "github-actions" }, body: "hi", createdAt: "2026-10-14T00:00:00Z",
 * })
 * console.log(comment.body) // "hi"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillTrainPullRequestComment extends S.Opaque<
  SkillTrainPullRequestComment,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    author: S.NullOr(S.Struct({ login: S.String })),
    body: S.String,
    createdAt: S.String,
  }).pipe(
    $I.annoteSchema("SkillTrainPullRequestComment", {
      description: "A pull-request comment's author, body, and creation time from gh pr list --json comments.",
    })
  )
) {}

/**
 * One open skill-update pull request, as `gh pr list --json number,title,url,headRefName,comments` prints it.
 *
 * **Example** (Decode a pull request)
 *
 * ```ts
 * import { SkillTrainPullRequest } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import * as S from "effect/Schema"
 *
 * const pr = S.decodeUnknownSync(SkillTrainPullRequest)({
 *   number: 7,
 *   title: "chore(deps): update skill oracle",
 *   url: "https://github.com/beep-effect/beep-effect/pull/7",
 *   headRefName: "renovate/skill-oracle",
 *   headRefOid: "a".repeat(40),
 *   comments: [],
 * })
 * console.log(pr.number) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillTrainPullRequest extends S.Opaque<SkillTrainPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Int,
    title: S.String,
    url: S.String,
    headRefName: S.String,
    headRefOid: S.String,
    comments: S.Array(SkillTrainPullRequestComment),
  }).pipe(
    $I.annoteSchema("SkillTrainPullRequest", {
      description: "An open skill-update pull request with the comments that carry its replay report.",
    })
  )
) {}

/**
 * The open skill-update pull requests `gh pr list --json` returned.
 *
 * **Example** (Decode an empty list)
 *
 * ```ts
 * import { SkillTrainPullRequests } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(SkillTrainPullRequests)([]).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillTrainPullRequests = S.Array(SkillTrainPullRequest).pipe(
  $I.annoteSchema("SkillTrainPullRequests", {
    description: "Open skill-update pull requests as gh pr list --json returns them.",
  })
);

/**
 * The open skill-update pull requests `gh pr list --json` returned.
 *
 * **Example** (Annotate a list)
 *
 * ```ts
 * import type { SkillTrainPullRequests } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * const none: SkillTrainPullRequests = []
 * console.log(none.length) // 0
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillTrainPullRequests = typeof SkillTrainPullRequests.Type;

/**
 * The parent tracking issue for one scheduled batch of skill updates.
 *
 * **Details**
 *
 * `title` is stable per batch (`Skills update train <batch>`), so a re-run
 * edits the same issue instead of opening another. `body` lists each update
 * pull request with its replay status and unresolved hunks.
 *
 * **Example** (Hold a rendered issue)
 *
 * ```ts
 * import { SkillTrainBatchIssue } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * const issue = SkillTrainBatchIssue.make({ batch: "2026-W42", title: "Skills update train 2026-W42", body: "" })
 * console.log(issue.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillTrainBatchIssue extends S.Opaque<SkillTrainBatchIssue, { readonly brand: unique symbol }>()(
  S.Struct({
    batch: S.String,
    title: S.String,
    body: S.String,
  }).pipe(
    $I.annoteSchema("SkillTrainBatchIssue", {
      description: "Stable title and rendered body of one update-train batch's parent tracking issue.",
    })
  )
) {}
