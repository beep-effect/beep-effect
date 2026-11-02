import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";

const withLayer =
  <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) =>
  <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context))
    );

it.effect("scripted handles accept kill, drain additional input fds and expose empty output fds", () => {
  const spawner = ScriptedSpawner.make(() => ({ stdout: "out", stderr: "err" }));
  return Effect.gen(function* () {
    const service = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* service.spawn(ChildProcess.make("tool"));
    yield* handle.kill();
    yield* Stream.run(Stream.make(new Uint8Array([1, 2])), handle.getInputFd(3));
    assert.deepStrictEqual(yield* Stream.runCollect(handle.getOutputFd(4)), []);
    assert.strictEqual(yield* Stream.run(Stream.make(new Uint8Array([3])), handle.stdin), undefined);
    assert.strictEqual(
      yield* Stream.runFold(
        Stream.decodeText(handle.all),
        () => "",
        (text, part) => text + part
      ),
      "outerr"
    );
  }).pipe(withLayer(spawner.layer));
});

it.effect("scripted spawns record and script redacted args and env values unwrapped", () => {
  const seen: Array<ReadonlyArray<string>> = [];
  const spawner = ScriptedSpawner.make((_command, args) => {
    seen.push(args);
    return { stdout: "" };
  });
  return Effect.gen(function* () {
    const service = yield* ChildProcessSpawner.ChildProcessSpawner;
    yield* service.spawn(
      ChildProcess.make("tool", ["--token", Redacted.make("secret")], {
        env: { TOKEN: Redacted.make("hidden"), PLAIN: "visible", UNSET: undefined },
      })
    );
    assert.deepStrictEqual(seen, [["--token", "secret"]]);
    assert.deepStrictEqual(spawner.spawns[0]?.args, ["--token", "secret"]);
    assert.deepStrictEqual(spawner.spawns[0]?.env, { TOKEN: "hidden", PLAIN: "visible", UNSET: undefined });
  }).pipe(withLayer(spawner.layer));
});
