// On-disk fixtures for the config-dependency resolution ladder: a fake
// `node_modules/.pnpm-config/<name>` install, a fake pnpm store `links/` tree,
// and the `.modules.yaml` that points one at the other. Real filesystem by
// necessity — the ladder reads through `node:fs`, never the effect
// `FileSystem`, because the store is real even when a test's FileSystem is not.

import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** A pnpmfile whose hook injects `hooked-dep` at `range` into the default catalog — the value proves WHICH file ran. */
export const pnpmfileInjecting = (range: string): string =>
	[
		"export const hooks = {",
		"\tupdateConfig(config) {",
		`\t\treturn { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "${range}" } };`,
		"\t},",
		"};",
		"",
	].join("\n");

/** The CommonJS spelling of {@link pnpmfileInjecting}, for a `pnpmfile.js` / `pnpmfile.cjs` candidate. */
export const pnpmfileInjectingCjs = (range: string): string =>
	[
		'"use strict";',
		"exports.hooks = {",
		"\tupdateConfig(config) {",
		`\t\treturn { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "${range}" } };`,
		"\t},",
		"};",
		"",
	].join("\n");

/** Write `dir/package.json` with `name` and `version`, creating the directory. */
export const writeManifest = (dir: string, name: string, version: string | undefined): void => {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify(version === undefined ? { name } : { name, version }));
};

/** The `<root>/node_modules/.pnpm-config/<name>` directory. */
export const installedDir = (root: string, name: string): string => join(root, "node_modules", ".pnpm-config", name);

/**
 * Install `name@version` under `.pnpm-config` as a REAL directory (not a
 * symlink), with an optional pnpmfile. `pnpmfile` is `[filename, source]`.
 */
export const installConfigDependency = (
	root: string,
	name: string,
	version: string | undefined,
	pnpmfile?: readonly [filename: string, source: string],
): string => {
	const dir = installedDir(root, name);
	writeManifest(dir, name, version);
	if (pnpmfile !== undefined) writeFileSync(join(dir, pnpmfile[0]), pnpmfile[1]);
	return dir;
};

/** The `<store>/links/<name>/<version>/<hash>/node_modules/<name>` directory. */
export const storeLinkDir = (store: string, name: string, version: string, hash: string): string =>
	join(store, "links", name, version, hash, "node_modules", name);

/**
 * Populate a fake store with `name@version` under `hash`, with an optional
 * pnpmfile. Returns the package directory.
 */
export const storeConfigDependency = (
	store: string,
	name: string,
	version: string,
	hash: string,
	pnpmfile?: readonly [filename: string, source: string],
): string => {
	const dir = storeLinkDir(store, name, version, hash);
	writeManifest(dir, name, version);
	if (pnpmfile !== undefined) writeFileSync(join(dir, pnpmfile[0]), pnpmfile[1]);
	return dir;
};

/** Symlink `.pnpm-config/<name>` at the store's copy, the way pnpm installs a config dependency. */
export const linkConfigDependency = (root: string, name: string, target: string): void => {
	const link = installedDir(root, name);
	mkdirSync(dirname(link), { recursive: true });
	symlinkSync(target, link, "dir");
};

/** Write `<root>/node_modules/.modules.yaml` naming `store` as pnpm does (quoted keys). */
export const writeModulesYaml = (root: string, store: string): void => {
	const dir = join(root, "node_modules");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, ".modules.yaml"), `"layoutVersion": 5\n"storeDir": ${JSON.stringify(store)}\n`);
};

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
export const writeFakePnpm = (binDir: string): void => {
	mkdirSync(binDir, { recursive: true });
	writeFileSync(join(binDir, "pnpm"), FAKE_PNPM, { mode: 0o755 });
};
