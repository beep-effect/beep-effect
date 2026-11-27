import { CliExit, CliRuntime } from "@beep/cli-kit";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as CliError from "effect/cli/CliError";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";

const platformServices = Layer.mergeAll(
  Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}),
  MemoryFileSystem.layer,
  Path.layer,
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("unused"),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  )
);

const Json = S.fromJsonString(S.Unknown);

class TestError extends S.TaggedError<TestError, { readonly brand: unique symbol }>()("TestError", {
  message: S.String,
}) {
  override readonly name = "Error";
}

class Platform extends Context.Service<Platform, { readonly name: string }>()(
  "@beep/cli-kit/test/CliMain.test/Platform"
) {}

const capturing = () => {
  const out: string[] = [];
  const err: string[] = [];
  const double: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
    error: (...args: ReadonlyArray<unknown>) => err.push(pipe(args, A.map(String), A.join(" "))),
  });
  return { double, out, err };
};

const codeOf = <A>(exit: Exit.Exit<A, unknown>): number | undefined =>
  Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : undefined;

it.layer(platformServices, { timeout: "30 seconds" })((it) => {
  describe("CliRuntime.main", () => {
    it.effect("a program that succeeds with no findings succeeds", () =>
      Effect.gen(function* () {
        const { double } = capturing();
        const exit = yield* CliRuntime.main(Effect.void, { platform: Layer.empty }).pipe(
          Effect.exit,
          Effect.provideService(Console.Console, double)
        );
        assertExitSuccess(exit, undefined);
      })
    );

    it.effect("findings exit non-zero and finalizers still run", () =>
      Effect.gen(function* () {
        const { double, err } = capturing();
        let finalized = false;
        const program = CliExit.set(1).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              finalized = true;
            })
          )
        );
        const exit = yield* CliRuntime.main(program, { platform: Layer.empty }).pipe(
          Effect.exit,
          Effect.provideService(Console.Console, double)
        );
        assert.strictEqual(codeOf(exit), 1);
        assert.isTrue(finalized);
        assert.deepStrictEqual(err, [], "the findings sentinel is never rendered");
        assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
        if (Exit.isFailure(exit)) {
          assert.strictEqual(
            exit.cause.pipe(Cause.squash, Runtime.getErrorReported),
            false,
            "the sentinel carries the no-double-report mark (false suppresses), so the runtime stays quiet"
          );
        }
        const codes: number[] = [];
        Runtime.defaultTeardown(exit, (code) => codes.push(code));
        assert.deepStrictEqual(codes, [1], "the teardown turns the quiet sentinel into exit 1");
      })
    );

    it.effect("a platform layer that fails to build renders one line on stderr with the fallback code", () =>
      Effect.gen(function* () {
        const { double, out, err } = capturing();
        const broken = Layer.effect(Platform, Effect.fail(TestError.make({ message: "HOME is not set" })));
        const program = Effect.asVoid(Platform);
        const exit = yield* CliRuntime.main(program, { platform: broken, exitCode: 3 }).pipe(
          Effect.exit,
          Effect.provideService(Console.Console, double)
        );
        assert.strictEqual(codeOf(exit), 3);
        assert.strictEqual(
          err[0],
          "[FAIL] Error: HOME is not set",
          "a defect prints its status line first, then its cleaned stack"
        );
        assert.deepStrictEqual(out, []);
      })
    );

    it.effect("the default logger is installed outermost: a failure lands on stderr", () =>
      Effect.gen(function* () {
        const { double, out, err } = capturing();
        yield* CliRuntime.main(Effect.fail(TestError.make({ message: "boom" })), { platform: Layer.empty }).pipe(
          Effect.exit,
          Effect.provideService(Console.Console, double)
        );
        assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
        assert.deepStrictEqual(out, []);
      })
    );

    for (const bad of [256, 1.5]) {
      it.effect(`validates a code written to the CliExit cell directly (${bad})`, () =>
        Effect.gen(function* () {
          const { double, out, err } = capturing();
          const program = Effect.gen(function* () {
            const cell = yield* CliExit;
            MutableRef.set(cell.code, bad);
          });
          const exit = yield* CliRuntime.main(program, { platform: Layer.empty }).pipe(
            Effect.exit,
            Effect.provideService(Console.Console, double)
          );
          assert.strictEqual(
            codeOf(exit),
            1,
            "a bad code is a wiring defect: exit 1, never a silent 0 (256 wraps under POSIX) or a process.exit throw (1.5)"
          );
          assert.strictEqual(
            err[0],
            `[FAIL] Error: CliRuntime.main: CliExit code must be an integer 0..255, received ${bad}`
          );
          assert.deepStrictEqual(out, []);
        })
      );
    }

    it.effect("a program failure beats findings: its own code wins", () =>
      Effect.gen(function* () {
        const { double } = capturing();
        const program = Effect.gen(function* () {
          yield* CliExit.set(2);
          return yield* TestError.make({ message: "boom" });
        });
        const exit = yield* CliRuntime.main(program, { platform: Layer.empty, exitCode: 5 }).pipe(
          Effect.exit,
          Effect.provideService(Console.Console, double)
        );
        assert.strictEqual(codeOf(exit), 5);
      })
    );
  });

  describe("CliRuntime.main and a UserError raised through Command.runWith", () => {
    const failsWithUserError = Command.make("deploy", {}, () =>
      Effect.fail(CliError.UserError.make({ cause: "unknown target: moon", userMessage: "unknown target: moon" }))
    );

    it.effect("reports it exactly once, and exits with the usage code 64", () =>
      Effect.gen(function* () {
        const { double, out, err } = capturing();
        const exit = yield* CliRuntime.main(Command.runWith(failsWithUserError, { version: "1.0.0" })([]), {
          platform: platformServices,
        }).pipe(Effect.exit, Effect.provideService(Console.Console, double));
        assert.strictEqual(
          err.length,
          1,
          `expected one stderr entry, got ${Result.getOrThrow(S.encodeUnknownResult(Json)(err))}`
        );
        assert.include(err[0], "unknown target: moon");
        assert.deepStrictEqual(out, []);
        assert.strictEqual(codeOf(exit), 64);
        const custom = yield* CliRuntime.main(Command.runWith(failsWithUserError, { version: "1.0.0" })([]), {
          platform: platformServices,
          usageExitCode: 2,
        }).pipe(Effect.exit, Effect.provideService(Console.Console, capturing().double));
        assert.strictEqual(codeOf(custom), 2);
      })
    );

    it.effect("with renderErrors: false runWith prints nothing, so reportFailures renders it once", () =>
      Effect.gen(function* () {
        const { double, err } = capturing();
        const exit = yield* CliRuntime.main(
          Command.runWith(failsWithUserError, { version: "1.0.0", renderErrors: false })([]),
          {
            platform: platformServices,
          }
        ).pipe(Effect.exit, Effect.provideService(Console.Console, double));
        assert.strictEqual(
          err.length,
          1,
          `expected one stderr entry, got ${Result.getOrThrow(S.encodeUnknownResult(Json)(err))}`
        );
        assert.strictEqual(codeOf(exit), 1, "rendered like any other failure: the fallback code, not the usage code");
      })
    );

    it.effect("a plain UserError carries no exit-code mark of its own", () =>
      Effect.sync(() => {
        assert.isFalse(
          Runtime.errorExitCode in CliError.UserError.make({ cause: "x" }),
          "the usage-code fallback relies on this: chooseExitCode would keep a code core put on a UserError"
        );
      })
    );

    it.effect("a UserError marked with an explicit exit code keeps it, and is printed once", () =>
      Effect.gen(function* () {
        const marked = Command.make("deploy", {}, () =>
          Effect.fail(CliRuntime.reported(CliError.UserError.make({ cause: "x" }), 3))
        );
        const { double, err } = capturing();
        const exit = yield* CliRuntime.main(Command.runWith(marked, { version: "1.0.0" })([]), {
          platform: platformServices,
        }).pipe(Effect.exit, Effect.provideService(Console.Console, double));
        assert.strictEqual(
          err.length,
          1,
          `expected one stderr entry, got ${Result.getOrThrow(S.encodeUnknownResult(Json)(err))}`
        );
        assert.strictEqual(codeOf(exit), 3);
      })
    );
  });

  describe("CliRuntime.main and --log-level: the failure report is written after the handler's scope closes", () => {
    const boom = Command.make("boom", {}, () => Effect.fail(TestError.make({ message: "boom" })));
    const app = Command.make("tool").pipe(Command.withSubcommands([boom]));

    for (const level of ["none", "all", "debug"]) {
      it.effect(
        `--log-level ${level}: a failing command still reports its failure on stderr with the right exit code`,
        () =>
          Effect.gen(function* () {
            const { double, out, err } = capturing();
            const exit = yield* CliRuntime.main(
              Command.runWith(app, { version: "1.0.0" })(["--log-level", level, "boom"]),
              {
                platform: platformServices,
              }
            ).pipe(Effect.exit, Effect.provideService(Console.Console, double));
            assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
            assert.deepStrictEqual(out, []);
            assert.strictEqual(codeOf(exit), 1);
          })
      );
    }

    it.effect("control: --log-level none silences Effect.logError inside the handler, --log-level error does not", () =>
      Effect.gen(function* () {
        const noisy = Command.make("noisy", {}, () => Effect.logError("inside"));
        const root = Command.make("tool").pipe(Command.withSubcommands([noisy]));
        const run = Effect.fn("run")(function* (level: string) {
          const { double, err } = capturing();
          yield* CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(["--log-level", level, "noisy"]), {
            platform: platformServices,
          }).pipe(Effect.exit, Effect.provideService(Console.Console, double));
          return err;
        });
        const result = yield* run("none");
        assert.deepStrictEqual(
          result,
          [],
          "the flag took effect, so the report surviving above is the runtime's doing"
        );
        const result1 = yield* run("error");
        assert.deepStrictEqual(result1, ["inside"]);
      })
    );
  });
});

for (const channel of ["interrupt", "mixed", "failure", "defect"] as const) {
  it.effect(`logger construction preserves ${channel} platform initialization semantics`, () =>
    Effect.gen(function* () {
      let builds = 0;
      let executed = 0;
      const original = TestError.make({ message: "first platform build failed" });
      const platform = Layer.effectContext(
        Effect.gen(function* () {
          builds += 1;
          if (builds === 1) {
            if (channel === "interrupt") return yield* Effect.interrupt;
            if (channel === "mixed")
              return yield* original.pipe(Cause.fail, Cause.combine(Cause.interrupt(123)), Effect.failCause);
            if (channel === "failure") return yield* original;
            return yield* Effect.die(original);
          }
          return yield* Layer.build(platformServices);
        })
      );
      const { double, out, err } = capturing();
      const program = Effect.sync(() => {
        executed += 1;
      });
      const exit = yield* CliRuntime.main(program, {
        platform,
        env: { log: { format: "json", level: "None" } },
      }).pipe(Effect.exit, Effect.provideService(Console.Console, double));
      if (channel === "interrupt" || channel === "mixed") {
        if (!Exit.isFailure(exit)) return yield* Effect.die("expected initialization interruption");
        assertExitFailure(exit, exit.cause);
        assert.isTrue(Cause.hasInterrupts(exit.cause));
        assert.strictEqual(Cause.hasFails(exit.cause), channel === "mixed");
        assert.strictEqual(builds, 1);
        assert.strictEqual(executed, 0);
      } else {
        assertExitSuccess(exit, undefined);
        assert.strictEqual(builds, 2);
        assert.strictEqual(executed, 1);
      }
      assert.deepStrictEqual(out, []);
      assert.deepStrictEqual(err, []);
    })
  );
}
