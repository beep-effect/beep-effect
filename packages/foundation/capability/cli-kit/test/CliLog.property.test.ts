import { CliEnv } from "@beep/cli-kit/CliEnv";
import { CliLog, CliLogFile, CliLogStatusOptions } from "@beep/cli-kit/CliLog";
import { Fmt } from "@beep/cli-kit/Fmt";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";

const runs = { arbitrary: fcRuns(100) };

it.effect("CliLogStatusOptions keeps exact optional keys and plain construction", () =>
  Effect.gen(function* () {
    const omitted = CliLogStatusOptions.make({});
    assert.deepStrictEqual<unknown>(omitted, {});
    const full = CliLogStatusOptions.make({ level: "Info", indent: 1 });
    // Own keys: only the given keys, and no tag is added.
    assert.deepStrictEqual(A.sort(Struct.keys(full), Str.Order), ["indent", "level"]);
    for (const value of [
      omitted,
      full,
      { level: "Warn", indent: 2 },
      { indent: "  │ " },
      { indent: Number.NaN },
      { indent: Number.POSITIVE_INFINITY },
      { indent: Number.NEGATIVE_INFINITY },
    ]) {
      assert.isTrue(S.is(CliLogStatusOptions)(value));
      const encoded = yield* S.encodeUnknownEffect(CliLogStatusOptions)(value);
      const decoded = yield* S.decodeEffect(CliLogStatusOptions)(encoded);
      assert.deepStrictEqual(decoded, value);
      const value1 = yield* S.encodeEffect(CliLogStatusOptions)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }
    // EF-40: a present key holding `undefined` is rejected.
    for (const value of [
      { level: undefined },
      { indent: undefined },
      { level: "All" },
      { level: "None" },
      { level: "warning" },
      { indent: null },
      { indent: true },
    ]) {
      assert.isFalse(S.is(CliLogStatusOptions)(value));
    }
  })
);

it.effect("CliLogFile encodes two valid keys as the explicit path without changing codec precedence", () =>
  Effect.gen(function* () {
    const original = { path: "/logs/explicit.ndjson", envVar: "TOOL_LOG_FILE" };
    assert.isTrue(S.is(CliLogFile)(original));
    const encoded = yield* S.encodeEffect(CliLogFile)(original);
    assert.deepStrictEqual(encoded, { path: original.path });
    const decoded = yield* S.decodeEffect(CliLogFile)(encoded);
    assert.deepStrictEqual(decoded, { path: original.path });
    const value2 = yield* S.encodeEffect(CliLogFile)(decoded);
    assert.deepStrictEqual(value2, encoded);
  })
);

it.effect.prop(
  "CliLogFile round-trips both plain file-sink cases",
  [Arbitrary.schema(CliLogFile)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CliLogFile)(value);
      const decoded = yield* S.decodeEffect(CliLogFile)(encoded);
      assert.deepStrictEqual(decoded, value);
      const value3 = yield* S.encodeEffect(CliLogFile)(decoded);
      assert.deepStrictEqual(value3, encoded);
    }),
  runs
);

it.effect("CliLogFile keeps empty paths and variable names without adding a discriminator", () =>
  Effect.gen(function* () {
    for (const value of [{ path: "" }, { envVar: "" }]) {
      const encoded = yield* S.encodeEffect(CliLogFile)(value);
      const value4 = yield* S.decodeEffect(CliLogFile)(encoded);
      assert.deepStrictEqual(value4, value);
    }
  })
);

const Record = S.fromJsonString(S.Struct({ message: S.String }));
it.layer(CliLog.layer({ format: "json", level: "Info", plainLogger: false, neutralize: true }), {
  timeout: "30 seconds",
})((it) => {
  it.effect.prop(
    "NDJSON diagnostics preserve arbitrary messages through parse/stringify and Actions neutralization",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.gen(function* () {
        const lines: Array<string> = [];
        const captured: Console.Console = {
          ...console,
          error: (...args: ReadonlyArray<unknown>) => {
            lines.push(pipe(args, A.map(String), A.join(" ")));
          },
        };
        yield* Effect.logInfo(text).pipe(Effect.provideService(Console.Console, captured));
        assert.strictEqual(lines.length, 1);
        const value = yield* S.decodeEffect(Record)(lines[0] ?? "");
        assert.strictEqual(value.message, text);
        const encoded = yield* S.encodeEffect(Record)(value);
        const value5 = yield* S.decodeEffect(Record)(encoded);
        assert.deepStrictEqual(value5, value);
        const argument = S.encodeEffect(Record);
        const value7 = yield* S.decodeEffect(Record)(encoded);
        const value6 = yield* argument(value7);
        assert.strictEqual(value6, encoded);
        assert.isFalse(Str.includes("##[")(lines[0] ?? ""));
      }),
    runs
  );
});
const recordDate = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T01:02:03.000Z"));
it.layer(
  CliLog.layer({ format: "pretty", level: "Info", plainLogger: false, neutralize: false }).pipe(
    Layer.provide(CliEnv.layerTest())
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect.prop(
    "pretty diagnostics preserve sanitized text and formatting normalized input is idempotent",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.gen(function* () {
        const lines: Array<string> = [];
        const captured: Console.Console = {
          ...console,
          error: (...args: ReadonlyArray<unknown>) => {
            lines.push(pipe(args, A.map(String), A.join(" ")));
          },
        };
        yield* Effect.withFiber((fiber) =>
          Effect.gen(function* () {
            const loggers = yield* Logger.CurrentLoggers;
            for (const logger of loggers) {
              logger.log({ fiber, date: recordDate, message: text, logLevel: "Info", cause: Cause.empty });
              logger.log({
                fiber,
                date: recordDate,
                message: Fmt.sanitize(text),
                logLevel: "Info",
                cause: Cause.empty,
              });
            }
          })
        ).pipe(Effect.provideService(Console.Console, captured));
        assert.deepStrictEqual(lines, [
          `01:02:03.000 INFO ${Fmt.sanitize(text)}`,
          `01:02:03.000 INFO ${Fmt.sanitize(text)}`,
        ]);
        assert.strictEqual(Fmt.sanitize(lines[0] ?? ""), lines[0]);
      }),
    runs
  );
});
