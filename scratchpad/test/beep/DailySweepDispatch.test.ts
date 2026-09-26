import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CertifiedSweepFailure,
  MemoryExtractionFailure,
  PreDispatchReason,
  SweepDispatchScope,
  SweepPreDispatchError,
  certifyPreDispatch,
  enterSweepDispatch,
  exitSweepDispatch,
  makeSweepPreDispatchError,
  markProviderDispatch,
  preDispatchReason,
  provesPreDispatch,
} from "../../beep/DailySweepDispatch.ts";

const isCertifiedSweepFailure = S.is(CertifiedSweepFailure);
const isSweepPreDispatchError = S.is(SweepPreDispatchError);

const failure = <E>(effect: Effect.Effect<unknown, E>): E => {
  const exit = Effect.runSyncExit(effect);
  if (exit._tag === "Success") throw new Error("expected failure");
  const found = Cause.findErrorOption(exit.cause);
  if (O.isNone(found)) throw new Error("expected a typed failure");
  return found.value;
};

describe("DailySweepDispatch", () => {
  it("proves only the issued object and hides the reason after dispatch", () => {
    const issued = makeSweepPreDispatchError("daily_sweep_summary_agent");
    const scope = SweepDispatchScope.make({ issued: O.some(issued), reason: O.some(issued.extractor) });
    assert.strictEqual(provesPreDispatch(scope, issued), true);
    assert.strictEqual(provesPreDispatch(scope, makeSweepPreDispatchError("daily_sweep_summary_agent")), false);
    assert.strictEqual(O.getOrElse(preDispatchReason(scope, issued), () => "daily_sweep_summary_agent"), issued.extractor);
    const dispatched = SweepDispatchScope.make({
      dispatched: true,
      issued: O.some(issued),
      reason: O.some<PreDispatchReason>("source_lock_check_unavailable"),
    });
    assert.strictEqual(provesPreDispatch(dispatched, issued), false);
    assert.strictEqual(O.isNone(preDispatchReason(dispatched, issued)), true);
  });

  it("enters, exits, and latches provider dispatch", () => {
    const entered = enterSweepDispatch(SweepDispatchScope.make({}));
    assert.strictEqual(entered.tokenHeld, true);
    assert.strictEqual(Effect.runSync(exitSweepDispatch(entered)).tokenHeld, false);
    assert.strictEqual(Effect.runSyncExit(exitSweepDispatch(SweepDispatchScope.make({})))._tag, "Failure");
    let ran = false;
    const marked = markProviderDispatch(O.some(SweepDispatchScope.make({})), O.some(() => {
      ran = true;
    }));
    assert.strictEqual(ran, true);
    assert.strictEqual(O.getOrElse(marked, () => SweepDispatchScope.make({})).dispatched, true);
    let skipped = false;
    assert.strictEqual(O.isNone(markProviderDispatch(O.none(), O.some(() => {
      skipped = true;
    }))), true);
    assert.strictEqual(skipped, false);
  });

  it("offers pipeable forms that match the data-first results", () => {
    const issued = makeSweepPreDispatchError("daily_sweep_summary_agent");
    const scope = SweepDispatchScope.make({ issued: O.some(issued), reason: O.some(issued.extractor) });
    assert.strictEqual(pipe(scope, provesPreDispatch(issued)), true);
    assert.strictEqual(pipe(scope, provesPreDispatch(makeSweepPreDispatchError("daily_sweep_summary_agent"))), false);
    assert.strictEqual(O.getOrElse(pipe(scope, preDispatchReason(issued)), () => "source_locked_before_dispatch"), issued.extractor);
    let ran = false;
    const marked = pipe(
      O.some(scope),
      markProviderDispatch(O.some(() => {
        ran = true;
      })),
    );
    assert.strictEqual(ran, true);
    assert.strictEqual(O.getOrElse(marked, () => SweepDispatchScope.make({})).dispatched, true);
    assert.strictEqual(O.isNone(O.flatMap(marked, preDispatchReason(issued))), true);
  });

  it("certifies a preparation failure and rethrows after dispatch", () => {
    const success = Effect.runSync(certifyPreDispatch(O.some(SweepDispatchScope.make({})), Effect.succeed("ok")));
    assert.strictEqual(success.value, "ok");
    const certified = failure(
      certifyPreDispatch(
        O.some(SweepDispatchScope.make({})),
        Effect.fail(MemoryExtractionFailure.make({ extractor: "daily_sweep_summary_input_budget", message: "budget" })),
      ),
    );
    assert.strictEqual(isCertifiedSweepFailure(certified), true);
    if (isCertifiedSweepFailure(certified)) {
      assert.strictEqual(certified.reason, "daily_sweep_summary_input_budget");
      assert.strictEqual(provesPreDispatch(certified.scope, certified.issued), true);
    }
    const coerced = failure(
      certifyPreDispatch(
        O.some(SweepDispatchScope.make({})),
        Effect.fail(MemoryExtractionFailure.make({ extractor: "not-a-reason", message: "other" })),
      ),
    );
    if (isCertifiedSweepFailure(coerced)) {
      assert.strictEqual(coerced.reason, "daily_sweep_summary_agent");
    }
    const issued = makeSweepPreDispatchError("source_locked_before_dispatch");
    const active = SweepDispatchScope.make({ dispatched: true, issued: O.some(issued), reason: O.some(issued.extractor) });
    const rethrown = failure(certifyPreDispatch(O.some(active), Effect.fail(issued)));
    assert.strictEqual(isSweepPreDispatchError(rethrown), true);
    const absent = failure(certifyPreDispatch(O.none(), Effect.fail(issued)));
    assert.strictEqual(absent, issued);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [PreDispatchReason, SweepPreDispatchError, SweepDispatchScope, CertifiedSweepFailure, MemoryExtractionFailure]) {
      assert.strictEqual(schema.pipe(Arbitrary.schema, Arbitrary.isArbitrary), true);
    }
  });
});
