/**
 * FileSystem-backed ontology sidecar file store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import {
  OntologyFileStore,
  OntologyFileStoreError,
  ReadOntologyFileResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { Clock, Config, Effect, FileSystem, Path, Random } from "effect";
import type { ReadOntologyFileRequest, WriteOntologyFileRequest } from "@beep/ontology-use-cases/aggregates/Session";

const OntologyWorkspaceRoot = Config.string("ONTOLOGY_WORKSPACE_ROOT").pipe(Config.withDefault("."));

const readFailure = (path: ReadOntologyFileRequest["path"]) => (): OntologyFileStoreError =>
  OntologyFileStoreError.make({
    reason: "readFailed",
    path,
    message: `Failed to read ontology sidecar file: ${path}.`,
  });

const writeFailure = (path: WriteOntologyFileRequest["path"]) => (): OntologyFileStoreError =>
  OntologyFileStoreError.make({
    reason: "writeFailed",
    path,
    message: `Failed to write ontology sidecar file: ${path}.`,
  });

const readPathRejected = (path: ReadOntologyFileRequest["path"], message: string): OntologyFileStoreError =>
  OntologyFileStoreError.make({
    reason: "readFailed",
    path,
    message,
  });

const writePathRejected = (path: WriteOntologyFileRequest["path"], message: string): OntologyFileStoreError =>
  OntologyFileStoreError.make({
    reason: "writeFailed",
    path,
    message,
  });

const resolveReadPath = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
  requestPath: ReadOntologyFileRequest["path"]
) =>
  resolvePathWithinRoot({ root, candidate: requestPath }).pipe(
    Effect.provideService(FileSystem.FileSystem, fileSystem),
    Effect.provideService(Path.Path, path),
    Effect.mapError((error) => readPathRejected(requestPath, error.message))
  );

const resolveWritePath = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
  requestPath: WriteOntologyFileRequest["path"]
) =>
  resolvePathWithinRoot({ root, candidate: requestPath }).pipe(
    Effect.provideService(FileSystem.FileSystem, fileSystem),
    Effect.provideService(Path.Path, path),
    Effect.mapError((error) => writePathRejected(requestPath, error.message))
  );

const writeAtomically = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  targetPath: string,
  source: WriteOntologyFileRequest["source"],
  requestPath: WriteOntologyFileRequest["path"]
): Effect.Effect<void, OntologyFileStoreError> =>
  Effect.gen(function* () {
    const targetDir = path.dirname(targetPath);
    const now = yield* Clock.currentTimeMillis;
    const random = yield* Random.nextInt;
    const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.tmp-${now}-${random}`);
    yield* fileSystem.writeFileString(tempPath, source);
    yield* fileSystem
      .rename(tempPath, targetPath)
      .pipe(
        Effect.catch((error) =>
          fileSystem.remove(tempPath, { force: true }).pipe(Effect.ignore, Effect.andThen(Effect.fail(error)))
        )
      );
  }).pipe(Effect.mapError(writeFailure(requestPath)));

/**
 * Build the FileSystem-backed ontology file-store port implementation.
 *
 * @example
 * ```ts
 * import { makeFileSystemOntologyFileStore } from "@beep/ontology-server/aggregates/Session"
 *
 * const fileStore = makeFileSystemOntologyFileStore()
 *
 * console.log(fileStore)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export const makeFileSystemOntologyFileStore = Effect.fn("Ontology.FileStore.makeFileSystem")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* Effect.orDie(OntologyWorkspaceRoot);

  return OntologyFileStore.of({
    read: Effect.fn("Ontology.FileStore.read")(function* (request: ReadOntologyFileRequest) {
      const safePath = yield* resolveReadPath(fileSystem, path, root, request.path);
      const source = yield* fileSystem.readFileString(safePath).pipe(Effect.mapError(readFailure(request.path)));

      return ReadOntologyFileResult.make({
        path: request.path,
        source,
      });
    }),
    write: Effect.fn("Ontology.FileStore.write")(function* (request: WriteOntologyFileRequest) {
      const safePath = yield* resolveWritePath(fileSystem, path, root, request.path);
      yield* fileSystem
        .makeDirectory(path.dirname(safePath), { recursive: true })
        .pipe(Effect.mapError(writeFailure(request.path)));
      const checkedPath = yield* resolveWritePath(fileSystem, path, root, request.path);
      yield* writeAtomically(fileSystem, path, checkedPath, request.source, request.path);
    }),
  });
});
