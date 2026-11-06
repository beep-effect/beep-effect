import { ExecContext, LocalExec, LocalExecError } from "@beep/commands/LocalExec";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";

const withLayer =
  <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) =>
  <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context))
    );

it.effect("empty launcher prefixes preserve argv and optionally set cwd", () =>
  Effect.gen(function* () {
    const command = ChildProcess.make("tool", ["--flag"]);
    const context = ExecContext.make({ label: "direct", prefix: [], dlxPrefix: [], scriptPrefix: [] });
    assert.strictEqual(context.apply(command), command);
    assert.strictEqual(context.applyDlx(command), command);
    assert.strictEqual(context.applyScript(command), command);
    const applied = ExecContext.make({ ...context, directory: "/project" }).apply(command);
    if (ChildProcess.isStandardCommand(applied)) {
      assert.strictEqual(applied.command, "tool");
      assert.deepStrictEqual(applied.args, ["--flag"]);
      assert.strictEqual(applied.options.cwd, "/project");
    } else assert.fail("expected a standard command");
    assert.strictEqual(command.options.cwd, undefined);
    assert.strictEqual(LocalExecError.make({}).message, "Could not determine the project-local execution context");
    assert.strictEqual(
      LocalExecError.make({ directory: "/project" }).message,
      "Could not determine the project-local execution context for /project"
    );
    const context1 = yield* LocalExec.makeTest().context;
    assertNone(context1);
    const pipe2 = yield* Effect.flatMap(LocalExec, (service) => service.context).pipe(withLayer(LocalExec.layerTest()));
    assertNone(pipe2);
    const expected = ExecContext.make({ label: "bun", ...LocalExec.prefixes("bun") });
    const pipe3 = yield* Effect.flatMap(LocalExec, (service) => service.context).pipe(
      withLayer(LocalExec.layerFor("bun"))
    );
    assertSome(pipe3, expected);
    const pipe4 = yield* Effect.flatMap(LocalExec, (service) => service.context).pipe(
      withLayer(LocalExec.layerFor("bun", {}))
    );
    assertSome(pipe4, expected);
  })
);
