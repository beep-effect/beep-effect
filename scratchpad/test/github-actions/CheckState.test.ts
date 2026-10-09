import { assert, describe, it } from "@effect/vitest";
import { CheckConclusion } from "../../effected/github/index.ts";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { flow } from "effect/Function";
import { CheckState, projectCheckState } from "../../effected/github-actions/CheckState.ts";

describe("CheckState", () => {
	it("decodes every state in the vocabulary", () => {
		for (const state of CheckState.literals) {
			assert.strictEqual(flow(S.decodeResult(CheckState), Result.getOrThrowWith((error) => error))(state), state);
		}
	});

	it("rejects GitHub's cancelled — it is not a state a pipeline reports", () => {
		assert.throws(() => flow(S.decodeUnknownResult(CheckState), Result.getOrThrowWith((error) => error))("cancelled"));
	});

	it("projects every state onto the wire, exhaustively", () => {
		// The canonical table, in full: a new literal added to the vocabulary
		// without a row here fails this test rather than falling through the
		// projection's default arm silently.
		assert.deepStrictEqual(projectCheckState("running"), { status: "in_progress" });
		assert.deepStrictEqual(projectCheckState("pass"), { status: "completed", conclusion: "success" });
		assert.deepStrictEqual(projectCheckState("fail"), { status: "completed", conclusion: "failure" });
		assert.deepStrictEqual(projectCheckState("warn"), { status: "completed", conclusion: "neutral" });
		assert.deepStrictEqual(projectCheckState("user_interaction_required"), {
			status: "completed",
			conclusion: "action_required",
		});
		assert.deepStrictEqual(projectCheckState("skipped"), { status: "completed", conclusion: "skipped" });
		assert.deepStrictEqual(projectCheckState("timeout"), { status: "completed", conclusion: "timed_out" });
		assert.strictEqual(CheckState.literals.length, 7, "a state was added without extending this table");
	});

	it("every completed projection lands inside @effected/github's conclusion set", () => {
		// The projection spells its conclusions structurally so this pure module
		// never imports the octokit-owning package at runtime. This is the drift
		// pin: a conclusion GitHub's wire vocabulary does not carry fails here,
		// not in a consumer's CheckRun.complete call.
		const wire = new Set<string>(CheckConclusion.literals);
		for (const state of CheckState.literals) {
			const projected = projectCheckState(state);
			if (projected.status === "completed") {
				assert.isTrue(
					wire.has(projected.conclusion),
					`${state} projects to unknown conclusion ${projected.conclusion}`,
				);
			}
		}
	});

	it("only running projects to in_progress, and it carries no conclusion", () => {
		for (const state of CheckState.literals) {
			const projected = projectCheckState(state);
			if (state === "running") {
				assert.strictEqual(projected.status, "in_progress");
				assert.isFalse("conclusion" in projected);
			} else {
				assert.strictEqual(projected.status, "completed");
			}
		}
	});
});
