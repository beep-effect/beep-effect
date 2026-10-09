import * as Match from "effect/Match";
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/github-actions/CheckState");

/** A check state outside the vocabulary was projected. */
export class UnhandledCheckStateError extends S.TaggedError<UnhandledCheckStateError>($I`UnhandledCheckStateError`)("UnhandledCheckStateError", {
	message: S.String,
}, $I.annote("UnhandledCheckStateError", { description: "A check state outside the vocabulary was projected." })) {}

/**
 * The kit's check-state vocabulary.
 *
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
 * @public
 */
export const CheckState = LiteralKit([
	"running",
	"pass",
	"fail",
	"warn",
	"user_interaction_required",
	"skipped",
	"timeout",
]).annotate($I.annote("CheckState", { description: "The kit's check-state vocabulary." }));

/**
 * The type of `CheckState`.
 *
 * @public
 */
export type CheckState = typeof CheckState.Type;

/**
 * The check-run conclusions the kit vocabulary can produce.
 *
 * **Details**
 *
 * A subset of GitHub's conclusion set, spelled structurally so a pure
 * vocabulary module does not put `@effected/github` — and through it the
 * octokit runtime — on its import graph. A structural assertion in the test
 * suite pins these literals against `CheckConclusion` in `@effected/github`,
 * so drift between the two spellings fails a test rather than a consumer.
 *
 * @public
 */
export type CheckRunConclusion = "success" | "failure" | "neutral" | "skipped" | "timed_out" | "action_required";

/**
 * A `CheckState` on GitHub's check-run wire: a status, and a conclusion
 * exactly when the status is `completed`.
 *
 * **Details**
 *
 * A discriminated union rather than two optional fields, because the wire
 * protocol's own invariant is conditional: an in-progress check run *has* no
 * conclusion, and a completed one always does.
 *
 * @public
 */
export type CheckRunProjection =
	| { readonly status: "in_progress" }
	| { readonly status: "completed"; readonly conclusion: CheckRunConclusion };

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
 * @public
 */
export const projectCheckState = (state: CheckState): CheckRunProjection =>
	Match.value(state).pipe(
		Match.when("running", (): CheckRunProjection => ({ status: "in_progress" })),
		Match.when("pass", (): CheckRunProjection => ({ status: "completed", conclusion: "success" })),
		Match.when("fail", (): CheckRunProjection => ({ status: "completed", conclusion: "failure" })),
		Match.when("warn", (): CheckRunProjection => ({ status: "completed", conclusion: "neutral" })),
		Match.when("user_interaction_required", (): CheckRunProjection => ({ status: "completed", conclusion: "action_required" })),
		Match.when("skipped", (): CheckRunProjection => ({ status: "completed", conclusion: "skipped" })),
		Match.when("timeout", (): CheckRunProjection => ({ status: "completed", conclusion: "timed_out" })),
		Match.orElse((unhandled: never) => {
			throw UnhandledCheckStateError.make({ message: `Unhandled CheckState: ${String(unhandled)}` });
		}),
	);
