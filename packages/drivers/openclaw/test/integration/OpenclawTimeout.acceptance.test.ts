import { OpenclawCommandTimeoutError } from "@beep/openclaw/Openclaw.errors";
import { OpenclawInvocationContext } from "@beep/openclaw/Openclaw.models";
import { OpenclawCli } from "@beep/openclaw/OpenclawCli.service";
import { it } from "@beep/test-runner";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";

const isOpenclawCommandTimeoutError = S.is(OpenclawCommandTimeoutError);

class TrackedProcess extends Context.Service<
  TrackedProcess,
  {
    readonly children: Array<ChildProcessSpawner.ChildProcessHandle>;
    readonly spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  }
>()("@beep/openclaw/test/integration/OpenclawTimeout.acceptance.test/TrackedProcess") {}

const trackedProcessLayer = Layer.effect(
  TrackedProcess,
  Effect.gen(function* () {
    const underlying = yield* ChildProcessSpawner.ChildProcessSpawner;
    const children: Array<ChildProcessSpawner.ChildProcessHandle> = [];
    return {
      children,
      spawner: ChildProcessSpawner.make((command) =>
        underlying.spawn(command).pipe(
          Effect.tap((child) =>
            Effect.sync(() => {
              children.push(child);
            })
          )
        )
      ),
    };
  })
).pipe(Layer.provide(NodeServices.layer));

const timeoutProbeLayer = OpenclawCli.makeLayer().pipe(
  Layer.provide(
    Layer.effect(
      ChildProcessSpawner.ChildProcessSpawner,
      Effect.map(TrackedProcess, (tracked) => tracked.spawner)
    )
  ),
  Layer.provideMerge(trackedProcessLayer),
  Layer.provideMerge(NodeServices.layer)
);

it.layer(timeoutProbeLayer, { excludeTestServices: true })("native CLI timeout ownership", (it) => {
  it.effect(
    "times out, escalates past handled SIGTERM, and removes the native workbench",
    Effect.fnUntraced(function* () {
      const cli = yield* OpenclawCli;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tracked = yield* TrackedProcess;
      expect(tracked.children).toEqual([]);
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-openclaw-timeout-" });
          const binaryPath = path.join(directory, "openclaw");
          const marker = path.join(directory, "term-handled");
          yield* fs.writeFileString(
            binaryPath,
            `#!/bin/sh\ntrap 'printf TERM > "${marker}"' TERM\nwhile :; do sleep 1; done\n`
          );
          yield* fs.chmod(binaryPath, 0o755);
          const error = yield* cli.version(OpenclawInvocationContext.make({ binaryPath })).pipe(Effect.flip);
          expect(error).toBeInstanceOf(OpenclawCommandTimeoutError);
          if (isOpenclawCommandTimeoutError(error)) {
            expect(error.timeoutMs).toBe(10_000);
            expect(error.subcommand).toBe("--version");
            expect(error.executable).toBe(binaryPath);
          }
          expect(tracked.children).toHaveLength(1);
          const child = O.getOrThrow(A.head(tracked.children));
          expect(yield* child.isRunning).toBe(false);
          expect(yield* fs.readFileString(marker)).toBe("TERM");
          return { directory, child };
        })
      );
      expect(yield* fs.exists(result.directory)).toBe(false);
      expect(yield* result.child.isRunning).toBe(false);
    }),
    20_000
  );
});
