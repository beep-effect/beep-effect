/**
 * The check-state vocabulary a run reports, and its projection onto GitHub's
 * check-run status and conclusion.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubReportingId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Match from "effect/Match";
import * as S from "effect/Schema";

const $I = $GithubReportingId.create("CheckState");

/**
 * **Example** (Construct a vocabulary projection error)
 *
 * ```ts
 * import { UnhandledCheckStateError } from "@beep/github-reporting/CheckState";
 *
 * const error = UnhandledCheckStateError.make({ message: "Unhandled check state" });
 * console.log(error.message) // Unhandled check state
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnhandledCheckStateError extends S.TaggedError<
  UnhandledCheckStateError,
  { readonly brand: unique symbol }
>($I`UnhandledCheckStateError`)(
  "UnhandledCheckStateError",
  {
    message: S.String,
  },
  $I.annoteError<UnhandledCheckStateError>("UnhandledCheckStateError", {
    description: "A check state outside the vocabulary was projected.",
  })
) {}

/**
 * **Details**
 *
 * Deliberately **wider than GitHub's own check-run conclusions**: `running` is
 * a first-class state rather than the absence of a conclusion, and
 * `user_interaction_required` names a release pipeline waiting on a human. A
 * check's lifecycle is a *sequence* of these states, and only the last one is
 * authoritative — resolution is not a terminal transition, so a check may run
 * `running`, `pass`, `running`, `fail` in order, and that means `fail`.
 *
 * Every state projects onto GitHub's check-run wire vocabulary through
 * {@link projectCheckState}. GitHub's `cancelled` conclusion has no
 * counterpart here on purpose: cancellation is something the runner does *to*
 * a run, not a state a pipeline reports about its own checks.
 *
 * **Example** (Decode a running check state)
 *
 * ```ts
 * import { CheckState } from "@beep/github-reporting/CheckState";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(CheckState)("running")) // running
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CheckState = LiteralKit([
  "running",
  "pass",
  "fail",
  "warn",
  "user_interaction_required",
  "skipped",
  "timeout",
]).pipe($I.annoteSchema("CheckState", { description: "The kit's check-state vocabulary." }));

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CheckState = typeof CheckState.Type;

/**
 * **Details**
 *
 * A subset of GitHub's conclusion set, spelled structurally so a pure
 * vocabulary module does not put `@beep/github` — and through it the
 * octokit runtime — on its import graph. A structural assertion in the test
 * suite pins these literals against `CheckConclusion` in `@beep/github`,
 * so drift between the two spellings fails a test rather than a consumer.
 *
 * **Example** (Validate a CheckRunConclusion value)
 *
 * ```ts
 * import { CheckRunConclusion } from "@beep/github-reporting/CheckState";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CheckRunConclusion)("success")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CheckRunConclusion = LiteralKit([
  "success",
  "failure",
  "neutral",
  "skipped",
  "timed_out",
  "action_required",
]).pipe(
  $I.annoteSchema("CheckRunConclusion", {
    description: "The GitHub check-run conclusions the kit vocabulary can produce.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CheckRunConclusion = typeof CheckRunConclusion.Type;

const CheckRunStatus = LiteralKit(["in_progress", "completed"]).pipe(
  $I.annoteSchema("CheckRunStatus", { description: "The statuses produced by a kit check-state projection." })
);

/**
 * An in-progress check run on GitHub's wire: a status and no conclusion.
 *
 * **Example** (Construct an in-progress projection)
 *
 * ```ts
 * import { CheckRunInProgress } from "@beep/github-reporting/CheckState";
 *
 * console.log(JSON.stringify(CheckRunInProgress.make({}))) // {"status":"in_progress"}
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class CheckRunInProgress extends S.Opaque<CheckRunInProgress, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Always `in_progress`: an active check without a conclusion.
     *
     * @since 0.0.0
     */
    status: S.tag(CheckRunStatus.Enum.in_progress).pipe(
      $I.annoteKey("CheckRunProjection.in_progress.status", { description: "An active check without a conclusion." })
    ),
  }).pipe($I.annoteSchema("CheckRunInProgress", { description: "An in-progress check run, carrying no conclusion." }))
) {}

/**
 * A completed check run on GitHub's wire: a status and its conclusion.
 *
 * **Example** (Construct a completed projection)
 *
 * ```ts
 * import { CheckRunCompleted } from "@beep/github-reporting/CheckState";
 *
 * console.log(CheckRunCompleted.make({ conclusion: "success" }).status) // completed
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class CheckRunCompleted extends S.Opaque<CheckRunCompleted, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Always `completed`: a finished check carrying its conclusion.
     *
     * @since 0.0.0
     */
    status: S.tag(CheckRunStatus.Enum.completed).pipe(
      $I.annoteKey("CheckRunProjection.completed.status", { description: "A finished check carrying its conclusion." })
    ),
    /**
     * The completed check's wire conclusion.
     *
     * @since 0.0.0
     */
    conclusion: CheckRunConclusion.pipe(
      $I.annoteKey("CheckRunProjection.completed.conclusion", { description: "The completed check's wire conclusion." })
    ),
  }).pipe($I.annoteSchema("CheckRunCompleted", { description: "A completed check run and its conclusion." }))
) {}

/**
 * A `CheckState` on GitHub's check-run wire: a status, and a conclusion
 * exactly when the status is `completed`.
 *
 * **Details**
 *
 * A discriminated union rather than two optional fields, because the wire
 * protocol's own invariant is conditional: an in-progress check run *has* no
 * conclusion, and a completed one always does. Both members are branded
 * `S.Opaque` structs, so values are plain objects; build them with
 * `CheckRunInProgress.make` and `CheckRunCompleted.make`, or decode them.
 *
 * **Example** (Validate a CheckRunProjection value)
 *
 * ```ts
 * import { CheckRunProjection } from "@beep/github-reporting/CheckState";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CheckRunProjection)({ status: "completed", conclusion: "success" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CheckRunProjection = S.Union([CheckRunInProgress, CheckRunCompleted]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("CheckRunProjection", {
    description: "A plain-object wire projection with a conclusion exactly for completed checks.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CheckRunProjection = typeof CheckRunProjection.Type;

const completed = (conclusion: CheckRunConclusion): CheckRunProjection => CheckRunCompleted.make({ conclusion });

/**
 * Project a kit check state onto GitHub's check-run wire vocabulary.
 *
 * **Details**
 *
 * The canonical mapping: `running` is `in_progress`; everything else is
 * `completed` with `pass → success`, `fail → failure`, `warn → neutral`
 * (GitHub has no warning conclusion, and `neutral` is its non-failing,
 * non-success verdict), `user_interaction_required → action_required`,
 * `skipped → skipped` and `timeout → timed_out`.
 *
 * **Example** (Project a warning onto GitHub conclusions)
 *
 * ```ts
 * import { projectCheckState } from "@beep/github-reporting/CheckState";
 *
 * console.log(JSON.stringify(projectCheckState("warn"))) // {"status":"completed","conclusion":"neutral"}
 * ```
 *
 * @public
 * @category mapping
 * @since 0.0.0
 */
export const projectCheckState = (state: CheckState): CheckRunProjection =>
  Match.value(state).pipe(
    Match.when("running", (): CheckRunProjection => CheckRunInProgress.make({})),
    Match.when("pass", () => completed("success")),
    Match.when("fail", () => completed("failure")),
    Match.when("warn", () => completed("neutral")),
    Match.when("user_interaction_required", () => completed("action_required")),
    Match.when("skipped", () => completed("skipped")),
    Match.when("timeout", () => completed("timed_out")),
    Match.exhaustive
  );
