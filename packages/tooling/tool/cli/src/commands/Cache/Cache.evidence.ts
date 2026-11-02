/**
 * Bounded immutable file verification shared by Cache evidence consumers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { ensureZeroExit } from "../../internal/process/index.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheEvidenceReference } from "@beep/repo-configs/cache";
import type { CapturedStreams } from "../../internal/process/index.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.evidence");
const CacheSupervisorFailureHint = LiteralKit([
  "Signed fresh comparisons lack positive native selected-task overlap.",
  "Signed producer diverged from fresh authority or failed seeded invalidation.",
  "Signed pilot reader protection probe failed.",
  "Signed mutation seed disagrees with its case-derived fresh verdict.",
  "Signed uploaded archive differs from its verified producer log.",
  "Read-only pilot package source changed during execution.",
  "Read-only pilot worktree changed during execution.",
  "Pilot startup libraries changed during execution.",
  "Pilot source configuration drifted during execution.",
  "Retained dependency materialization changed or is incomplete.",
  "Dependency materialization has a stale lockfile or root manifest.",
  "A native non-execution control exceeded its capture bound.",
  "Signed native refusal or absent-script evidence differs from its expected case.",
  "Signed pilot omits distinct, case-derived native non-execution controls.",
  "Signed pilot wire inventory differs from its baseline or seeded case.",
  "Signed mutation lacks its exact changed input and fresh seed verdict.",
  "Signed pilot capture contains synthetic credential material.",
  "Pilot process capture exceeded its bound.",
  "Missing-child policy refusal does not establish an independent ungoverned dry plan.",
  "Missing-child refusal requires a complete native dry plan.",
  "Missing-child refusal omitted its selected dry-plan task.",
  "Missing-child refusal omitted its resolved task configuration.",
  "Non-execution evidence reused an executed task summary.",
  "Signed pilot profile differs from its base tuple.",
  "Signed archive inspection is not bound to its transferred artifact and task log.",
  "TimeoutError",
  "Service not found",
  "Cannot find package",
  "error while loading shared libraries",
]).pipe(
  $I.annoteSchema("CacheSupervisorFailureHint", {
    description:
      "Fixed diagnostic hints safe to quote from an unsuccessful private supervisor capture; never proof authority.",
  })
);

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
 * **Details**
 * Nonzero exits may quote one fixed hint from the source-owned vocabulary.
 * Captured substrings, unmatched text and raw causes never enter the error.
 * A hint is an untrusted diagnostic observation and grants no proof authority.
 * Truncation and exit status remain the only success conditions.
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
 * @param captured - Private streams used only for status, truncation and fixed-hint recognition.
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
    yield* ensureZeroExit(captured, (exitCode) => {
      const streams = A.map([captured.stdout, captured.stderr], Str.replace(/\s+/g, " "));
      const hint = A.findFirst(CacheSupervisorFailureHint.literals, (candidate) =>
        A.some(streams, Str.includes(candidate))
      );
      const suffix = hint.pipe(
        O.map((value) => ` Hint: ${value}`),
        O.getOrElse(() => "")
      );
      return CacheCommandError.new(`${context} supervisor exited with exit code ${exitCode}.${suffix}`);
    });
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
