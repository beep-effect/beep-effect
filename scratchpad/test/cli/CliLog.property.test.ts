import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Console from "effect/Console";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { CliEnv } from "../../effected/cli/CliEnv.ts";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CliLog } from "../../effected/cli/CliLog.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";

const runs = { arbitrary: fcRuns(100) };
const Record = S.fromJsonString(S.Struct({ message: S.String }));
it.layer(CliLog.layer({ format: "json", level: "Info", plainLogger: false, neutralize: true }), { timeout: "30 seconds" })((it) => {
  it.effect.prop("NDJSON diagnostics preserve arbitrary messages through parse/stringify and Actions neutralization", [Arbitrary.schema(S.String)], ([text]) => Effect.gen(function* () {
    const lines: Array<string> = [];
    const captured: Console.Console = { ...console, error: (...args: ReadonlyArray<unknown>) => { lines.push(args.map(String).join(" ")); } };
    yield* Effect.logInfo(text).pipe(Effect.provideService(Console.Console, captured));
    assert.strictEqual(lines.length, 1);
    const value = yield* S.decodeEffect(Record)(lines[0] ?? "");
    assert.strictEqual(value.message, text);
    const encoded = yield* S.encodeEffect(Record)(value);
    assert.deepStrictEqual(yield* S.decodeEffect(Record)(encoded), value);
    assert.strictEqual(yield* S.encodeEffect(Record)(yield* S.decodeEffect(Record)(encoded)), encoded);
    assert.isFalse((lines[0] ?? "").includes("##["));
  }), runs);
});
const recordDate = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T01:02:03.000Z"));
it.layer(CliLog.layer({ format: "pretty", level: "Info", plainLogger: false, neutralize: false }).pipe(Layer.provide(CliEnv.layerTest())), { timeout: "30 seconds" })((it) => {
  it.effect.prop("pretty diagnostics preserve sanitized text and formatting normalized input is idempotent", [Arbitrary.schema(S.String)], ([text]) => Effect.gen(function* () {
    const lines: Array<string> = [];
    const captured: Console.Console = { ...console, error: (...args: ReadonlyArray<unknown>) => { lines.push(args.map(String).join(" ")); } };
    yield* Effect.withFiber((fiber) => Effect.gen(function* () {
      const loggers = yield* Logger.CurrentLoggers;
      for (const logger of loggers) {
        logger.log({ fiber, date: recordDate, message: text, logLevel: "Info", cause: Cause.empty });
        logger.log({ fiber, date: recordDate, message: Fmt.sanitize(text), logLevel: "Info", cause: Cause.empty });
      }
    })).pipe(Effect.provideService(Console.Console, captured));
    assert.deepStrictEqual(lines, [`01:02:03.000 INFO ${Fmt.sanitize(text)}`, `01:02:03.000 INFO ${Fmt.sanitize(text)}`]);
    assert.strictEqual(Fmt.sanitize(lines[0] ?? ""), lines[0]);
  }), runs);
});
