import { CommandFailedError, Run } from "@beep/commands/Run";
import { NodeChildProcessSpawner, NodePath } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as TestClock from "effect/testing/TestClock";

const withLayer =
  <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) =>
  <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context))
    );

const noopFileSystemWithoutCwd = FileSystem.layerNoop({});
const Platform = NodeChildProcessSpawner.layer.pipe(
  Layer.provide(Layer.mergeAll(NodePath.layer, noopFileSystemWithoutCwd))
);

const live = <A, E>(program: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>): Effect.Effect<A, E> =>
  withLayer(Platform)(program);

const node = (script: string) => ChildProcess.make(process.execPath, ["-e", script]);

const realDelay = (millis: number) => TestClock.withLive(Effect.sleep(millis));

const existenceCheckSignal = 0;
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, existenceCheckSignal);
    return true;
  } catch {
    return false;
  }
};

describe("Run against real processes: pipe backpressure, ENOENT mapping and unref a scripted spawner cannot reproduce", () => {
  it.effect("text captures stdout", () =>
    Effect.gen(function* () {
      const output = yield* live(Run.text(node("process.stdout.write('hello')")));
      assert.strictEqual(output, "hello");
    })
  );

  it.effect("a real non-zero exit fails typed with the real code", () =>
    Effect.gen(function* () {
      const error = yield* Run.text(node("process.stderr.write('bad'); process.exit(3)")).pipe(live, Effect.flip);
      assert.instanceOf(error, CommandFailedError);
      if (S.is(CommandFailedError)(error)) {
        assert.strictEqual(error.kind, "nonZero");
        assert.strictEqual(error.exitCode, 3);
        assert.include(error.stderr ?? "", "bad");
      }
    })
  );

  it.effect("an absent executable maps to notFound", () =>
    Effect.gen(function* () {
      const error = yield* Run.text(ChildProcess.make("effected-no-such-binary-xyz", [])).pipe(live, Effect.flip);
      assert.instanceOf(error, CommandFailedError);
      if (S.is(CommandFailedError)(error)) {
        assert.strictEqual(error.kind, "spawn");
        assert.isTrue(
          error.notFound,
          "ENOENT from a real spawn must classify as notFound: every availability answer rests on the Node backend's mapping"
        );
      }
    })
  );

  it.effect("succeeds answers false for an absent executable and true for a real one", () =>
    Effect.gen(function* () {
      const live1 = yield* live(Run.succeeds(ChildProcess.make("effected-no-such-binary-xyz", [])));
      assert.isFalse(live1);
      const live2 = yield* live(Run.succeeds(node("process.exit(0)")));
      assert.isTrue(live2);
    })
  );

  it.effect(
    "collect drains stdout and stderr concurrently under simultaneous backpressure on BOTH pipes",
    () =>
      Effect.gen(function* () {
        const script = A.join(
          [
            "const big = 'x'.repeat(1024 * 1024);",
            "process.stdout.write(big);",
            "process.stderr.write(big);",
            "process.stdout.write(big);",
            "process.stderr.write(big);",
          ],
          ""
        );
        const output = yield* live(Run.collect(node(script)));
        assert.strictEqual(
          output.stdout.length,
          2 * 1024 * 1024,
          "both pipes full at once: collecting sequentially deadlocks here, which in-memory streams cannot reproduce"
        );
        assert.strictEqual(output.stderr.length, 2 * 1024 * 1024);
        assert.strictEqual(output.exitCode, 0);
      }),
    30_000
  );

  it.effect("json decodes real tool output through a schema", () =>
    Effect.gen(function* () {
      const parsed = yield* live(
        Run.json(node("process.stdout.write(JSON.stringify({ ok: true }))"), S.Struct({ ok: S.Boolean }))
      );
      assert.deepStrictEqual(parsed, { ok: true });
    })
  );
});

describe("environment extension against a real spawn", () => {
  const markerAndPathProbe =
    "process.stdout.write((process.env.EFFECTED_MARKER ?? 'no-marker') + ':' + (process.env.PATH ? 'has-path' : 'no-path'))";

  it.effect("Run.extendEnv gives the child the new variable WITHOUT losing the parent PATH", () =>
    Effect.gen(function* () {
      const output = yield* live(Run.text(node(markerAndPathProbe).pipe(Run.extendEnv({ EFFECTED_MARKER: "x" }))));
      assert.strictEqual(output, "x:has-path");
    })
  );

  it.effect("bare core setEnv strips the parent environment — the platform trap Run.extendEnv exists for", () =>
    Effect.gen(function* () {
      const output = yield* live(
        Run.text(node(markerAndPathProbe).pipe(ChildProcess.setEnv({ EFFECTED_MARKER: "x" })))
      );
      assert.strictEqual(
        output,
        "x:no-path",
        "setEnv never sets extendEnv, so the child's whole environment is the one variable; node spawns by absolute path"
      );
    })
  );
});

describe("Run.detach lifecycle", () => {
  it.effect(
    "an unref'd child SURVIVES its scope closing",
    () =>
      Effect.gen(function* () {
        const pid = yield* live(Run.detach(node("setTimeout(() => {}, 60_000)")));
        yield* realDelay(250).pipe(
          Effect.tap(() =>
            Effect.sync(() =>
              assert.isTrue(isAlive(Number(pid)), "detach must leave the child running after its scope closed")
            )
          ),
          Effect.ensuring(
            Effect.ignore(
              Effect.try({ try: () => process.kill(Number(pid), "SIGKILL"), catch: () => "already-exited" })
            )
          )
        );
      }),
    15_000
  );

  it.effect(
    "a child spawned WITHOUT unref is killed when its scope closes — the mirror case",
    () =>
      Effect.gen(function* () {
        const pid = yield* live(
          Effect.scopedWith((childScope) =>
            Effect.gen(function* () {
              const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
              const handle = yield* spawner.spawn(node("setTimeout(() => {}, 60_000)")).pipe(Scope.provide(childScope));
              return handle.pid;
            })
          )
        );
        yield* realDelay(250);
        assert.isFalse(
          isAlive(Number(pid)),
          "a referenced child must not survive its scope; without this mirror, the survival test proves nothing about unref"
        );
      }),
    15_000
  );
});
