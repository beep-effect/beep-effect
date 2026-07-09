/**
 * FileSystem-backed ontology sidecar file store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  OntologyFileStore,
  OntologyFileStoreError,
  ReadOntologyFileResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { Effect, FileSystem, Path } from "effect";
import type { ReadOntologyFileRequest, WriteOntologyFileRequest } from "@beep/ontology-use-cases/aggregates/Session";

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

  return OntologyFileStore.of({
    read: Effect.fn("Ontology.FileStore.read")(function* (request: ReadOntologyFileRequest) {
      const source = yield* fileSystem.readFileString(request.path).pipe(Effect.mapError(readFailure(request.path)));

      return ReadOntologyFileResult.make({
        path: request.path,
        source,
      });
    }),
    write: Effect.fn("Ontology.FileStore.write")(function* (request: WriteOntologyFileRequest) {
      yield* fileSystem
        .makeDirectory(path.dirname(request.path), { recursive: true })
        .pipe(Effect.mapError(writeFailure(request.path)));
      yield* fileSystem.writeFileString(request.path, request.source).pipe(Effect.mapError(writeFailure(request.path)));
    }),
  });
});
