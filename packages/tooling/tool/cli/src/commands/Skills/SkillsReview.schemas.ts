/**
 * Ledger, queue, and session schemas for the vendored-skill review ritual
 * (`beep skills review`).
 *
 * **Details**
 *
 * Every hunk decision is one append-only row of
 * `.agents/skill-patches/ledger.jsonl`, keyed by (old revision, new revision,
 * patch-set hash, hunk hash) as SPEC Workstream B fixes it. The review queue
 * holds two kinds of item:
 *
 * - `conflict`: a hunk that did not apply exactly at the skill's current pin
 *   (`fuzz-applied` or `conflicted`) and has no decision at its key.
 * - `classification`: a hunk that applies but carries no labelled `keep` or
 *   `drop` decision yet; the first ritual classifies the generated
 *   `temporary-drift` patches this way (B8, B21).
 *
 * A session walks the queue within a time budget, checkpoints every decision
 * into the ledger as it is made, and reports which skills are fully decided
 * and which stay queued.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SkillGitRevision, SkillPatchLabel } from "@beep/ai-sync/Skills.schemas";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { SkillHunkStatus } from "./SkillsRelock.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsReview.schemas");

/**
 * What a reviewer decided about one hunk.
 *
 * **Details**
 *
 * `keep`: the hunk stays in the series; a classification keep also names the
 * patch label. `drop`: upstream covers the hunk, so it leaves the series.
 * `rebase`: the intent stays, but the hunk must be re-cut onto the new pin.
 * `promote-candidate`: the hunk should graduate to a semantic guide (B4);
 * the graduation itself stays a separate human decision.
 *
 * **Example** (Check a decision)
 *
 * ```ts
 * import { SkillHunkDecision } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillHunkDecision.is.rebase("rebase")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillHunkDecision = LiteralKit(["keep", "drop", "rebase", "promote-candidate"]).pipe(
  $I.annoteSchema("SkillHunkDecision", {
    description: "A reviewer's decision on one hunk: keep, drop, rebase onto the new pin, or promotion candidate.",
  })
);

/**
 * What a reviewer decided about one hunk.
 *
 * **Example** (Annotate a decision)
 *
 * ```ts
 * import type { SkillHunkDecision } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const decision: SkillHunkDecision = "keep"
 * console.log(decision)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillHunkDecision = typeof SkillHunkDecision.Type;

/**
 * How a ledger row came to be.
 *
 * **Details**
 *
 * `review`: a reviewer answered the hunk in a session. `ghost`: `--ghost`
 * replayed an earlier human decision on a byte-identical hunk at the same new
 * revision; the row keeps that earlier reviewer's name.
 *
 * **Example** (Check an origin)
 *
 * ```ts
 * import { SkillHunkDecisionOrigin } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillHunkDecisionOrigin.is.ghost("ghost")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillHunkDecisionOrigin = LiteralKit(["review", "ghost"]).pipe(
  $I.annoteSchema("SkillHunkDecisionOrigin", {
    description: "Whether a ledger row was answered in a session or replayed from an earlier identical hunk.",
  })
);

/**
 * How a ledger row came to be.
 *
 * **Example** (Annotate an origin)
 *
 * ```ts
 * import type { SkillHunkDecisionOrigin } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const origin: SkillHunkDecisionOrigin = "review"
 * console.log(origin)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillHunkDecisionOrigin = typeof SkillHunkDecisionOrigin.Type;

/**
 * One append-only row of the hunk ledger.
 *
 * **Details**
 *
 * The key is (`oldRevision`, `newRevision`, `patchSetHash`, `hunkHash`).
 * `oldRevision` is the pin the base branch's lock records and `newRevision`
 * the pin under review; both are the current pin when no bump is pending,
 * as in the first classification ritual. `status` is the hunk's replay
 * outcome when it was decided, which the two-strike query reads. `label` is
 * present on a classification `keep` and may ride on any other decision.
 *
 * **Example** (Record a classification)
 *
 * ```ts
 * import { SkillHunkLedgerRow } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import * as S from "effect/Schema"
 *
 * const pin = "d6e773a562dc85c2a81b7c571f40ca2d81896679"
 * const row = S.decodeUnknownSync(SkillHunkLedgerRow)({
 *   schemaVersion: "skills-hunk-ledger/v1",
 *   skill: "oracle",
 *   oldRevision: pin,
 *   newRevision: pin,
 *   patchSetHash: "0".repeat(64),
 *   hunkHash: "1".repeat(64),
 *   patch: ".agents/skill-patches/oracle/0001-skill-md.patch",
 *   file: "SKILL.md",
 *   hunk: 1,
 *   status: "applied",
 *   decision: "keep",
 *   label: "policy",
 *   reviewer: "@kriegcloud",
 *   decidedAt: "2026-10-14T00:00:00.000Z",
 *   origin: "review",
 * })
 * console.log(row.decision) // "keep"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillHunkLedgerRow extends S.Opaque<SkillHunkLedgerRow, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skills-hunk-ledger/v1"),
    skill: S.String,
    oldRevision: SkillGitRevision,
    newRevision: SkillGitRevision,
    patchSetHash: Sha256Hex,
    hunkHash: Sha256Hex,
    patch: S.String,
    file: S.String,
    hunk: S.Natural,
    status: SkillHunkStatus,
    decision: SkillHunkDecision,
    label: S.OptionFromOptionalKey(SkillPatchLabel),
    reviewer: S.NonEmptyString,
    decidedAt: S.DateTimeUtcFromString,
    origin: SkillHunkDecisionOrigin,
  }).pipe(
    $I.annoteSchema("SkillHunkLedgerRow", {
      description: "One append-only hunk decision keyed by old and new revision, patch-set hash, and hunk hash.",
    })
  )
) {}

/**
 * Which question a queued hunk asks.
 *
 * **Details**
 *
 * `conflict`: the hunk did not apply exactly at the pin under review.
 * `classification`: the hunk applies but was never classified.
 *
 * **Example** (Check an item kind)
 *
 * ```ts
 * import { SkillReviewItemKind } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillReviewItemKind.is.classification("classification")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillReviewItemKind = LiteralKit(["conflict", "classification"]).pipe(
  $I.annoteSchema("SkillReviewItemKind", {
    description: "Whether a queued hunk awaits a conflict decision or its first classification.",
  })
);

/**
 * Which question a queued hunk asks.
 *
 * **Example** (Annotate an item kind)
 *
 * ```ts
 * import type { SkillReviewItemKind } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const kind: SkillReviewItemKind = "conflict"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewItemKind = typeof SkillReviewItemKind.Type;

/**
 * One undecided hunk in the review queue.
 *
 * **Details**
 *
 * The key fields match {@link SkillHunkLedgerRow}. `twoStrike` is true when
 * the same hunk identity already conflicted at another new revision (B4), so
 * the report suggests `promote-candidate` and `--ghost` never answers it.
 * `ghost` carries the earlier decision `--ghost` would replay. `text` is the
 * hunk as the patch file holds it, for the reviewer to read.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { SkillReviewItem } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(typeof SkillReviewItem.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewItem extends S.Opaque<SkillReviewItem, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: SkillReviewItemKind,
    skill: S.String,
    oldRevision: SkillGitRevision,
    newRevision: SkillGitRevision,
    patchSetHash: Sha256Hex,
    hunkHash: Sha256Hex,
    patch: S.String,
    file: S.String,
    hunk: S.Natural,
    status: SkillHunkStatus,
    detail: S.String,
    currentLabel: SkillPatchLabel,
    twoStrike: S.Boolean,
    ghost: S.OptionFromOptionalKey(SkillHunkLedgerRow),
    text: S.String,
  }).pipe(
    $I.annoteSchema("SkillReviewItem", {
      description: "One undecided hunk: its ledger key, replay outcome, two-strike flag, ghost proposal, and text.",
    })
  )
) {}

/**
 * A reviewer's answer that records a decision.
 *
 * **Example** (Keep a hunk as policy)
 *
 * ```ts
 * import { SkillReviewDecide } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import * as O from "effect/Option"
 *
 * const answer = SkillReviewDecide.make({ decision: "keep", label: O.some("policy") })
 * console.log(answer._tag) // "decide"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewDecide extends S.Opaque<SkillReviewDecide, { readonly brand: unique symbol }>()(
  S.TaggedStruct("decide", {
    decision: SkillHunkDecision,
    label: S.OptionFromOptionalKey(SkillPatchLabel),
  }).pipe(
    $I.annoteSchema("SkillReviewDecide", {
      description: "An answer that records a decision, with a patch label when it classifies.",
    })
  )
) {}

/**
 * A reviewer's answer that leaves the hunk queued for a later session.
 *
 * **Example** (Skip a hunk)
 *
 * ```ts
 * import { SkillReviewSkip } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillReviewSkip.make({})._tag) // "skip"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewSkip extends S.Opaque<SkillReviewSkip, { readonly brand: unique symbol }>()(
  S.TaggedStruct("skip", {}).pipe(
    $I.annoteSchema("SkillReviewSkip", {
      description: "An answer that leaves the hunk queued.",
    })
  )
) {}

/**
 * A reviewer's answer that ends the session, keeping every recorded checkpoint.
 *
 * **Example** (Quit a session)
 *
 * ```ts
 * import { SkillReviewQuit } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillReviewQuit.make({})._tag) // "quit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewQuit extends S.Opaque<SkillReviewQuit, { readonly brand: unique symbol }>()(
  S.TaggedStruct("quit", {}).pipe(
    $I.annoteSchema("SkillReviewQuit", {
      description: "An answer that ends the session; decisions already recorded stay in the ledger.",
    })
  )
) {}

/**
 * Every answer a reviewer can give one queued hunk.
 *
 * **Example** (Match an answer)
 *
 * ```ts
 * import { SkillReviewAnswer, SkillReviewSkip } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SkillReviewAnswer)(SkillReviewSkip.make({}))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillReviewAnswer = S.Union([SkillReviewDecide, SkillReviewSkip, SkillReviewQuit]).pipe(
  $I.annoteSchema("SkillReviewAnswer", {
    description: "A reviewer's answer to one queued hunk: decide, skip, or quit the session.",
  })
);

/**
 * Every answer a reviewer can give one queued hunk.
 *
 * **Example** (Annotate an answer)
 *
 * ```ts
 * import { SkillReviewSkip, type SkillReviewAnswer } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const answer: SkillReviewAnswer = SkillReviewSkip.make({})
 * console.log(answer._tag) // "skip"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewAnswer = typeof SkillReviewAnswer.Type;

/**
 * One scripted answer: a hunk identity (or a unique prefix of at least 12 hex
 * characters), the decision, and an optional label.
 *
 * **Example** (Decode a scripted answer)
 *
 * ```ts
 * import { SkillReviewScriptEntry } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(SkillReviewScriptEntry)({ hunk: "0123456789ab", decision: "drop" })
 * console.log(entry.decision) // "drop"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewScriptEntry extends S.Opaque<SkillReviewScriptEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    hunk: S.String.check(S.isPattern(/^[0-9a-f]{12,64}$/u)),
    decision: SkillHunkDecision,
    label: S.OptionFromOptionalKey(SkillPatchLabel),
  }).pipe(
    $I.annoteSchema("SkillReviewScriptEntry", {
      description: "A scripted review answer keyed by a hunk identity or a unique 12+ character prefix.",
    })
  )
) {}

/**
 * A scripted session: the answers a reviewer gave, in any order.
 *
 * **Details**
 *
 * `skills review --decisions <file>` reads this as JSON. A queued hunk the
 * script does not name is skipped and stays queued.
 *
 * **Example** (Decode an empty script)
 *
 * ```ts
 * import { SkillReviewScript } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(SkillReviewScript)([]).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillReviewScript = S.Array(SkillReviewScriptEntry).pipe(
  $I.annoteSchema("SkillReviewScript", {
    description: "Scripted review answers keyed by hunk identity.",
  })
);

/**
 * A scripted session: the answers a reviewer gave, in any order.
 *
 * **Example** (Annotate a script)
 *
 * ```ts
 * import type { SkillReviewScript } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const none: SkillReviewScript = []
 * console.log(none.length) // 0
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewScript = typeof SkillReviewScript.Type;

/**
 * Where one skill stands after a session.
 *
 * **Details**
 *
 * `clear`: nothing was queued for it. `decided`: every queued hunk now has a
 * decision, so the skill can ship (its patch work and relock may proceed).
 * `queued`: at least one hunk is still undecided.
 *
 * **Example** (Check a state)
 *
 * ```ts
 * import { SkillReviewSkillState } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillReviewSkillState.is.decided("decided")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillReviewSkillState = LiteralKit(["clear", "decided", "queued"]).pipe(
  $I.annoteSchema("SkillReviewSkillState", {
    description: "Whether a skill had nothing queued, is fully decided, or still has undecided hunks.",
  })
);

/**
 * Where one skill stands after a session.
 *
 * **Example** (Annotate a state)
 *
 * ```ts
 * import type { SkillReviewSkillState } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const state: SkillReviewSkillState = "queued"
 * console.log(state)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewSkillState = typeof SkillReviewSkillState.Type;

/**
 * One reviewed skill's revisions, state, and count of undecided hunks.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { SkillReviewSkill } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(typeof SkillReviewSkill.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewSkill extends S.Opaque<SkillReviewSkill, { readonly brand: unique symbol }>()(
  S.Struct({
    skill: S.String,
    oldRevision: SkillGitRevision,
    newRevision: SkillGitRevision,
    state: SkillReviewSkillState,
    unresolved: S.Natural,
  }).pipe(
    $I.annoteSchema("SkillReviewSkill", {
      description: "A reviewed skill's base and current pins, its state, and its undecided hunk count.",
    })
  )
) {}

/**
 * Why a session stopped.
 *
 * **Details**
 *
 * `listed`: the run only prepared the queue. `queue-empty`: every queued
 * hunk was answered or skipped. `budget`: the time budget ran out; the rest
 * stays queued. `quit`: the reviewer ended the session.
 *
 * **Example** (Check a stop reason)
 *
 * ```ts
 * import { SkillReviewStop } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * console.log(SkillReviewStop.is.budget("budget")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillReviewStop = LiteralKit(["listed", "queue-empty", "budget", "quit"]).pipe(
  $I.annoteSchema("SkillReviewStop", {
    description: "Why a review session stopped: listing only, empty queue, spent budget, or the reviewer quit.",
  })
);

/**
 * Why a session stopped.
 *
 * **Example** (Annotate a stop reason)
 *
 * ```ts
 * import type { SkillReviewStop } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const stop: SkillReviewStop = "quit"
 * console.log(stop)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewStop = typeof SkillReviewStop.Type;

/**
 * The outcome of one review run.
 *
 * **Details**
 *
 * `recorded` lists the ledger rows this run appended, ghost replays first.
 * `queue` is what is still undecided, in walk order. `skills` reports every
 * reviewed skill's state.
 *
 * **Example** (Build an empty session)
 *
 * ```ts
 * import { SkillReviewSession } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const session = SkillReviewSession.make({ stoppedBy: "listed", budgetMinutes: 20, recorded: [], queue: [], skills: [] })
 * console.log(session.schemaVersion) // "skills-review/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewSession extends S.Opaque<SkillReviewSession, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skills-review/v1"),
    stoppedBy: SkillReviewStop,
    budgetMinutes: S.Natural,
    recorded: S.Array(SkillHunkLedgerRow),
    queue: S.Array(SkillReviewItem),
    skills: S.Array(SkillReviewSkill),
  }).pipe(
    $I.annoteSchema("SkillReviewSession", {
      description: "One review run: rows it recorded, hunks still queued, and each skill's state.",
    })
  )
) {}

/**
 * One hunk of a patch file, with the identity the replay and the ledger key on.
 *
 * **Details**
 *
 * `hunk` is the 1-based index within its file section, or `0` for a section
 * without hunks (a mode change, an empty file) and for a patch that does not
 * parse. `text` is the hunk as a reviewer reads it: its `@@` header and body
 * lines, or a one-line description of a hunk-less section.
 *
 * **Example** (Hold one hunk)
 *
 * ```ts
 * import { SkillPatchHunk } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const hunk = SkillPatchHunk.make({
 *   patch: ".agents/skill-patches/oracle/0001-skill-md.patch",
 *   file: "SKILL.md",
 *   hunk: 1,
 *   hunkHash: Sha256Hex.make("0".repeat(64)),
 *   text: "@@ -1,1 +1,1 @@\n-a\n+b",
 * })
 * console.log(hunk.hunk) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatchHunk extends S.Opaque<SkillPatchHunk, { readonly brand: unique symbol }>()(
  S.Struct({
    patch: S.String,
    file: S.String,
    hunk: S.Natural,
    hunkHash: Sha256Hex,
    text: S.String,
  }).pipe(
    $I.annoteSchema("SkillPatchHunk", {
      description: "One hunk of a patch file with its position-free identity and its reviewable text.",
    })
  )
) {}

/**
 * Options for one review run.
 *
 * **Details**
 *
 * `decide: false` only prepares the queue and writes nothing, ghost replays
 * included. With `decide: true`, `ghost` first records the replayable earlier
 * decisions, then the reviewer's decider answers the rest within `budget`,
 * each answer recorded under `reviewer`.
 *
 * **Example** (Prepare a read-only review run)
 *
 * ```ts
 * import { SkillReviewOptions } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import * as Duration from "effect/Duration"
 * import * as O from "effect/Option"
 *
 * const options = SkillReviewOptions.make({
 *   skill: O.none(),
 *   decide: false,
 *   ghost: true,
 *   reviewer: "kriegcloud",
 *   budget: Duration.minutes(15),
 * })
 * console.log(options.decide) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillReviewOptions extends S.Opaque<SkillReviewOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    skill: S.Option(S.String),
    decide: S.Boolean,
    ghost: S.Boolean,
    reviewer: S.String,
    budget: S.Duration,
  }).pipe(
    $I.annoteSchema("SkillReviewOptions", {
      description: "Options for one skills review run: scope, write mode, ghost replay, reviewer, and time budget.",
    })
  )
) {}
