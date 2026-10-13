import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { TestConsole } from "effect/testing";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { ActionLogger } from "../../effected/github-actions/ActionLogger.ts";
const runs = { arbitrary: fcRuns(100) };

it.layer(Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger), { timeout: "30 seconds" })((it) => {
  it.effect.prop("plain-message formatting is idempotent after command neutralization", [Arbitrary.schema(S.String)], ([message]) => Effect.gen(function* () {
    const before = (yield* TestConsole.logLines).length;
    const date = DateTime.toDateUtc(yield* DateTime.now);
    yield* Effect.withFiber((fiber) => Effect.sync(() => ActionLogger.logger.log({ fiber, logLevel: "Info", message, cause: Cause.empty, date })));
    const once = (yield* TestConsole.logLines)[before];
    assert.isDefined(once);
    yield* Effect.withFiber((fiber) => Effect.sync(() => ActionLogger.logger.log({ fiber, logLevel: "Info", message: once, cause: Cause.empty, date })));
    assert.strictEqual((yield* TestConsole.logLines)[before + 1], once);
  }), runs);

  it.effect.prop("buffering preserves a failed transcript and discards a successful transcript", [Arbitrary.schema(S.Int)], ([value]) => Effect.gen(function* () {
    const logger = yield* ActionLogger;
    const before = yield* TestConsole.logLines;
    assert.strictEqual(yield* logger.withBuffer("success", Effect.as(Effect.logInfo(value), value), { onSuccess: "discard" }), value);
    assert.deepStrictEqual(yield* TestConsole.logLines, before);
    assert.strictEqual(yield* Effect.flip(logger.withBuffer("failure", Effect.andThen(Effect.logInfo(value), Effect.fail(value)), { onSuccess: "discard" })), value);
    assert.deepStrictEqual((yield* TestConsole.logLines).slice(before.length), ['--- Buffered output for "failure" ---', String(value), '--- End buffered output for "failure" ---']);
  }), runs);
});
