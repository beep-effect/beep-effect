import { CliLogger } from "@beep/cli-kit/CliLogger";
import { CliRuntime } from "@beep/cli-kit/CliRuntime";
import { ExitRequested } from "@beep/cli-kit/internal/ExitRequested";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import { assert, describe, expectTypeOf, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as F from "effect/Function";
import { pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

class TestError extends S.TaggedError<TestError, { readonly brand: unique symbol }>()("TestError", {
  message: S.String,
}) {
  override readonly name = "Error";
}

const capturing = (): { readonly console: Console.Console; readonly out: string[]; readonly err: string[] } => {
  const out: string[] = [];
  const err: string[] = [];
  const console_: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
    error: (...args: ReadonlyArray<unknown>) => err.push(pipe(args, A.map(String), A.join(" "))),
  });
  return { console: console_, out, err };
};

const run = <A, E>(
  program: Effect.Effect<A, E>,
  options: Parameters<typeof CliRuntime.reportFailures>[0] = {}
): Effect.Effect<{ out: string[]; err: string[]; exit: Exit.Exit<A, Error> }> =>
  Effect.gen(function* () {
    const { console: double, out, err } = capturing();
    const exit = yield* program.pipe(
      CliRuntime.reportFailures(options),
      Effect.exit,
      provideBuilt(CliLogger.layer()),
      Effect.provideService(Console.Console, double)
    );
    return { out, err, exit };
  });

const failureOf = <A>(exit: Exit.Exit<A, Error>): unknown =>
  Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;

describe("CliRuntime.reportFailures", () => {
  it.effect("reports through the program's own logger, on stderr", () =>
    Effect.gen(function* () {
      const { out, err, exit } = yield* F.pipe(TestError.make({ message: "boom" }), Effect.fail, run);

      assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
      assert.deepStrictEqual(out, [], "the report must never land on stdout");
      assert.strictEqual(Exit.isFailure(exit), true);
    })
  );

  it.effect("re-fails rather than swallowing, so a broken run cannot exit zero", () =>
    Effect.gen(function* () {
      const { exit } = yield* F.pipe(TestError.make({ message: "boom" }), Effect.fail, run);
      assert.strictEqual(Exit.isSuccess(exit), false);
    })
  );

  it.effect("marks the error so the runtime does NOT report it a second time", () =>
    Effect.gen(function* () {
      const { exit } = yield* F.pipe(TestError.make({ message: "boom" }), Effect.fail, run);
      const error = failureOf(exit);

      assert.strictEqual(
        Runtime.getErrorReported(CliRuntime.reported(new Error("x"))),
        false,
        "read through core's getter: false is what suppresses, so a marker 'corrected' to true fails here"
      );
      assert.strictEqual(error === undefined ? true : Runtime.getErrorReported(error), false);
    })
  );

  it.effect("keeps an exit code the error chose for itself", () =>
    Effect.gen(function* () {
      const picky = Object.assign(new Error("needs 3"), { [Runtime.errorExitCode]: 3 });
      const { exit } = yield* run(Effect.fail(picky), { exitCode: 9 });
      const error = failureOf(exit);

      assert.strictEqual(
        Runtime.getErrorExitCode(error),
        3,
        "the option is a fallback, never an override of the error's own code"
      );
    })
  );

  it.effect("distinguishes an explicit exit code of 1 from no marker at all", () =>
    Effect.gen(function* () {
      const explicitlyOne = Object.assign(new Error("one"), { [Runtime.errorExitCode]: 1 });
      const unmarked = new Error("unmarked");

      const kept = yield* run(Effect.fail(explicitlyOne), { exitCode: 7 });
      const defaulted = yield* run(Effect.fail(unmarked), { exitCode: 7 });

      const codeOf = <A>(exit: Exit.Exit<A, Error>): number => exit.pipe(failureOf, Runtime.getErrorExitCode);

      assert.strictEqual(
        codeOf(kept.exit),
        1,
        "getErrorExitCode answers 1 for marked-1 and unmarked alike, so the option must not override a deliberate 1"
      );
      assert.strictEqual(codeOf(defaulted.exit), 7);
    })
  );

  it.effect("renders several lines when the renderer returns several", () =>
    Effect.gen(function* () {
      const { err } = yield* run(Effect.fail(TestError.make({ message: "bad config" })), {
        render: (error) => [String(error), "  unknown key at groups.g.rulesetz"],
      });

      assert.deepStrictEqual(err, ["Error: bad config", "  unknown key at groups.g.rulesetz"]);
    })
  );

  it.effect("tells render a typed failure is not a defect, and hands it the whole cause", () =>
    Effect.gen(function* () {
      const seen: Array<{ error: unknown; isDefect: boolean; cause: Cause.Cause<unknown> }> = [];
      const typed = new Error("typed");
      yield* run(Effect.fail(typed), {
        render: (error, { cause, isDefect }) => {
          seen.push({ error, isDefect, cause });
          return String(error);
        },
      });
      assert.strictEqual(seen.length, 1);
      assert.strictEqual(seen[0]?.error, typed);
      assert.isFalse(seen[0]?.isDefect);
      assert.isTrue(Cause.hasFails(seen[0]?.cause ?? Cause.empty));
    })
  );

  it.effect("tells render a die is a defect, even when the defect is an Error carrying a _tag", () =>
    Effect.gen(function* () {
      const flags: Array<boolean> = [];
      const lookalike = Object.assign(new Error("bug"), { _tag: "LooksTyped" });
      const { err } = yield* run(Effect.die(lookalike), {
        render: (error, { isDefect }) => {
          flags.push(isDefect);
          return isDefect ? `defect: ${String(error)}` : String(error);
        },
      });
      assert.deepStrictEqual(flags, [true]);
      assert.deepStrictEqual(err, ["defect: Error: bug"]);
    })
  );

  it.effect("a cause with both a failure and a defect renders the typed failure as not a defect", () =>
    Effect.gen(function* () {
      const flags: Array<[unknown, boolean]> = [];
      const typed = new Error("typed");
      yield* run(
        F.pipe(TestError.make({ message: "bug" }), Cause.die, Cause.combine(Cause.fail(typed)), Effect.failCause),
        {
          render: (error, { isDefect }) => {
            flags.push([error, isDefect]);
            return String(error);
          },
        }
      );
      assert.deepStrictEqual(flags, [[typed, false]]);
    })
  );

  it.effect("leaves an interrupt alone", () =>
    Effect.gen(function* () {
      const { out, err, exit } = yield* run(Effect.interrupt);

      assert.deepStrictEqual(err, [], "an interrupt is not a failure to report: the default teardown maps it to 130");
      assert.deepStrictEqual(out, []);
      assert.strictEqual(Exit.isFailure(exit), true);
    })
  );

  it.effect("leaves a success untouched", () =>
    Effect.gen(function* () {
      const { out, err, exit } = yield* run(Effect.succeed(42));

      assert.strictEqual(Exit.isSuccess(exit), true);
      assert.deepStrictEqual([...out, ...err], []);
    })
  );
});

describe("CliRuntime.reportFailures and ShowHelp", () => {
  it.effect("never renders a ShowHelp: runWith already printed help", () =>
    Effect.gen(function* () {
      const help = CliError.ShowHelp.make({ commandPath: ["tool"], errors: [] });
      const { out, err } = yield* F.pipe(help, Effect.fail, run);
      assert.deepStrictEqual(err, []);
      assert.deepStrictEqual(out, []);
    })
  );

  it.effect("a bare-root ShowHelp (no errors) exits 0", () =>
    Effect.gen(function* () {
      const help = CliError.ShowHelp.make({ commandPath: ["tool"], errors: [] });
      const { exit } = yield* F.pipe(help, Effect.fail, run);
      assert.strictEqual(exit.pipe(failureOf, Runtime.getErrorExitCode), 0);
    })
  );

  it.effect("a ShowHelp carrying parse errors exits with usageExitCode, default 64", () =>
    Effect.gen(function* () {
      const help = CliError.ShowHelp.make({
        commandPath: ["tool"],
        errors: [CliError.UnrecognizedOption.make({ option: "--nope", suggestions: [] })],
      });
      const { exit } = yield* F.pipe(help, Effect.fail, run);
      assert.strictEqual(exit.pipe(failureOf, Runtime.getErrorExitCode), 64);
      const custom = yield* run(Effect.fail(help), { usageExitCode: 2 });
      assert.strictEqual(custom.exit.pipe(failureOf, Runtime.getErrorExitCode), 2);
    })
  );

  it.effect("never renders the CliExit sentinel, and keeps its code", () =>
    Effect.gen(function* () {
      const { err, exit } = yield* F.pipe(ExitRequested.make({ code: 2 }), Effect.fail, run);
      assert.deepStrictEqual(err, []);
      assert.strictEqual(exit.pipe(failureOf, Runtime.getErrorExitCode), 2);
    })
  );

  it.effect("still renders an already-reported error that is not ShowHelp", () =>
    Effect.gen(function* () {
      const gate = CliRuntime.reported(new Error("3 schemas drifted"), 1);
      const { err } = yield* run(Effect.fail(gate));
      assert.deepStrictEqual(err, ["[FAIL] Error: 3 schemas drifted"]);
    })
  );
});

describe("CliRuntime.reported", () => {
  class GateError extends S.TaggedError<GateError, { readonly brand: unique symbol }>()("GateError", {
    message: S.String,
    count: S.Finite,
  }) {
    override readonly name = "Error";
  }
  const gateError = (count: number): GateError => GateError.make({ message: `gate: ${count} over budget`, count });
  const isGateError = S.is(GateError);

  it.effect("returns the same typed instance, with explicit narrowing for wrapper recovery", () =>
    Effect.gen(function* () {
      const error = gateError(2);
      const marked = CliRuntime.reported(error, 1);

      if (!isGateError(marked)) return yield* Effect.fail(marked);
      const typed: GateError = marked;
      assert.strictEqual(typed, error);
      assert.strictEqual(typed.count, 2);
      assert.strictEqual(Runtime.getErrorExitCode(typed), 1);
      assert.strictEqual(Runtime.getErrorReported(typed), false);

      const recovered = yield* Effect.fail(CliRuntime.reported(gateError(3), 1)).pipe(
        Effect.catchIf(
          (caught): caught is GateError => isGateError(caught),
          (caught) => Effect.succeed(caught.count)
        )
      );
      assert.strictEqual(recovered, 3, "only the preserved typed instance is recovered; a wrapper stays a failure");
    })
  );

  it("wraps a non-Error value in a plain marked Error", () => {
    const marked = CliRuntime.reported("boom", 3);
    const asError: Error = marked;
    assert.strictEqual(asError instanceof Error, true);
    assert.strictEqual(asError.message, "boom");
    assert.strictEqual(Runtime.getErrorExitCode(asError), 3);
    assert.strictEqual(Runtime.getErrorReported(asError), false);
  });

  it("wraps a structural Error without advertising its stripped subtype fields", () => {
    const lookalike = { name: "Error", message: "boom", _tag: "RemoteError", code: 42 };
    const marked = CliRuntime.reported(lookalike, 7);
    expectTypeOf(marked).toEqualTypeOf<Error | typeof lookalike>();
    expectTypeOf(marked).not.toExtend<{ readonly code: number }>();
    expectTypeOf(marked).not.toExtend<{ readonly _tag: string }>();
    assert.notStrictEqual(marked, lookalike);
    assert.isTrue(marked instanceof Error);
    assert.isFalse(P.hasProperty(marked, "code"));
    assert.isTrue(P.isTagged("CliRuntimeError")(marked));
    assert.strictEqual(Runtime.getErrorExitCode(marked), 7);
    assert.strictEqual(Runtime.getErrorReported(marked), false);
  });

  it("defaults the exit code to 1", () => {
    assert.strictEqual(Runtime.getErrorExitCode(CliRuntime.reported(new Error("x"))), 1);
  });
});
