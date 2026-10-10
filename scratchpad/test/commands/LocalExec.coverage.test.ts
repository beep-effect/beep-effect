import * as Layer from "effect/Layer";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import { ExecContext, LocalExec, LocalExecError } from "../../effected/commands/LocalExec.ts";

const withLayer = <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) => <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
  Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context)));

it.effect("empty launcher prefixes preserve argv and optionally set cwd", () => Effect.gen(function* () {
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
  assert.strictEqual(LocalExecError.make({ directory: "/project" }).message, "Could not determine the project-local execution context for /project");
  assertNone(yield* LocalExec.makeTest().context);
  assertNone(yield* Effect.flatMap(LocalExec, (service) => service.context).pipe(withLayer(LocalExec.layerTest())));
  const expected = ExecContext.make({ label: "bun", ...LocalExec.prefixes("bun") });
  assertSome(yield* Effect.flatMap(LocalExec, (service) => service.context).pipe(withLayer(LocalExec.layerFor("bun"))), expected);
  assertSome(yield* Effect.flatMap(LocalExec, (service) => service.context).pipe(withLayer(LocalExec.layerFor("bun", {}))), expected);
}));
