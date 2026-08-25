import { Effect, FileSystem, Path, Stream } from "effect";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { CodegenFormatError } from "../CodegenKit.errors.ts";

export interface Formatter {
  readonly content: (source: string, outputPath: string) => Effect.Effect<string, CodegenFormatError>;
  readonly file: (filePath: string) => Effect.Effect<void, CodegenFormatError>;
  readonly unifiedDiff: (currentPath: string, generated: string) => Effect.Effect<string, CodegenFormatError>;
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
        `Biome exit code ${exitCode}`
      );
    }
  });

  const content = Effect.fn("CodegenKit.formatContent")(function* (source: string, outputPath: string) {
    const formatterPath = path.join(import.meta.dirname, "generated.ts");
    const formatted = yield* spawner
      .string(
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
            "--stdin-file-path",
            formatterPath,
          ],
          {
            stdin: Stream.make(source).pipe(Stream.encodeText),
            stdout: "pipe",
            stderr: "inherit",
          }
        )
      )
      .pipe(Effect.mapError((cause) => formatFailure(`Biome could not format ${outputPath}`, cause)));
    if (Str.isEmpty(formatted)) {
      return yield* formatFailure(`Biome returned empty output for ${outputPath}`, "Biome returned empty output");
    }
    return formatted;
  });

  const unifiedDiff = Effect.fn("CodegenKit.unifiedDiff")(function* (currentPath: string, generated: string) {
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const temporaryPath = yield* fs
          .makeTempFileScoped({
            directory: import.meta.dirname,
            prefix: ".codegen-kit-diff-",
            suffix: ".generated.ts",
          })
          .pipe(Effect.mapError((cause) => formatFailure(`Could not stage unified diff for ${currentPath}`, cause)));
        yield* fs
          .writeFileString(temporaryPath, generated)
          .pipe(Effect.mapError((cause) => formatFailure(`Could not write unified diff for ${currentPath}`, cause)));
        const exists = yield* fs
          .exists(currentPath)
          .pipe(
            Effect.mapError((cause) => formatFailure(`Could not inspect ${currentPath} for a unified diff`, cause))
          );
        return yield* spawner
          .string(
            ChildProcess.make(
              "diff",
              ["-u", "--label", currentPath, "--label", "generated", exists ? currentPath : "/dev/null", temporaryPath],
              { stdin: "ignore", stdout: "pipe", stderr: "inherit" }
            )
          )
          .pipe(Effect.mapError((cause) => formatFailure(`Could not render unified diff for ${currentPath}`, cause)));
      })
    );
  });

  return { content, file, unifiedDiff } satisfies Formatter;
});
