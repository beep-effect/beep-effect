import { env as runnerEnvironment } from "node:process";
import {
  Action,
  ActionEnvironment,
  ActionFailedError,
  ActionInput,
  ActionOutputs,
  ActionRuntime,
  describeCause,
} from "@beep/github-actions";
import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as References from "effect/References";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ActionEnvironmentError, ActionRunOptions, ActionServices } from "@beep/github-actions";

class Extra extends Context.Service<Extra, { readonly describe: Effect.Effect<string, ActionEnvironmentError> }>()(
  "@beep/github-actions/test/Action.test/Extra"
) {}

class Boom extends S.TaggedError<Boom, { readonly brand: unique symbol }>()("Boom", { detail: S.String }) {
  override get message(): string {
    return `it went wrong: ${this.detail}`;
  }
}

/**
 * The runner environment every capture installs, restored after each test.
 */
const RUNNER_ENV: Readonly<Record<string, string>> = {
  GITHUB_REPOSITORY: "acme/example",
  GITHUB_JOB: "test-job",
  // The runner uppercases an input name and replaces SPACES; dashes survive.
  "INPUT_MY-GREETING": "hello",
  // What the runner writes for an input the workflow did NOT supply.
  INPUT_OMITTED: "",
  // The false-green reproduction: a bare Config read of "dry-run" must reach
  // this variable through the installed provider.
  "INPUT_DRY-RUN": "from-input",
  // The shadowing pair: an input and an env var with the same bare name.
  INPUT_SHADOWED: "from-input",
  SHADOWED: "from-env",
  // A plain variable with no corresponding input, for the fallback.
  PLAIN_VAR: "from-env",
};

class Captured extends Context.Service<Captured, { readonly lines: ReadonlyArray<string> }>()(
  "@beep/github-actions/test/Action.test/Captured"
) {}

// Action.main owns its runtime, so its real console and runner environment are the subject.
const captureLayer = (env: Readonly<Record<string, string | undefined>> = {}) =>
  Layer.effect(
    Captured,
    Effect.acquireRelease(
      Effect.sync(() => {
        const lines: Array<string> = [];
        const spy = vi.spyOn(console, "log").mockImplementation((...parts: ReadonlyArray<unknown>) => {
          lines.push(pipe(parts, A.map(String), A.join(" ")));
        });
        const variables = { ...RUNNER_ENV, ...env };
        const previousEnv = MutableHashMap.fromIterable(
          A.map(R.keys(variables), (name) => [name, runnerEnvironment[name]] as const)
        );
        for (const [name, value] of R.toEntries(variables)) {
          if (value === undefined) delete runnerEnvironment[name];
          else runnerEnvironment[name] = value;
        }
        return { lines, spy, previousEnv };
      }),
      ({ spy, previousEnv }) =>
        Effect.sync(() => {
          spy.mockRestore();
          for (const [name, value] of previousEnv) {
            if (value === undefined) delete runnerEnvironment[name];
            else runnerEnvironment[name] = value;
          }
        })
    )
  );

/**
 * The exit code `Runtime.defaultTeardown` — the teardown `Action.run` hands to
 * `NodeRuntime.runMain` — maps an `Exit` to.
 */
const exitCodeOf = (exit: Exit.Exit<unknown, unknown>): number => {
  const codes: Array<number> = [];
  Runtime.defaultTeardown(exit, (code) => codes.push(code));
  return codes[0] ?? -1;
};

/**
 * Run `Action.main` and keep its `Exit`.
 *
 * **Details**
 *
 * On the real console, because `it.effect` installs a `TestConsole` and the
 * subject here is what the runner reads.
 */
const mainExit = <E, R = never>(
  program: Effect.Effect<void, E, ActionServices | R>,
  options?: ActionRunOptions<R>
): Effect.Effect<Exit.Exit<void, ActionFailedError>> =>
  Action.main(program, options).pipe(Effect.provideService(Console.Console, console), Effect.exit);

/** The exit code a `runMain` would give the process for `Action.main(program)`. */
const verdict = <E, R = never>(
  program: Effect.Effect<void, E, ActionServices | R>,
  options?: ActionRunOptions<R>
): Effect.Effect<number> => Effect.map(mainExit(program, options), exitCodeOf);

/**
 * Launch through `Action.run` itself, with a teardown that records the code
 * instead of exiting the process.
 */
const runVerdict = (launch: (teardown: Runtime.Teardown) => void): Effect.Effect<number> =>
  Effect.callback<number>((resume) => {
    launch((exit, _onExit) => Runtime.defaultTeardown(exit, (code) => resume(Effect.succeed(code))));
  });

describe("describeCause", () => {
  it("renders a typed failure as [Tag]: message", () => {
    // What a human scanning a workflow log for the first red line actually
    // needs: which error, and what it said.
    assert.strictEqual(
      Boom.make({ detail: "no token" }).pipe(Cause.fail, describeCause),
      "[Boom]: it went wrong: no token"
    );
  });

  it("marks a defect as one, because the two need different fixes", () => {
    const rendered = describeCause(Cause.die(new TypeError("x is not a function")));
    assert.include(rendered, "[defect]");
    assert.include(rendered, "x is not a function");
  });

  it("says something rather than nothing for an interruption", () => {
    // An interrupt carries no error and no message. The predecessor's fallback
    // chain ended in a sentinel for exactly this case; the requirement is only
    // that the line is never empty.
    assert.notStrictEqual(Cause.interrupt(1).pipe(describeCause, Str.trim), "");
  });

  it("renders a plain Error, which is what a thrown library failure is", () => {
    assert.strictEqual(describeCause(Cause.fail(new RangeError("out of range"))), "[RangeError]: out of range");
  });
});

describe("Action.main", () => {
  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("resolves without touching the exit code when the program succeeds", () =>
      Effect.gen(function* () {
        yield* Captured;
        const code = yield* verdict(Effect.void);
        assert.strictEqual(code, 0);
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("renders one ::error:: line and fails the step", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const code = yield* Boom.make({ detail: "no token" }).pipe(Effect.fail, verdict);
        assert.strictEqual(code, 1);
        const errors = A.filter(lines, (line) => Str.startsWith("::error::")(line));
        assert.lengthOf(errors, 1, "one line, not a wall of them");
        assert.include(errors[0] ?? "", "Action failed: [Boom]: it went wrong: no token");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("puts the fiddly diagnostics behind ::debug::, where the runner hides them", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* Boom.make({ detail: "no token" }).pipe(Effect.fail, verdict);
        assert.isTrue(A.some(lines, (line) => Str.startsWith("::debug::")(line)));
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("fails the step for a defect too, not only for a typed failure", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const code = yield* verdict(
          Effect.sync((): void => {
            throw new TypeError("undefined is not a function");
          })
        );
        assert.strictEqual(code, 1);
        assert.isTrue(A.some(lines, (line) => Str.startsWith("::error::")(line) && Str.includes("[defect]")(line)));
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("fails with an already-reported ActionFailedError, so runMain neither re-logs nor exits green", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const exit = yield* Boom.make({ detail: "x" }).pipe(Effect.fail, mainExit);
        assert.isTrue(Exit.isFailure(exit));
        const error = Exit.findErrorOption(exit);
        assert.isTrue(O.isSome(error) && S.is(ActionFailedError)(error.value));
        const failure = O.getOrThrow(error);
        assert.strictEqual(failure.summary, "[Boom]: it went wrong: x");
        assert.strictEqual(failure.message, "Action failed: [Boom]: it went wrong: x");
        assert.strictEqual(Runtime.getErrorExitCode(failure), 1);
        assert.isFalse(Runtime.getErrorReported(failure));
        // The rendered line and the error agree, so nothing needs a second say.
        assert.include(lines, `::error::${failure.message}`);
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("provides the runner services the program asks for", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const code = yield* verdict(
          Effect.gen(function* () {
            const env = yield* ActionEnvironment;
            const repository = yield* env.get("GITHUB_REPOSITORY");
            yield* Effect.logWarning(`saw ${repository}`);
          })
        );
        assert.strictEqual(code, 0);
        assert.include(lines, "::warning::saw acme/example");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("installs the INPUT_ config provider, so an input resolves without anyone spelling the variable", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const code = yield* verdict(
          Effect.gen(function* () {
            const greeting = yield* ActionInput.string("my-greeting");
            yield* Effect.log(`greeting=${greeting}`);
          })
        );
        assert.isTrue(A.some(lines, (line) => Str.includes("greeting=hello")(line)));
        assert.strictEqual(code, 0);
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("reads an omitted input as absent, so a default is a default", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(
          Effect.gen(function* () {
            const omitted = yield* ActionInput.string("omitted").pipe(Config.withDefault("fallback"));
            yield* Effect.logWarning(`omitted=${omitted}`);
          })
        );
        assert.include(lines, "::warning::omitted=fallback");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect(
      "resolves a bare Config read through the INPUT_ derivation — the false-green class, dead at the root",
      () =>
        Effect.gen(function* () {
          const { lines } = yield* Captured;
          const code = yield* verdict(
            Effect.gen(function* () {
              // The exact shipped defect: a bare read with a default. Before the
              // runtime installed the provider, the plain-named lookup found
              // nothing, the default fired, and a rehearsal flag silently read as
              // its fallback on every run.
              const dryRun = yield* Config.String("dry-run").pipe(Config.withDefault("defaulted"));
              yield* Effect.logWarning(`dry-run=${dryRun}`);
            })
          );
          assert.include(lines, "::warning::dry-run=from-input", "the default must NOT fire");
          assert.strictEqual(code, 0);
        })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("still resolves a plain env var with no corresponding input", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const code = yield* verdict(
          Effect.gen(function* () {
            yield* Effect.logWarning(`plain=${yield* Config.String("PLAIN_VAR")}`);
          })
        );
        assert.include(lines, "::warning::plain=from-env");
        assert.strictEqual(code, 0);
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("an input shadows an env var of the same bare name — pinned, not accidental", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(
          Effect.gen(function* () {
            // Both INPUT_SHADOWED and SHADOWED are set. The input wins for a
            // bare read in ANY casing, because the derivation uppercases; that
            // is the documented trade for killing the false-green class.
            yield* Effect.logWarning(`upper=${yield* Config.String("SHADOWED")}`);
            yield* Effect.logWarning(`lower=${yield* Config.String("shadowed")}`);
          })
        );
        assert.include(lines, "::warning::upper=from-input");
        assert.include(lines, "::warning::lower=from-input");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("a caller-supplied ConfigProvider in the extra layer wins", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(
          Effect.gen(function* () {
            const dryRun = yield* Config.String("dry-run").pipe(Config.withDefault("defaulted"));
            yield* Effect.logWarning(`dry-run=${dryRun}`);
          }),
          // Normal layer precedence: the extra layer's context merges LAST in
          // `Action.run`'s composition, so this replaces the installed provider
          // wholesale. INPUT_DRY-RUN is set in the environment — seeing
          // "from-caller" rather than "from-input" is what proves the override.
          { layer: ConfigProvider.layer(ConfigProvider.fromUnknown({ "dry-run": "from-caller" })) }
        );
        assert.include(lines, "::warning::dry-run=from-caller");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("wires an extra layer against the runtime's own services", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const extra = Layer.effect(
          Extra,
          Effect.map(ActionEnvironment, (env) => ({ describe: env.get("GITHUB_JOB") }))
        );
        const code = yield* verdict(
          Effect.gen(function* () {
            const service = yield* Extra;
            yield* Effect.log(`job=${yield* service.describe}`);
          }),
          { layer: extra }
        );
        assert.isTrue(A.some(lines, (line) => Str.includes("job=test-job")(line)));
        assert.strictEqual(code, 0);
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("takes a layer requiring the PLATFORM and ActionOutputs, with no sub-provide", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const publishLike = Layer.effect(
          Extra,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const outputs = yield* ActionOutputs;
            return {
              describe: Effect.as(outputs.setSecret("s3cret"), typeof fs.readFile === "function" ? "masked" : "no fs"),
            };
          })
        );
        const code = yield* verdict(
          Effect.gen(function* () {
            const service = yield* Extra;
            yield* Effect.logWarning(`publish=${yield* service.describe}`);
          }),
          { layer: publishLike }
        );
        assert.include(lines, "::add-mask::s3cret", "the mask reached the runner with no sub-provide");
        assert.include(lines, "::warning::publish=masked", "and the platform reached the layer");
        assert.strictEqual(code, 0);
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("does not swallow the transcript of a run that then fails", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const code = yield* verdict(
          Effect.flatMap(Effect.log("halfway through"), () => Effect.fail(Boom.make({ detail: "later" })))
        );
        assert.isTrue(A.some(lines, (line) => Str.includes("halfway through")(line)));
        assert.isTrue(A.some(lines, (line) => Str.startsWith("::error::")(line)));
        assert.strictEqual(code, 1);
      })
    );
  });

  it.layer(
    ActionRuntime.layer.pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "INPUT_DRY-RUN": "x", PLAIN_VAR: "y" } })))
    ),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("programs composed over ActionRuntime.layer see the identical resolution", () =>
      Effect.gen(function* () {
        // The same provider `Action.run` installs, reached through the layer a
        // test composes directly — with the ambient environment injected as a
        // provider BENEATH the runtime, so nothing touches the process.
        assert.strictEqual(yield* Config.String("dry-run").pipe(Config.withDefault("defaulted")), "x");
        assert.strictEqual(yield* Config.String("PLAIN_VAR"), "y");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("an interruption from inside the program still fails the step", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        assert.strictEqual(yield* verdict(Effect.interrupt), 1);
        assert.isTrue(A.some(lines, (line) => Str.startsWith("::error::Action failed:")(line)));
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("takes its options data-last too", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        const exit = yield* Effect.logWarning("piped").pipe(
          Action.main({ stepDebugLogLevel: false }),
          Effect.provideService(Console.Console, console),
          Effect.exit
        );
        assert.strictEqual(exitCodeOf(exit), 0);
        assert.include(lines, "::warning::piped");
      })
    );
  });

  it("exposes the runtime as a bound layer, not a factory", () => {
    // A layer-returning function mints a fresh layer per call and layers
    // memoize by reference, so a factory would re-read `process.env` at every
    // composition site.
    assert.strictEqual(ActionRuntime.layer, ActionRuntime.layer);
  });
});

describe("Action.run", () => {
  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("hands a successful program to runMain, whose teardown reads 0", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        assert.strictEqual(
          yield* runVerdict((teardown) => Action.run(Effect.logWarning("ran under runMain"), { teardown })),
          0
        );
        assert.include(lines, "::warning::ran under runMain");
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("leaves a failed program's exit code to runMain's teardown, with one ::error:: line", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        assert.strictEqual(
          yield* runVerdict((teardown) =>
            Action.run(Boom.make({ detail: "no token" }).pipe(Effect.fail), { teardown })
          ),
          1
        );
        // disableErrorReporting: runMain adds no second rendering of the cause.
        assert.lengthOf(
          A.filter(lines, (line) => Str.startsWith("::error::")(line)),
          1
        );
      })
    );
  });

  it.layer(captureLayer(), { timeout: "30 seconds" })((it) => {
    it.effect("takes its options data-last too", () =>
      Effect.gen(function* () {
        yield* Captured;
        const code = yield* runVerdict((teardown) =>
          Boom.make({ detail: "piped" }).pipe(Effect.fail, Action.run({ teardown }))
        );
        assert.strictEqual(code, 1);
      })
    );
  });
});

describe("Action.main step debugging", () => {
  // Info goes out in both cases, so an absent debug line is a filtered entry
  // and not a program that never ran — the positive control every "absent"
  // assertion below leans on.
  const probe = Effect.gen(function* () {
    yield* Effect.logInfo("probe-info");
    yield* Effect.logDebug("probe-debug");
  });

  it.layer(captureLayer({ RUNNER_DEBUG: "1" }), { timeout: "30 seconds" })((it) => {
    it.effect("lowers the minimum log level to Debug when RUNNER_DEBUG=1, so Effect.logDebug reaches the runner", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(probe);
        assert.include(lines, "probe-info");
        assert.include(lines, "::debug::probe-debug");
      })
    );
  });

  it.layer(captureLayer({ RUNNER_DEBUG: undefined }), { timeout: "30 seconds" })((it) => {
    it.effect("leaves the Info default alone when step debugging is off", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(probe);
        assert.include(lines, "probe-info");
        assert.isFalse(A.some(lines, (line) => Str.includes("probe-debug")(line)));
      })
    );
  });

  it.layer(captureLayer({ RUNNER_DEBUG: "1" }), { timeout: "30 seconds" })((it) => {
    it.effect("honours an explicit opt-out even with step debugging on", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(probe, { stepDebugLogLevel: false });
        assert.include(lines, "probe-info");
        assert.isFalse(A.some(lines, (line) => Str.includes("probe-debug")(line)));
      })
    );
  });

  it.layer(captureLayer({ RUNNER_DEBUG: "1" }), { timeout: "30 seconds" })((it) => {
    it.effect("only ever lowers the level: a caller that already asked for Trace keeps it", () =>
      Effect.gen(function* () {
        const { lines } = yield* Captured;
        yield* verdict(Effect.logTrace("probe-trace"), {
          layer: Layer.succeed(References.MinimumLogLevel, "Trace"),
        });
        assert.include(lines, "::debug::probe-trace");
      })
    );
  });
});
