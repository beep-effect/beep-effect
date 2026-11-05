import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CheckConclusion } from "@beep/github/CheckRun";
import {
  CheckRunCompleted,
  CheckRunConclusion,
  CheckRunInProgress,
  CheckRunProjection,
  CheckState,
  projectCheckState,
} from "@beep/github-reporting/CheckState";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

/** The plain wire shape a branded projection is compared against. */
type WireProjection = typeof CheckRunProjection.Encoded;

describe("CheckState", () => {
  it("decodes every state in the vocabulary", () => {
    for (const state of CheckState.literals) {
      assert.strictEqual(
        flow(
          S.decodeResult(CheckState),
          Result.getOrThrowWith((error) => error)
        )(state),
        state
      );
    }
  });

  it("rejects GitHub's cancelled — it is not a state a pipeline reports", () => {
    assert.throws(() =>
      flow(
        S.decodeUnknownResult(CheckState),
        Result.getOrThrowWith((error) => error)
      )("cancelled")
    );
  });

  it("projects every state onto the wire, exhaustively", () => {
    // The canonical table, in full: a new literal added to the vocabulary
    // without a row here fails this test rather than falling through the
    // projection's default arm silently.
    assert.deepStrictEqual<WireProjection>(projectCheckState("running"), { status: "in_progress" });
    assert.deepStrictEqual<WireProjection>(projectCheckState("pass"), { status: "completed", conclusion: "success" });
    assert.deepStrictEqual<WireProjection>(projectCheckState("fail"), { status: "completed", conclusion: "failure" });
    assert.deepStrictEqual<WireProjection>(projectCheckState("warn"), { status: "completed", conclusion: "neutral" });
    assert.deepStrictEqual<WireProjection>(projectCheckState("user_interaction_required"), {
      status: "completed",
      conclusion: "action_required",
    });
    assert.deepStrictEqual<WireProjection>(projectCheckState("skipped"), {
      status: "completed",
      conclusion: "skipped",
    });
    assert.deepStrictEqual<WireProjection>(projectCheckState("timeout"), {
      status: "completed",
      conclusion: "timed_out",
    });
    assert.strictEqual(CheckState.literals.length, 7, "a state was added without extending this table");
  });

  it("every completed projection lands inside @beep/github's conclusion set", () => {
    // The projection spells its conclusions structurally so this pure module
    // never imports the octokit-owning package at runtime. This is the drift
    // pin: a conclusion GitHub's wire vocabulary does not carry fails here,
    // not in a consumer's CheckRun.complete call.
    const wire = HashSet.fromIterable<string>(CheckConclusion.literals);
    for (const state of CheckState.literals) {
      const projected = projectCheckState(state);
      if (projected.status === "completed") {
        assert.isTrue(
          HashSet.has(wire, projected.conclusion),
          `${state} projects to unknown conclusion ${projected.conclusion}`
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

describe("check-run schema contracts", () => {
  it.effect("decodes every conclusion and excludes cancelled", () =>
    Effect.gen(function* () {
      for (const conclusion of CheckRunConclusion.literals) {
        const value = yield* S.decodeEffect(CheckRunConclusion)(conclusion);
        assert.strictEqual(value, conclusion);
        assert.isTrue(S.is(CheckConclusion)(conclusion));
      }
      assert.strictEqual(CheckRunConclusion.literals.length, 6);
      assert.isFalse(S.is(CheckRunConclusion)("cancelled"));
    })
  );

  it.effect("preserves plain wire objects and requires completed conclusions", () =>
    Effect.gen(function* () {
      const running = CheckRunInProgress.make({});
      const completed = CheckRunCompleted.make({ conclusion: "neutral" });
      assert.deepStrictEqual<WireProjection>(running, { status: "in_progress" });
      assert.deepStrictEqual<WireProjection>(completed, { status: "completed", conclusion: "neutral" });
      const value1 = yield* S.decodeEffect(CheckRunProjection)(running);
      assert.deepStrictEqual(value1, running);
      const value2 = yield* S.decodeEffect(CheckRunProjection)(completed);
      assert.deepStrictEqual(value2, completed);
      assert.isFalse("conclusion" in (yield* S.decodeEffect(CheckRunProjection)(running)));
      assert.isFalse(S.is(CheckRunProjection)({ status: "completed" }));
      assert.isFalse(S.is(CheckRunProjection)({ status: "completed", conclusion: undefined }));
      assert.isFalse(S.is(CheckRunProjection)({ status: "completed", conclusion: "cancelled" }));
      assert.isFalse(S.is(CheckRunProjection)({ status: "queued" }));
    })
  );
});

describe("check-run schema properties", () => {
  it.effect.prop(
    "every arbitrary state projects onto a decodable wire projection",
    [Arbitrary.schema(CheckState)],
    ([state]) =>
      Effect.gen(function* () {
        const projected = projectCheckState(state);
        const decoded = yield* S.decodeEffect(CheckRunProjection)(projected);
        assert.deepStrictEqual(decoded, projected);
        assert.strictEqual(projected.status === "in_progress", state === "running");
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "an arbitrary projection keeps its conclusion exactly when completed",
    [Arbitrary.schema(CheckRunProjection)],
    ([projection]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(CheckRunProjection)(projection);
        assert.strictEqual("conclusion" in encoded, projection.status === "completed");
        const value3 = yield* S.decodeEffect(CheckRunProjection)(encoded);
        assert.deepStrictEqual(value3, projection);
      }),
    { arbitrary: fcRuns(50) }
  );
});
