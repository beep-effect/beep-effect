// @effect-diagnostics nodeBuiltinImport:skip-file
// Per-format fixture tests: the ported corpus (pnpm v1–v3, npm v1–v2,
// yarn v1–v2, bun v1–v3) asserted against the unified model — package
// counts, workspace identification, integrity hashes, workspace dependency
// edges and extension payloads — plus the model's own instance surface
// (packagesNamed, workspacePackages) and the withImporterNames seam repair.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { Lockfile } from "../../effected/lockfiles/Lockfile.ts";
import type { LockfileFormat } from "../../effected/lockfiles/LockfileFormat.ts";
import { filenameFor } from "../../effected/lockfiles/LockfileFormat.ts";
import { ResolvedPackage } from "../../effected/lockfiles/ResolvedPackage.ts";
import { isUnsupportedLockfileVersion } from "../../effected/lockfiles/UnsupportedLockfileVersion.ts";

const fixture = (relative: string): string => readFileSync(join(import.meta.dirname, "fixtures", relative), "utf8");

/**
 * Fixture directories under this prefix hold input the parser must *reject*,
 * so they are expected to sit below their format's version gate. The prefix is
 * the single exclusion mechanism for the enumeration guard below.
 */
const NEGATIVE_FIXTURE_PREFIX = "unsupported-";

/**
 * pnpm fixture directories under this prefix were captured from a workspace
 * with **no root `package.json`**, so the caller reading them would assert
 * `configOnly`. The prefix is the marker the enumeration guard below reads to
 * pass that flag: a new config-only capture opts in by its name, and no other
 * fixture is ever parsed with the flag.
 */
const CONFIG_ONLY_FIXTURE_PREFIX = "env-configonly-";

const parseFixture = (relative: string, format: LockfileFormat, configOnly = false) =>
	Lockfile.parse(fixture(relative), { format, configOnly });

describe("Lockfile.parse", () => {
	describe("pnpm", () => {
		it.effect("v1: normalizes importers, packages, edges and the pnpm extension", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");

				assert.strictEqual(lockfile.format, "pnpm");
				assert.strictEqual(lockfile.lockfileVersion, "9.0");
				assert.strictEqual(lockfile.packages.length, 5);

				// Workspace packages are importer-path-keyed with version "0.0.0" —
				// the honest first stage; withImporterNames is the second.
				const workspaces = lockfile.workspacePackages;
				assert.deepStrictEqual(
					workspaces.map((p) => p.name),
					["packages/core", "packages/utils"],
				);
				assert.isTrue(workspaces.every((p) => p.version === "0.0.0"));
				assert.isTrue(workspaces.every((p) => p.relativePath === p.name));

				const chalk = lockfile.packagesNamed("chalk");
				assert.strictEqual(chalk.length, 1);
				assert.strictEqual(chalk[0]?.version, "5.6.2");
				assert.isFalse(chalk[0]?.isWorkspace);
				assert.isTrue(chalk[0]?.integrity?.startsWith("sha512-"));

				// The instance-id index answers the same object a scan would, so a
				// consumer walking resolved edges need not rebuild the map itself.
				const byId = lockfile.packageByInstanceId(chalk[0]?.instanceId ?? "");
				assert.isTrue(Option.isSome(byId));
				assert.strictEqual(Option.getOrUndefined(byId)?.name, "chalk");

				// A miss is None, not a throw and not a stray object member.
				assert.isTrue(Option.isNone(lockfile.packageByInstanceId("nope@0.0.0")));
				assert.isTrue(Option.isNone(lockfile.packageByInstanceId("__proto__")));
				assert.isTrue(Option.isNone(lockfile.packageByInstanceId("constructor")));

				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				const edge = lockfile.workspaceDependencies[0];
				assert.strictEqual(edge?.from, "packages/core");
				assert.strictEqual(edge?.to, "@test-monorepo/utils");
				assert.strictEqual(edge?.depType, "dependencies");
				assert.strictEqual(edge?.constraint, "workspace:*");

				assert.strictEqual(lockfile.extension?._tag, "pnpm");
				if (lockfile.extension?._tag === "pnpm") {
					assert.deepStrictEqual(lockfile.extension.catalogs?.default, {
						chalk: { specifier: "^5.3.0", version: "5.6.2" },
					});
					assert.deepStrictEqual(lockfile.extension.overrides, { lodash: "4.17.21" });
					assert.strictEqual(lockfile.extension.settings?.autoInstallPeers, true);
					assert.strictEqual(lockfile.extension.settings?.excludeLinksFromLockfile, false);
				}
			}),
		);

		it.effect("v2: carries named catalogs with specifier/version entries", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/v2/pnpm-lock.yaml", "pnpm");

				assert.strictEqual(lockfile.format, "pnpm");
				assert.deepStrictEqual(
					lockfile.workspacePackages.map((p) => p.name),
					["packages/core", "packages/new-pkg", "packages/utils"],
				);

				const edges = lockfile.workspaceDependencies;
				assert.deepStrictEqual(
					edges.map((e) => [e.from, e.to]),
					[
						["packages/core", "@test-monorepo/utils"],
						["packages/new-pkg", "@test-monorepo/utils"],
					],
				);

				assert.strictEqual(lockfile.extension?._tag, "pnpm");
				if (lockfile.extension?._tag === "pnpm") {
					const silk = lockfile.extension.catalogs?.silk;
					assert.isDefined(silk);
					for (const entry of Object.values(silk ?? {})) {
						assert.isObject(entry);
						assert.property(entry, "specifier");
						assert.property(entry, "version");
					}
				}

				// Peer-resolution suffixes in packages: keys must not corrupt the
				// name@version split: "fdir@6.5.0(picomatch@4.0.4)" is fdir at 6.5.0.
				assert.strictEqual(lockfile.packagesNamed("fdir")[0]?.version, "6.5.0");
				assert.strictEqual(lockfile.packagesNamed("@effect/platform")[0]?.version, "0.96.0");
				assert.strictEqual(lockfile.packagesNamed("@vitest/mocker")[0]?.version, "3.2.4");
				assert.isFalse(
					lockfile.packages.some(
						(p) => p.name.includes("(") || p.name.includes(")") || p.version.includes("(") || p.version.includes(")"),
					),
				);
			}),
		);

		it.effect("v3: parses the minimal modern lockfile", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/v3/pnpm-lock.yaml", "pnpm");

				assert.strictEqual(lockfile.packages.length, 4);
				assert.strictEqual(lockfile.workspacePackages.length, 2);
				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				assert.strictEqual(lockfile.packagesNamed("lodash")[0]?.version, "4.17.23");
				assert.strictEqual(lockfile.extension?._tag, "pnpm");
			}),
		);
	});

	describe("npm", () => {
		it.effect("v1: resolves workspace links to real names and versions", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/v1/package-lock.json", "npm");

				assert.strictEqual(lockfile.format, "npm");
				assert.strictEqual(lockfile.lockfileVersion, "3");
				assert.strictEqual(lockfile.packages.length, 5);

				const workspaces = lockfile.workspacePackages;
				assert.deepStrictEqual(
					workspaces.map((p) => [p.name, p.version, p.relativePath]),
					[
						["@test-monorepo/core", "1.0.0", "packages/core"],
						["@test-monorepo/utils", "1.0.0", "packages/utils"],
					],
				);

				assert.strictEqual(lockfile.packagesNamed("typescript")[0]?.version, "5.9.3");
				assert.isTrue(lockfile.packagesNamed("chalk")[0]?.integrity?.startsWith("sha512-"));

				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				const edge = lockfile.workspaceDependencies[0];
				assert.strictEqual(edge?.from, "@test-monorepo/core");
				assert.strictEqual(edge?.to, "@test-monorepo/utils");
				assert.strictEqual(edge?.constraint, "*");

				// npm records no format-specific extension.
				assert.isUndefined(lockfile.extension);
			}),
		);

		it.effect("v2: handles the three-workspace lockfile", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/v2/package-lock.json", "npm");

				assert.deepStrictEqual(
					lockfile.workspacePackages.map((p) => p.name),
					["@test-monorepo/core", "@test-monorepo/new-pkg", "@test-monorepo/utils"],
				);
				// 104 registry packages + 3 workspaces.
				assert.strictEqual(lockfile.packages.length, 107);
				assert.deepStrictEqual(
					lockfile.workspaceDependencies.map((e) => [e.from, e.to]),
					[
						["@test-monorepo/core", "@test-monorepo/utils"],
						["@test-monorepo/new-pkg", "@test-monorepo/utils"],
					],
				);
			}),
		);
	});

	describe("yarn (Berry)", () => {
		it.effect("v1: identifies soft-link workspaces including the root", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("yarn/v1/yarn.lock", "yarn");

				assert.strictEqual(lockfile.format, "yarn");
				assert.strictEqual(lockfile.lockfileVersion, "8");
				assert.strictEqual(lockfile.packages.length, 7);

				const workspaces = lockfile.workspacePackages;
				assert.deepStrictEqual(workspaces.map((p) => p.name).sort(), [
					"@test-monorepo/core",
					"@test-monorepo/utils",
					"test-yarn-monorepo",
				]);
				assert.isTrue(workspaces.every((p) => p.version === "0.0.0-use.local"));

				// The compound key "@test-monorepo/utils@workspace:*, ...@workspace:packages/utils"
				// yields the non-* path.
				const utils = lockfile.packagesNamed("@test-monorepo/utils")[0];
				assert.strictEqual(utils?.relativePath, "packages/utils");

				// Yarn Berry's `10c0/<hex>` cache checksums validate as an
				// `IntegrityHash` (the yarn textual form), so they are preserved.
				const chalk = lockfile.packagesNamed("chalk")[0];
				assert.strictEqual(chalk?.version, "5.6.2");
				assert.isTrue(chalk?.integrity?.startsWith("10c0/"));

				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				const edge = lockfile.workspaceDependencies[0];
				assert.strictEqual(edge?.from, "@test-monorepo/core");
				assert.strictEqual(edge?.to, "@test-monorepo/utils");
				assert.strictEqual(edge?.constraint, "workspace:*");

				assert.isUndefined(lockfile.extension);
			}),
		);

		it.effect("v2: extracts edges across three workspaces and strips npm: prefixes", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("yarn/v2/yarn.lock", "yarn");

				const workspaceNames = lockfile.workspacePackages.map((p) => p.name).sort();
				assert.deepStrictEqual(workspaceNames, [
					"@test-monorepo/core",
					"@test-monorepo/new-pkg",
					"@test-monorepo/utils",
					"test-yarn-monorepo",
				]);

				assert.deepStrictEqual(lockfile.workspaceDependencies.map((e) => [e.from, e.to]).sort(), [
					["@test-monorepo/core", "@test-monorepo/utils"],
					["@test-monorepo/new-pkg", "@test-monorepo/utils"],
				]);

				// typescript resolves through both @npm: and @patch: descriptors.
				assert.isAtLeast(lockfile.packagesNamed("typescript").length, 2);
			}),
		);
	});

	describe("bun", () => {
		it.effect("v1: reads workspaces, package tuples and the bun extension", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/v1/bun.lock", "bun");

				assert.strictEqual(lockfile.format, "bun");
				assert.strictEqual(lockfile.lockfileVersion, "1");
				// 2 workspaces + 5 registry tuples (the workspace tuples are
				// deduplicated against the workspaces map).
				assert.strictEqual(lockfile.packages.length, 7);

				const workspaces = lockfile.workspacePackages;
				assert.deepStrictEqual(
					workspaces.map((p) => [p.name, p.version, p.relativePath]),
					[
						["@test-monorepo/core", "1.0.0", "packages/core"],
						["@test-monorepo/utils", "1.0.0", "packages/utils"],
					],
				);

				// Integrity is assumed at tuple index 3 (the pinned bun tuple shape).
				const chalk = lockfile.packagesNamed("chalk")[0];
				assert.strictEqual(chalk?.version, "5.6.2");
				assert.isTrue(chalk?.integrity?.startsWith("sha512-"));

				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				assert.strictEqual(lockfile.workspaceDependencies[0]?.from, "@test-monorepo/core");
				assert.strictEqual(lockfile.workspaceDependencies[0]?.to, "@test-monorepo/utils");

				assert.strictEqual(lockfile.extension?._tag, "bun");
				if (lockfile.extension?._tag === "bun") {
					assert.deepStrictEqual(lockfile.extension.catalog, { react: "^19.0.0", "react-dom": "^19.0.0" });
					assert.isUndefined(lockfile.extension.catalogs);
					assert.isUndefined(lockfile.extension.trustedDependencies);
				}
			}),
		);

		it.effect("v2: carries both the default catalog and named catalogs", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/v2/bun.lock", "bun");

				assert.deepStrictEqual(
					lockfile.workspacePackages.map((p) => p.name),
					["@test-monorepo/core", "@test-monorepo/new-pkg", "@test-monorepo/utils"],
				);
				assert.deepStrictEqual(
					lockfile.workspaceDependencies.map((e) => [e.from, e.to]),
					[
						["@test-monorepo/core", "@test-monorepo/utils"],
						["@test-monorepo/new-pkg", "@test-monorepo/utils"],
					],
				);

				assert.strictEqual(lockfile.extension?._tag, "bun");
				if (lockfile.extension?._tag === "bun") {
					assert.deepStrictEqual(lockfile.extension.catalog, {
						react: "^19.1.0",
						"react-dom": "^19.1.0",
						zod: "^3.23.0",
					});
					assert.deepStrictEqual(lockfile.extension.catalogs, { testing: { vitest: "^3.0.0" } });
				}
			}),
		);

		it.effect("v3: parses the minimal lockfile", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/v3/bun.lock", "bun");

				assert.strictEqual(lockfile.packages.length, 4);
				assert.strictEqual(lockfile.workspacePackages.length, 2);
				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				assert.strictEqual(lockfile.packagesNamed("react")[0]?.version, "19.2.4");
			}),
		);
	});
});

describe("Lockfile instance surface", () => {
	it.effect("packagesNamed returns every resolved version and [] for unknown names", () =>
		Effect.gen(function* () {
			const lockfile = yield* parseFixture("yarn/v2/yarn.lock", "yarn");
			assert.isAtLeast(lockfile.packagesNamed("typescript").length, 2);
			assert.deepStrictEqual(lockfile.packagesNamed("not-in-the-lockfile"), []);
			// Repeated lookups hit the same lazily built index.
			assert.strictEqual(lockfile.packagesNamed("typescript"), lockfile.packagesNamed("typescript"));
		}),
	);

	it.effect("workspacePackages filters on isWorkspace", () =>
		Effect.gen(function* () {
			const lockfile = yield* parseFixture("npm/v1/package-lock.json", "npm");
			assert.strictEqual(lockfile.workspacePackages.length, 2);
			assert.isTrue(lockfile.workspacePackages.every((p) => p.isWorkspace));
		}),
	);
});

describe("Lockfile#withImporterNames (seam repair 1)", () => {
	const names = new Map([
		["packages/core", "@test-monorepo/core"],
		["packages/utils", "@test-monorepo/utils"],
	]);

	it.effect("renames pnpm workspace packages and rewrites both edge ends", () =>
		Effect.gen(function* () {
			const parsed = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");
			const lockfile = parsed.withImporterNames(names);

			assert.deepStrictEqual(
				lockfile.workspacePackages.map((p) => [p.name, p.relativePath]),
				[
					["@test-monorepo/core", "packages/core"],
					["@test-monorepo/utils", "packages/utils"],
				],
			);
			// Versions stay "0.0.0": the map carries names only.
			assert.isTrue(lockfile.workspacePackages.every((p) => p.version === "0.0.0"));

			const edge = lockfile.workspaceDependencies[0];
			assert.strictEqual(edge?.from, "@test-monorepo/core");
			assert.strictEqual(edge?.to, "@test-monorepo/utils");

			// Registry packages and the extension are untouched.
			assert.strictEqual(lockfile.packagesNamed("chalk")[0]?.version, "5.6.2");
			assert.strictEqual(lockfile.extension?._tag, "pnpm");

			// The name index reflects the rewritten names.
			assert.strictEqual(lockfile.packagesNamed("@test-monorepo/core").length, 1);
			assert.deepStrictEqual(lockfile.packagesNamed("packages/core"), []);

			// The original instance is untouched (pure, not in-place).
			assert.strictEqual(parsed.workspacePackages[0]?.name, "packages/core");

			// Importers are path-keyed, so the rename deliberately leaves them
			// untouched — pinning the design's "withImporterNames does not touch
			// importers" invariant (importers are the join key, not renamed).
			assert.isTrue(parsed.importers.length > 0);
			assert.deepStrictEqual(lockfile.importers, parsed.importers);
		}),
	);

	it.effect("keeps path names for entries not in the map", () =>
		Effect.gen(function* () {
			const parsed = yield* parseFixture("pnpm/v2/pnpm-lock.yaml", "pnpm");
			const lockfile = parsed.withImporterNames(names);

			assert.deepStrictEqual(
				lockfile.workspacePackages.map((p) => p.name),
				["@test-monorepo/core", "packages/new-pkg", "@test-monorepo/utils"],
			);
			// The unmapped importer's edge keeps its path-named end.
			assert.deepStrictEqual(
				lockfile.workspaceDependencies.map((e) => [e.from, e.to]),
				[
					["@test-monorepo/core", "@test-monorepo/utils"],
					["packages/new-pkg", "@test-monorepo/utils"],
				],
			);
		}),
	);

	it.effect("leaves non-pnpm lockfiles unaffected", () =>
		Effect.gen(function* () {
			const parsed = yield* parseFixture("npm/v1/package-lock.json", "npm");
			const lockfile = parsed.withImporterNames(new Map([["not-a-path", "renamed"]]));

			assert.deepStrictEqual(
				lockfile.workspacePackages.map((p) => p.name),
				parsed.workspacePackages.map((p) => p.name),
			);
			assert.deepStrictEqual(
				lockfile.workspaceDependencies.map((e) => [e.from, e.to]),
				parsed.workspaceDependencies.map((e) => [e.from, e.to]),
			);
		}),
	);

	it.effect("is a no-op for an empty map", () =>
		Effect.gen(function* () {
			const parsed = yield* parseFixture("pnpm/v3/pnpm-lock.yaml", "pnpm");
			const lockfile = parsed.withImporterNames(new Map());
			assert.deepStrictEqual(
				lockfile.workspacePackages.map((p) => p.name),
				parsed.workspacePackages.map((p) => p.name),
			);
		}),
	);
});

// Peer declarations. The fixtures under `<format>/peers/` were generated by the
// real package managers (pnpm 11.22.0, npm 11.19.0, bun 1.3.14, yarn 4.9.1) over
// one workspace: an app pinning react@17.0.2 against react-dom@18.3.1 (an unmet
// required peer), react-redux@9.2.0 (two *optional* peers), and a workspace
// library declaring one required and two optional peers of its own.
describe("peer declarations", () => {
	const named = (lockfile: Lockfile, name: string) => {
		const found = lockfile.packagesNamed(name);
		assert.strictEqual(found.length, 1, `expected exactly one ${name}`);
		return found[0];
	};

	describe("pnpm", () => {
		it.effect("carries packages: peerDependencies and peerDependenciesMeta", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");

				const reactDom = named(lockfile, "react-dom");
				assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
				assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

				const reactRedux = named(lockfile, "react-redux");
				assert.deepStrictEqual(reactRedux?.peerDependencies, {
					"@types/react": "^18.2.25 || ^19",
					react: "^18.0 || ^19",
					redux: "^5.0.0",
				});
				assert.deepStrictEqual(reactRedux?.peerDependenciesMeta, {
					"@types/react": { optional: true },
					redux: { optional: true },
				});
			}),
		);

		it.effect("gives a package declaring no peers empty records, never undefined", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");
				const chalk = named(lockfile, "chalk");
				assert.deepStrictEqual(chalk?.peerDependencies, {});
				assert.deepStrictEqual(chalk?.peerDependenciesMeta, {});
				// pnpm records a workspace project's resolved dependencies only —
				// never its own peer declarations — so workspace rows keep the
				// empty defaults.
				assert.isTrue(lockfile.workspacePackages.every((p) => Object.keys(p.peerDependencies).length === 0));
			}),
		);
	});

	describe("npm", () => {
		it.effect("carries node_modules entry peers, with optional flags", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/peers/package-lock.json", "npm");

				const reactDom = named(lockfile, "react-dom");
				assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
				assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

				const reactRedux = named(lockfile, "react-redux");
				assert.strictEqual(reactRedux?.peerDependencies.react, "^18.0 || ^19");
				assert.deepStrictEqual(reactRedux?.peerDependenciesMeta, {
					"@types/react": { optional: true },
					redux: { optional: true },
				});
			}),
		);

		it.effect("carries a workspace package's peers off its resolved path entry", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/peers/package-lock.json", "npm");
				const lib = named(lockfile, "@peers/lib");
				assert.isTrue(lib?.isWorkspace);
				assert.deepStrictEqual(lib?.peerDependencies, {
					"left-pad": "^1.3.0",
					react: "^18.0.0",
					typescript: "^5.0.0",
				});
				assert.deepStrictEqual(lib?.peerDependenciesMeta, {
					"left-pad": { optional: true },
					typescript: { optional: true },
				});
				// A required peer carries no meta entry at all.
				assert.isUndefined(lib?.peerDependenciesMeta.react);
			}),
		);
	});

	describe("bun", () => {
		it.effect("normalizes the package tuple's optionalPeers array into meta", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/peers/bun.lock", "bun");

				const reactDom = named(lockfile, "react-dom");
				assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
				assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

				// bun spells optional peers as `optionalPeers: ["@types/react", "redux"]`;
				// the model normalizes that to the same meta shape every other format uses.
				const reactRedux = named(lockfile, "react-redux");
				assert.strictEqual(reactRedux?.peerDependencies.redux, "^5.0.0");
				assert.deepStrictEqual(reactRedux?.peerDependenciesMeta, {
					"@types/react": { optional: true },
					redux: { optional: true },
				});
			}),
		);

		it.effect("normalizes a workspace entry's optionalPeers array into meta", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/peers/bun.lock", "bun");
				const lib = named(lockfile, "@peers/lib");
				assert.isTrue(lib?.isWorkspace);
				assert.deepStrictEqual(lib?.peerDependencies, {
					"left-pad": "^1.3.0",
					react: "^18.0.0",
					typescript: "^5.0.0",
				});
				assert.deepStrictEqual(lib?.peerDependenciesMeta, {
					"left-pad": { optional: true },
					typescript: { optional: true },
				});
			}),
		);
	});

	describe("yarn", () => {
		it.effect("carries entry peers and peerDependenciesMeta", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("yarn/peers/yarn.lock", "yarn");

				const reactDom = named(lockfile, "react-dom");
				assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
				assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

				const lib = named(lockfile, "@peers/lib");
				assert.isTrue(lib?.isWorkspace);
				assert.deepStrictEqual(lib?.peerDependencies, {
					"left-pad": "^1.3.0",
					react: "^18.0.0",
					typescript: "^5.0.0",
				});
				assert.deepStrictEqual(lib?.peerDependenciesMeta, {
					"left-pad": { optional: true },
					typescript: { optional: true },
				});
			}),
		);
	});

	it("defaults every map field to {} at construction", () => {
		const pkg = ResolvedPackage.make({ name: "solo", version: "1.0.0", instanceId: "solo@1.0.0", isWorkspace: false });
		assert.deepStrictEqual(pkg.peerDependencies, {});
		assert.deepStrictEqual(pkg.peerDependenciesMeta, {});
		assert.deepStrictEqual(pkg.resolved, {});
	});
});

// Instance identity and resolved edges. These fixtures were generated by the
// real managers over trees built to *duplicate* a package, which is the only
// way the difference between a package and a package instance shows up:
// `pnpm/variants` installs react-dom against two different reacts,
// and one shared `nested` workspace shadows two names twice over in both npm
// and bun: react@18.3.1 under a workspace directory against a hoisted 17.0.2,
// and ms@2.0.0 under debug against a hoisted 2.1.3.
describe("instance identity and resolved edges", () => {
	const instance = (lockfile: Lockfile, name: string, version: string) => {
		const found = lockfile.packagesNamed(name).filter((p) => p.version === version);
		assert.strictEqual(found.length, 1, `expected exactly one ${name}@${version}`);
		return found[0] as ResolvedPackage;
	};

	describe("pnpm", () => {
		it.effect("v9: two peer-resolved variants of one package are two instances", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/variants/pnpm-lock.yaml", "pnpm");

				// `packages:` carries ONE react-dom entry; `snapshots:` carries two.
				// Rows follow snapshots, because that is where an instance lives.
				const variants = lockfile.packagesNamed("react-dom");
				assert.deepStrictEqual(variants.map((p) => p.instanceId).sort(), [
					"react-dom@18.3.1(react@17.0.2)",
					"react-dom@18.3.1(react@18.3.1)",
				]);
				assert.isTrue(variants.every((p) => p.version === "18.3.1"));
				// The peer declaration is joined on from the per-version `packages:`
				// entry, so both instances still carry it.
				assert.isTrue(variants.every((p) => p.peerDependencies.react === "^18.3.1"));

				// Each variant resolved a *different* react, which is the entire point.
				const old = variants.find((p) => p.instanceId.includes("(react@17.0.2)")) as ResolvedPackage;
				const fresh = variants.find((p) => p.instanceId.includes("(react@18.3.1)")) as ResolvedPackage;
				assert.strictEqual(old.resolved.react, "react@17.0.2");
				assert.strictEqual(fresh.resolved.react, "react@18.3.1");
				assert.strictEqual(instance(lockfile, "react", "17.0.2").instanceId, "react@17.0.2");
			}),
		);

		it.effect("v9: an importer resolves registry and link: edges to instance ids", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");
				const app = lockfile.packagesNamed("packages/app")[0] as ResolvedPackage;

				assert.strictEqual(app.instanceId, "packages/app");
				assert.strictEqual(app.resolved["react-dom"], "react-dom@18.3.1(react@17.0.2)");
				// `link:../lib` is normalized against the importer's own path, and
				// emitted only because `packages/lib` is a real instance id.
				assert.strictEqual(app.resolved["@peers/lib"], "packages/lib");
			}),
		);

		it.effect("resolves a link: peer edge, whose identity pnpm spells two different ways", () =>
			Effect.gen(function* () {
				// Generated with pnpm 11.22.0 from a workspace overriding `react` to
				// `link:packages/fakereact`, so a REGISTRY package's peer is satisfied
				// by a linked workspace directory.
				//
				// pnpm records that one edge in two spellings, and neither composes:
				// the snapshot body keeps a readable `react: link:packages/fakereact`,
				// while the key's peer suffix carries a mangled identity —
				// `react-redux@9.2.0(react@packages+fakereact)` — that appears nowhere
				// as a key. Dropping the edge is not a harmless gap: one layer up, a
				// peer with no recorded provider reads as an UNSATISFIED peer, so a
				// satisfied link became a false positive.
				const lockfile = yield* parseFixture("pnpm/linkedpeer/pnpm-lock.yaml", "pnpm");
				const byId = new Map(lockfile.packages.map((p) => [p.instanceId, p]));

				const redux = byId.get("react-redux@9.2.0(react@packages+fakereact)") as ResolvedPackage;
				assert.strictEqual(redux.peerDependencies.react, "^18.0 || ^19");
				// The snapshot's `link:` target is recorded relative to the workspace
				// ROOT, and a workspace importer's instance id is its path.
				assert.strictEqual(redux.resolved.react, "packages/fakereact");
				assert.isTrue(byId.get("packages/fakereact")?.isWorkspace);

				// Transitively too — the same edge appears on the nested consumer.
				const nested = byId.get("use-sync-external-store@1.6.0(react@packages+fakereact)") as ResolvedPackage;
				assert.strictEqual(nested.resolved.react, "packages/fakereact");
			}),
		);

		it.effect("names a recorded-but-unnameable edge, and only that one", () =>
			Effect.gen(function* () {
				// Generated with pnpm 11.22.0 from this repository's own shape: an
				// override pointing a registry name at `link:vendor/react-stub`, a
				// directory that is NOT a workspace importer — the same class as our
				// dogfood overrides linking to `packages/<pkg>/dist/dev/pkg`.
				//
				// One snapshot carries all three cases, which is what makes each
				// assertion discriminating rather than incidental:
				//   resolves               `@types/use-sync-external-store: 0.0.6`
				//   recorded, unnameable   `react: link:vendor/react-stub`
				//   genuinely absent       `redux` — a declared peer the snapshot
				//                          records no edge for at all
				const lockfile = yield* parseFixture("pnpm/unnameablelink/pnpm-lock.yaml", "pnpm");
				const redux = lockfile.packagesNamed("react-redux")[0] as ResolvedPackage;

				// 1. Resolved edges are unaffected.
				assert.strictEqual(redux.resolved["@types/use-sync-external-store"], "@types/use-sync-external-store@0.0.6");

				// 2. The recorded-but-unnameable edge is NAMED. Without this the
				//    absence of `react` from `resolved` is indistinguishable from
				//    "nothing resolved", and a peer check reports an unsatisfied peer
				//    for a peer that is satisfied by a link.
				assert.deepStrictEqual(redux.unresolvedEdges, ["react"]);
				assert.isUndefined(redux.resolved.react);

				// 3. A declared peer the lockfile records NO edge for is an absence,
				//    not an unresolved edge — it must not appear. A field that fired
				//    for every unsatisfied peer would be a signal nobody reads.
				assert.deepStrictEqual(redux.peerDependencies.redux, "^5.0.0");
				assert.isFalse(redux.unresolvedEdges.includes("redux"));
				assert.isFalse(redux.unresolvedEdges.includes("@types/react"));
			}),
		);

		it.effect("leaves unresolvedEdges empty when every recorded edge resolves", () =>
			Effect.gen(function* () {
				// The other half: the linked-peer fixture's target IS an importer, so
				// nothing is unnameable there.
				const lockfile = yield* parseFixture("pnpm/linkedpeer/pnpm-lock.yaml", "pnpm");
				assert.isTrue(lockfile.packages.every((p) => p.unresolvedEdges.length === 0));
			}),
		);

		it.effect("resolves a workspace: link into a package's publish directory to that importer", () =>
			Effect.gen(function* () {
				// pnpm's `publishConfig.linkDirectory` records a workspace link against
				// the package's PUBLISH directory, not its root:
				//
				//   '@savvy-web/bundler':
				//     specifier: workspace:*
				//     version: link:../bundler/dist/dev/pkg
				//
				// `packages/bundler` is an importer; `packages/bundler/dist/dev/pkg` is a
				// build output and never will be. Leaving the edge unnameable makes every
				// such workspace permanently unverifiable downstream, on a lockfile pnpm
				// itself reports as clean (savvy-web/systems: 25 such edges, 12 packages).
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/app:",
					"    devDependencies:",
					"      '@scope/lib':",
					"        specifier: workspace:*",
					"        version: link:../lib/dist/dev/pkg",
					"  packages/lib: {}",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const app = lockfile.packagesNamed("packages/app")[0];

				assert.strictEqual(app?.resolved["@scope/lib"], "packages/lib");
				assert.deepStrictEqual(app?.unresolvedEdges, []);
			}),
		);

		it.effect("declines a publish-directory link whose specifier is not workspace:", () =>
			Effect.gen(function* () {
				// The discriminating half: identical TARGET, different specifier. A
				// hand-written `link:` names a directory pnpm never claimed belongs to a
				// workspace package — it may hold a vendored stub with its own identity —
				// so naming the enclosing importer would answer with the wrong package's
				// peers rather than admit the edge could not be named.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/app:",
					"    devDependencies:",
					"      '@scope/stub':",
					"        specifier: link:../lib/vendor/stub",
					"        version: link:../lib/vendor/stub",
					"  packages/lib: {}",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const app = lockfile.packagesNamed("packages/app")[0];

				assert.isUndefined(app?.resolved["@scope/stub"]);
				assert.deepStrictEqual(app?.unresolvedEdges, ["@scope/stub"]);
			}),
		);

		it.effect("a publish-directory link resolves to the NEAREST enclosing importer", () =>
			Effect.gen(function* () {
				// Nested importers: the owner is the longest ancestor that is one, so a
				// package nested inside another package's tree is not swallowed by its
				// parent. The root importer is excluded outright — it is an ancestor of
				// every path, so admitting it would resolve every stray link to the root.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/app:",
					"    dependencies:",
					"      '@scope/inner':",
					"        specifier: workspace:*",
					"        version: link:../lib/nested/inner/dist/pkg",
					"      '@scope/nowhere':",
					"        specifier: workspace:*",
					"        version: link:../../elsewhere/dist/pkg",
					"  packages/lib: {}",
					"  packages/lib/nested/inner: {}",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const app = lockfile.packagesNamed("packages/app")[0];

				assert.strictEqual(app?.resolved["@scope/inner"], "packages/lib/nested/inner");
				// Under no importer at all: still unnameable, even under `workspace:`.
				assert.isUndefined(app?.resolved["@scope/nowhere"]);
				assert.deepStrictEqual(app?.unresolvedEdges, ["@scope/nowhere"]);
			}),
		);

		it.effect("emits no edge for a link: target that is not an importer", () =>
			Effect.gen(function* () {
				// The honest half of the same rule. A `link:` target that names no
				// instance — a plain directory rather than a workspace importer —
				// still resolves to nothing, because compose-then-verify emits only
				// what it can match. Widening what legitimately matches must not
				// soften verification into "compose and hope".
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"packages:",
					"  host@1.0.0: {}",
					"snapshots:",
					"  host@1.0.0:",
					"    dependencies:",
					"      ghost: link:build/output/dir",
					// The same rule on the OTHER composition path: a plain
					// `name@version` naming no snapshot must not resolve either.
					"      phantom: 9.9.9",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const host = lockfile.packagesNamed("host")[0];

				assert.deepStrictEqual(host?.resolved, {});
				// Both are RECORDED edges, so both are named rather than dropped.
				assert.deepStrictEqual(host?.unresolvedEdges, ["ghost", "phantom"]);
			}),
		);

		it.effect("resolves the alias edges pnpm itself records (real fixture)", () =>
			Effect.gen(function* () {
				// Generated with pnpm 11.22.0: `glob@10.4.5` pulls in `@isaacs/cliui`,
				// whose snapshot body records four aliased edges the ecosystem ships
				// every day (`string-width-cjs: string-width@4.2.3`, ...), and the
				// root importer declares `semver-classic: npm:semver@7.6.3`. Before
				// the alias reading, every one of those landed in unresolvedEdges —
				// on a lockfile pnpm reports as clean.
				const lockfile = yield* parseFixture("pnpm/alias/pnpm-lock.yaml", "pnpm");
				const cliui = lockfile.packagesNamed("@isaacs/cliui")[0] as ResolvedPackage;

				assert.strictEqual(cliui.resolved["string-width-cjs"], "string-width@4.2.3");
				assert.strictEqual(cliui.resolved["strip-ansi-cjs"], "strip-ansi@6.0.1");
				// And the whole lockfile is as clean as pnpm says it is.
				assert.isTrue(lockfile.packages.every((p) => p.unresolvedEdges.length === 0));
			}),
		);

		it.effect("resolves the publish-directory link pnpm itself records (real fixture)", () =>
			Effect.gen(function* () {
				// Generated with pnpm 11.22.0: `packages/react` declares
				// `publishConfig.directory: dist/pkg` (+ linkDirectory), so the
				// registry `react-dom`'s satisfied peer is recorded in its snapshot
				// body as `react: link:packages/react/dist/pkg` — a build output that
				// is no importer, with no specifier beside it. The importer entry's
				// own `publishDirectory: dist/pkg` is the evidence that names it.
				const lockfile = yield* parseFixture("pnpm/publishdir/pnpm-lock.yaml", "pnpm");
				const byId = new Map(lockfile.packages.map((p) => [p.instanceId, p]));

				const reactDom = byId.get("react-dom@18.2.0(react@packages+react+dist+pkg)") as ResolvedPackage;
				assert.strictEqual(reactDom.resolved.react, "packages/react");
				// The importer path resolves the same target — the map answers before
				// the `workspace:`-gated ancestor walk has to.
				const app = lockfile.packagesNamed("packages/app")[0];
				assert.strictEqual(app?.resolved.react, "packages/react");
				assert.isTrue(lockfile.packages.every((p) => p.unresolvedEdges.length === 0));
			}),
		);

		it.effect("resolves an npm: alias in an importer section by the recorded version", () =>
			Effect.gen(function* () {
				// pnpm records an aliased dependency (`npm:typescript@^6.0.3`) with the
				// REFERENCED package's identity as the version: `typescript@6.0.3`. The
				// bare composition `typescript-classic@typescript@6.0.3` matches
				// nothing, so the edge used to land in unresolvedEdges — a false
				// fail-closed marker on a lockfile pnpm itself reports as clean
				// (spencerbeggs/type-registry-effect is the real reproduction).
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/app:",
					"    devDependencies:",
					"      typescript-classic:",
					"        specifier: npm:typescript@^6.0.3",
					"        version: typescript@6.0.3",
					"packages:",
					"  typescript@6.0.3: {}",
					"snapshots:",
					"  typescript@6.0.3: {}",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const app = lockfile.packagesNamed("packages/app")[0];

				// The recorded version IS the referenced instance's key.
				assert.strictEqual(app?.resolved["typescript-classic"], "typescript@6.0.3");
				assert.deepStrictEqual(app?.unresolvedEdges, []);
			}),
		);

		it.effect("resolves an npm: alias in a snapshot body, with and without a peer suffix", () =>
			Effect.gen(function* () {
				// Snapshot bodies record aliases the same way — `name: realname@realversion`,
				// the peer-resolution suffix included when one applies — with no
				// specifier beside them. The recorded version being the referenced
				// instance's key is exact evidence on both paths; a plain version like
				// `9.9.9` never is one (instance ids always carry a name), so the
				// dangling control must stay unresolved.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"packages:",
					"  host@1.0.0: {}",
					"  typescript@6.0.3: {}",
					"  react-dom@18.3.1: {}",
					"  react@18.3.1: {}",
					"snapshots:",
					"  host@1.0.0:",
					"    dependencies:",
					"      typescript-classic: typescript@6.0.3",
					"      renderer: react-dom@18.3.1(react@18.3.1)",
					"      phantom: 9.9.9",
					"  typescript@6.0.3: {}",
					"  react-dom@18.3.1(react@18.3.1): {}",
					"  react@18.3.1: {}",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const host = lockfile.packagesNamed("host")[0];

				assert.strictEqual(host?.resolved["typescript-classic"], "typescript@6.0.3");
				assert.strictEqual(host?.resolved.renderer, "react-dom@18.3.1(react@18.3.1)");
				assert.deepStrictEqual(host?.unresolvedEdges, ["phantom"]);
			}),
		);

		it.effect("resolves an aliased importer edge that carries a peer suffix", () =>
			Effect.gen(function* () {
				// The importer-section spelling of the suffixed case: the recorded
				// version names the peer-resolved INSTANCE, suffix and all, and that
				// full string is the key it must match.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/app:",
					"    dependencies:",
					"      renderer:",
					"        specifier: npm:react-dom@^18.0.0",
					"        version: react-dom@18.3.1(react@18.3.1)",
					"packages:",
					"  react-dom@18.3.1: {}",
					"  react@18.3.1: {}",
					"snapshots:",
					"  react-dom@18.3.1(react@18.3.1): {}",
					"  react@18.3.1: {}",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const app = lockfile.packagesNamed("packages/app")[0];

				assert.strictEqual(app?.resolved.renderer, "react-dom@18.3.1(react@18.3.1)");
				assert.deepStrictEqual(app?.unresolvedEdges, []);
			}),
		);

		it.effect("resolves a snapshot link: into a declared publishDirectory to its importer", () =>
			Effect.gen(function* () {
				// `publishConfig.linkDirectory` reaches snapshot bodies too: a registry
				// package whose peer a workspace override satisfies records
				// `@scope/lib: link:packages/lib/dist/dev/pkg`, a build output that is
				// no importer. Snapshot edges carry no specifier, but the lockfile
				// itself supplies exact evidence — the importer entry declares
				// `publishDirectory: dist/dev/pkg` — so the target is matched against
				// the declared publish directories, not guessed from ancestry.
				// (effected's own pnpm-lock.yaml is the real reproduction.)
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/lib:",
					"    publishDirectory: dist/dev/pkg",
					"packages:",
					"  host@1.0.0: {}",
					"snapshots:",
					"  host@1.0.0:",
					"    dependencies:",
					"      '@scope/lib': link:packages/lib/dist/dev/pkg",
					// A link into a directory NO importer declares as its publish
					// directory stays unnameable — the map is evidence, not a guess.
					"      '@scope/stray': link:packages/lib/dist/prod/pkg",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const host = lockfile.packagesNamed("host")[0];

				assert.strictEqual(host?.resolved["@scope/lib"], "packages/lib");
				assert.deepStrictEqual(host?.unresolvedEdges, ["@scope/stray"]);
			}),
		);

		it.effect('resolves a link: into the ROOT importer\'s publishDirectory to "."', () =>
			Effect.gen(function* () {
				// The root importer may declare a publishDirectory of its own (a
				// single-package repo publishing from a build directory). The declared
				// directory is root-relative already, so the map key is the normalized
				// publishDirectory itself and the owner is the root importer's id "." —
				// exact evidence reaches the one importer the ancestor walk must
				// exclude on principle.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .:",
					"    publishDirectory: dist/dev/pkg",
					"packages:",
					"  host@1.0.0: {}",
					"snapshots:",
					"  host@1.0.0:",
					"    dependencies:",
					"      '@scope/root': link:dist/dev/pkg",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const host = lockfile.packagesNamed("host")[0];

				assert.strictEqual(host?.resolved["@scope/root"], ".");
				assert.deepStrictEqual(host?.unresolvedEdges, []);
			}),
		);

		it.effect("consults publishDirectory evidence on importer edges before the ancestor walk", () =>
			Effect.gen(function* () {
				// The importer-path spelling: the same publish-directory link under a
				// plain `link:` specifier, which the `workspace:`-gated ancestor walk
				// declines. The declared publishDirectory is exact evidence, so it
				// resolves regardless of specifier — while the sibling target no
				// importer declares stays unnameable, exactly as before.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .: {}",
					"  packages/app:",
					"    devDependencies:",
					"      '@scope/lib':",
					"        specifier: link:../lib/dist/dev/pkg",
					"        version: link:../lib/dist/dev/pkg",
					"      '@scope/stub':",
					"        specifier: link:../lib/vendor/stub",
					"        version: link:../lib/vendor/stub",
					"  packages/lib:",
					"    publishDirectory: dist/dev/pkg",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const app = lockfile.packagesNamed("packages/app")[0];

				assert.strictEqual(app?.resolved["@scope/lib"], "packages/lib");
				assert.deepStrictEqual(app?.unresolvedEdges, ["@scope/stub"]);
			}),
		);

		it.effect("a v9 lockfile with an empty snapshots map is valid input", () =>
			Effect.gen(function* () {
				// The support gate is on the format VERSION, never on whether
				// `snapshots:` is present or populated. A dependency-free v9
				// workspace legitimately records no snapshot entries, so an
				// emptiness guard would reject this perfectly valid lockfile —
				// version is the format's identity, emptiness is a coincidence of
				// content. Rows still come from `packages:`, carrying no resolution,
				// which is honest: none was recorded.
				const lockfile = yield* parseFixture("pnpm/emptysnapshots/pnpm-lock.yaml", "pnpm");

				const chalk = instance(lockfile, "chalk", "5.3.0");
				assert.strictEqual(chalk.instanceId, "chalk@5.3.0");
				assert.isTrue(chalk.integrity?.startsWith("sha512-"));

				const app = lockfile.packagesNamed("packages/app")[0] as ResolvedPackage;
				assert.strictEqual(app.resolved.chalk, "chalk@5.3.0");
			}),
		);

		it.effect("answers which version of a peer resolved for a package instance", () =>
			Effect.gen(function* () {
				// The whole point of the two fields, end to end: this is the
				// computation @effected/workspaces has to run, with no format
				// knowledge anywhere in it.
				const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");
				const byId = new Map(lockfile.packages.map((p) => [p.instanceId, p]));

				const app = lockfile.packagesNamed("packages/app")[0] as ResolvedPackage;
				const reactDom = byId.get(app.resolved["react-dom"] ?? "") as ResolvedPackage;
				const wanted = reactDom.peerDependencies.react;
				const found = byId.get(reactDom.resolved.react ?? "")?.version ?? null;

				assert.strictEqual(wanted, "^18.3.1");
				assert.strictEqual(found, "17.0.2"); // unmet, and now provably so
				assert.isUndefined(reactDom.peerDependenciesMeta.react); // required
			}),
		);
	});

	describe("npm", () => {
		it.effect("parses an entry nested under a workspace directory", () =>
			Effect.gen(function* () {
				// The defect this pins: `packages/lib/node_modules/react` does not
				// start with `node_modules/`, and used to be dropped outright — so the
				// model reported react@17.0.2 as the only react in the workspace.
				const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");

				assert.deepStrictEqual(
					lockfile
						.packagesNamed("react")
						.map((p) => p.version)
						.sort(),
					["17.0.2", "18.3.1"],
				);
				assert.strictEqual(instance(lockfile, "react", "18.3.1").instanceId, "packages/lib/node_modules/react");

				// And the workspace resolves the react actually installed for it —
				// which is also what satisfies its own declared peer.
				const lib = lockfile.packagesNamed("@nested/lib")[0] as ResolvedPackage;
				assert.deepStrictEqual(lib.peerDependencies, { react: "^18.0.0" });
				assert.strictEqual(lib.resolved.react, "packages/lib/node_modules/react");
			}),
		);

		it.effect("names a nested entry by its bare package name", () =>
			Effect.gen(function* () {
				// The other defect: single-prefix stripping named this entry
				// "debug/node_modules/ms".
				const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");
				assert.isTrue(lockfile.packages.every((p) => !p.name.includes("node_modules")));

				const nested = instance(lockfile, "ms", "2.0.0");
				assert.strictEqual(nested.name, "ms");
				assert.strictEqual(nested.instanceId, "node_modules/debug/node_modules/ms");
				assert.strictEqual(instance(lockfile, "ms", "2.1.3").instanceId, "node_modules/ms");
			}),
		);

		it.effect("resolves deepest-first, so a shadowed copy wins over the hoisted one", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");
				const byId = new Map(lockfile.packages.map((p) => [p.instanceId, p]));

				// ms@2.1.3 is hoisted at node_modules/ms; debug pins ms@2.0.0 beside
				// itself. An outermost-first walk would report 2.1.3 here.
				const debug = byId.get("node_modules/debug") as ResolvedPackage;
				assert.strictEqual(debug.resolved.ms, "node_modules/debug/node_modules/ms");
				assert.strictEqual(byId.get(debug.resolved.ms ?? "")?.version, "2.0.0");
				assert.strictEqual(byId.get("node_modules/ms")?.version, "2.1.3");

				// The second, independent shadow: react@17.0.2 is hoisted, and the
				// workspace's own react@18.3.1 sits under its directory.
				const lib = byId.get("node_modules/@nested/lib") as ResolvedPackage;
				assert.strictEqual(byId.get(lib.resolved.react ?? "")?.version, "18.3.1");
				assert.strictEqual(byId.get("node_modules/react")?.version, "17.0.2");
			}),
		);

		it.effect("resolves through an intermediate ancestor, not just self-then-root", () =>
			Effect.gen(function* () {
				// HAND-AUTHORED fixture — see its own header comment. npm's hoisting
				// works to avoid this shape, so it cannot be generated on demand, and
				// the subject under test is the walk over a key set rather than npm's
				// hoisting policy.
				//
				// Every collision in the generated fixtures resolves at depth 0 or 1,
				// which means a walk shortened to "my own node_modules, else the root"
				// passes all of them. This is the shape that separates the two: b sits
				// under a, has no c of its own, and must find a's c@2.0.0 at the
				// INTERMEDIATE level rather than the root's c@1.0.0.
				const lockfile = yield* parseFixture("npm/ancestor-walk/package-lock.json", "npm");
				const byId = new Map(lockfile.packages.map((p) => [p.instanceId, p]));

				const b = byId.get("node_modules/a/node_modules/b") as ResolvedPackage;
				assert.strictEqual(b.resolved.c, "node_modules/a/node_modules/c");
				assert.strictEqual(byId.get(b.resolved.c ?? "")?.version, "2.0.0");
				// Both candidates genuinely exist, at different versions — without
				// that the assertion above could not discriminate.
				assert.strictEqual(byId.get("node_modules/c")?.version, "1.0.0");
			}),
		);

		it.effect("resolves a workspace link's edges from the workspace directory", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/peers/package-lock.json", "npm");
				const lib = lockfile.packagesNamed("@peers/lib")[0] as ResolvedPackage;
				assert.strictEqual(lib.instanceId, "node_modules/@peers/lib");
				assert.strictEqual(lib.resolved.chalk, "node_modules/chalk");
				// A peer nothing installed resolves to nothing — omitted, not invented.
				assert.isUndefined(lib.resolved["left-pad"]);
			}),
		);

		it.effect("npm and bun: a declaration nothing installed is ABSENCE, not an unresolved edge", () =>
			Effect.gen(function* () {
				// The npm/bun exemption, pinned. Their sections are *declarations*
				// (name → range) resolved positionally against the key space, so a
				// name the walk does not find means "not installed" — the ordinary
				// state of every unmet optional peer. Reporting those as
				// `unresolvedEdges` would raise the fail-closed marker on both
				// formats' every real-world lockfile, and a signal that is always on
				// is one nobody reads.
				for (const [relative, format] of [
					["npm/peers/package-lock.json", "npm"],
					["npm/v2/package-lock.json", "npm"],
					["bun/peers/bun.lock", "bun"],
					["bun/v2/bun.lock", "bun"],
				] as ReadonlyArray<[string, LockfileFormat]>) {
					const lockfile = yield* parseFixture(relative, format);
					for (const row of lockfile.packages) {
						assert.deepStrictEqual(row.unresolvedEdges, [], `${relative}: ${row.instanceId}`);
					}
					// Non-vacuous: these fixtures really do carry declarations the walk
					// finds nothing for. `react-redux` asks for `redux`, which neither
					// lockfile installs.
					const redux = lockfile.packagesNamed("react-redux")[0];
					if (redux !== undefined) {
						assert.strictEqual(redux.peerDependencies.redux, "^5.0.0", relative);
						assert.isUndefined(redux.resolved.redux, relative);
					}
				}

				// The control on a known-good input: the field is reachable, and a
				// lockfile that RECORDS an edge this model cannot name still fills it.
				const unnameable = yield* parseFixture("pnpm/unnameablelink/pnpm-lock.yaml", "pnpm");
				assert.isAbove(
					unnameable.packages.filter((p) => p.unresolvedEdges.length > 0).length,
					0,
					"the control fixture must populate unresolvedEdges, or the assertions above prove nothing",
				);
			}),
		);
	});

	describe("bun", () => {
		it.effect("keys nested instances by parent path and keeps them distinguishable", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/nested/bun.lock", "bun");

				const reacts = lockfile.packagesNamed("react");
				assert.strictEqual(new Set(reacts.map((p) => p.instanceId)).size, reacts.length);
				// The nesting key is the workspace's *scoped* name, spanning two "/"
				// segments — so a parent chain derived by splitting on "/" would take
				// "@nested" as the parent and miss it. The chain is read off the key
				// space instead, and "@nested/lib" is itself a key.
				assert.strictEqual(instance(lockfile, "react", "18.3.1").instanceId, "@nested/lib/react");
				assert.strictEqual(instance(lockfile, "react", "17.0.2").instanceId, "react");
				// Name and version come off tuple[0]; identity comes off the key.
				assert.strictEqual(instance(lockfile, "react", "18.3.1").name, "react");

				const lib = lockfile.packagesNamed("@nested/lib")[0] as ResolvedPackage;
				// A workspace's instance id is its `packages` key — the bare name —
				// because that is what nested keys prefix themselves with.
				assert.strictEqual(lib.instanceId, "@nested/lib");
				assert.strictEqual(lib.resolved.react, "@nested/lib/react");
				assert.deepStrictEqual(lib.peerDependencies, { react: "^18.0.0" });
			}),
		);

		it.effect("resolves deepest-first over the key space", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/nested/bun.lock", "bun");
				const byId = new Map(lockfile.packages.map((p) => [p.instanceId, p]));

				// ms@2.1.3 is hoisted at "ms"; debug's own ms@2.0.0 is keyed "debug/ms".
				// An outermost-first walk would report the hoisted one.
				const debug = byId.get("debug") as ResolvedPackage;
				assert.strictEqual(debug.resolved.ms, "debug/ms");
				assert.strictEqual(byId.get("debug/ms")?.version, "2.0.0");
				assert.strictEqual(byId.get("ms")?.version, "2.1.3");
			}),
		);
	});

	describe("yarn", () => {
		it.effect("identifies instances by locator and resolves descriptors through the key index", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("yarn/peers/yarn.lock", "yarn");
				const reactDom = instance(lockfile, "react-dom", "18.3.1");
				assert.strictEqual(reactDom.instanceId, "react-dom@npm:18.3.1");
				assert.strictEqual(reactDom.resolved.scheduler, "scheduler@npm:0.23.2");

				const app = lockfile.packagesNamed("@peers/app")[0] as ResolvedPackage;
				assert.strictEqual(app.instanceId, "@peers/app@workspace:packages/app");
				// A workspace dependency resolves to the workspace locator, not the npm one.
				assert.strictEqual(app.resolved["@peers/lib"], "@peers/lib@workspace:packages/lib");

				// Peers are deliberately absent: yarn resolves them virtually and the
				// lockfile does not record which virtual instance satisfied which peer.
				// An absent edge is a true statement; a guessed one would not be.
				assert.deepStrictEqual(reactDom.peerDependencies, { react: "^18.3.1" });
				assert.isUndefined(reactDom.resolved.react);
			}),
		);

		it.effect("resolves a workspace's DEV edges — yarn records them as dependencies", () =>
			Effect.gen(function* () {
				// Real yarn 4.9.1 output. In `yarn/devdeps`, `typescript` is declared
				// ONLY in devDependencies and `chalk` only in dependencies, and the
				// lockfile writes both under one `dependencies:` map — a Berry
				// lockfile has no `devDependencies` section to iterate. The pair is
				// what makes this discriminating: a resolver that visited only some
				// declared section would show one of these two edges and not the
				// other.
				const lockfile = yield* parseFixture("yarn/devdeps/yarn.lock", "yarn");
				const root = lockfile.packagesNamed("@devdeps/root")[0] as ResolvedPackage;
				assert.strictEqual(root.resolved.chalk, "chalk@npm:5.3.0");
				assert.strictEqual(root.resolved.typescript, "typescript@npm:5.3.3");
				const lib = lockfile.packagesNamed("@devdeps/lib")[0] as ResolvedPackage;
				assert.strictEqual(lib.resolved.chalk, "chalk@npm:5.3.0");
				assert.strictEqual(lib.resolved.typescript, "typescript@npm:5.3.3");
				assert.deepStrictEqual(root.unresolvedEdges, []);
			}),
		);
	});
});

describe("peer suffixes on protocol versions", () => {
	// pnpm suffixes a `file:` resolution exactly as it suffixes a registry
	// version whenever the package declares peers — directory and tarball
	// alike, nested chains included — and never suffixes a `link:` one. Real
	// pnpm 12.6.0 output (fixtures README, `pnpm/filepeer`). Before the split
	// learned this, `lib@file:vendor/lib(react@18.3.1)` came out as name
	// `lib@file:vendor/lib(react` at version `18.3.1)`, and one layer up a
	// peer check read the garbled version as merely unparseable.
	const load = () => parseFixture("pnpm/filepeer/pnpm-lock.yaml", "pnpm");

	it.effect("splits a file: directory's suffix off its snapshot key, nested chain and all", () =>
		Effect.gen(function* () {
			const lockfile = yield* load();
			const libs = lockfile.packagesNamed("lib");
			// ONE instance: the `packages:` entry is covered by its snapshot rather
			// than re-emitted as an orphan under a second identity.
			assert.strictEqual(libs.length, 1);
			const lib = libs[0] as ResolvedPackage;
			assert.strictEqual(lib.instanceId, "lib@file:vendor/lib(react-dom@18.3.1(react@18.3.1))(react@18.3.1)");
			assert.strictEqual(lib.version, "file:vendor/lib");
			// Peer declarations join from the `packages:` entry keyed by the plain part.
			assert.deepStrictEqual(lib.peerDependencies, { react: "^18.0.0", "react-dom": "^18.0.0" });
		}),
	);

	it.effect("names no instance with a fragment of a peer suffix", () =>
		Effect.gen(function* () {
			for (const pkg of (yield* load()).packages) {
				assert.notInclude(pkg.name, "(", pkg.instanceId);
				assert.isFalse(pkg.version.endsWith(")"), pkg.instanceId);
			}
		}),
	);

	it.effect("splits a file: tarball's suffix the same way", () =>
		Effect.gen(function* () {
			const tarlibs = (yield* load()).packagesNamed("tarlib");
			assert.strictEqual(tarlibs.length, 1);
			assert.strictEqual(tarlibs[0]?.instanceId, "tarlib@file:vendor/tarlib-1.0.0.tgz(react@18.3.1)");
			assert.strictEqual(tarlibs[0]?.version, "file:vendor/tarlib-1.0.0.tgz");
			assert.deepStrictEqual(tarlibs[0]?.peerDependencies, { react: "^18.0.0" });
		}),
	);

	it.effect("reads a parenthesised path the way pnpm's own packages: key does", () =>
		Effect.gen(function* () {
			// `file:../../vendor/paren(lib)` is snapshot-keyed
			// `parenlib@file:vendor/paren(lib)(react@18.3.1)`, and pnpm itself writes
			// the `packages:` key as `parenlib@file:vendor/paren`: its suffix rule
			// takes the whole trailing run of balanced groups, path text included.
			// Reading it any other way would orphan that entry and lose its peers.
			const parens = (yield* load()).packagesNamed("parenlib");
			assert.strictEqual(parens.length, 1);
			assert.strictEqual(parens[0]?.instanceId, "parenlib@file:vendor/paren(lib)(react@18.3.1)");
			assert.strictEqual(parens[0]?.version, "file:vendor/paren");
			assert.deepStrictEqual(parens[0]?.peerDependencies, { react: "^18.0.0" });
		}),
	);

	it.effect("splits the importer versions likewise, and leaves an unsuffixed link: whole", () =>
		Effect.gen(function* () {
			const host = Option.getOrThrow((yield* load()).importer("packages/host"));
			const dep = (name: string) => host.dependencies.find((d) => d.name === name);
			assert.strictEqual(dep("lib")?.version, "file:vendor/lib");
			assert.strictEqual(dep("lib")?.peerSuffix, "(react-dom@18.3.1(react@18.3.1))(react@18.3.1)");
			assert.strictEqual(dep("tarlib")?.version, "file:vendor/tarlib-1.0.0.tgz");
			assert.strictEqual(dep("tarlib")?.peerSuffix, "(react@18.3.1)");
			// pnpm does not suffix a `link:` even when its target declares peers.
			assert.strictEqual(dep("linklib")?.version, "link:../../vendor/linklib");
			assert.isFalse(Object.hasOwn(dep("linklib") ?? {}, "peerSuffix"));
			// A registry version is unchanged.
			assert.strictEqual(dep("react-dom")?.version, "18.3.1");
			assert.strictEqual(dep("react-dom")?.peerSuffix, "(react@18.3.1)");
		}),
	);

	it.effect("still resolves the host's edges to the suffixed instances", () =>
		Effect.gen(function* () {
			const host = (yield* load()).packagesNamed("packages/host")[0] as ResolvedPackage;
			assert.strictEqual(host.resolved.lib, "lib@file:vendor/lib(react-dom@18.3.1(react@18.3.1))(react@18.3.1)");
			assert.strictEqual(host.resolved.tarlib, "tarlib@file:vendor/tarlib-1.0.0.tgz(react@18.3.1)");
		}),
	);

	/** Hand-authored edge shapes no workspace here needed to produce. */
	const edges = () =>
		Lockfile.parse(
			[
				"lockfileVersion: '9.0'",
				"importers:",
				"  .:",
				"    dependencies:",
				"      mid:",
				"        specifier: file:vendor/a(b)/mid",
				"        version: file:vendor/a(b)/mid(react@18.3.1)",
				"      scoped:",
				"        specifier: file:../@scope/lib",
				"        version: file:../@scope/lib(react@18.3.1)",
				"      stub:",
				"        specifier: link:vendor/stub(x)",
				"        version: link:vendor/stub(x)",
				"snapshots:",
				"  mid@file:vendor/a(b)/mid(react@18.3.1): {}",
				"  scoped@file:../@scope/lib(react@18.3.1): {}",
				"  '@scope/reg@1.0.0(react@18.3.1)': {}",
			].join("\n"),
			{ format: "pnpm" },
		);

	it.effect("never splits inside the path: only a TRAILING run of groups is a suffix", () =>
		Effect.gen(function* () {
			// A parenthesis INSIDE the path is followed by more path, so it is not
			// part of the trailing run.
			const lockfile = yield* edges();
			assert.strictEqual(lockfile.packagesNamed("mid")[0]?.version, "file:vendor/a(b)/mid");
			const root = Option.getOrThrow(lockfile.importer("."));
			assert.strictEqual(root.dependencies.find((d) => d.name === "mid")?.version, "file:vendor/a(b)/mid");
			assert.strictEqual(root.dependencies.find((d) => d.name === "mid")?.peerSuffix, "(react@18.3.1)");
		}),
	);

	it.effect("splits name from version at the first @, so an @ in the spec stays in the version", () =>
		Effect.gen(function* () {
			const lockfile = yield* edges();
			assert.strictEqual(lockfile.packagesNamed("scoped")[0]?.version, "file:../@scope/lib");
			assert.strictEqual(lockfile.packagesNamed("@scope/reg")[0]?.version, "1.0.0");
		}),
	);

	it.effect("leaves a link: whole, since pnpm never suffixes one", () =>
		Effect.gen(function* () {
			const root = Option.getOrThrow((yield* edges()).importer("."));
			const stub = root.dependencies.find((d) => d.name === "stub");
			assert.strictEqual(stub?.version, "link:vendor/stub(x)");
			assert.isFalse(Object.hasOwn(stub ?? {}, "peerSuffix"));
		}),
	);
});

// The supported input domain. This is a deliberate narrowing: a lockfile older
// than the gate fails typed rather than parsing into a model that cannot answer
// resolution questions. The gate is on the lockfile FORMAT version, which is
// the only version a lockfile records — the writing package manager's version
// is not recoverable from the file.
describe("supported lockfile versions", () => {
	const failure = (relative: string, format: LockfileFormat) =>
		Effect.flip(Lockfile.parse(fixture(relative), { format }));

	it.effect("narrows the cause through the exported predicate, not by hand", () =>
		Effect.gen(function* () {
			// The documented discrimination — `isUnsupportedLockfileVersion(cause)`
			// — must typecheck and narrow, since a consumer following the docs
			// otherwise writes an unchecked cast.
			const error = yield* failure("npm/unsupported-v2/package-lock.json", "npm");
			assert.strictEqual(error._tag, "LockfileParseError");
			if (error._tag !== "LockfileParseError") return;

			assert.isTrue(isUnsupportedLockfileVersion(error.cause));
			if (!isUnsupportedLockfileVersion(error.cause)) return;
			// Narrowed: these read without a cast.
			assert.strictEqual(error.cause.format, "npm");
			assert.strictEqual(error.cause.lockfileVersion, 2);
			assert.strictEqual(error.cause.minimumSupported, 3);
			assert.include(error.cause.message, "lockfileVersion");
		}),
	);

	it.effect("the predicate rejects a malformed-input cause, which is the whole point", () =>
		Effect.gen(function* () {
			// `cause` is `Schema.Defect` because it carries whatever the delegated
			// engines throw. A consumer distinguishing "too old" from "malformed"
			// needs the predicate to say NO here.
			const syntax = yield* Effect.flip(Lockfile.parse("{ not json", { format: "npm" }));
			assert.strictEqual(syntax._tag, "LockfileParseError");
			if (syntax._tag !== "LockfileParseError") return;
			assert.strictEqual(syntax.stage, "syntax");
			assert.isFalse(isUnsupportedLockfileVersion(syntax.cause));

			// And a shape failure, which shares the "validation" stage with the
			// version gate — so stage alone cannot tell them apart, only the tag.
			const shape = yield* Effect.flip(Lockfile.parse(JSON.stringify({ lockfileVersion: 3 }), { format: "npm" }));
			assert.strictEqual(shape._tag, "LockfileParseError");
			if (shape._tag !== "LockfileParseError") return;
			assert.strictEqual(shape.stage, "validation");
			assert.isFalse(isUnsupportedLockfileVersion(shape.cause));
		}),
	);

	it("is total and defensive: it is called on genuinely unknown values", () => {
		// The predicate's whole job is narrowing an open channel, so every one of
		// these is a value it will really be handed. None may throw.
		for (const value of [
			null,
			undefined,
			"UnsupportedLockfileVersion",
			42,
			[],
			new Error("boom"),
			Object.assign(new Error("tagged"), { _tag: "SomethingElse" }),
			{ _tag: "SomeOtherError", format: "npm", minimumSupported: 3 },
		]) {
			assert.isFalse(isUnsupportedLockfileVersion(value), String(value));
		}
	});

	it("rejects a NEAR-MISS, not just obviously-wrong values", () => {
		// The dangerous impostor is not `undefined` — it is a value carrying the
		// right tag and nothing else. A predicate that accepts anything tagged is
		// a cast wearing a predicate's clothes.
		assert.isFalse(isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion" }));
		assert.isFalse(isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: "npm" }));
		assert.isFalse(
			isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: "3" }),
		);
		// Each field is checked independently: a near-miss missing only `format`,
		// or carrying the wrong type for it, must fail on that clause alone.
		assert.isFalse(isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", minimumSupported: 3 }));
		assert.isFalse(
			isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: 42, minimumSupported: 3 }),
		);
		// A foreign throwable inheriting the tag from its prototype is not this
		// record either; the discriminant is read as an OWN property.
		assert.isFalse(
			isUnsupportedLockfileVersion(
				Object.create({ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: 3 }),
			),
		);
		// What passes is identity plus the two checked value clauses. The
		// predicate deliberately validates neither `lockfileVersion` nor
		// `message`, so a record carrying only the checked fields passes too —
		// stating that here keeps the next reader from "fixing" the predicate to
		// match a stronger claim than it makes.
		assert.isTrue(
			isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: 3 }),
		);
		assert.isTrue(
			isUnsupportedLockfileVersion({
				_tag: "UnsupportedLockfileVersion",
				format: "npm",
				lockfileVersion: 2,
				minimumSupported: 3,
				message: "…",
			}),
		);
	});

	it.effect("pnpm: a pre-v9 lockfile fails typed at validation", () =>
		Effect.gen(function* () {
			// Real pnpm 8 output (lockfileVersion '6.0'), kept as a negative fixture.
			const error = yield* failure("pnpm/unsupported-v6/pnpm-lock.yaml", "pnpm");
			assert.strictEqual(error._tag, "LockfileParseError");
			if (error._tag !== "LockfileParseError") return;
			assert.strictEqual(error.format, "pnpm");
			// Validation, not framing: the document was located perfectly well.
			assert.strictEqual(error.stage, "validation");
			// Legible enough to tell "too old" from "malformed" without parsing prose.
			const cause = error.cause as { _tag?: string; lockfileVersion?: unknown; minimumSupported?: unknown };
			assert.strictEqual(cause._tag, "UnsupportedLockfileVersion");
			assert.strictEqual(cause.lockfileVersion, "6.0");
			assert.strictEqual(cause.minimumSupported, 9);
		}),
	);

	it.effect("npm: a lockfileVersion 2 lockfile fails typed at validation", () =>
		Effect.gen(function* () {
			const error = yield* failure("npm/unsupported-v2/package-lock.json", "npm");
			assert.strictEqual(error._tag, "LockfileParseError");
			if (error._tag !== "LockfileParseError") return;
			assert.strictEqual(error.format, "npm");
			assert.strictEqual(error.stage, "validation");
			const cause = error.cause as { _tag?: string; lockfileVersion?: unknown; minimumSupported?: unknown };
			assert.strictEqual(cause._tag, "UnsupportedLockfileVersion");
			assert.strictEqual(cause.lockfileVersion, 2);
			assert.strictEqual(cause.minimumSupported, 3);
		}),
	);

	it.effect("npm: a lockfileVersion 1 lockfile fails as TOO OLD, not as malformed", () =>
		Effect.gen(function* () {
			// Real npm 11.19.0 output (`npm install --lockfile-version=1`). A v1
			// tree carries no `packages` object at all, so a gate that ran after
			// the shape decode would report the oldest format we reject as merely
			// malformed — a `ParseFailure` cause the predicate says no to, which is
			// the same answer it gives for a corrupt file.
			const error = yield* failure("npm/unsupported-v1/package-lock.json", "npm");
			assert.strictEqual(error._tag, "LockfileParseError");
			if (error._tag !== "LockfileParseError") return;
			assert.strictEqual(error.format, "npm");
			assert.strictEqual(error.stage, "validation");
			assert.isTrue(isUnsupportedLockfileVersion(error.cause), "v1 must fail through the typed version cause");
			if (!isUnsupportedLockfileVersion(error.cause)) return;
			assert.strictEqual(error.cause.lockfileVersion, 1);
			assert.strictEqual(error.cause.minimumSupported, 3);
		}),
	);

	it.effect("pnpm: a pre-v9 SINGLE-PROJECT lockfile fails as too old, not as malformed", () =>
		Effect.gen(function* () {
			// Real pnpm 8.15.9 output for a non-workspace project: it records its
			// dependencies at the top level and has no `importers` map, the key the
			// v9 shape requires. The gate has to read the version first or this
			// file — too old, and nothing else wrong with it — reports as a shape
			// failure. The workspace-shaped `unsupported-v6` fixture cannot catch
			// that ordering, because it decodes fine.
			const error = yield* failure("pnpm/unsupported-v6-single/pnpm-lock.yaml", "pnpm");
			assert.strictEqual(error._tag, "LockfileParseError");
			if (error._tag !== "LockfileParseError") return;
			assert.strictEqual(error.format, "pnpm");
			assert.strictEqual(error.stage, "validation");
			assert.isTrue(isUnsupportedLockfileVersion(error.cause), "a pre-v9 lockfile must fail through the typed cause");
			if (!isUnsupportedLockfileVersion(error.cause)) return;
			assert.strictEqual(error.cause.lockfileVersion, "6.0");
			assert.strictEqual(error.cause.minimumSupported, 9);
		}),
	);

	it.effect("a supported lockfile with a broken shape still fails as MALFORMED", () =>
		Effect.gen(function* () {
			// The other side of the ordering: reading the version first must not
			// turn shape failures into version failures. A v9 document whose
			// `importers` is the wrong type is malformed, and says so.
			const error = yield* Effect.flip(Lockfile.parse("lockfileVersion: '9.0'\nimporters: 7\n", { format: "pnpm" }));
			assert.strictEqual(error._tag, "LockfileParseError");
			if (error._tag !== "LockfileParseError") return;
			assert.strictEqual(error.stage, "validation");
			assert.isFalse(isUnsupportedLockfileVersion(error.cause));
		}),
	);

	it.effect("the gate is on version, not on emptiness or content", () =>
		Effect.gen(function* () {
			// Two lockfiles the gate must NOT reject, for two different reasons: one
			// v9 document whose `snapshots:` map is empty, and one v9 document with
			// a full one. An emptiness guard passes the second and fails the first.
			const empty = yield* Lockfile.parse(fixture("pnpm/emptysnapshots/pnpm-lock.yaml"), { format: "pnpm" });
			assert.isAbove(empty.packages.length, 0);
			const full = yield* Lockfile.parse(fixture("pnpm/v3/pnpm-lock.yaml"), { format: "pnpm" });
			assert.isAbove(full.packages.length, 0);
		}),
	);

	it.effect("every non-negative fixture sits at or above its format's gate", () =>
		Effect.gen(function* () {
			// A guard against a fixture silently ageing out of support. It
			// **enumerates the fixtures directory** rather than listing paths: a
			// hard-coded list cannot guard against the case it exists for, because
			// a fixture added tomorrow simply would not appear in it.
			//
			// Negative fixtures are excluded by naming convention — a directory
			// named `unsupported-*` asserts a typed failure, so it is expected to
			// sit *below* the gate. The convention is the exclusion mechanism, so
			// adding a negative fixture cannot silently opt a positive one out.
			//
			// Config-only pnpm captures are marked the same way, by name: they are
			// the one fixture shape whose caller asserts `configOnly`, so the guard
			// passes the flag for exactly those and for nothing else.
			const gated = { pnpm: 9, npm: 3 } as const;
			const checked: Array<string> = [];
			const checkedConfigOnly: Array<string> = [];

			for (const [format, minimum] of Object.entries(gated) as ReadonlyArray<[keyof typeof gated, number]>) {
				const filename = filenameFor(format);
				const formatDir = join(import.meta.dirname, "fixtures", format);
				for (const entry of readdirSync(formatDir, { withFileTypes: true })) {
					if (!entry.isDirectory() || entry.name.startsWith(NEGATIVE_FIXTURE_PREFIX)) continue;
					const relative = `${format}/${entry.name}/${filename}`;
					// `filenameFor` names the PRIMARY filename only, and `fixture()` reads
					// eagerly — so a directory holding, say, `npm-shrinkwrap.json` instead
					// would throw ENOENT OUTSIDE the Effect, where `Effect.result` cannot
					// capture it and the path is lost from the message. Report it here.
					assert.isTrue(
						existsSync(join(formatDir, entry.name, filename)),
						`${relative} is missing: this guard reads each format's primary filename`,
					);
					// Through `Effect.result` so a fixture that has aged below the gate
					// reports *which* fixture, rather than surfacing as a bare parse
					// error with no path in it — this guard is read by whoever added
					// the fixture that broke it.
					const configOnly = format === "pnpm" && entry.name.startsWith(CONFIG_ONLY_FIXTURE_PREFIX);
					const parsed = yield* Effect.result(parseFixture(relative, format, configOnly));
					assert.isTrue(parsed._tag === "Success", `${relative} no longer parses: it may have aged below the gate`);
					if (parsed._tag !== "Success") continue;
					assert.isAtLeast(Number.parseFloat(parsed.success.lockfileVersion), minimum, relative);
					checked.push(relative);
					if (configOnly) checkedConfigOnly.push(relative);
				}
			}

			// The enumeration itself must not silently find nothing — a mistyped
			// directory would turn this guard into a vacuous pass.
			assert.isAtLeast(checked.length, 12, `enumerated too few fixtures: ${checked.join(", ")}`);
			// Nor may the marker silently match nothing: a mistyped prefix would
			// leave the flag path of this guard unexercised.
			assert.isAtLeast(checkedConfigOnly.length, 2, `marked too few config-only fixtures: ${checked.join(", ")}`);
		}),
	);
});
