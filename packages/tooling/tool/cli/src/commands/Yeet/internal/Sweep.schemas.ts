/**
 * Schema-first plan and report documents for the post-merge workspace sweep.
 *
 * After a merge lands through the gh CLI the local clone is left stale and the
 * next yeet run pays for it: the feature branch lingers, origin refs are
 * unpruned, local `main` is behind (stale base → rebase treadmill), and a
 * lockfile-moving `main` leaves `node_modules` phantom-failing. The sweep is
 * the tail that returns the clone to a ready state.
 *
 * Two documents model it. {@link SweepPlan} is the dry-run: every step it would
 * take, the git facts it observed, and whether the step needs a human. Running
 * it produces a {@link SweepReport}: the same plan echoed verbatim plus one
 * outcome per step. Both carry a `schemaVersion` literal and are written
 * through their `S.encode`-backed JSON codecs ({@link SweepPlanJson},
 * {@link SweepReportJson}) — never `JSON.stringify` over a decoded instance,
 * which leaks `Option` runtime objects into the artifact.
 *
 * **Details**
 *
 * The sweep never fails. A precondition it cannot satisfy — a dirty worktree, a
 * branch checked out elsewhere, an unpushed commit — is reported as a skip or
 * an operator handoff, so "merged, cleanup skipped: reason" is a success. That
 * is why {@link SweepStepOutcome} has no failure member: unmerged local work is
 * sacred and the sweep would rather report than destroy.
 *
 * **Gotchas**
 *
 * Worktree detection must go through `git rev-parse --git-dir` or
 * `git worktree list`. A `[ -d "$dir/.git" ]` probe silently skips linked
 * worktrees, where `.git` is a FILE — the exact miss that would let a
 * "no worktree holds this branch" precondition read satisfied while a linked
 * worktree has it checked out. Truncated probe output is the same miss by
 * another route: a cut-off `git worktree list --porcelain` parses to zero
 * worktrees, so the planner records the truncation as its own unsatisfied
 * {@link SweepPrecondition} rather than letting it read as an observed fact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Sweep.schemas");

/**
 * The fixed set of steps a workspace sweep may take, in execution order.
 *
 * **Details**
 *
 * `fetch-prune` refreshes origin and drops deleted remote refs; `ff-main`
 * fast-forwards local `main` (via `git fetch origin main:main` when `main` is
 * not checked out anywhere); `delete-local-branch` and `delete-remote-branch`
 * retire the merged feature branch; `lockfile-install` runs `bun install` when
 * the `main` update moved `bun.lock`; `end-state` records where the sweep left
 * the clone.
 *
 * **Example** (List the sweep step ids)
 *
 * ```ts
 * import { SweepStepId } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(SweepStepId.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SweepStepId = LiteralKit([
  "fetch-prune",
  "ff-main",
  "delete-local-branch",
  "delete-remote-branch",
  "lockfile-install",
  "end-state",
]).pipe(
  $I.annoteSchema("SweepStepId", {
    title: "Sweep Step Id",
    description: "One step of the post-merge workspace sweep.",
  })
);

/**
 * The fixed set of steps a workspace sweep may take.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SweepStepId = typeof SweepStepId.Type;

/**
 * One git fact the planner observed, paired with whether it holds.
 *
 * **Details**
 *
 * Preconditions are recorded as observations rather than prose so a `--plan`
 * dry-run explains itself: an unsatisfied precondition is the reason its step
 * will skip or hand off, and `requiresOperator` on the step is derivable from
 * the set rather than asserted independently.
 *
 * **Example** (Record an observed precondition)
 *
 * ```ts
 * import { SweepPrecondition } from "@beep/repo-cli/test/Yeet"
 *
 * const observed = SweepPrecondition.make({
 *   description: "no worktree holds branch feat/merge-loop",
 *   satisfied: false,
 * })
 * console.log(observed.satisfied)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepPrecondition extends S.Class<SweepPrecondition>($I`SweepPrecondition`)(
  {
    description: S.NonEmptyString,
    satisfied: S.Boolean,
  },
  $I.annote("SweepPrecondition", {
    description: "One git fact observed while planning a sweep step, paired with whether it holds.",
  })
) {}

/**
 * One planned sweep step with the action it would take and the facts behind it.
 *
 * **Example** (Plan the local branch deletion)
 *
 * ```ts
 * import { SweepPlanStep, SweepPrecondition } from "@beep/repo-cli/test/Yeet"
 *
 * const step = SweepPlanStep.make({
 *   id: "delete-local-branch",
 *   action: "git branch -d feat/merge-loop",
 *   preconditions: [SweepPrecondition.make({ description: "branch is merged into origin/main", satisfied: true })],
 *   requiresOperator: false,
 * })
 * console.log(step.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepPlanStep extends S.Class<SweepPlanStep>($I`SweepPlanStep`)(
  {
    id: SweepStepId,
    action: S.NonEmptyString,
    preconditions: S.Array(SweepPrecondition),
    requiresOperator: S.Boolean,
  },
  $I.annote("SweepPlanStep", {
    description: "One planned sweep step with its action, observed preconditions, and operator requirement.",
  })
) {}

/**
 * The dry-run document for one workspace sweep.
 *
 * **Example** (Construct an empty sweep plan)
 *
 * ```ts
 * import { SweepPlan } from "@beep/repo-cli/test/Yeet"
 *
 * const plan = SweepPlan.make({
 *   schemaVersion: "yeet-sweep-plan/v1",
 *   createdAt: "2026-08-04T00:00:00.000Z",
 *   branch: "feat/merge-loop",
 *   steps: [],
 * })
 * console.log(plan.branch)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepPlan extends S.Class<SweepPlan>($I`SweepPlan`)(
  {
    schemaVersion: S.Literal("yeet-sweep-plan/v1"),
    createdAt: S.String,
    branch: S.String,
    steps: S.Array(SweepPlanStep),
  },
  $I.annote("SweepPlan", {
    description: "Dry-run plan for one post-merge workspace sweep.",
  })
) {}

/**
 * A sweep step that ran its action.
 *
 * @category models
 * @since 0.0.0
 */
export class SweepStepExecuted extends S.Class<SweepStepExecuted>($I`SweepStepExecuted`)(
  {
    status: S.tag("executed"),
    detail: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("SweepStepExecuted", {
    description: "A sweep step that ran its action.",
  })
) {}

/**
 * A sweep step deliberately not taken, with the precondition that blocked it.
 *
 * **Details**
 *
 * A skip is a success, not a failure: the clone is simply less clean than it
 * could have been, and the reason names what a human would have to change.
 *
 * @category models
 * @since 0.0.0
 */
export class SweepStepSkipped extends S.Class<SweepStepSkipped>($I`SweepStepSkipped`)(
  {
    status: S.tag("skipped"),
    reason: S.NonEmptyString,
  },
  $I.annote("SweepStepSkipped", {
    description: "A sweep step deliberately not taken, carrying the reason it was skipped.",
  })
) {}

/**
 * A sweep step the tool refuses to take on its own, handed to the operator.
 *
 * **Details**
 *
 * Distinct from a skip: the work still wants doing, but authority for it rests
 * with the human, so the outcome carries the exact command to run.
 *
 * @category models
 * @since 0.0.0
 */
export class SweepStepNeedsOperator extends S.Class<SweepStepNeedsOperator>($I`SweepStepNeedsOperator`)(
  {
    status: S.tag("needs-operator"),
    reason: S.NonEmptyString,
    operatorCommand: S.NonEmptyString,
  },
  $I.annote("SweepStepNeedsOperator", {
    description: "A sweep step handed to the operator, carrying the reason and the exact command to run.",
  })
) {}

/**
 * What became of one sweep step: executed, skipped, or handed to the operator.
 *
 * **Example** (Decode a skipped outcome)
 *
 * ```ts
 * import { SweepStepOutcome } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(SweepStepOutcome)({
 *   status: "skipped",
 *   reason: "worktree is dirty",
 * })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SweepStepOutcome = S.Union([SweepStepExecuted, SweepStepSkipped, SweepStepNeedsOperator]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("SweepStepOutcome", {
    description: "What became of one sweep step: executed, skipped, or handed to the operator.",
  })
);

/**
 * What became of one sweep step.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SweepStepOutcome = typeof SweepStepOutcome.Type;

/**
 * One executed plan step paired with its outcome.
 *
 * **Example** (Record a skipped step)
 *
 * ```ts
 * import { SweepReportStep, SweepStepSkipped } from "@beep/repo-cli/test/Yeet"
 *
 * const step = SweepReportStep.make({
 *   id: "ff-main",
 *   outcome: SweepStepSkipped.make({ reason: "main is checked out in another worktree" }),
 * })
 * console.log(step.outcome.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepReportStep extends S.Class<SweepReportStep>($I`SweepReportStep`)(
  {
    id: SweepStepId,
    outcome: SweepStepOutcome,
    durationMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("SweepReportStep", {
    description: "One planned sweep step paired with the outcome of attempting it.",
  })
) {}

/**
 * The result document for one executed workspace sweep.
 *
 * **Details**
 *
 * The plan is echoed in full rather than referenced by path so the report is a
 * self-contained audit record: a reader can see which facts were observed at
 * plan time and what the run then did about them, without a second file that
 * may have been overwritten by the next sweep.
 *
 * **Example** (Construct an empty sweep report)
 *
 * ```ts
 * import { SweepPlan, SweepReport } from "@beep/repo-cli/test/Yeet"
 *
 * const report = SweepReport.make({
 *   schemaVersion: "yeet-sweep-report/v1",
 *   plan: SweepPlan.make({
 *     schemaVersion: "yeet-sweep-plan/v1",
 *     createdAt: "2026-08-04T00:00:00.000Z",
 *     branch: "feat/merge-loop",
 *     steps: [],
 *   }),
 *   steps: [],
 *   startedAt: "2026-08-04T00:00:00.000Z",
 *   endedAt: "2026-08-04T00:00:01.000Z",
 * })
 * console.log(report.plan.branch)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepReport extends S.Class<SweepReport>($I`SweepReport`)(
  {
    schemaVersion: S.Literal("yeet-sweep-report/v1"),
    plan: SweepPlan,
    steps: S.Array(SweepReportStep),
    startedAt: S.String,
    endedAt: S.String,
  },
  $I.annote("SweepReport", {
    description: "Result document for one executed post-merge workspace sweep, echoing the plan it ran.",
  })
) {}

/**
 * JSON-string codec for the sweep plan artifact.
 *
 * **Example** (Round-trip an empty plan)
 *
 * ```ts
 * import { SweepPlan, SweepPlanJson } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const plan = SweepPlan.make({
 *   schemaVersion: "yeet-sweep-plan/v1",
 *   createdAt: "2026-08-04T00:00:00.000Z",
 *   branch: "feat/merge-loop",
 *   steps: [],
 * })
 * console.log(Effect.runSync(SweepPlanJson.encode(plan)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SweepPlanJson = JsonStringCodec(SweepPlan);

/**
 * JSON-string codec for the sweep report artifact.
 *
 * **Example** (Encode a report)
 *
 * ```ts
 * import { SweepPlan, SweepReport, SweepReportJson } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const report = SweepReport.make({
 *   schemaVersion: "yeet-sweep-report/v1",
 *   plan: SweepPlan.make({
 *     schemaVersion: "yeet-sweep-plan/v1",
 *     createdAt: "2026-08-04T00:00:00.000Z",
 *     branch: "feat/merge-loop",
 *     steps: [],
 *   }),
 *   steps: [],
 *   startedAt: "2026-08-04T00:00:00.000Z",
 *   endedAt: "2026-08-04T00:00:01.000Z",
 * })
 * console.log(Effect.runSync(SweepReportJson.encode(report)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SweepReportJson = JsonStringCodec(SweepReport);
