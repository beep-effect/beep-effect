// Reclaim the binary backups older `effect-tsgo patch` releases left behind,
// so a long-lived `node_modules` cannot accumulate them without bound.
//
// Why this exists. Older `effect-tsgo patch` releases backed the current binary
// up before writing their own and did not reuse or remove numbered backups:
//
//   let actualBackupPath = binary + ".original"
//   while (exists(actualBackupPath)) {
//     if (counter > 100) fail("Too many backup files exist (over 100)")
//     actualBackupPath = binary + ".original." + counter++
//   }
//   rename(binary, actualBackupPath)
//
// Repeated installs could therefore add one ~30 MB file each and fail hard at
// 100. The current prepare lifecycle first restores the genuine `.original`,
// prunes any historical rotations, and then applies the installed replacement.
//
// That ceiling is reachable in practice. A Vercel project restoring its build
// cache across deployments crossed 100 and could no longer deploy at all - and
// because the failure happens during `install`, the build never wrote a new
// cache, so every later deployment restored the same poisoned one and failed
// identically. A developer checkout here held 42 backups totalling 1.2 GB.
//
// What is safe to delete. The plain `<binary>.original` is kept because an
// active patch still needs it for restoration. Numbered `.original.<n>` files
// are old rotated binaries and `*.patched` files are restore leftovers; both
// are reproducible from installed packages and are removed.

import * as fs from "node:fs";
import * as path from "node:path";

const typescriptPackagesRoot = path.join(process.cwd(), "node_modules", "@typescript");

// `.original.12` - a rotated-out patched binary. Never the plain `.original`.
const isReclaimable = (name) => /\.original\.\d+$/.test(name) || name.endsWith(".patched");

const pruneDirectory = (directory) =>
  fs
    .readdirSync(directory)
    .filter(isReclaimable)
    .map((entry) => path.join(directory, entry))
    .reduce((reclaimedBytes, target) => {
      const { size } = fs.statSync(target);
      fs.rmSync(target);
      return reclaimedBytes + size;
    }, 0);

const libDirectories = () =>
  fs
    .readdirSync(typescriptPackagesRoot)
    .map((packageName) => path.join(typescriptPackagesRoot, packageName, "lib"))
    .filter((directory) => fs.existsSync(directory));

const main = () => {
  // A fresh clone has no @typescript packages until install finishes; nothing
  // to prune is the normal case, not a failure.
  if (!fs.existsSync(typescriptPackagesRoot)) return;
  const reclaimedBytes = libDirectories().reduce((total, directory) => total + pruneDirectory(directory), 0);
  console.log(`[prune-tsgo-backups] reclaimed ~${Math.round(reclaimedBytes / 1024 / 1024)} MB of stale binary backups`);
};

// Pruning is an optimization, never a gate: if it cannot run, `patch` should
// still get its chance rather than failing the whole install.
try {
  main();
} catch (cause) {
  console.warn(`[prune-tsgo-backups] skipped: ${cause instanceof Error ? cause.message : String(cause)}`);
}
