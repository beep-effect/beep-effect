// @effect-diagnostics nodeBuiltinImport:skip-file
// PnpmEnvLockfile.packageManager: the package manager a pnpm-lock.yaml pins,
// read out of the env preamble (the FIRST of two YAML documents), and
// PnpmEnvLockfile.configDependencies: the config dependencies it records.
//
// The real fixtures are pnpm's own output, captured by probe on 2026-09-27:
//   env-pnpm12     pnpm 12.6.0, devEngines.packageManager only (no configDependencies)
//   env-pnpm11     pnpm 11.27.1, devEngines.packageManager only
//   env-configdeps pnpm 12.6.0, a +sha512 specifier and a configDependency
//   env-configdeps-pnpm11 / -pnpm12  pnpm 11.27.1 / 12.6.0, one bare
//                  configDependency beside an ordinary dependency: the shape
//                  the base side of effected#842 records
//   env-configonly-pnpm11 / -pnpm12  pnpm 11.28.0 / 12.7.0, a workspace with
//                  no package.json and one configDependency: the preamble
//                  then an EMPTY main document (effected#845)
// Both majors write the preamble with no configDependencies at all; a legacy
// `packageManager` field (or no declaration) writes a single document.
//
// The failure cases use a hand-built preamble whose default renders a valid
// lock (the positive control), then break exactly one edge per test — so each
// failure is the mutation's doing, not a broken builder.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { ConfigDependencyLock } from "../../effected/lockfiles/ConfigDependencyLock.ts";
import { LockfileFramingError, LockfileParseError } from "../../effected/lockfiles/Lockfile.ts";
import { PackageManagerLock } from "../../effected/lockfiles/PackageManagerLock.ts";
import { PnpmEnvLockfile } from "../../effected/lockfiles/PnpmEnvLockfile.ts";
import { isUnsupportedLockfileVersion } from "../../effected/lockfiles/UnsupportedLockfileVersion.ts";

const fixture = (relative: string): string =>
	readFileSync(join(import.meta.dirname, "fixtures", "pnpm", relative, "pnpm-lock.yaml"), "utf8");

const PNPM_12_SRI = "sha512-PvaPlRyxEawgS0paFvCy3fDaVqluBBPoHYVdnwtV75JnFHCQKOHNAMQFwsX7e56OxNxGd3yAXQNzwvL/AP0g7A==";
const PNPM_11_SRI = "sha512-qB1MIbmwmksK6/kO9eUn1CYr3aMi0mCCl4y1SQI6xtnK/Jixn/+qXHHbQ4pl9wIk7beNcxEYeGH/lkgNHNyiPA==";
const PLUGIN_0_11_1_SRI =
	"sha512-m35mtvgU4nbE8ZHd4EFqKu5jJeQY0gPUYHzKTno57JT/QeHzM9RRLNQsIcG0npsFYBxJfJ1tC/NH4zEWc2gdxQ==";
const EXE_LINUX_X64_12_SRI =
	"sha512-qFWBneHJAJ73W4whtbaFOL1M/7DBC6ILHXuxc7ZPtEhfPuT1zeZiGrmKHoMAfJA+mcm6xhOFljqVTUS+00Jabw==";

/** A well-formed SRI string, distinct per seed. */
const sri = (seed: string): string => `sha512-${seed.repeat(86).slice(0, 86)}==`;

interface PreambleOptions {
	readonly lockfileVersion?: string;
	readonly pmDeps?: string;
	readonly pnpmPackage?: string | null;
	readonly nativePackage?: string | null;
	readonly pnpmSnapshot?: string | null;
}

/**
 * Render a two-document pnpm-lock.yaml. Defaults describe a valid pnpm 12.6.0
 * lock with one native; each option replaces (or, with `null`, deletes) one
 * part of it.
 */
const preamble = (options: PreambleOptions = {}): string => {
	const pmDeps =
		options.pmDeps ??
		["    packageManagerDependencies:", "      pnpm:", "        specifier: 12.6.0", "        version: 12.6.0"].join(
			"\n",
		);
	const pnpmPackage =
		options.pnpmPackage === undefined
			? `  pnpm@12.6.0:\n    resolution: {integrity: ${sri("a")}}`
			: options.pnpmPackage;
	const nativePackage =
		options.nativePackage === undefined
			? `  '@pnpm/exe.linux-x64@12.6.0':\n    resolution: {integrity: ${sri("b")}}`
			: options.nativePackage;
	const pnpmSnapshot =
		options.pnpmSnapshot === undefined
			? "  pnpm@12.6.0:\n    optionalDependencies:\n      '@pnpm/exe.linux-x64': 12.6.0"
			: options.pnpmSnapshot;
	return [
		"---",
		`lockfileVersion: '${options.lockfileVersion ?? "9.0"}'`,
		"importers:",
		"  .:",
		pmDeps,
		"packages:",
		...(pnpmPackage === null ? [] : [pnpmPackage]),
		...(nativePackage === null ? [] : [nativePackage]),
		"snapshots:",
		"  '@pnpm/exe.linux-x64@12.6.0':\n    optional: true",
		...(pnpmSnapshot === null ? [] : [pnpmSnapshot]),
		"---",
		"lockfileVersion: '9.0'",
		"importers:",
		"  .: {}",
		"",
	].join("\n");
};

const lockOf = Effect.fn("lockOf")(function*(content: string) {
	const result = yield* PnpmEnvLockfile.packageManager(content);
	assert.isTrue(Option.isSome(result), "expected the lockfile to record a package manager");
	return Option.getOrThrow(result);
});

const validationError = Effect.fn("validationError")(function*(content: string) {
	const error = yield* Effect.flip(PnpmEnvLockfile.packageManager(content));
	assert.instanceOf(error, LockfileParseError);
	assert.strictEqual(error.format, "pnpm");
	assert.strictEqual(error.stage, "validation");
	return error;
});

const causeMessage = (error: LockfileParseError): string => (error.cause instanceof Error ? error.cause.message : "");

describe("PnpmEnvLockfile.packageManager", () => {
	describe("real pnpm output", () => {
		it.effect("pnpm 12: pnpm's integrity plus one native per platform, keyed without a version", () =>
			Effect.gen(function* () {
				const lock = yield* lockOf(fixture("env-pnpm12"));
				assert.instanceOf(lock, PackageManagerLock);
				assert.strictEqual(lock.name, "pnpm");
				assert.strictEqual(lock.specifier, "12.6.0");
				assert.strictEqual(lock.version, "12.6.0");
				assert.strictEqual(lock.integrity, PNPM_12_SRI);
				const names = Object.keys(lock.nativeIntegrity);
				assert.strictEqual(names.length, 14);
				assert.isTrue(names.every((name) => name.startsWith("@pnpm/exe.") && !name.includes("@12.6.0")));
				assert.strictEqual(lock.nativeIntegrity["@pnpm/exe.linux-x64"], EXE_LINUX_X64_12_SRI);
			}),
		);

		it.effect("pnpm 12 with configDependencies: the specifier keeps its +sha512 suffix verbatim", () =>
			Effect.gen(function* () {
				const lock = yield* lockOf(fixture("env-configdeps"));
				assert.isTrue(lock.specifier.startsWith("12.6.0+sha512.3ef68f951cb111ac"));
				assert.strictEqual(lock.version, "12.6.0");
				assert.strictEqual(lock.integrity, PNPM_12_SRI);
				assert.strictEqual(Object.keys(lock.nativeIntegrity).length, 14);
				assert.isFalse(Object.hasOwn(lock.nativeIntegrity, "@effected/pnpm-plugin-effect"));
			}),
		);

		it.effect("pnpm 11: pnpm's integrity and an empty native record (natives hang off @pnpm/exe)", () =>
			Effect.gen(function* () {
				const lock = yield* lockOf(fixture("env-pnpm11"));
				assert.strictEqual(lock.specifier, "11.27.1");
				assert.strictEqual(lock.version, "11.27.1");
				assert.strictEqual(lock.integrity, PNPM_11_SRI);
				assert.deepStrictEqual(lock.nativeIntegrity, {});
			}),
		);
	});

	describe("no package manager recorded → none", () => {
		it.effect("a single-document lockfile has no preamble", () =>
			Effect.gen(function* () {
				const result = yield* PnpmEnvLockfile.packageManager(fixture("v1"));
				assert.isTrue(Option.isNone(result));
			}),
		);

		it.effect("a single document is not a preamble even when it declares packageManagerDependencies", () =>
			Effect.gen(function* () {
				// The first document of a real two-document lockfile, alone: position,
				// not content, is what makes a document the preamble.
				const onlyPreamble = preamble().split("\n---\n")[0] ?? "";
				assert.include(onlyPreamble, "packageManagerDependencies");
				const result = yield* PnpmEnvLockfile.packageManager(onlyPreamble);
				assert.isTrue(Option.isNone(result));
			}),
		);

		it.effect("a preamble holding only configDependencies", () =>
			Effect.gen(function* () {
				const result = yield* PnpmEnvLockfile.packageManager(fixture("multidoc"));
				assert.isTrue(Option.isNone(result));
			}),
		);

		it.effect("a preamble whose packageManagerDependencies names no pnpm", () =>
			Effect.gen(function* () {
				const content = preamble({
					pmDeps: [
						"    packageManagerDependencies:",
						"      constructor:",
						"        specifier: 1.0.0",
						"        version: 1.0.0",
					].join("\n"),
				});
				const result = yield* PnpmEnvLockfile.packageManager(content);
				assert.isTrue(Option.isNone(result));
			}),
		);

		it.effect("empty content", () =>
			Effect.gen(function* () {
				const result = yield* PnpmEnvLockfile.packageManager("");
				assert.isTrue(Option.isNone(result));
			}),
		);
	});

	describe("a recorded package manager the lockfile cannot back fails typed", () => {
		it.effect("control: the unmutated preamble resolves", () =>
			Effect.gen(function* () {
				const lock = yield* lockOf(preamble());
				assert.strictEqual(lock.integrity, sri("a"));
				assert.deepStrictEqual(lock.nativeIntegrity, { "@pnpm/exe.linux-x64": sri("b") });
			}),
		);

		it.effect("the pnpm@<version> packages entry is missing", () =>
			Effect.gen(function* () {
				const error = yield* validationError(preamble({ pnpmPackage: null }));
				assert.include(causeMessage(error), '"pnpm@12.6.0"');
			}),
		);

		it.effect("the pnpm@<version> entry records no integrity", () =>
			validationError(preamble({ pnpmPackage: "  pnpm@12.6.0:\n    resolution: {tarball: x}" })),
		);

		it.effect("the pnpm integrity is not SRI (the corepack hex form)", () =>
			validationError(
				preamble({ pnpmPackage: `  pnpm@12.6.0:\n    resolution: {integrity: sha512.${"ab".repeat(64)}}` }),
			),
		);

		it.effect("the pnpm@<version> snapshot is missing", () =>
			Effect.gen(function* () {
				const error = yield* validationError(preamble({ pnpmSnapshot: null }));
				assert.include(causeMessage(error), "snapshots");
			}),
		);

		it.effect("a native the snapshot lists has no packages entry", () =>
			Effect.gen(function* () {
				const error = yield* validationError(preamble({ nativePackage: null }));
				assert.include(causeMessage(error), "@pnpm/exe.linux-x64@12.6.0");
			}),
		);

		it.effect("an empty recorded version", () =>
			validationError(
				preamble({
					pmDeps: [
						"    packageManagerDependencies:",
						"      pnpm:",
						"        specifier: 12.6.0",
						"        version: ''",
					].join("\n"),
				}),
			),
		);
	});

	describe("malformed input fails typed", () => {
		it.effect("a packageManagerDependencies entry of the wrong shape", () =>
			validationError(preamble({ pmDeps: "    packageManagerDependencies:\n      pnpm: 12.6.0" })),
		);

		it.effect("a preamble that is not a mapping", () =>
			validationError("--- 42\n---\nlockfileVersion: '9.0'\n"),
		);

		it.effect("broken YAML fails at stage 'syntax'", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(PnpmEnvLockfile.packageManager("importers:\n  - [unclosed\n\tflow"));
				assert.instanceOf(error, LockfileParseError);
				assert.strictEqual(error.stage, "syntax");
			}),
		);

		it.effect("a preamble below the supported lockfile version", () =>
			Effect.gen(function* () {
				const error = yield* validationError(preamble({ lockfileVersion: "6.0" }));
				assert.isTrue(isUnsupportedLockfileVersion(error.cause));
			}),
		);

		it.effect("more than two documents: no position identifies the preamble", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(PnpmEnvLockfile.packageManager(`${preamble()}---\nlockfileVersion: '9.0'\n`));
				assert.instanceOf(error, LockfileFramingError);
				assert.strictEqual(error.reason, "unexpectedDocuments");
				assert.strictEqual(error.documents, 3);
			}),
		);
	});

	describe("hostile keys", () => {
		it.effect("a native named __proto__ lands as an own key and pollutes nothing", () =>
			Effect.gen(function* () {
				const lock = yield* lockOf(
					preamble({
						nativePackage: `  '__proto__@12.6.0':\n    resolution: {integrity: ${sri("c")}}`,
						pnpmSnapshot: "  pnpm@12.6.0:\n    optionalDependencies:\n      __proto__: 12.6.0",
					}),
				);
				assert.isTrue(Object.hasOwn(lock.nativeIntegrity, "__proto__"));
				assert.strictEqual(Object.keys(lock.nativeIntegrity).length, 1);
				assert.strictEqual(({} as Record<string, unknown>).integrity, undefined);
			}),
		);
	});
});

/**
 * Render a two-document pnpm-lock.yaml recording config dependencies only.
 * The default records one valid entry; `importer` and `packages` replace the
 * two halves a test breaks.
 */
const configPreamble = (options: { readonly importer?: string; readonly packages?: string } = {}): string =>
	[
		"---",
		"lockfileVersion: '9.0'",
		"importers:",
		"  .:",
		options.importer ??
			["    configDependencies:", "      cfg:", "        specifier: 1.0.0", "        version: 1.0.0"].join("\n"),
		"packages:",
		options.packages ?? `  cfg@1.0.0:\n    resolution: {integrity: ${sri("d")}}`,
		"---",
		"",
	].join("\n");

const configValidationError = Effect.fn("configValidationError")(function*(content: string) {
	const error = yield* Effect.flip(PnpmEnvLockfile.configDependencies(content));
	assert.instanceOf(error, LockfileParseError);
	assert.strictEqual(error.format, "pnpm");
	assert.strictEqual(error.stage, "validation");
	return error;
});

describe("PnpmEnvLockfile.configDependencies", () => {
	describe("real pnpm output", () => {
		for (const major of ["pnpm11", "pnpm12"]) {
			it.effect(`${major}, a bare configDependency: the integrity lives only in the preamble`, () =>
				Effect.gen(function* () {
					const locks = yield* PnpmEnvLockfile.configDependencies(fixture(`env-configdeps-${major}`));
					assert.deepStrictEqual([...locks.keys()], ["@effected/pnpm-plugin-effect"]);
					const lock = locks.get("@effected/pnpm-plugin-effect");
					assert.instanceOf(lock, ConfigDependencyLock);
					assert.strictEqual(lock?.name, "@effected/pnpm-plugin-effect");
					assert.strictEqual(lock?.specifier, "0.11.1");
					assert.strictEqual(lock?.version, "0.11.1");
					assert.strictEqual(lock?.integrity, PLUGIN_0_11_1_SRI);
				}),
			);
		}

		for (const major of ["pnpm11", "pnpm12"]) {
			it.effect(`${major}, config dependencies only: the preamble reads ahead of an empty main document`, () =>
				Effect.gen(function* () {
					const content = fixture(`env-configonly-${major}`);
					const locks = yield* PnpmEnvLockfile.configDependencies(content);
					assert.deepStrictEqual([...locks.keys()], ["@effected/pnpm-plugin-effect"]);
					assert.strictEqual(locks.get("@effected/pnpm-plugin-effect")?.integrity, PLUGIN_0_11_1_SRI);
					// No devEngines, so the preamble records no package manager.
					assert.isTrue(Option.isNone(yield* PnpmEnvLockfile.packageManager(content)));
				}),
			);
		}

		it.effect("beside packageManagerDependencies, the package manager is not a config dependency", () =>
			Effect.gen(function* () {
				const locks = yield* PnpmEnvLockfile.configDependencies(fixture("env-configdeps"));
				assert.deepStrictEqual([...locks.keys()], ["@effected/pnpm-plugin-effect"]);
				assert.strictEqual(locks.get("@effected/pnpm-plugin-effect")?.integrity, PLUGIN_0_11_1_SRI);
			}),
		);
	});

	describe("no config dependencies recorded → empty", () => {
		it.effect("a single-document lockfile has no preamble", () =>
			Effect.gen(function* () {
				const locks = yield* PnpmEnvLockfile.configDependencies(fixture("v1"));
				assert.strictEqual(locks.size, 0);
			}),
		);

		it.effect("a preamble holding only packageManagerDependencies", () =>
			Effect.gen(function* () {
				const locks = yield* PnpmEnvLockfile.configDependencies(fixture("env-pnpm12"));
				assert.strictEqual(locks.size, 0);
			}),
		);

		it.effect("empty content", () =>
			Effect.gen(function* () {
				const locks = yield* PnpmEnvLockfile.configDependencies("");
				assert.strictEqual(locks.size, 0);
			}),
		);
	});

	describe("a recorded config dependency the lockfile cannot back fails typed", () => {
		it.effect("control: the unmutated preamble resolves", () =>
			Effect.gen(function* () {
				const locks = yield* PnpmEnvLockfile.configDependencies(configPreamble());
				assert.strictEqual(locks.get("cfg")?.integrity, sri("d"));
			}),
		);

		it.effect("the <name>@<version> packages entry is missing", () =>
			Effect.gen(function* () {
				const error = yield* configValidationError(configPreamble({ packages: "  other@1.0.0: {}" }));
				assert.include(causeMessage(error), '"cfg@1.0.0"');
			}),
		);

		it.effect("the entry records no integrity", () =>
			configValidationError(configPreamble({ packages: "  cfg@1.0.0:\n    resolution: {tarball: x}" })),
		);

		it.effect("the integrity is not SRI", () =>
			configValidationError(
				configPreamble({ packages: `  cfg@1.0.0:\n    resolution: {integrity: sha512.${"ab".repeat(64)}}` }),
			),
		);

		it.effect("an empty recorded version", () =>
			Effect.gen(function* () {
				const error = yield* configValidationError(
					configPreamble({
						importer: ["    configDependencies:", "      cfg:", "        specifier: 1.0.0", "        version: ''"].join(
							"\n",
						),
					}),
				);
				assert.include(causeMessage(error), "empty version");
			}),
		);

		it.effect("an entry of the wrong shape", () =>
			configValidationError(configPreamble({ importer: "    configDependencies:\n      cfg: 1.0.0" })),
		);

		it.effect("more than two documents fails through the framing channel", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PnpmEnvLockfile.configDependencies(
						`${configPreamble()}lockfileVersion: '9.0'\n---\nlockfileVersion: '9.0'\n`,
					),
				);
				assert.instanceOf(error, LockfileFramingError);
				assert.strictEqual(error.reason, "unexpectedDocuments");
			}),
		);
	});

	describe("hostile keys", () => {
		it.effect("a config dependency named __proto__ is an ordinary entry", () =>
			Effect.gen(function* () {
				const locks = yield* PnpmEnvLockfile.configDependencies(
					configPreamble({
						importer: [
							"    configDependencies:",
							"      __proto__:",
							"        specifier: 1.0.0",
							"        version: 1.0.0",
						].join("\n"),
						packages: `  '__proto__@1.0.0':\n    resolution: {integrity: ${sri("e")}}`,
					}),
				);
				assert.strictEqual(locks.get("__proto__")?.integrity, sri("e"));
				assert.strictEqual(locks.size, 1);
			}),
		);
	});
});
