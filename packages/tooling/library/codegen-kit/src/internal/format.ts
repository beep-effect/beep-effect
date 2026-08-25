import { Effect } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { CodegenFormatError } from "../CodegenKit.errors.ts";

export interface Formatter {
  readonly content: (source: string, outputPath: string) => Effect.Effect<string, CodegenFormatError>;
  readonly file: (filePath: string) => Effect.Effect<void, CodegenFormatError>;
}

const formatFailure = (message: string, cause: unknown): CodegenFormatError =>
  CodegenFormatError.make({ message, cause });

export const makeFormatter = Effect.fn("CodegenKit.makeFormatter")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const biome = path.join(import.meta.dirname, "..", "..", "..", "..", "..", "..", "node_modules", ".bin", "biome");

  const file = Effect.fn("CodegenKit.formatFile")(function* (filePath: string) {
    const exitCode = yield* spawner
      .exitCode(
        ChildProcess.make(
          biome,
          [
            "check",
            "--write",
            "--unsafe",
            "--linter-enabled=false",
            "--assist-enabled=false",
            "--javascript-formatter-indent-style=space",
            "--javascript-formatter-indent-width=2",
            "--javascript-formatter-line-width=80",
            "--trailing-commas=all",
            filePath,
          ],
          {
            stdin: "ignore",
            stdout: "inherit",
            stderr: "inherit",
          }
        )
      )
      .pipe(Effect.mapError((cause) => formatFailure(`Biome could not format ${filePath}`, cause)));
    if (exitCode !== 0) {
      return yield* formatFailure(
        `Biome failed for ${filePath} with exit code ${exitCode}`,
        new globalThis.Error(`Biome exit code ${exitCode}`)
      );
    }
  });

  const content = Effect.fn("CodegenKit.formatContent")(function* (source: string, outputPath: string) {
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* fs
          .makeTempDirectoryScoped({ directory: path.dirname(outputPath), prefix: ".codegen-kit-" })
          .pipe(
            Effect.mapError((cause) => formatFailure(`Could not create formatter workspace for ${outputPath}`, cause))
          );
        const temporaryPath = path.join(
          directory,
          Str.endsWith(".json")(outputPath) ? "generated.json" : "generated.ts"
        );
        yield* fs
          .writeFileString(temporaryPath, source)
          .pipe(Effect.mapError((cause) => formatFailure(`Could not stage ${outputPath} for formatting`, cause)));
        yield* file(temporaryPath);
        return yield* fs
          .readFileString(temporaryPath)
          .pipe(Effect.mapError((cause) => formatFailure(`Could not read formatted ${outputPath}`, cause)));
      })
    );
  });

  return { content, file } satisfies Formatter;
});
