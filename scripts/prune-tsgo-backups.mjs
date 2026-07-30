// Reclaim the binary backups `effect-tsgo patch` leaves behind, so a long-lived
// `node_modules` cannot accumulate them without bound.
//
// Why this exists. `effect-tsgo patch` backs the current binary up before
// writing its own, and it never reuses or removes a backup:
//
//   let actualBackupPath = binary + ".original"
//   while (exists(actualBackupPath)) {
//     if (counter > 100) fail("Too many backup files exist (over 100)")
//     actualBackupPath = binary + ".original." + counter++
//   }
//   rename(binary, actualBackupPath)
//
// So every install adds one ~30 MB file, and at 100 the patch step fails hard.
// The tool's restore path does not reclaim them either: it reads only the
// plain `.original` and renames the patched binary aside as a `.patched` file.
//
// That ceiling is reachable in practice. A Vercel project restoring its build
// cache across deployments crossed 100 and could no longer deploy at all - and
// because the failure happens during `install`, the build never wrote a new
// cache, so every later deployment restored the same poisoned one and failed
// identically. A developer checkout here held 42 backups totalling 1.2 GB.
//
// What is safe to delete. The plain `<binary>.original` is the genuine
// pre-patch binary and is kept: it is the one file `patch` cannot regenerate.
// The numbered `<binary>.original.<n>` files are previously-patched binaries
// rotated out by later runs, and `*.patched` files are restore leftovers; both
// are reproducible from the package and are removed.

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
