/**
 * Compiles the bun sidecar into a standalone binary named with the rust
 * target triple, which is where tauri's `externalBin` expects to find it
 * (`binaries/sidecar` → `binaries/sidecar-x86_64-unknown-linux-gnu`, …).
 *
 * Ported from the effect-lexical-chat POC (`scripts/build-sidecar.ts`), adapted
 * to this app's sidecar entry (`server/main.ts`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Console, Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

class MissingTargetTripleError extends S.TaggedError<MissingTargetTripleError>()("MissingTargetTripleError", {
  message: S.String,
}) {}

class SidecarBuildError extends S.TaggedError<SidecarBuildError>()("SidecarBuildError", {
  exitCode: S.Int,
  message: S.String,
}) {}

const program = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const rustcOutput = yield* spawner.string(ChildProcess.make("rustc", ["-vV"]));
  const triple = pipe(Str.match(/host: (\S+)/u)(rustcOutput), O.flatMap(A.get(1)), O.filter(Str.isNonEmpty));
  if (O.isNone(triple)) {
    return yield* MissingTargetTripleError.make({
      message: "could not determine the target triple from `rustc -vV`",
    });
  }

  const outfile = `src-tauri/binaries/sidecar-${triple.value}`;
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make("bun", ["build", "--compile", "server/main.ts", "--outfile", outfile], {
      stderr: "inherit",
      stdout: "inherit",
    })
  );
  if (exitCode !== 0) {
    return yield* SidecarBuildError.make({ exitCode, message: `sidecar build failed with exit code ${exitCode}` });
  }
  yield* Console.log(`sidecar compiled → ${outfile}`);
});

const main = Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer))));

BunRuntime.runMain(main);
