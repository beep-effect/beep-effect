import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as DateTime from "effect/DateTime";
import * as Cause from "effect/Cause";
import * as TestConsole from "effect/testing/TestConsole";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { ActionLogger } from "../../effected/github-actions/ActionLogger.ts";

it.layer(Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger), { timeout: "30 seconds" })((it) => {
  it.effect("annotation projection rejects nonfinite numbers, empty text and nonnumeric text", () => Effect.gen(function* () {
    yield* Effect.logWarning("bad annotations").pipe(
      Effect.annotateLogs({ title: 12, file: false, startLine: Number.NaN, endLine: Number.POSITIVE_INFINITY, startColumn: "", endColumn: "invalid" }),
    );
    yield* Effect.logError("valid annotations").pipe(
      Effect.annotateLogs({ title: "title", file: "file.ts", startLine: "12", endLine: "Infinity", startColumn: 3, endColumn: null }),
    );
    assert.deepStrictEqual(yield* TestConsole.logLines, ["::warning::bad annotations", "::error title=title,file=file.ts,line=12,col=3::valid annotations"]);
  }));
  it.effect("an empty buffer flush prints no header or footer", () => Effect.gen(function* () {
    const before = yield* TestConsole.logLines;
    assert.strictEqual(yield* (yield* ActionLogger).withBuffer("empty", Effect.succeed(42)), 42);
    assert.deepStrictEqual(yield* TestConsole.logLines, before);
  }));
  it.effect("the logger accepts a scalar message at its direct callback boundary", () => Effect.gen(function* () {
    const before = yield* TestConsole.logLines;
    const date = DateTime.toDateUtc(yield* DateTime.now);
    yield* Effect.withFiber((fiber) => Effect.sync(() => ActionLogger.logger.log({ fiber, logLevel: "Info", message: "scalar", cause: Cause.empty, date: date })));
    assert.deepStrictEqual(yield* TestConsole.logLines, [...before, "scalar"]);
  }));
});
it.effect("the silent test double preserves annotated results", () => Effect.gen(function* () {
  assert.strictEqual(yield* ActionLogger.makeTest().annotated({ title: "test" }, Effect.succeed(42)), 42);
}));
