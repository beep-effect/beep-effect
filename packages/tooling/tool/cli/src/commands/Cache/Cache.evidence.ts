/**
 * Bounded immutable file verification shared by Cache evidence consumers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { Sha256HexFromBytes } from "@beep/schema";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { ensureZeroExit } from "../../internal/process/index.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheEvidenceReference } from "@beep/repo-configs/cache";
import type { CapturedStreams } from "../../internal/process/index.ts";

/**
 * Read a required contained experiment artifact within its byte bound.
 *
 * **Example** (Plan a bounded file read)
 *
 * ```ts
 * import { readCacheExperimentBytes } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(readCacheExperimentBytes("/repo", "fixture.txt", 4096)))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readCacheExperimentBytes = Effect.fn("CacheEvidence.readExperimentBytes")(function* (
  root: string,
  relative: string,
  limit = 1024 * 1024
) {
  const read = yield* readContainedFileBytesNoFollow(root, relative, S.Natural.make(limit));
  return yield* read.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new(`Required bounded experiment artifact is missing: ${relative}`))
  );
});

/**
 * Decode experiment bytes without silently replacing malformed UTF-8.
 *
 * **Example** (Decode exact UTF-8 bytes)
 *
 * ```ts
 * import { decodeCacheExperimentText } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(decodeCacheExperimentText(new TextEncoder().encode("fixture"))))
 * ```
 *
 * @internal
 * @param bytes - Original artifact bytes to decode with strict UTF-8 validation.
 * @returns Decoded text or a typed failure for malformed UTF-8.
 * @category queries
 * @since 0.0.0
 */
export const decodeCacheExperimentText = (bytes: Uint8Array) =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => CacheCommandError.new("Experiment artifact contains invalid UTF-8."),
  });
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

/**
 * Hash an exact executable with the shared no-follow, 128 MiB read bound.
 *
 * **Example** (Plan executable identity verification)
 *
 * ```ts
 * import { hashCacheExperimentExecutable } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(hashCacheExperimentExecutable("/tools/turbo")))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const hashCacheExperimentExecutable = Effect.fn("CacheEvidence.hashExperimentExecutable")(function* (
  executable: string
) {
  const path = yield* Path.Path;
  return yield* readCacheExperimentBytes(path.dirname(executable), executable, 128 * 1024 * 1024).pipe(
    Effect.flatMap(hashBytes)
  );
});

/**
 * Read at most eight MiB from a contained regular file and verify its original bytes.
 *
 * **Details**
 *
 * The shared filesystem guard rejects symlink traversal. This checks file
 * integrity only; the caller owns decoding and the evidence's meaning.
 *
 * **Example** (Keep verification lazy)
 *
 * ```ts
 * import { readCacheEvidenceBytes } from "@beep/repo-cli/test/Cache"
 * import type { CacheEvidenceReference } from "@beep/repo-configs/cache"
 * const plan = (reference: CacheEvidenceReference) => readCacheEvidenceBytes("/repo", reference)
 * console.assert(typeof plan === "function")
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readCacheEvidenceBytes = Effect.fn("CacheEvidence.readBytes")(function* (
  root: string,
  reference: CacheEvidenceReference
) {
  const read = yield* readContainedFileBytesNoFollow(root, reference.path, S.Natural.make(8 * 1024 * 1024));
  const bytes = yield* read.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new("Required qualification evidence is missing."))
  );
  const digest = yield* hashBytes(bytes);
  if (digest !== reference.sha256) return yield* CacheCommandError.new("Qualification evidence digest mismatch.");
  return bytes;
}, CacheCommandError.mapError("Cannot verify qualification evidence bytes."));

/**
 * Refuse cache sandbox supervision on unsupported host platforms.
 *
 * **Example** (Plan the host check)
 *
 * ```ts
 * import { requireCacheLinuxX64 } from "@beep/repo-cli/commands/Cache/Cache.evidence"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(requireCacheLinuxX64("Linux x64 is required.")))
 * ```
 *
 * @param message - Existing runner-specific diagnostic for unsupported hosts.
 * @returns A host validation effect with a typed cache command error.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const requireCacheLinuxX64 = Effect.fn("CacheEvidence.requireLinuxX64")(function* (message: string) {
  if ((yield* HostProcessPlatform) !== "linux" || (yield* HostProcessArchitecture) !== "x64")
    return yield* CacheCommandError.new(message);
});

/**
 * Require a complete successful supervisor capture without exposing worker streams.
 *
 * **Example** (Validate a bounded private capture)
 * ```ts
 * import { requireCacheSupervisorCapture } from "@beep/repo-cli/commands/Cache/Cache.evidence"
 * import { CapturedStreams } from "@beep/repo-cli/test/Process"
 * const capture = CapturedStreams.make({ exitCode: 0, stdout: "", stderr: "", truncated: false })
 * const check = requireCacheSupervisorCapture("Protocol")(capture)
 * console.assert(check !== undefined)
 * ```
 *
 * @param captured - Private captured streams; only status and truncation affect the result.
 * @param context - Static runner label for the bounded diagnostic.
 * @returns Typed failure for truncation or nonzero exit, with no raw stream cause.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const requireCacheSupervisorCapture: {
  (context: string): (captured: CapturedStreams) => Effect.Effect<void, CacheCommandError>;
  (captured: CapturedStreams, context: string): Effect.Effect<void, CacheCommandError>;
} = dual(
  2,
  Effect.fn("CacheEvidence.requireSupervisorCapture")(function* (captured: CapturedStreams, context: string) {
    if (captured.truncated) return yield* CacheCommandError.new(`${context} supervisor exceeded its capture bound.`);
    yield* ensureZeroExit(captured, (exitCode) =>
      CacheCommandError.new(`${context} supervisor exited with exit code ${exitCode}.`)
    );
  })
);

/**
 * Allocate scoped supervisor storage outside every task input mount.
 *
 * **Example** (Reference private host storage)
 * ```ts
 * import { makePrivateSupervisorStorage } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof makePrivateSupervisorStorage === "function")
 * ```
 *
 * @internal
 * @category resources
 * @since 0.0.0
 */
export const makePrivateSupervisorStorage = Effect.fn("CachePilot.makePrivateSupervisorStorage")(function* (
  root: string,
  mounts: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs
    .makeTempDirectoryScoped({
      directory: "/tmp",
      prefix: "beep-cache-supervisor-",
    })
    .pipe(Effect.flatMap(fs.realPath));
  if (A.some([...mounts, "/usr"], (mount) => isResolvedPathWithinRoot(path, { root: mount, candidate: directory })))
    return yield* CacheCommandError.new("Private supervisor storage must remain outside every source input mount.");
  yield* fs.chmod(directory, 0o700);
  // Resolve worker imports without placing private captures inside a source mount.
  yield* fs.symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"));
  return directory;
});
