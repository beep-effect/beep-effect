import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import type { PlatformError } from "effect/PlatformError";
import * as S from "effect/Schema";

/**
 * A generated file on disk is not what its generator produces now; `message`
 * names the file and how to bring it back in line.
 *
 * @category errors
 * @since 0.0.0
 */
export class GeneratedDrift extends S.TaggedError<GeneratedDrift, { readonly brand: unique symbol }>()("GeneratedDrift", {
  file: S.String,
  message: S.String,
}) {}

/**
 * Write a generated file, or with `--check` fail with `GeneratedDrift` unless
 * the file on disk is exactly what `render` produces. Generated files are
 * never edited by hand.
 *
 * **Example** (A generator's entry point)
 * ```ts
 * import { generatedFile } from "@proto/tooling/GeneratedFile";
 * import * as Effect from "effect/Effect";
 * import { pipe } from "effect/Function";
 *
 * const run = generatedFile("/tmp/out.ts", Effect.succeed("export {};\n"), ["--check"]);
 * const same = pipe("/tmp/out.ts", generatedFile(Effect.succeed("export {};\n"), ["--check"]));
 * ```
 *
 * @category generators
 * @since 0.0.0
 */
export const generatedFile: {
  <E, R>(
    render: Effect.Effect<string, E, R>,
    argv: ReadonlyArray<string>,
  ): (file: string) => Effect.Effect<void, E | GeneratedDrift | PlatformError, R | FileSystem.FileSystem>;
  <E, R>(
    file: string,
    render: Effect.Effect<string, E, R>,
    argv: ReadonlyArray<string>,
  ): Effect.Effect<void, E | GeneratedDrift | PlatformError, R | FileSystem.FileSystem>;
} = dual(
  3,
  Effect.fnUntraced(function* <E, R>(file: string, render: Effect.Effect<string, E, R>, argv: ReadonlyArray<string>) {
    const fs = yield* FileSystem.FileSystem;
    const expected = yield* render;
    if (!A.contains(argv, "--check")) return yield* fs.writeFileString(file, expected);
    const actual = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => ""));
    return yield* actual === expected
      ? Effect.void
      : Effect.fail(GeneratedDrift.make({ file, message: `${file} is not what its generator produces; run it without --check` }));
  }),
);
