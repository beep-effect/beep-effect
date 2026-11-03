// On-disk fixtures for the config-dependency resolution ladder: a fake
// `node_modules/.pnpm-config/<name>` install, a fake pnpm store `links/` tree,
// and the `.modules.yaml` that points one at the other. Each helper is an
// effect over the provided `FileSystem` and `Path`: the integration suites run
// them on the real filesystem, because the replaying layers `import()` the
// pnpmfiles and the fetch rung spawns a fake `pnpm` that must see the files.

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type * as PlatformError from "effect/PlatformError";

/** A pnpmfile to write beside a manifest: `[filename, source]`. */
type Pnpmfile = readonly [filename: string, source: string];

/** The services every fixture writes through. */
type FixtureServices = FileSystem.FileSystem | Path.Path;

/** A pnpmfile whose hook injects `hooked-dep` at `range` into the default catalog — the value proves WHICH file ran. */
export const pnpmfileInjecting = (range: string): string =>
  A.join(
    [
      "export const hooks = {",
      "\tupdateConfig(config) {",
      `\t\treturn { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "${range}" } };`,
      "\t},",
      "};",
      "",
    ],
    "\n"
  );

/** The CommonJS spelling of {@link pnpmfileInjecting}, for a `pnpmfile.js` / `pnpmfile.cjs` candidate. */
export const pnpmfileInjectingCjs = (range: string): string =>
  A.join(
    [
      '"use strict";',
      "exports.hooks = {",
      "\tupdateConfig(config) {",
      `\t\treturn { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "${range}" } };`,
      "\t},",
      "};",
      "",
    ],
    "\n"
  );

/** A `package.json` naming a package, with or without a version. */
const ManifestJson = S.fromJsonString(S.Struct({ name: S.String, version: S.optionalKey(S.String) }));
/** A JSON-quoted string, as `.modules.yaml` spells its keys and values. */
const JsonQuoted = S.fromJsonString(S.String);

/** A `package.json` naming `name` at `version`, or with no version at all. */
const manifestText = (name: string, version: string | undefined): Effect.Effect<string, S.SchemaError> =>
  S.encodeEffect(ManifestJson)(version === undefined ? { name } : { name, version });

/** Write `dir/package.json` with `name` and `version`, creating the directory, then the optional pnpmfile. */
const writePackage = Effect.fnUntraced(function* (
  dir: string,
  name: string,
  version: string | undefined,
  pnpmfile: Pnpmfile | undefined
): Effect.fn.Return<string, PlatformError.PlatformError, FixtureServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(dir, { recursive: true });
  const argument = path.join(dir, "package.json");
  const orDie1 = yield* Effect.orDie(manifestText(name, version));
  yield* fs.writeFileString(argument, orDie1);
  if (pnpmfile !== undefined) {
    yield* fs.writeFileString(path.join(dir, pnpmfile[0]), pnpmfile[1]);
  }
  return dir;
});

/** The `<root>/node_modules/.pnpm-config/<name>` directory. */
export const installedDir = Effect.fnUntraced(function* (
  root: string,
  name: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(root, "node_modules", ".pnpm-config", name);
});

/**
 * Install `name@version` under `.pnpm-config` as a REAL directory (not a
 * symlink), with an optional pnpmfile.
 */
export const installConfigDependency = Effect.fnUntraced(function* (
  root: string,
  name: string,
  version: string | undefined,
  pnpmfile?: Pnpmfile
): Effect.fn.Return<string, PlatformError.PlatformError, FixtureServices> {
  const installedDir1 = yield* installedDir(root, name);
  return yield* writePackage(installedDir1, name, version, pnpmfile);
});

/**
 * Populate a fake store with `name@version` under `hash`, with an optional
 * pnpmfile. Returns the package directory.
 */
export const storeConfigDependency = Effect.fnUntraced(function* (
  store: string,
  name: string,
  version: string,
  hash: string,
  pnpmfile?: Pnpmfile
): Effect.fn.Return<string, PlatformError.PlatformError, FixtureServices> {
  const path = yield* Path.Path;
  return yield* writePackage(
    path.join(store, "links", name, version, hash, "node_modules", name),
    name,
    version,
    pnpmfile
  );
});

/** Symlink `.pnpm-config/<name>` at the store's copy, the way pnpm installs a config dependency. */
export const linkConfigDependency = Effect.fnUntraced(function* (
  root: string,
  name: string,
  target: string
): Effect.fn.Return<void, PlatformError.PlatformError, FixtureServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const link = yield* installedDir(root, name);
  yield* fs.makeDirectory(path.dirname(link), { recursive: true });
  yield* fs.symlink(target, link);
});

/** Write `<root>/node_modules/.modules.yaml` naming `store` as pnpm does (quoted keys). */
export const writeModulesYaml = Effect.fnUntraced(function* (
  root: string,
  store: string
): Effect.fn.Return<void, PlatformError.PlatformError, FixtureServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(root, "node_modules");
  yield* fs.makeDirectory(dir, { recursive: true });
  yield* fs.writeFileString(
    path.join(dir, ".modules.yaml"),
    `"layoutVersion": 5\n"storeDir": ${yield* Effect.orDie(S.encodeEffect(JsonQuoted)(store))}\n`
  );
});

/**
 * The fake `pnpm` executable {@link writeFakePnpm} installs: a stand-in for
 * the fetch rung's `pnpm install --frozen-lockfile --dir <scratch>
 * [--store-dir <dir>]`, so no test drives a live package manager or reaches a
 * registry.
 *
 * It models the two things the rung relies on pnpm for. It reads the pinned
 * `<name>@<version>` and integrity out of the scratch lockfile, and refuses,
 * as pnpm does, when the "registry" (`FAKE_PNPM_PUBLISHED`, a JSON map of
 * `name@version` → the integrity of the tarball it serves) serves a tarball
 * that does not match. Otherwise it writes the version into
 * `<store-dir>/v11/links/<name>/<version>/<hash>/node_modules/<name>`, with a
 * pnpmfile injecting `hooked-dep` at `^<version>`, and links the scratch
 * workspace's `.pnpm-config/<name>` to it. Every run appends
 * `{ argv, lockfile, workspaceYaml, npmrc }` (`npmrc` null when the scratch
 * has none) as a JSON line to `FAKE_PNPM_LOG`. When `FAKE_PNPM_EXPECT_NPMRC` is
 * set, it refuses unless the scratch `.npmrc` holds exactly that text (the
 * empty string meaning "no `.npmrc` at all").
 */
const FAKE_PNPM = `#!/usr/bin/env node
const { appendFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const argv = process.argv.slice(2);
const option = (flag) => {
	const at = argv.indexOf(flag);
	return at === -1 ? undefined : argv[at + 1];
};
const scratch = option("--dir");
const lockfile = readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8");
const workspaceYaml = readFileSync(join(scratch, "pnpm-workspace.yaml"), "utf8");
const npmrcPath = join(scratch, ".npmrc");
const npmrc = existsSync(npmrcPath) ? readFileSync(npmrcPath, "utf8") : null;
appendFileSync(process.env.FAKE_PNPM_LOG, JSON.stringify({ argv, lockfile, workspaceYaml, npmrc }) + "\\n");
// Real pnpm reads the scratch's .npmrc for registry and auth: a declaring
// workspace with one must hand it over, byte for byte, and one without must
// not invent one.
const expected = process.env.FAKE_PNPM_EXPECT_NPMRC;
if (expected !== undefined && npmrc !== (expected === "" ? null : expected)) {
	process.stderr.write("FAKE_PNPM_NPMRC scratch .npmrc is " + JSON.stringify(npmrc) + ", expected " + JSON.stringify(expected || null) + "\\n");
	process.exit(1);
}
const key = JSON.parse(/^  ("[^"]+"):$/m.exec(lockfile)[1]);
const integrity = JSON.parse(/resolution: \\{integrity: ("[^"]+")\\}/.exec(lockfile)[1]);
const at = key.lastIndexOf("@");
const name = key.slice(0, at);
const version = key.slice(at + 1);
const served = JSON.parse(process.env.FAKE_PNPM_PUBLISHED || "{}")[key];
if (served === undefined) {
	process.stderr.write("ERR_PNPM_NO_MATCHING_VERSION No matching version found for " + key + "\\n");
	process.exit(1);
}
if (served !== integrity) {
	process.stderr.write("ERR_PNPM_TARBALL_INTEGRITY Got unexpected checksum for " + key + "\\n");
	process.exit(1);
}
const dir = join(option("--store-dir"), "v11", "links", name, version, "0".repeat(64), "node_modules", name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version }));
writeFileSync(
	join(dir, "pnpmfile.mjs"),
	"export const hooks = { updateConfig(config) { return { ...config, catalog: { ...(config.catalog ?? {}), \\"hooked-dep\\": \\"^" + version + "\\" } }; } };\\n",
);
const link = join(scratch, "node_modules", ".pnpm-config", name);
mkdirSync(dirname(link), { recursive: true });
symlinkSync(dir, link, "dir");
`;

/** Write the fake `pnpm` executable (see {@link FAKE_PNPM}) into `binDir`, for prepending to `PATH`. */
export const writeFakePnpm = Effect.fnUntraced(function* (
  binDir: string
): Effect.fn.Return<void, PlatformError.PlatformError, FixtureServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(binDir, { recursive: true });
  const pnpm = path.join(binDir, "pnpm");
  yield* fs.writeFileString(pnpm, FAKE_PNPM);
  yield* fs.chmod(pnpm, 0o755);
});
