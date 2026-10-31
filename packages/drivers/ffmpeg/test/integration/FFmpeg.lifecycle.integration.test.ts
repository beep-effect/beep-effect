import { execPath } from "node:process";
import { FFmpeg, ProbeVideoRequest } from "@beep/ffmpeg";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

class StartedProcess extends Context.Service<
  StartedProcess,
  Deferred.Deferred<ChildProcessSpawner.ChildProcessHandle>
>()("@beep/ffmpeg/test/integration/FFmpeg.lifecycle.integration.test/StartedProcess") {}

const observedSpawnerLayer = Layer.effectContext(
  Effect.gen(function* () {
    const nativeSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const started = yield* Deferred.make<ChildProcessSpawner.ChildProcessHandle>();
    // Substitute only the executable payload. Command options, native process
    // ownership and streams stay real; no FFmpeg binary is needed for this test.
    const observedSpawner = ChildProcessSpawner.make((command) =>
      nativeSpawner
        .spawn(
          ChildProcess.isStandardCommand(command)
            ? ChildProcess.make(execPath, ["-e", "setInterval(() => {}, 1000)"], command.options)
            : command
        )
        .pipe(Effect.tap((handle) => Deferred.succeed(started, handle)))
    );
    return Context.make(StartedProcess, started).pipe(
      Context.add(ChildProcessSpawner.ChildProcessSpawner, observedSpawner)
    );
  })
);

const nativeLifecycleLayer = FFmpeg.makeLayer({ forceKillAfterMillis: 100 }).pipe(
  Layer.provideMerge(observedSpawnerLayer),
  Layer.provideMerge(NodeServices.layer)
);

it.layer(nativeLifecycleLayer, { excludeTestServices: true })("@beep/ffmpeg native process lifetime", (it) => {
  it.effect(
    "interrupting a probe waits for its native child to stop",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const started = yield* StartedProcess;
          const driver = yield* FFmpeg;
          const directory = yield* Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
            fs.remove(directory, { recursive: true, force: true }).pipe(Effect.orDie)
          );
          const videoPath = path.join(directory, "input.mp4");
          yield* fs.writeFileString(videoPath, "lifecycle fixture");

          const probe = yield* driver.probeVideo(ProbeVideoRequest.make({ videoPath })).pipe(Effect.forkChild);
          const handle = yield* Deferred.await(started).pipe(Effect.timeout("5 seconds"));
          // A failing assertion must not leave this deliberately long-lived child.
          yield* Effect.addFinalizer(() => handle.kill({ killSignal: "SIGKILL" }).pipe(Effect.ignore));
          expect(yield* handle.isRunning).toBe(true);

          yield* Fiber.interrupt(probe).pipe(Effect.timeout("5 seconds"));

          expect(Exit.hasInterrupts(yield* Fiber.await(probe))).toBe(true);
          expect(yield* handle.isRunning).toBe(false);
        })
      ),
    20_000
  );
});
