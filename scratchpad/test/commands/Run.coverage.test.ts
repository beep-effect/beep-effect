import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/process/ChildProcess";
import { CommandFailedError, CommandOutputError, Run } from "../../effected/commands/Run.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";

const withLayer = <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) => <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
  Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context)));

it.effect("failure rendering handles missing causes, empty streams, stdout fallback and truncation", () => Effect.sync(() => {
  const error = CommandFailedError.make({ kind: "spawn", command: "tool", args: [] });
  assert.isFalse(error.notFound);
  assert.strictEqual(error.message, 'Command "tool" failed');
  assert.strictEqual(CommandFailedError.timedOut(ChildProcess.make("tool")).message, 'Command "tool" failed (timed out)');
  const nonZero = CommandFailedError.make({ kind: "nonZero", command: "tool", args: ["arg"], exitCode: 2, stderr: "  ", stdout: " detail " });
  assert.strictEqual(nonZero.message, 'Command "tool arg" failed (exit 2) :\ndetail');
  assert.strictEqual(CommandFailedError.make({ ...nonZero, stdout: "  " }).message, 'Command "tool arg" failed (exit 2)');
  const long = CommandFailedError.make({ ...nonZero, stderr: "x".repeat(2001) });
  assert.strictEqual(long.message, `Command "tool arg" failed (exit 2) :\n...[1 chars truncated from head]...\n${"x".repeat(2000)}`);
  assert.strictEqual(CommandOutputError.make({ kind: "schema", command: "tool", exitCode: 3, stderr: " " }).message, 'Command "tool" produced JSON that did not match the expected schema (exit 3)');
  assert.strictEqual(CommandOutputError.make({ kind: "notJson", command: "tool", stderr: " detail " }).message, 'Command "tool" did not produce JSON :\ndetail');
  assert.strictEqual(CommandOutputError.make({ kind: "tooLarge", command: "tool" }).message, 'Command "tool" produced more output than the configured limit');
}));
it.effect("jsonLine reports repeated JSON and schema failures with exit and stream context", () => Effect.gen(function* () {
  const command = ChildProcess.make("protocol");
  for (const [stdout, kind] of [["bad\nother bad", "notJson"], ["1\n2", "schema"], ["1\nbad\n2\nother bad", "schema"]] as const) {
    const spawner = ScriptedSpawner.make(() => ({ stdout, stderr: "diagnostic", exit: 9 }));
    const error = yield* Effect.flip(Run.jsonLine(command, S.Boolean).pipe(withLayer(spawner.layer)));
    if (S.is(CommandOutputError)(error)) {
      assert.strictEqual(error.kind, kind);
      assert.strictEqual(error.exitCode, 9);
      assert.strictEqual(error.stderr, "diagnostic");
      assert.strictEqual(error.stdout, stdout);
    } else assert.fail("expected an output error");
  }
}));

it.effect("Run runtime namespace constructor creates an empty instance", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(Run, []);
  assert.strictEqual(Object.getPrototypeOf(instance), Run.prototype);
  if (P.isObject(instance)) assert.deepStrictEqual(Object.keys(instance), []);
  else assert.fail("expected an object instance");
}));

it.effect("stream maps platform spawn failures to the command failure contract", () => Effect.gen(function* () {
  const command = ChildProcess.make("missing");
  const cause = ScriptedSpawner.notFound("missing");
  const error = yield* Run.stream(command).pipe(Stream.runCollect, withLayer(ScriptedSpawner.make(() => cause).layer), Effect.flip);
  assert.strictEqual(error.kind, "spawn");
  assert.strictEqual(error.command, "missing");
  assert.strictEqual(error.cause, cause);
  assert.isTrue(error.notFound);
}));
