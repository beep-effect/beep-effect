import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliLog } from "../../effected/cli/CliLog.ts";

it.effect("CliLog retains its runtime class identity", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(CliLog, []) instanceof CliLog);
}));

import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Console from "effect/Console";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import { CliEnv } from "../../effected/cli/CliEnv.ts";
import { envBuildLogLayer } from "../../effected/cli/CliLog.ts";

const recordDate = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T01:02:03.000Z"));
it.layer(CliLog.layer({ level: "All", format: "auto", plainLogger: false, neutralize: false }).pipe(Layer.provide(CliEnv.layerTest({ audience: "human" }))), { timeout: "30 seconds" })((it) => {
  it.effect("pretty diagnostics fall back to the built audience and accept scalar messages, causes and sentinel levels", () => Effect.gen(function* () {
    const lines: Array<string> = [];
    const captured: Console.Console = { ...console, error: (...args: ReadonlyArray<unknown>) => { lines.push(args.map(String).join(" ")); } };
    yield* Effect.withFiber((fiber) => Effect.gen(function* () {
      const loggers = yield* Logger.CurrentLoggers;
      for (const logger of loggers) logger.log({ fiber, date: recordDate, message: "scalar", logLevel: "All", cause: Cause.fail("detail") });
    })).pipe(Effect.provideService(Console.Console, captured));
    assert.strictEqual(lines.length, 1);
    assert.include(lines[0] ?? "", "01:02:03.000 ALL scalar");
    assert.include(lines[0] ?? "", "detail");
  }));
});
const ordinary: Array<unknown> = [];
it.layer(CliLog.layer({ level: "Debug", format: "json", plainLogger: false, extraLoggers: [Logger.make(({ message }) => { ordinary.push(message); })] }), { timeout: "30 seconds" })((it) => {
  it.effect("ordinary logger floors follow a changed fiber minimum", () => Effect.gen(function* () {
    const lines: Array<string> = [];
    const captured: Console.Console = { ...console, error: (...args: ReadonlyArray<unknown>) => { lines.push(args.map(String).join(" ")); } };
    yield* Effect.withFiber((fiber) => Effect.gen(function* () {
      const loggers = yield* Logger.CurrentLoggers;
      for (const logger of loggers) {
        logger.log({ fiber, date: recordDate, message: "below threshold", logLevel: "Info", cause: Cause.empty });
        logger.log({ fiber, date: recordDate, message: "changed threshold", logLevel: "Warn", cause: Cause.empty });
      }
    })).pipe(Effect.provideService(References.MinimumLogLevel, "Warn"), Effect.provideService(Console.Console, captured));
    assert.deepStrictEqual(ordinary, ["changed threshold"]);
    assert.strictEqual(lines.length, 1);
    assert.include(lines[0] ?? "", "changed threshold");
  }));
});
it.layer(envBuildLogLayer({ format: "json" }), { timeout: "30 seconds" })((it) => {
  it.effect("environment build diagnostics discard informational records", () => Effect.gen(function* () {
    const lines: Array<string> = [];
    const captured: Console.Console = { ...console, error: (...args: ReadonlyArray<unknown>) => { lines.push(args.map(String).join(" ")); } };
    yield* Effect.logInfo("quiet configuration").pipe(Effect.provideService(Console.Console, captured));
    assert.deepStrictEqual(lines, []);
  }));
});
