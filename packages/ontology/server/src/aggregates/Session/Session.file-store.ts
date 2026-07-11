/**
 * FileSystem-backed ontology sidecar file store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  resolvePathWithinCanonicalRoot,
  writeFileWithinCanonicalRootAtomically,
} from "@beep/file-processing/PathSafety";
import {
  OntologyFileStore,
  OntologyFileStoreError,
  ReadOntologyFileResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { Config, Effect, FileSystem, Path, PlatformError } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ReadOntologyFileRequest, WriteOntologyFileRequest } from "@beep/ontology-use-cases/aggregates/Session";

const OntologyWorkspaceRoot = Config.nonEmptyString("ONTOLOGY_WORKSPACE_ROOT");
const utf8Encoder = new TextEncoder();

const isSafePathSegment = P.every<string>([Str.isNonEmpty, P.not(Eq.equals(".")), P.not(Eq.equals(".."))]);

const OntologyWorkspaceFilePathChecks = S.makeFilterGroup(
  [
    S.isPattern(/^(?![\\/])(?![A-Za-z]:)[^\\]+\.ttl$/u, {
      identifier: "OntologyWorkspaceFilePathSyntaxCheck",
      title: "Ontology Workspace File Path Syntax",
      description: "Ontology workspace paths must be root-relative POSIX paths ending in lower-case .ttl.",
      message: "Expected a root-relative POSIX path ending in lower-case .ttl.",
    }),
    S.makeFilter((value: string) => A.every(Str.split("/")(value), isSafePathSegment), {
      identifier: "OntologyWorkspaceFilePathSegmentCheck",
      title: "Ontology Workspace File Path Segments",
      description: "Ontology workspace paths must not contain empty, current-directory, or parent-directory segments.",
      message: "Ontology workspace paths must not contain empty, '.' or '..' segments.",
    }),
  ],
  {
    identifier: "OntologyWorkspaceFilePathChecks",
    title: "Ontology Workspace File Path",
    description: "A traversal-safe root-relative Turtle document path.",
  }
);

const OntologyWorkspaceFilePath = S.String.check(OntologyWorkspaceFilePathChecks);
const decodeOntologyWorkspaceFilePath = S.decodeUnknownEffect(OntologyWorkspaceFilePath);

const readFailure = (path: ReadOntologyFileRequest["path"]) => (): OntologyFileStoreError =>
  OntologyFileStoreError.make({
    reason: "readFailed",
    path,
    message: `Failed to read ontology sidecar file: ${path}.`,
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

const invalidReadPath = (path: ReadOntologyFileRequest["path"]): OntologyFileStoreError =>
  readPathRejected(path, "Ontology file path must be a traversal-safe root-relative path ending in lower-case .ttl.");

const invalidWritePath = (path: WriteOntologyFileRequest["path"]): OntologyFileStoreError =>
  writePathRejected(path, "Ontology file path must be a traversal-safe root-relative path ending in lower-case .ttl.");

const invalidResolvedReadPath = (path: ReadOntologyFileRequest["path"]): OntologyFileStoreError =>
  readPathRejected(
    path,
    "Ontology file path must resolve to a traversal-safe root-relative path ending in lower-case .ttl."
  );

const invalidResolvedWritePath = (path: WriteOntologyFileRequest["path"]): OntologyFileStoreError =>
  writePathRejected(
    path,
    "Ontology file path must resolve to a traversal-safe root-relative path ending in lower-case .ttl."
  );

const resolveOntologyWorkspaceRoot = Effect.fn("Ontology.FileStore.resolveWorkspaceRoot")(function* (
  fileSystem: FileSystem.FileSystem
) {
  const configuredRoot = yield* OntologyWorkspaceRoot;
  const canonicalRoot = yield* fileSystem.realPath(configuredRoot);
  const info = yield* fileSystem.stat(canonicalRoot);

  if (!Eq.equals(info.type, "Directory")) {
    return yield* PlatformError.badArgument({
      module: "FileSystem",
      method: "stat",
      description: `Ontology workspace root is not a directory: ${configuredRoot}`,
    });
  }

  return canonicalRoot;
});

const validateReadPath = (requestPath: ReadOntologyFileRequest["path"]) =>
  decodeOntologyWorkspaceFilePath(requestPath).pipe(Effect.mapError(() => invalidReadPath(requestPath)));

const validateWritePath = (requestPath: WriteOntologyFileRequest["path"]) =>
  decodeOntologyWorkspaceFilePath(requestPath).pipe(Effect.mapError(() => invalidWritePath(requestPath)));

const canonicalRelativePath = (path: Path.Path, canonicalRoot: string, target: string): string =>
  Str.replaceAll(path.sep, "/")(path.relative(canonicalRoot, target));

const validateResolvedReadPath = (
  path: Path.Path,
  canonicalRoot: string,
  target: string,
  requestPath: ReadOntologyFileRequest["path"]
) =>
  decodeOntologyWorkspaceFilePath(canonicalRelativePath(path, canonicalRoot, target)).pipe(
    Effect.as(target),
    Effect.mapError(() => invalidResolvedReadPath(requestPath))
  );

const validateResolvedWritePath = (
  path: Path.Path,
  canonicalRoot: string,
  target: string,
  requestPath: WriteOntologyFileRequest["path"]
) =>
  decodeOntologyWorkspaceFilePath(canonicalRelativePath(path, canonicalRoot, target)).pipe(
    Effect.as(target),
    Effect.mapError(() => invalidResolvedWritePath(requestPath))
  );

const resolveReadPath = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  canonicalRoot: string,
  requestPath: ReadOntologyFileRequest["path"]
) =>
  validateReadPath(requestPath).pipe(
    Effect.flatMap((candidate) =>
      resolvePathWithinCanonicalRoot({ canonicalRoot, candidate }).pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, path),
        Effect.mapError((error) => readPathRejected(requestPath, error.message)),
        Effect.flatMap((target) => validateResolvedReadPath(path, canonicalRoot, target, requestPath))
      )
    )
  );

const resolveWritePath = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  canonicalRoot: string,
  requestPath: WriteOntologyFileRequest["path"]
) =>
  validateWritePath(requestPath).pipe(
    Effect.flatMap((candidate) =>
      resolvePathWithinCanonicalRoot({ canonicalRoot, candidate }).pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, path),
        Effect.mapError((error) => writePathRejected(requestPath, error.message)),
        Effect.flatMap((target) => validateResolvedWritePath(path, canonicalRoot, target, requestPath))
      )
    )
  );

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
 * @remarks `ONTOLOGY_WORKSPACE_ROOT` is required and must resolve to an existing directory. Requests accept only traversal-safe root-relative paths ending in lower-case `.ttl`.
 * @effects Reads and validates `ONTOLOGY_WORKSPACE_ROOT`, canonicalizes read targets, and atomically writes Turtle documents within the configured root.
 * @since 0.0.0
 * @category services
 */
export const makeFileSystemOntologyFileStore = Effect.fn("Ontology.FileStore.makeFileSystem")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalRoot = yield* resolveOntologyWorkspaceRoot(fileSystem).pipe(Effect.orDie);

  return OntologyFileStore.of({
    read: Effect.fn("Ontology.FileStore.read")(function* (request: ReadOntologyFileRequest) {
      const safePath = yield* resolveReadPath(fileSystem, path, canonicalRoot, request.path);
      const source = yield* fileSystem.readFileString(safePath).pipe(Effect.mapError(readFailure(request.path)));

      return ReadOntologyFileResult.make({
        path: request.path,
        source,
      });
    }),
    write: Effect.fn("Ontology.FileStore.write")(function* (request: WriteOntologyFileRequest) {
      const target = yield* resolveWritePath(fileSystem, path, canonicalRoot, request.path);
      yield* writeFileWithinCanonicalRootAtomically({
        canonicalRoot,
        candidate: target,
        bytes: utf8Encoder.encode(request.source),
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, path),
        Effect.mapError((error) => writePathRejected(request.path, error.message))
      );
    }),
  });
});
