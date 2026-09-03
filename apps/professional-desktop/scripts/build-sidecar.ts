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
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { Equivalence } from "effect/Equivalence";

// Effect calls the hook with the declared struct equivalence; narrowing it from `never` to `Self`
// is the contravariant direction (`Self` extends the struct type), so the assertion is sound.
const declaredFieldsEquivalence = <Self>(typeParameters: readonly [Equivalence<never>]): Equivalence<Self> =>
  typeParameters[0] as Equivalence<Self>;

class MissingTargetTripleError extends S.TaggedError<MissingTargetTripleError>()(
  "MissingTargetTripleError",
  {
    message: S.String,
  },
  { toEquivalence: (typeParameters) => declaredFieldsEquivalence<MissingTargetTripleError>(typeParameters) }
) {}

class SidecarBuildError extends S.TaggedError<SidecarBuildError>()(
  "SidecarBuildError",
  {
    exitCode: S.Int,
    message: S.String,
  },
  {
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<SidecarBuildError>(typeParameters),
  }
) {}

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

const main = program.pipe(Layer.effectDiscard, Layer.provide(BunServices.layer), Layer.build, Effect.scoped);

BunRuntime.runMain(main);
