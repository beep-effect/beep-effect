/**
 * Reclaim the binary backups older `effect-tsgo patch` releases left behind.
 *
 * **Details**
 *
 * Older `effect-tsgo patch` releases backed the current binary up before
 * writing their own and never reused or removed numbered backups, so repeated
 * installs added one ~30 MB `<binary>.original.<n>` file each and failed hard
 * past 100. A Vercel project restoring its build cache crossed that ceiling and
 * could no longer deploy; a developer checkout held 42 backups (1.2 GB).
 *
 * The root `prepare` lifecycle first restores the genuine `.original`, prunes
 * here, then applies the installed replacement. The plain `<binary>.original`
 * is kept because an active patch still needs it for restoration; numbered
 * `.original.<n>` rotations and `*.patched` restore leftovers are reproducible
 * from installed packages and are removed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, P, Str } from "@beep/utils";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Inspectable from "effect/Inspectable";
import * as Num from "effect/Number";
import * as Path from "effect/Path";

const LOG_PREFIX = "[prune-tsgo-backups]";

// `.original.12` is a rotated-out patched binary; `.patched` a restore leftover. Never the plain `.original`.
const isReclaimable: (name: string) => boolean = flow(Str.match(/(?:\.original\.\d+|\.patched)$/u), O.isSome);

const pruneDirectory = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(directory);
  let reclaimedBytes = 0;
  for (const target of A.map(A.filter(entries, isReclaimable), (entry) => path.join(directory, entry))) {
    const info = yield* fs.stat(target);
    yield* fs.remove(target);
    reclaimedBytes += Number(info.size);
  }
  return reclaimedBytes;
});

const packageDirectories = Effect.fnUntraced(function* (root: string, ...segments: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!(yield* fs.exists(root))) {
    return A.empty<string>();
  }
  const packages = yield* fs.readDirectory(root);
  return yield* Effect.filter(
    A.map(packages, (packageName) => path.join(root, packageName, ...segments)),
    (directory) => fs.exists(directory)
  );
});

const causeMessage = flow(Cause.squash, (error: unknown) =>
  P.isError(error) ? error.message : Inspectable.toStringUnknown(error)
);

/**
 * Prune stale tsgo and tsrs binary backups under one install root.
 *
 * **Details**
 *
 * Scans `node_modules/@typescript/<package>/lib` and `node_modules/@tsrs/<package>`
 * below `root`, deletes `*.original.<n>` and `*.patched`, and prints
 * `[prune-tsgo-backups] reclaimed ~N MB of stale binary backups`. A root with
 * neither package scope is a fresh clone and prints nothing.
 *
 * **Gotchas**
 *
 * The effect never fails: pruning is an optimization, never an install gate,
 * so every failure or defect becomes a `[prune-tsgo-backups] skipped: <reason>`
 * warning on stderr and `effect-tsgo patch` still gets its chance.
 *
 * **Example** (Prune the current install)
 *
 * ```ts
 * import { pruneTsgoBackups } from "@beep/repo-cli/commands/Toolchain"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(pruneTsgoBackups("/checkout"))) // true
 * ```
 *
 * @param root - Directory whose `node_modules` holds the patched compilers.
 * @returns An effect that logs the reclaimed size or the skip reason.
 * @category utilities
 * @since 0.0.0
 */
export const pruneTsgoBackups = Effect.fn("Toolchain.pruneTsgoBackups")(
  function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const typescriptPackagesRoot = path.join(root, "node_modules", "@typescript");
    // `effect-tsgo patch --tsrs` keeps its backup beside the binary at the @tsrs/<platform> package root.
    const tsrsPackagesRoot = path.join(root, "node_modules", "@tsrs");
    if (!(yield* fs.exists(typescriptPackagesRoot)) && !(yield* fs.exists(tsrsPackagesRoot))) {
      return;
    }
    const typescriptDirectories = yield* packageDirectories(typescriptPackagesRoot, "lib");
    const tsrsDirectories = yield* packageDirectories(tsrsPackagesRoot);
    const directories = A.appendAll(typescriptDirectories, tsrsDirectories);
    let reclaimedBytes = 0;
    for (const directory of directories) {
      reclaimedBytes += yield* pruneDirectory(directory);
    }
    yield* Console.log(
      `${LOG_PREFIX} reclaimed ~${Num.round(reclaimedBytes / 1024 / 1024, 0)} MB of stale binary backups`
    );
  },
  Effect.catchCause((cause) => Console.warn(`${LOG_PREFIX} skipped: ${causeMessage(cause)}`))
);
