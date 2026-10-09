import { Schema } from "effect";

/**
 * The kit's check-state vocabulary.
 *
 * @remarks
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
export const CheckState = Schema.Literals([
	"running",
	"pass",
	"fail",
	"warn",
	"user_interaction_required",
	"skipped",
	"timeout",
]);

/**
 * The type of `CheckState`.
 *
 * @public
 */
export type CheckState = typeof CheckState.Type;

/**
 * The check-run conclusions the kit vocabulary can produce.
 *
 * @remarks
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
 * @remarks
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
 * @remarks
 * The canonical mapping: `running` is `in_progress`; everything else is
 * `completed` with `pass → success`, `fail → failure`, `warn → neutral`
 * (GitHub has no warning conclusion, and `neutral` is its non-failing,
 * non-success verdict), `user_interaction_required → action_required`,
 * `skipped → skipped` and `timeout → timed_out`.
 *
 * @public
 */
export const projectCheckState = (state: CheckState): CheckRunProjection => {
	switch (state) {
		case "running":
			return { status: "in_progress" };
		case "pass":
			return { status: "completed", conclusion: "success" };
		case "fail":
			return { status: "completed", conclusion: "failure" };
		case "warn":
			return { status: "completed", conclusion: "neutral" };
		case "user_interaction_required":
			return { status: "completed", conclusion: "action_required" };
		case "skipped":
			return { status: "completed", conclusion: "skipped" };
		case "timeout":
			return { status: "completed", conclusion: "timed_out" };
		default: {
			// Exhaustiveness at compile time: a literal added to the vocabulary
			// without a row here fails the build, not just the runtime count test.
			const unhandled: never = state;
			throw new Error(`Unhandled CheckState: ${String(unhandled)}`);
		}
	}
};
