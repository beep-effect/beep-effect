/**
 * Safe filesystem reads for vault scans and queued uploads.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import { VaultScanFailed } from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { constFalse, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { ObservedFile, ObservedFolder, VaultScanObservation } from "./VaultScan.model.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSync.file-store");

const contentDigestOf = (bytes: Uint8Array): DocumentContentDigest =>
  DocumentContentDigest.make(bytesToHex(sha256(bytes)));

const scanFailed = (reason: string): VaultScanFailed => VaultScanFailed.make({ reason });

const isPathWithinRoot = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return !path.isAbsolute(relative) && !Str.startsWith("..")(relative);
};

const emptyObservation = VaultScanObservation.make({ files: [], folders: [] });

const mergeObservations = (observations: ReadonlyArray<VaultScanObservation>): VaultScanObservation =>
  VaultScanObservation.make({
    files: A.flatMap(observations, (observation) => observation.files),
    folders: A.flatMap(observations, (observation) => observation.folders),
  });

/**
 * Capture filesystem services for safe scans and upload reads within a canonical vault root.
 *
 * **Details**
 * The caller owns root canonicalization and the workspace lock. Both methods
 * share the same regular-file checks: symlink refusal, inode/device binding,
 * root containment and a scoped file handle. Scans skip dot entries and links.
 * Reconciliation, repositories and remote mutations stay outside this adapter.
 *
 * **Example** (Scan a canonical vault root)
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 * import { makeVaultSyncFileStore } from "./VaultSync.file-store.ts"
 *
 * const scan = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const root = yield* fs.realPath("./vault")
 *   const files = yield* makeVaultSyncFileStore()
 *   return yield* files.scan(root)
 * })
 * ```
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncFileStore = Effect.fn($I`makeVaultSyncFileStore`)(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const readRegularFileWithinRoot = Effect.fn($I`readRegularFileWithinRoot`)(function* (
    canonicalRoot: string,
    candidatePath: string,
    displayPath: string
  ) {
    const initialLink = yield* Effect.result(fs.readLink(candidatePath));
    if (Result.isSuccess(initialLink)) {
      return yield* scanFailed(`vault sync refused symbolic link ${displayPath}`);
    }

    return yield* Effect.scoped(
      Effect.gen(function* () {
        const file = yield* fs
          .open(candidatePath, { flag: "r" })
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not open local file ${displayPath}`)));
        const info = yield* file.stat.pipe(
          Effect.mapError(() => scanFailed(`vault sync could not inspect open local file ${displayPath}`))
        );
        if (info.type !== "File") {
          return yield* scanFailed(`vault sync refused non-regular file ${displayPath}`);
        }

        // `File` no longer exposes a descriptor, so the opened path cannot be read back
        // from `/proc/self/fd`. Binding the canonical path to the open descriptor by
        // device + inode is the portable equivalent and keeps the same TOCTOU guarantee.
        const openedPath = yield* fs
          .realPath(candidatePath)
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not resolve open local file ${displayPath}`)));
        const candidateInfo = yield* fs
          .stat(openedPath)
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not inspect local file ${displayPath}`)));
        const inodeMatches = O.getOrElse(O.zipWith(info.ino, candidateInfo.ino, Eq.equals), constFalse);
        if (!Eq.equals(info.dev, candidateInfo.dev) || !inodeMatches || candidateInfo.type !== "File") {
          return yield* scanFailed(`vault sync refused changed local file ${displayPath}`);
        }
        if (!isPathWithinRoot(path, canonicalRoot, openedPath)) {
          return yield* scanFailed(`vault sync refused file outside the configured vault ${displayPath}`);
        }

        const finalLink = yield* Effect.result(fs.readLink(candidatePath));
        if (Result.isSuccess(finalLink)) {
          return yield* scanFailed(`vault sync refused symbolic link ${displayPath}`);
        }

        const size = yield* ByteSize.toNumber(info.size).pipe(
          O.match({
            onNone: () => scanFailed(`vault sync could not safely allocate local file ${displayPath}`),
            onSome: Effect.succeed,
          })
        );
        const bytes = yield* file
          .readAlloc(size)
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not read local file ${displayPath}`)));
        return O.getOrElse(bytes, () => new Uint8Array());
      })
    );
  });

  const walkDirectory = (
    canonicalRoot: string,
    absolutePath: string,
    relSegments: ReadonlyArray<string>
  ): Effect.Effect<VaultScanObservation, VaultScanFailed> =>
    Effect.gen(function* () {
      const names = yield* fs
        .readDirectory(absolutePath)
        .pipe(Effect.mapError(() => scanFailed(`vault scan could not read directory ${absolutePath}`)));
      const visible = pipe(names, A.filter(P.not(Str.startsWith("."))), A.sort(Order.String));
      const observations = yield* Effect.forEach(
        visible,
        Effect.fnUntraced(function* (name) {
          const childAbsolutePath = path.join(absolutePath, name);
          const childSegments = A.append(relSegments, name);
          // Symlinks are never followed: a link out of the vault must not leak
          // into the mirror, and a dangling link must not abort the scan.
          // `readLink` succeeds exactly when the entry is a symlink.
          const symlinkTarget = yield* Effect.result(fs.readLink(childAbsolutePath));
          if (Result.isSuccess(symlinkTarget)) {
            yield* Effect.logDebug("Documents vault scan skipped a symlink").pipe(
              Effect.annotateLogs({ path: childAbsolutePath })
            );
            return emptyObservation;
          }
          const canonicalChildPath = yield* fs
            .realPath(childAbsolutePath)
            .pipe(Effect.mapError(() => scanFailed(`vault scan could not resolve ${childAbsolutePath}`)));
          if (!isPathWithinRoot(path, canonicalRoot, canonicalChildPath)) {
            return yield* scanFailed(`vault scan refused path outside the configured vault ${childAbsolutePath}`);
          }
          const info = yield* fs
            .stat(canonicalChildPath)
            .pipe(Effect.mapError(() => scanFailed(`vault scan could not stat ${childAbsolutePath}`)));
          if (info.type === "Directory") {
            const nested = yield* walkDirectory(canonicalRoot, canonicalChildPath, childSegments);
            const folder = ObservedFolder.make({ relPath: VaultRelPath.make(A.join(childSegments, "/")) });
            return mergeObservations([VaultScanObservation.make({ files: [], folders: [folder] }), nested]);
          }
          if (info.type === "File") {
            const bytes = yield* readRegularFileWithinRoot(
              canonicalRoot,
              childAbsolutePath,
              A.join(childSegments, "/")
            );
            const file = ObservedFile.make({
              digest: contentDigestOf(bytes),
              relPath: VaultRelPath.make(A.join(childSegments, "/")),
              sizeBytes: bytes.byteLength,
            });
            return VaultScanObservation.make({ files: [file], folders: [] });
          }
          return emptyObservation;
        })
      );

      return mergeObservations(observations);
    }).pipe(Effect.withSpan($I`walkDirectory`));

  return {
    scan: (canonicalRoot: string) => walkDirectory(canonicalRoot, canonicalRoot, A.empty<string>()),
    read: Effect.fn($I`readVaultFileBytes`)(function* (canonicalRoot: string, relPath: VaultRelPath) {
      const absolutePath = path.join(canonicalRoot, ...Str.split(relPath, "/"));
      return yield* readRegularFileWithinRoot(canonicalRoot, absolutePath, relPath);
    }),
  };
});
