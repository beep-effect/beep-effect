import { assert, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Data from "effect/Data";
import * as Cause from "effect/Cause";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as P from "effect/Predicate";
import * as Runtime from "effect/Runtime";
import { CliDoc } from "../../effected/cli/CliFailure.ts";
import { CliRuntime } from "../../effected/cli/CliRuntime.ts";

it.effect("an unprintable failure still produces a safe last-resort diagnostic", () => Effect.gen(function* () {
  const unprintable = new Error("unprintable");
  const error = {
    get [CliDoc](): () => never { throw new Error("document unavailable"); },
    toString(): string { throw unprintable; },
  };
  const lines: Array<unknown> = [];
  const logger = Logger.make(({ message }) => { lines.push(message); });
  const exit = yield* Effect.scopedWith((scope) => Effect.flatMap(
    Layer.buildWithScope(Logger.layer([logger]), scope),
    (context) => Effect.fail(error).pipe(
      CliRuntime.reportFailures({ exitCode: 23, render: (_error, details) => details.defaultLines }),
      Effect.exit,
      Effect.provideContext(context),
    ),
  ));
  assertExitFailure(exit, Cause.fail(CliRuntime.reported("[unprintable failure]", 23)));
  const failure = Cause.squash(exit.cause);
  assert.isTrue(P.isTagged("CliRuntimeError")(failure));
  assert.strictEqual(Runtime.getErrorReported(failure), false);
  assert.strictEqual(Runtime.getErrorExitCode(failure), 23);
  assert.deepStrictEqual(lines, [["[unprintable failure]"]]);
}));

for (const channel of ["failure", "defect"] as const) {
  for (const ownCode of [undefined, 3]) {
    it.effect(`an immutable ${channel} retains its original cause and ${ownCode === undefined ? "fallback" : "own"} exit code`, () => Effect.gen(function* () {
      const original = Object.freeze(Object.assign(new Error("original"), ownCode === undefined ? {} : {
        [Runtime.errorExitCode]: ownCode,
      }));
      const lines: Array<unknown> = [];
      const logger = Logger.make(({ message }) => { lines.push(message); });
      const program = channel === "failure" ? Effect.fail(original) : Effect.die(original);
      const exit = yield* Effect.scopedWith((scope) => Effect.flatMap(
        Layer.buildWithScope(Logger.layer([logger]), scope),
        (context) => program.pipe(
          CliRuntime.reportFailures({ exitCode: 23, render: (error, details) => {
            assert.strictEqual(error, original);
            assert.strictEqual(details.isDefect, channel === "defect");
            return original.message;
          } }),
          Effect.exit,
          Effect.provideContext(context),
        ),
      ));
      if (!Exit.isFailure(exit)) return yield* Effect.die("expected a failed exit");

      assertExitFailure(exit, exit.cause);
      assert.isTrue(Cause.hasFails(exit.cause));
      assert.isFalse(Cause.hasDies(exit.cause));
      const failure = Cause.squash(exit.cause);
      assert.isTrue(failure instanceof Error);
      if (!(failure instanceof Error)) return yield* Effect.die("expected an Error wrapper");
      assert.notStrictEqual(failure, original);
      assert.strictEqual(failure.cause, original);
      assert.strictEqual(failure.message, "original");
      assert.strictEqual(Runtime.getErrorExitCode(failure), ownCode ?? 23);
      assert.strictEqual(Runtime.getErrorReported(failure), false);
      const codes: Array<number> = [];
      Runtime.defaultTeardown(exit, (code) => { codes.push(code); });
      assert.deepStrictEqual(codes, [ownCode ?? 23]);
      assert.deepStrictEqual(lines, [["original"]]);
    }));
  }
}

it("a nonconfigurable marker falls back after partial installation", () => {
  const original = new Error("locked code");
  Object.defineProperty(original, Runtime.errorExitCode, { value: 9, configurable: false });
  const marked = CliRuntime.reported(original, 23);
  assert.notStrictEqual(marked, original);
  assert.strictEqual(marked.cause, original);
  assert.strictEqual(marked.message, "locked code");
  assert.strictEqual(Runtime.getErrorExitCode(marked), 23);
  assert.strictEqual(Runtime.getErrorReported(marked), false);
});

it("a prototype exit-code getter is still marked in place", () => {
  class GetterError extends Data.TaggedError("GetterError")<{ readonly message: string }> {
    override get [Runtime.errorExitCode](): number { return 3; }
  }
  const original = new GetterError({ message: "getter" });
  const marked = CliRuntime.reported(original, 23);
  assert.strictEqual(marked, original);
  assert.strictEqual(Runtime.getErrorExitCode(marked), 23);
  assert.strictEqual(Runtime.getErrorReported(marked), false);
});
