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
import { OntologyConfig } from "@beep/ontology-config/server";
import {
  OntologyFilePath,
  OntologyFileStore,
  OntologyFileStoreError,
  ReadOntologyFileResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { Effect, FileSystem, Path, PlatformError } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ReadOntologyFileRequest, WriteOntologyFileRequest } from "@beep/ontology-use-cases/aggregates/Session";

const utf8Encoder = new TextEncoder();

const OntologyWorkspacePathSegment = S.NonEmptyString.check(
  S.isPattern(/^(?!\.{1,2}$).+$/u, {
    identifier: "OntologyWorkspacePathSegmentCheck",
    title: "Ontology Workspace Path Segment",
    description: "Ontology workspace path segments must not be current-directory or parent-directory markers.",
    message: "Ontology workspace path segments must not be '.' or '..'.",
  })
);
const isOntologyWorkspacePathSegment = S.is(OntologyWorkspacePathSegment);

const OntologyWorkspaceFilePathChecks = S.makeFilterGroup(
  [
    S.isPattern(/^(?![\\/])(?![A-Za-z]:)[^\\]+\.ttl$/u, {
      identifier: "OntologyWorkspaceFilePathSyntaxCheck",
      title: "Ontology Workspace File Path Syntax",
      description: "Ontology workspace paths must be root-relative POSIX paths ending in lower-case .ttl.",
      message: "Expected a root-relative POSIX path ending in lower-case .ttl.",
    }),
    S.makeFilter((value: string) => A.every(Str.split("/")(value), isOntologyWorkspacePathSegment), {
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

const OntologyWorkspaceFilePath = OntologyFilePath.check(OntologyWorkspaceFilePathChecks);
const decodeOntologyWorkspaceFilePath = S.decodeUnknownEffect(OntologyWorkspaceFilePath);

// Absence is not a failure to read: callers seed a starter document when a file
// is missing, and must never take that path for a file that exists but could not
// be read (a permissions error or a transient fault would otherwise overwrite the
// user's document with the fixture).
const readFailure =
  (path: ReadOntologyFileRequest["path"]) =>
  (error: PlatformError.PlatformError): OntologyFileStoreError =>
    error.reason._tag === "NotFound"
      ? OntologyFileStoreError.make({
          reason: "notFound",
          path,
          message: `Ontology sidecar file does not exist: ${path}.`,
        })
      : OntologyFileStoreError.make({
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
  fileSystem: FileSystem.FileSystem,
  configuredRoot: string
) {
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
 * **Gotchas**
 *
 * The supplied ontology server configuration must name an existing
 * directory. Requests accept only traversal-safe root-relative paths ending in
 * lower-case `.ttl`.
 *
 * **Example** (Build filesystem file store)
 *
 * ```ts
 * import { OntologyConfig, OntologyServerConfig } from "@beep/ontology-config/server"
 * import { makeFileSystemOntologyFileStore } from "@beep/ontology-server/aggregates/Session"
 * import { Effect } from "effect"
 *
 * const program = makeFileSystemOntologyFileStore().pipe(
 *   Effect.provideService(
 *     OntologyConfig,
 *     OntologyServerConfig.make({ workspaceRoot: "." })
 *   ),
 *   Effect.map((fileStore) => typeof fileStore.read === "function")
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Reads typed ontology server configuration, canonicalizes its workspace root and read targets, and atomically writes Turtle documents within that root.
 * @category services
 * @since 0.0.0
 */
export const makeFileSystemOntologyFileStore = Effect.fn("Ontology.FileStore.makeFileSystem")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { workspaceRoot } = yield* OntologyConfig;
  const canonicalRoot = yield* resolveOntologyWorkspaceRoot(fileSystem, workspaceRoot);

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
