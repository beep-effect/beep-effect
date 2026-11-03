/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the proof coordinator lock path and the diff fingerprint of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import {
  artifactDirForContext,
  proofCoordinatorLockPath,
  runArtifactPathForContext as runOutputPathForContext,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { concatBytes } from "../../../../packages/tooling/tool/cli/src/internal/cli/Bytes.ts";
import { oldRunGitOutput } from "./GitRunners.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

const textEncoder = new TextEncoder();
const fingerprintSeparator = textEncoder.encode("\0");

export const oldProofLockPathForContext = Effect.fn("Yeet.oldProofLockPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  string,
  YeetCommandError,
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Digest.Digest
> {
  const repositoryIdentity = yield* oldRunGitOutput(context.repoRoot, ["config", "--get", "remote.origin.url"]);
  return yield* proofCoordinatorLockPath(repositoryIdentity);
});

export const oldReadFingerprintFileBytes = Effect.fn("Yeet.oldReadFingerprintFileBytes")(function* (
  filePath: string
): Effect.fn.Return<Uint8Array, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFile(filePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read Yeet fingerprint artifact ${filePath}.`)));
});

export const oldCollectGitDiffBytes = Effect.fn("Yeet.oldCollectGitDiffBytes")(function* (
  context: RepoRunContext,
  args: ReadonlyArray<string>,
  fileName: string
): Effect.fn.Return<
  Uint8Array,
  YeetCommandError,
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  const requestedPath = yield* runOutputPathForContext(context, `fingerprint-${process.pid}-${fileName}.patch`);
  yield* fs
    .makeDirectory(path.dirname(requestedPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet fingerprint directory for ${requestedPath}.`)));

  // Fail closed if the fingerprint target (or a symlink at that path) resolves
  // outside the Yeet artifact tree, so `git diff --output` cannot be redirected
  // through a symlink to clobber a file outside the run directory.
  const diffPath = yield* resolvePathWithinRoot({ root: artifactDir, candidate: requestedPath }).pipe(
    Effect.mapError(YeetCommandError.new(`Refused unsafe Yeet fingerprint artifact path ${requestedPath}.`))
  );

  return yield* Effect.gen(function* () {
    yield* oldRunGitOutput(context.repoRoot, ["diff", "--binary", `--output=${diffPath}`, ...args]);
    return yield* oldReadFingerprintFileBytes(diffPath);
  }).pipe(Effect.ensuring(fs.remove(diffPath).pipe(Effect.ignore)));
});

export const oldCollectDiffFingerprint = Effect.fn("Yeet.oldCollectDiffFingerprint")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  string,
  YeetCommandError,
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Digest.Digest
> {
  const status = yield* oldRunGitOutput(context.repoRoot, ["status", "--short"]);
  const unstagedDiff = yield* oldCollectGitDiffBytes(context, ["HEAD"], "worktree");
  const stagedDiff = yield* oldCollectGitDiffBytes(context, ["--cached"], "index");
  const crypto = yield* Digest.Digest;
  const digest = yield* crypto.digest(
    Digest.sha256,
    concatBytes([textEncoder.encode(status), fingerprintSeparator, unstagedDiff, fingerprintSeparator, stagedDiff])
  );
  return Hex.encode(digest);
});
