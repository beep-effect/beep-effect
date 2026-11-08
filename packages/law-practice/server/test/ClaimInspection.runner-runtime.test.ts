import {
  ClaimInputCollection,
  ClaimInputRecord,
  decomposeClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { ClaimInspection, UsptoClaimInputs, UsptoClaimsError } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { WinkEngineError, WinkIntrinsicNounActivationError } from "@beep/wink";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { makeEvaluationInspectionRuntime } from "./evaluation/inspection-tool.lexical.ts";

const noFetch = Layer.succeed(UsptoClaimInputs, {
  inputs: Effect.fn("RunnerControl.noAcquisition")(() =>
    UsptoClaimsError.make({ reason: "unavailable", message: "Supplied-source runner control." })
  ),
});
const inputFor = (sourceKey: string) =>
  ClaimInputCollection.make({
    sourceKey,
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: "A system comprising a welded joint is fixed.",
        canonicalText: "A system comprising a welded joint is fixed.",
      }),
    ],
  });
const inspectFamily = Effect.fn("RunnerControl.inspectFamily")(function* (
  runtime: Effect.Success<ReturnType<typeof makeEvaluationInspectionRuntime>>,
  input: ClaimInputCollection
) {
  const context = yield* runtime.pipe(Layer.provide(noFetch), Layer.build);
  return yield* ClaimInspection.use((service) => service.inspect(input)).pipe(Effect.provideContext(context));
});

it.effect("the runner's real shared-runtime helper retains intrinsic proof across distinct family inputs", () =>
  Effect.gen(function* () {
    const runtime = yield* makeEvaluationInspectionRuntime();
    for (const sourceKey of ["runner-family-one", "runner-family-two"]) {
      const input = inputFor(sourceKey);
      const report = yield* inspectFamily(runtime, input);
      assert.deepStrictEqual(report.input, input);
      const record = O.getOrThrow(A.head(report.records));
      assert.strictEqual(record.status, "complete");
      assert.strictEqual(record.decomposition.status, "decomposed");
      if (record.decomposition.status !== "decomposed") return;
      assert.deepStrictEqual(
        A.flatMap(record.decomposition.tree.elements, (element) => A.map(element.terms, (term) => term.head)),
        ["system", "welded joint"]
      );
    }
  })
);

it.effect("the runner replays ordinary typed initialization unavailability as partial legacy structures", () =>
  Effect.gen(function* () {
    const failure = WinkEngineError.fromCause("runner ordinary initialization control", "initialize");
    const runtime = yield* makeEvaluationInspectionRuntime(failure.pipe(Layer.effectContext));
    const input = inputFor("runner-unavailable");
    const report = yield* inspectFamily(runtime, input);
    const legacy = yield* decomposeClaimInput(input);
    const record = O.getOrThrow(A.head(report.records));
    const prior = O.getOrThrow(A.head(legacy));
    assert.strictEqual(record.status, "partial");
    if (record.status !== "partial") return;
    assert.strictEqual(record.decomposition.status, "decomposed");
    assert.strictEqual(prior.status, "decomposed");
    if (record.decomposition.status !== "decomposed" || prior.status !== "decomposed") return;
    assert.deepStrictEqual(record.decomposition.tree, prior.tree);
    assert.isTrue(A.some(record.coverage, (issue) => issue.kind === "policy-uncovered"));
  })
);

it.effect("the runner preserves an activation refusal instead of narrowing it to ordinary unavailability", () =>
  Effect.gen(function* () {
    const failure = WinkIntrinsicNounActivationError.make({ reason: "core-owner", cause: "runner control" });
    const runtime = yield* makeEvaluationInspectionRuntime(failure.pipe(Layer.effectContext));
    const result = yield* runtime.pipe(Layer.provide(noFetch), Layer.build, Effect.result);
    assert.strictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) assert.strictEqual(result.failure, failure);
  })
);

it.effect("the runner leaves defects outside its typed initialization result", () =>
  Effect.gen(function* () {
    const defect = new Error("runner initialization defect control");
    const exit = yield* makeEvaluationInspectionRuntime(Effect.die(defect).pipe(Layer.effectContext)).pipe(Effect.exit);
    assert.strictEqual(Exit.isFailure(exit), true);
    if (Exit.isFailure(exit)) assert.isTrue(Cause.hasDies(exit.cause));
  })
);
