import { CliLog } from "@beep/cli-kit";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import { TerminalEnv } from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Audience } from "@beep/runtime-env";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

const ENV = "HOST_LOG_LEVEL";
const ESC = String.fromCharCode(0x1b);

const capturing = () => {
  const out: string[] = [];
  const err: string[] = [];
  const double: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
    error: (...args: ReadonlyArray<unknown>) => err.push(pipe(args, A.map(String), A.join(" "))),
  });
  return { double, out, err };
};

const records = Effect.gen(function* () {
  yield* Effect.logDebug("d");
  yield* Effect.logInfo("i");
  yield* Effect.logWarning("w");
  yield* Effect.logError("e");
});

const levelsOf = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    lines,
    A.filter((line) => Str.startsWith("{")(line)),
    A.map((line) => Result.getOrThrow(S.decodeResult(LogLevelRecord)(line)).level)
  );

/** Run `program` under a layer that needs nothing, with an optional env var and a captured Console. */
const run = Effect.fn("run")(function* (
  layer: Layer.Layer<never>,
  env: Record<string, string> = {},
  program: typeof records = records
) {
  const { double, out, err } = capturing();
  yield* program.pipe(
    provideBuilt(layer),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
    Effect.provideService(Console.Console, double)
  );
  return { out, err };
});

describe("CliLog.layer plainLogger: false (diagnostics only)", () => {
  const diagnosticsOnly = (extra: { readonly level?: "Debug" | "Info" | "Error"; readonly envVar?: string } = {}) =>
    CliLog.layer({ plainLogger: false, format: "json", ...extra });

  it.effect("with no level set, nothing is written to stderr or stdout", () =>
    Effect.gen(function* () {
      const { out, err } = yield* run(diagnosticsOnly({ envVar: ENV }));
      assert.deepStrictEqual(err, []);
      assert.deepStrictEqual(out, []);
    })
  );

  for (const value of ["constructor", "__proto__"]) {
    it.effect(`rejects inherited level ${value}, warns once and keeps diagnostics at None`, () =>
      Effect.gen(function* () {
        const { out, err } = yield* run(
          diagnosticsOnly({ envVar: ENV }),
          { [ENV]: value },
          Effect.gen(function* () {
            const Level1 = yield* CliLog.Level;
            assert.strictEqual(Level1, "None");
            yield* records;
          })
        );
        assert.deepStrictEqual(levelsOf(err), []);
        assert.strictEqual(err.length, 1);
        assert.include(err[0] ?? "", `${ENV}=${value} is not a log level`);
        assert.include(err[0] ?? "", "; ignoring it");
        assert.deepStrictEqual(out, []);
      })
    );
  }

  it.effect("with a level set, it writes NDJSON only: one line per record, no plain duplicate", () =>
    Effect.gen(function* () {
      const { out, err } = yield* run(diagnosticsOnly({ level: "Info" }));
      assert.deepStrictEqual(levelsOf(err), ["INFO", "WARN", "ERROR"]);
      assert.strictEqual(err.length, 3, A.join(err, "\n"));
      assert.deepStrictEqual(out, []);
    })
  );

  it.effect("control: by default the same level prints each record twice, plain and NDJSON", () =>
    Effect.gen(function* () {
      const { err } = yield* run(CliLog.layer({ format: "json", level: "Info" }));
      assert.deepStrictEqual(levelsOf(err), ["INFO", "WARN", "ERROR"]);
      assert.strictEqual(err.length, 6, A.join(err, "\n"));
    })
  );

  it.effect("extraLoggers still run beside the sink", () =>
    Effect.gen(function* () {
      const seen: Array<unknown> = [];
      const extra = Logger.make<unknown, void>(({ message }) => {
        seen.push(message);
      });
      const { err } = yield* run(
        CliLog.layer({ plainLogger: false, format: "json", level: "Error", extraLoggers: [extra] })
      );
      assert.deepStrictEqual(seen, [["i"], ["w"], ["e"]], "the extra logger keeps the ambient minimum, Info");
      assert.deepStrictEqual(levelsOf(err), ["ERROR"]);
    })
  );
});

describe("CliLog.layer level option", () => {
  it.effect("sets the diagnostics level with no env var at all", () =>
    Effect.gen(function* () {
      const { err } = yield* run(CliLog.layer({ plainLogger: false, format: "json", level: "Debug" }));
      assert.deepStrictEqual(levelsOf(err), ["DEBUG", "INFO", "WARN", "ERROR"]);
    })
  );

  it.effect("beats the env var, in both directions", () =>
    Effect.gen(function* () {
      const lowered = yield* run(CliLog.layer({ plainLogger: false, format: "json", level: "Debug", envVar: ENV }), {
        [ENV]: "error",
      });
      assert.deepStrictEqual(levelsOf(lowered.err), ["DEBUG", "INFO", "WARN", "ERROR"]);
      const raised = yield* run(CliLog.layer({ plainLogger: false, format: "json", level: "Error", envVar: ENV }), {
        [ENV]: "debug",
      });
      assert.deepStrictEqual(levelsOf(raised.err), ["ERROR"]);
    })
  );

  it.effect("an invalid env var is not read, so it neither warns nor overrides the level", () =>
    Effect.gen(function* () {
      const { err } = yield* run(CliLog.layer({ format: "json", level: "Error", envVar: ENV }), { [ENV]: "bogus" });
      assert.isFalse(
        A.some(err, (line) => Str.includes("bogus")(line)),
        A.join(err, "\n")
      );
      assert.deepStrictEqual(levelsOf(err), ["ERROR"]);
    })
  );

  it.effect("loses to core's --log-level: a MinimumLogLevel set inside the program is followed", () =>
    Effect.gen(function* () {
      const { err } = yield* run(
        CliLog.layer({ plainLogger: false, format: "json", level: "Error" }),
        {},
        records.pipe(Effect.provideService(References.MinimumLogLevel, "Debug"))
      );
      assert.deepStrictEqual(levelsOf(err), ["DEBUG", "INFO", "WARN", "ERROR"]);
    })
  );
});

describe("CliLog.layer requirements follow the fixed format", () => {
  it.effect("format json needs neither Audience nor TerminalEnv", () =>
    Effect.gen(function* () {
      // Assigned to a layer with an empty requirement: a leftover Audience or TerminalEnv would not compile.
      const layer: Layer.Layer<never, never, never> = CliLog.layer({ format: "json", level: "Info" });
      const { err } = yield* run(layer);
      assert.deepStrictEqual(levelsOf(err), ["INFO", "WARN", "ERROR"]);
    })
  );

  it.effect("format pretty needs TerminalEnv alone, for the stderr colour: the level is painted with it, or not", () =>
    Effect.gen(function* () {
      const layer: Layer.Layer<never, never, TerminalEnv> = CliLog.layer({
        format: "pretty",
        plainLogger: false,
        level: "Info",
      });
      const under = (color: "none" | "basic") =>
        run(layer.pipe(Layer.provide(TerminalEnv.layerTest({ stderr: { isTerminal: true, color } }))));
      const painted = (yield* under("basic")).err;
      const plain = (yield* under("none")).err;
      assert.strictEqual(painted.length, 3, A.join(painted, "\n"));
      assert.strictEqual(plain.length, 3, A.join(plain, "\n"));
      assert.isTrue(
        A.every(painted, (line) => Str.includes(ESC)(line)),
        A.join(painted, "\n")
      );
      assert.isFalse(
        A.some(plain, (line) => Str.includes(ESC)(line)),
        A.join(plain, "\n")
      );
      assert.match(plain[0] ?? "", /^\d\d:\d\d:\d\d\.\d{3} INFO i$/);
    })
  );

  it("format auto and the default still need both, as before", () => {
    const auto: Layer.Layer<never, never, Audience | TerminalEnv> = CliLog.layer({ format: "auto" });
    const omitted: Layer.Layer<never, never, Audience | TerminalEnv> = CliLog.layer();
    assert.isDefined(auto);
    assert.isDefined(omitted);
  });

  it("a fixed format with a file leaves exactly FileSystem and Path (plus TerminalEnv for pretty) in R", () => {
    const json: Layer.Layer<never, never, FileSystem.FileSystem | Path.Path> = CliLog.layer({
      format: "json",
      file: { path: "/x" },
    });
    const prettyFile: Layer.Layer<never, never, TerminalEnv | FileSystem.FileSystem | Path.Path> = CliLog.layer({
      format: "pretty",
      file: { path: "/x" },
    });
    assert.isDefined(json);
    assert.isDefined(prettyFile);
  });

  it("negative control: a fixed json layer is NOT assignable where a requirement is unmet, and auto is not requirement-free", () => {
    const needsNothing = CliLog.layer({ format: "auto" });
    const autoAssignable: typeof needsNothing extends Layer.Layer<never, never, never> ? true : false = false;
    assert.isFalse(autoAssignable);
    const alsoNeedsSomething = CliLog.layer({ format: "pretty" });
    const prettyAssignable: typeof alsoNeedsSomething extends Layer.Layer<never, never, never> ? true : false = false;
    assert.isFalse(prettyAssignable);
    assert.isDefined(needsNothing);
    assert.isDefined(alsoNeedsSomething);
  });
});

const LogLevelRecord = S.fromJsonString(S.Struct({ level: S.String }));
