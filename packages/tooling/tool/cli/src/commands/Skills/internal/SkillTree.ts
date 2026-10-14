/**
 * Mode-aware skill tree hashing and installed-tree reading shared by the
 * provenance resolver and the materializer.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { concatBytes } from "../../../internal/cli/Bytes.ts";
import { SkillsCommandError } from "../Skills.errors.ts";
import { SkillSnapshotFile, SkillTreeMode, SkillUpstreamContentFile } from "../Skills.schemas.ts";
import type * as Crypto from "effect/Crypto";

const $I = $RepoCliId.create("commands/Skills/internal/SkillTree");

const textEncoder = new TextEncoder();
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);

/**
 * Binary-safe skill file paired with its canonical content digest.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class HashedSkillFile extends S.Class<HashedSkillFile>($I`HashedSkillFile`)(
  {
    path: S.String,
    mode: SkillTreeMode,
    bytes: S.Uint8Array,
    sha256: Sha256Hex,
  },
  $I.annote("HashedSkillFile", {
    description: "Binary-safe skill file paired with its canonical content digest.",
  })
) {}

/**
 * Ordered mode-aware manifest of one skill tree plus its aggregate tree and manifest hashes.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class ComputedSkillTree extends S.Class<ComputedSkillTree>($I`ComputedSkillTree`)(
  {
    files: S.Array(HashedSkillFile),
    manifest: S.Array(SkillSnapshotFile),
    treeHash: Sha256Hex,
    manifestHash: Sha256Hex,
  },
  $I.annote("ComputedSkillTree", {
    description: "Ordered mode-aware manifest plus pristine or effective aggregate hashes.",
  })
) {}

const normalizeSlashes = Str.replaceAll("\\", "/");

const isSafeRelativePath = (filePath: string): boolean =>
  Str.isNonEmpty(filePath) &&
  !Str.includes("\0")(filePath) &&
  !Str.startsWith("/")(filePath) &&
  !Str.Equivalence(filePath, ".") &&
  !Str.Equivalence(filePath, "..") &&
  !Str.startsWith("../")(filePath) &&
  !Str.includes("/../")(filePath);

/**
 * Normalizes a skill-relative path and refuses an empty, absolute, or climbing one.
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const validateRelativePath = Effect.fn("SkillsProvenance.validateRelativePath")(function* (
  filePath: string,
  skill: string
): Effect.fn.Return<string, SkillsCommandError> {
  const normalized = normalizeSlashes(filePath);
  if (!isSafeRelativePath(normalized)) {
    return yield* SkillsCommandError.make({
      message: `Upstream skill "${skill}" contains an unsafe file path: ${filePath}`,
      file: filePath,
      skill,
    });
  }
  return normalized;
});

/**
 * SHA-256 of `bytes` as lowercase hex, failing typed with `label` in the message.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const hashBytes = Effect.fn("SkillsProvenance.hashBytes")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<Sha256Hex, SkillsCommandError, Crypto.Crypto> {
  return yield* decodeSha256HexFromBytes(bytes).pipe(
    SkillsCommandError.mapError(`Failed to compute SHA-256 digest for ${label}.`, label)
  );
});

/**
 * Appends `value` and a NUL frame terminator to a hash preimage.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const appendFramedText: {
  (value: string): (chunks: ReadonlyArray<Uint8Array>) => ReadonlyArray<Uint8Array>;
  (chunks: ReadonlyArray<Uint8Array>, value: string): ReadonlyArray<Uint8Array>;
} = dual(
  2,
  (chunks: ReadonlyArray<Uint8Array>, value: string): ReadonlyArray<Uint8Array> =>
    A.append(A.append(chunks, textEncoder.encode(value)), textEncoder.encode("\0"))
);

/**
 * Hashes a skill tree: files sorted by path, each framed as path, mode, length, and bytes.
 *
 * **Details**
 *
 * `treeHash` covers bytes and modes, `manifestHash` covers paths, modes, and
 * per-file digests. The snapshot, effective, and per-target hashes in
 * `skills-lock.json` are all this function's output.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const computeSkillTree = Effect.fn("SkillsProvenance.computeSkillTree")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>,
  label: string
): Effect.fn.Return<ComputedSkillTree, SkillsCommandError, Crypto.Crypto> {
  const sorted = A.sortWith(files, (file) => file.path, Str.Order);
  let treeChunks: ReadonlyArray<Uint8Array> = A.empty<Uint8Array>();
  let manifestChunks: ReadonlyArray<Uint8Array> = A.empty<Uint8Array>();
  let hashedFiles: ReadonlyArray<HashedSkillFile> = A.empty<HashedSkillFile>();
  let manifest: ReadonlyArray<SkillSnapshotFile> = A.empty<SkillSnapshotFile>();

  for (const file of sorted) {
    const sha256 = yield* hashBytes(file.bytes, `${label}:${file.path}`);
    const hashedFile = HashedSkillFile.make({
      path: file.path,
      mode: file.mode,
      bytes: file.bytes,
      sha256,
    });
    hashedFiles = A.append(hashedFiles, hashedFile);
    manifest = A.append(
      manifest,
      SkillSnapshotFile.make({
        path: file.path,
        mode: file.mode,
        sha256,
      })
    );

    treeChunks = appendFramedText(treeChunks, file.path);
    treeChunks = appendFramedText(treeChunks, file.mode);
    treeChunks = appendFramedText(treeChunks, `${file.bytes.byteLength}`);
    treeChunks = A.append(A.append(treeChunks, file.bytes), textEncoder.encode("\0"));

    manifestChunks = appendFramedText(manifestChunks, file.path);
    manifestChunks = appendFramedText(manifestChunks, file.mode);
    manifestChunks = appendFramedText(manifestChunks, sha256);
  }

  return ComputedSkillTree.make({
    files: hashedFiles,
    manifest,
    treeHash: yield* hashBytes(concatBytes(treeChunks), `${label}:tree`),
    manifestHash: yield* hashBytes(concatBytes(manifestChunks), `${label}:manifest`),
  });
});

/**
 * Reads an installed skill directory as mode-aware files; a symbolic link is recorded as Git does (mode 120000 over its target text).
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readLocalSkillFiles = Effect.fn("SkillsProvenance.readLocalSkillFiles")(function* (
  absoluteSkillDir: string,
  skill: string
): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(absoluteSkillDir)
    .pipe(
      SkillsCommandError.mapError(`Failed to inspect installed skill ${absoluteSkillDir}.`, absoluteSkillDir, skill)
    );
  if (!exists) {
    return yield* SkillsCommandError.make({
      message: `Installed skill "${skill}" does not exist at ${absoluteSkillDir}.`,
      file: absoluteSkillDir,
      skill,
    });
  }

  // `stat` resolves links and the FileSystem service exposes no `lstat`, so a successful
  // `readLink` is the only way to see the link itself. Recording it the way Git does —
  // mode 120000 over the target text — keeps a correct local symlink equal to its upstream
  // entry. A real I/O failure is not swallowed here; it resurfaces from the caller's `stat`.
  const readSymlinkEntry = Effect.fn("SkillsProvenance.readLocalSkillFiles.readSymlinkEntry")(function* (
    absoluteEntry: string
  ): Effect.fn.Return<O.Option<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    const linkTarget = yield* Effect.option(fs.readLink(absoluteEntry));
    if (O.isNone(linkTarget)) {
      return O.none();
    }
    const linkPath = yield* validateRelativePath(path.relative(absoluteSkillDir, absoluteEntry), skill);
    return O.some(
      SkillUpstreamContentFile.make({
        path: linkPath,
        mode: "120000",
        bytes: textEncoder.encode(linkTarget.value),
      })
    );
  });

  const readLeafEntries = Effect.fn("SkillsProvenance.readLocalSkillFiles.readLeafEntries")(function* (
    absoluteEntry: string,
    stat: FileSystem.File.Info
  ): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    if (!Str.Equivalence(stat.type, "File")) {
      return A.empty<SkillUpstreamContentFile>();
    }
    const relativePath = yield* validateRelativePath(path.relative(absoluteSkillDir, absoluteEntry), skill);
    const bytes = yield* fs
      .readFile(absoluteEntry)
      .pipe(SkillsCommandError.mapError(`Failed to read installed skill file ${absoluteEntry}.`, absoluteEntry, skill));
    return A.of(
      SkillUpstreamContentFile.make({
        path: relativePath,
        mode: (stat.mode & 0o111) === 0 ? "100644" : "100755",
        bytes,
      })
    );
  });

  const walk = Effect.fn("SkillsProvenance.readLocalSkillFiles.walk")(function* (
    currentDir: string
  ): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(currentDir)
      .pipe(SkillsCommandError.mapError(`Failed to read installed skill directory ${currentDir}.`, currentDir, skill));
    let files = A.empty<SkillUpstreamContentFile>();

    for (const entry of A.sort(entries, Str.Order)) {
      const absoluteEntry = path.join(currentDir, entry);
      const symlink = yield* readSymlinkEntry(absoluteEntry);
      if (O.isSome(symlink)) {
        files = A.append(files, symlink.value);
        continue;
      }

      const stat = yield* fs
        .stat(absoluteEntry)
        .pipe(
          SkillsCommandError.mapError(`Failed to stat installed skill path ${absoluteEntry}.`, absoluteEntry, skill)
        );
      files = Str.Equivalence(stat.type, "Directory")
        ? A.appendAll(files, yield* walk(absoluteEntry))
        : A.appendAll(files, yield* readLeafEntries(absoluteEntry, stat));
    }
    return files;
  });

  return yield* walk(absoluteSkillDir);
});

/**
 * The cross-target installed-tree hash: each target path framed with its tree hash, in target order.
 *
 * **Details**
 *
 * This is the rule behind `effective.installedTreeHash` and a local entry's
 * `installedTreeHash`, so a lock entry and a fresh read of the installed
 * targets agree exactly when every target holds the recorded tree.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const installedTargetsHash = Effect.fn("SkillTree.installedTargetsHash")(function* (
  targets: ReadonlyArray<readonly [target: string, treeHash: Sha256Hex]>,
  skill: string
): Effect.fn.Return<Sha256Hex, SkillsCommandError, Crypto.Crypto> {
  const empty: ReadonlyArray<Uint8Array> = A.empty();
  const chunks = A.reduce(targets, empty, (preimage, [target, treeHash]) =>
    appendFramedText(appendFramedText(preimage, target), treeHash)
  );
  return yield* hashBytes(concatBytes(chunks), `${skill}:installed-targets`);
});

/**
 * Reads and hashes one installed target, or `None` when the target does not exist.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readTargetTree = Effect.fn("SkillTree.readTargetTree")(function* (
  repoRoot: string,
  target: string,
  skill: string
): Effect.fn.Return<
  O.Option<ComputedSkillTree>,
  SkillsCommandError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, target);
  const exists = yield* fs
    .exists(absolute)
    .pipe(SkillsCommandError.mapError(`Failed to inspect installed skill target ${target}.`, target, skill));
  if (!exists) {
    return O.none();
  }
  const files = yield* readLocalSkillFiles(absolute, skill);
  return O.some(yield* computeSkillTree(files, `${skill}:${target}`));
});

/**
 * The patch-set hash: every patch framed as path and byte length, then its bytes, in series order.
 *
 * **Details**
 *
 * An empty series hashes the empty byte string. This is the rule behind
 * `patches.patchSetHash`, shared by the lock planner that records it and the
 * materializer that verifies it.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const patchSetHashOf = Effect.fn("SkillTree.patchSetHashOf")(function* (
  patches: ReadonlyArray<{ readonly path: string; readonly bytes: Uint8Array }>,
  skill: string
): Effect.fn.Return<Sha256Hex, SkillsCommandError, Crypto.Crypto> {
  const chunks = A.flatMap(patches, (patch) =>
    A.append(
      appendFramedText(appendFramedText(A.empty<Uint8Array>(), patch.path), `${patch.bytes.byteLength}`),
      patch.bytes
    )
  );
  return yield* hashBytes(concatBytes(chunks), `${skill}:patch-set`);
});
