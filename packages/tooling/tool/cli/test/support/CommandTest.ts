import { A, dual } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, FileSystem, Layer, Path, Runtime } from "effect";
import * as O from "effect/Option";
import { expect } from "vitest";

export const NodeTestLayer = Layer.mergeAll(NodeServices.layer);

const permuteDirectoryEntries = (entries: ReadonlyArray<string>, iteration: number): ReadonlyArray<string> => {
  const size = A.length(entries);
  if (size === 0) return entries;
  const pivot = iteration % size;
  const rotated = A.appendAll(A.drop(entries, pivot), A.take(entries, pivot));
  return iteration % 2 === 0 ? rotated : A.reverse(rotated);
};

export const permutedDirectoryReadsFileSystem: {
  (fileSystem: FileSystem.FileSystem, iteration: number): FileSystem.FileSystem;
  (iteration: number): (fileSystem: FileSystem.FileSystem) => FileSystem.FileSystem;
} = dual(
  2,
  (fileSystem: FileSystem.FileSystem, iteration: number): FileSystem.FileSystem =>
    FileSystem.FileSystem.of({
      ...fileSystem,
      readDirectory: Effect.fn("CommandTest.permutedReadDirectory")((path, options) =>
        fileSystem
          .readDirectory(path, options)
          .pipe(Effect.map((entries) => A.fromIterable(permuteDirectoryEntries(entries, iteration))))
      ),
    })
);

export const withTempWorkingDirectory = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const originalCwd = process.cwd();
      const workingDirectory = yield* fs.makeTempDirectory();

      yield* Effect.sync(() => {
        process.chdir(workingDirectory);
      });
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            process.chdir(originalCwd);
          });
          yield* fs.remove(workingDirectory, { force: true, recursive: true }).pipe(Effect.orDie);
        })
      );

      return yield* use;
    })
  );

const projectFilePath = Effect.fn("CommandTest.projectFilePath")(function* (relativePath: string) {
  const path = yield* Path.Path;
  return path.resolve(process.cwd(), relativePath);
});

const ensureParentDirectory = Effect.fn("CommandTest.ensureParentDirectory")(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
});

export const writeProjectFile = Effect.fn(function* (relativePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const absolutePath = yield* projectFilePath(relativePath);
  yield* ensureParentDirectory(absolutePath);
  yield* fs.writeFileString(absolutePath, content);
});

export const readProjectFile = Effect.fn(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(yield* projectFilePath(relativePath));
});

export const writeDefaultTsconfig = writeProjectFile(
  "tsconfig.json",
  A.join(["{", '  "compilerOptions": {', '    "target": "ES2022",', '    "module": "ESNext"', "  }", "}"], "\n")
);

export const expectReportedExit: {
  (exitCode?: number): (exit: Exit.Exit<unknown, unknown>) => void;
  (exit: Exit.Exit<unknown, unknown>, exitCode?: number): void;
} = dual(
  (args) => Exit.isExit(args[0]),
  (exit: Exit.Exit<unknown, unknown>, exitCode = 1): void => {
    const failure = Exit.match(exit, {
      onFailure: (cause) => O.some(Cause.squash(cause)),
      onSuccess: () => O.none(),
    });

    expect(O.isSome(failure)).toBe(true);
    if (O.isSome(failure)) {
      const error = failure.value;
      expect(Runtime.getErrorExitCode(error)).toBe(exitCode);
      expect(Runtime.getErrorReported(error)).toBe(false);
    }
  }
);
