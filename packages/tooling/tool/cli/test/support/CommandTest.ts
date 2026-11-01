import { A, dual } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Runtime from "effect/Runtime";
import * as Str from "effect/String";
import { expect } from "vitest";

export const NodeTestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

/**
 * Supplies native platform services and cryptography for complete CLI command trees.
 *
 * **Example** (Compose command tests)
 * ```ts
 * import { NodeCommandTestLayer } from "./CommandTest.ts"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(NodeCommandTestLayer)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const NodeCommandTestLayer = Layer.mergeAll(NodeTestLayer, NodeCrypto.layer);

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

/**
 * Runs an effect with every path outside `dir` reported as absent by `exists`.
 *
 * **Details**
 *
 * Upward searches such as `findRepoRoot` probe each ancestor with `exists`.
 * A bare temporary directory under a shared `/tmp` is not proof that no root
 * exists: a stray `/tmp/.git` or `/tmp/bun.lock` from another process makes the
 * search succeed. Hiding everything outside `dir` makes "no ancestor marker" a
 * property of the test rather than of the host. Every other operation reaches
 * the real file system.
 *
 * **Example** (Prove a bare directory has no repository root)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { withAncestorsHidden } from "./CommandTest.ts"
 *
 * const program = Effect.void.pipe(withAncestorsHidden("/tmp/bare-123"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const withAncestorsHidden =
  (dir: string) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | FileSystem.FileSystem> =>
    Effect.provideServiceEffect(
      self,
      FileSystem.FileSystem,
      Effect.map(Effect.service(FileSystem.FileSystem), (fileSystem) =>
        FileSystem.FileSystem.of({
          ...fileSystem,
          exists: Effect.fn("CommandTest.ancestorsHiddenExists")((path) =>
            path === dir || Str.startsWith(`${dir}/`)(path) ? fileSystem.exists(path) : Effect.succeed(false)
          ),
        })
      )
    );

/**
 * Enters a fresh native temporary directory for the lifetime of the caller's scope.
 *
 * **Details**
 *
 * Scope finalizers restore the previous cwd before removing the temporary tree.
 * Acquisition registers cleanup before the next interruptible operation.
 *
 * **Gotchas**
 *
 * The process cwd is shared. Consume this only from sequential test bodies.
 *
 * **Example** (A directory owned by one test)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import { temporaryWorkingDirectory } from "./CommandTest.ts"
 *
 * const writeFixture = Effect.gen(function* () {
 *   yield* temporaryWorkingDirectory
 *   const fs = yield* FileSystem.FileSystem
 *   yield* fs.writeFileString("fixture.txt", "fixture")
 * })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const temporaryWorkingDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const originalCwd = yield* Effect.sync(() => process.cwd());
  const workingDirectory = yield* Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { force: true, recursive: true }).pipe(Effect.orDie)
  );
  yield* Effect.acquireRelease(
    Effect.sync(() => process.chdir(workingDirectory)),
    () => Effect.sync(() => process.chdir(originalCwd))
  );
  return workingDirectory;
}).pipe(Effect.withSpan("CommandTest.temporaryWorkingDirectory"));

/**
 * Runs a test body in an owned temporary directory, passing its absolute root to fixture builders.
 *
 * **Example** (Write beneath the allocated root)
 * ```ts
 * import { withTempWorkingDirectory } from "./CommandTest.ts";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import * as Path from "effect/Path";
 *
 * const fixture = withTempWorkingDirectory((root) => Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem;
 *   const path = yield* Path.Path;
 *   yield* fs.writeFileString(path.join(root, "fixture.txt"), "fixture");
 * }));
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const withTempWorkingDirectory = <A, E, R>(
  use: Effect.Effect<A, E, R> | ((root: string) => Effect.Effect<A, E, R>)
) => Effect.scoped(Effect.flatMap(temporaryWorkingDirectory, (root) => (Effect.isEffect(use) ? use : use(root))));

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
      onFailure: (cause) => cause.pipe(Cause.squash, O.some),
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
