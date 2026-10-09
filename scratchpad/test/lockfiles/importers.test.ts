// @effect-diagnostics nodeBuiltinImport:skip-file
// Per-format importer extraction: the `Lockfile.importers` field and the
// `lockfile.importer(path)` keyed lookup. pnpm records `{ specifier, version }`
// per importer dependency — the parser splits pnpm's peer-disambiguation
// suffix off the version into `peerSuffix`; bun and npm record a specifier
// only (the resolved version lives on package entries); yarn records no
// importers at all.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Lockfile } from "../../effected/lockfiles/Lockfile.ts";
import { peerDeclarations } from "../../effected/lockfiles/internal/shared.ts";
import type { LockfileFormat } from "../../effected/lockfiles/LockfileFormat.ts";

const fixture = (relative: string): string => readFileSync(join(import.meta.dirname, "fixtures", relative), "utf8");
const parseFixture = (relative: string, format: LockfileFormat) => Lockfile.parse(fixture(relative), { format });

describe("Lockfile.importers", () => {
	describe("pnpm", () => {
		it.effect("v1: importer dependencies carry both specifier and version", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");

				// The root importer "." is present and declares nothing.
				const root = lockfile.importer(".");
				assertSome(O.map(root, (importer) => importer.dependencies.length), 0);
				assert.strictEqual(O.getOrThrow(root).dependencies.length, 0);

				const core = O.getOrThrow(lockfile.importer("packages/core"));
				assert.strictEqual(core.path, "packages/core");
				// dependencies (2) + devDependencies (1)
				assert.strictEqual(core.dependencies.length, 3);

				const lodash = core.dependencies.find((d) => d.name === "lodash");
				assert.strictEqual(lodash?.specifier.raw, "4.17.21");
				assert.strictEqual(lodash?.specifier._tag, "range");
				assert.strictEqual(lodash?.version, "4.17.21");
				assert.strictEqual(lodash?.depType, "dependencies");

				const utils = core.dependencies.find((d) => d.name === "@test-monorepo/utils");
				assert.strictEqual(utils?.specifier.raw, "workspace:*");
				assert.strictEqual(utils?.specifier._tag, "workspace");
				assert.strictEqual(utils?.version, "link:../utils");

				const ts = core.dependencies.find((d) => d.name === "typescript");
				assert.strictEqual(ts?.depType, "devDependencies");
				assert.strictEqual(ts?.version, "5.9.3");
			}),
		);

		it.effect("v3: a `catalog:` specifier classifies as catalog and round-trips its raw", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/v3/pnpm-lock.yaml", "pnpm");
				const core = O.getOrThrow(lockfile.importer("packages/core"));
				const lodash = core.dependencies.find((d) => d.name === "lodash");
				assert.strictEqual(lodash?.specifier._tag, "catalog");
				assert.strictEqual(lodash?.specifier.raw, "catalog:");
				assert.strictEqual(lodash?.version, "4.17.23");
			}),
		);

		it.effect("v2: a peer-suffixed version splits into a plain version and peerSuffix", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("pnpm/v2/pnpm-lock.yaml", "pnpm");
				const utils = O.getOrThrow(lockfile.importer("packages/utils"));
				const platform = utils.dependencies.find((d) => d.name === "@effect/platform");
				assert.strictEqual(platform?.version, "0.96.0");
				assert.strictEqual(platform?.peerSuffix, "(effect@3.21.0)");
			}),
		);

		it.effect("peer-disambiguation suffixes split off; link:/file: resolutions pass through verbatim", () =>
			Effect.gen(function* () {
				// The exact literal from issue #165, nested-suffix chain included.
				const content = [
					"lockfileVersion: '9.0'",
					"importers:",
					"  .:",
					"    dependencies:",
					"      '@effect/experimental':",
					"        specifier: 4.0.0-beta.101",
					"        version: 4.0.0-beta.101(effect@4.0.0-beta.101)(ioredis@5.11.1(supports-color@8.1.1))",
					"      effect:",
					"        specifier: 4.0.0-beta.101",
					"        version: 4.0.0-beta.101",
					"      '@local/utils':",
					"        specifier: workspace:*",
					"        version: link:packages/utils",
					"      vendored:",
					"        specifier: file:vendor/vendored",
					"        version: file:vendor/vendored",
					"",
				].join("\n");
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
				const root = O.getOrThrow(lockfile.importer("."));

				const experimental = root.dependencies.find((d) => d.name === "@effect/experimental");
				assert.strictEqual(experimental?.version, "4.0.0-beta.101");
				assert.strictEqual(experimental?.peerSuffix, "(effect@4.0.0-beta.101)(ioredis@5.11.1(supports-color@8.1.1))");

				// A suffix-free entry keeps its version and records no peerSuffix key.
				const effect = root.dependencies.find((d) => d.name === "effect");
				assert.strictEqual(effect?.version, "4.0.0-beta.101");
				assert.isFalse(Object.hasOwn(effect ?? {}, "peerSuffix"));

				// Non-version resolutions pass through untouched, no suffix field.
				const linked = root.dependencies.find((d) => d.name === "@local/utils");
				assert.strictEqual(linked?.version, "link:packages/utils");
				assert.isFalse(Object.hasOwn(linked ?? {}, "peerSuffix"));

				const vendored = root.dependencies.find((d) => d.name === "vendored");
				assert.strictEqual(vendored?.version, "file:vendor/vendored");
				assert.isFalse(Object.hasOwn(vendored ?? {}, "peerSuffix"));
			}),
		);
	});

	describe("bun", () => {
		it.effect("v1: importer dependencies carry a specifier and no version", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("bun/v1/bun.lock", "bun");

				// The root workspace ("") becomes the "." importer.
				const root = O.getOrThrow(lockfile.importer("."));
				assert.strictEqual(root.dependencies.length, 0);

				const core = O.getOrThrow(lockfile.importer("packages/core"));
				// 3 dependencies + 1 devDependency
				assert.strictEqual(core.dependencies.length, 4);
				assert.isTrue(core.dependencies.every((d) => d.version === undefined));

				const react = core.dependencies.find((d) => d.name === "react");
				assert.strictEqual(react?.specifier._tag, "catalog");
				assert.strictEqual(react?.specifier.raw, "catalog:");
			}),
		);
	});

	describe("npm", () => {
		it.effect("v2: root and workspace importers carry a specifier and no version", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("npm/v2/package-lock.json", "npm");

				const root = O.getOrThrow(lockfile.importer("."));
				const ts = root.dependencies.find((d) => d.name === "typescript");
				assert.strictEqual(ts?.depType, "devDependencies");
				assert.strictEqual(ts?.specifier.raw, "^5.3.0");
				assert.strictEqual(ts?.version, undefined);

				// 3 dependencies + 1 peerDependency + 1 optionalDependency.
				const core = O.getOrThrow(lockfile.importer("packages/core"));
				assert.strictEqual(core.dependencies.length, 5);
				assert.isTrue(core.dependencies.every((d) => d.version === undefined));
				assert.strictEqual(core.dependencies.find((d) => d.name === "react")?.depType, "peerDependencies");
				assert.strictEqual(core.dependencies.find((d) => d.name === "fsevents")?.depType, "optionalDependencies");
			}),
		);
	});

	describe("yarn", () => {
		it.effect("v1: records no importers", () =>
			Effect.gen(function* () {
				const lockfile = yield* parseFixture("yarn/v1/yarn.lock", "yarn");
				assert.strictEqual(lockfile.importers.length, 0);
				assertNone(lockfile.importer("."));
			}),
		);
	});

	it.effect("importer(path) is None for an unknown path", () =>
		Effect.gen(function* () {
			const lockfile = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");
			assertNone(lockfile.importer("packages/does-not-exist"));
		}),
	);
});


describe("peerDeclarations dual helper", () => {
	it("three arguments return the normalized record, including explicit undefined metadata", () => {
		assert.deepEqual(peerDeclarations({ react: "^18" }, undefined, undefined), {
			peerDependencies: { react: "^18" }, peerDependenciesMeta: {},
		});
		assert.deepEqual(peerDeclarations(undefined, { react: { optional: true } }, undefined), {
			peerDependencies: {}, peerDependenciesMeta: { react: { optional: true } },
		});
		assert.deepEqual(peerDeclarations(undefined, undefined, undefined), {
			peerDependencies: {}, peerDependenciesMeta: {},
		});
	});

	it("data-last calls normalize optional metadata and bun overrides", () => {
		assert.deepEqual(pipe({ react: "^18" }, peerDeclarations(undefined)), {
			peerDependencies: { react: "^18" }, peerDependenciesMeta: {},
		});
		assert.deepEqual(pipe(undefined, peerDeclarations(undefined, undefined)), {
			peerDependencies: {}, peerDependenciesMeta: {},
		});
		assert.deepEqual(pipe({ react: "^18" }, peerDeclarations({ react: { optional: false } }, ["react"])), {
			peerDependencies: { react: "^18" }, peerDependenciesMeta: { react: { optional: true } },
		});
	});

	it("an explicit undefined optionalPeers argument preserves metadata and range records", () => {
		assert.deepEqual(peerDeclarations({ react: "^18" }, { react: { optional: true }, vue: {} }, undefined), {
			peerDependencies: { react: "^18" },
			peerDependenciesMeta: { react: { optional: true }, vue: { optional: false } },
		});
	});

	it("bun optional peer names override metadata flags while preserving first-seen key order", () => {
		const result = peerDeclarations({ react: "^18" }, { react: { optional: false }, vue: {} }, ["vue", "react", "svelte", "vue"]);
		assert.deepEqual(result.peerDependencies, { react: "^18" });
		assert.deepEqual(R.toEntries(result.peerDependenciesMeta), [
			["react", { optional: true }], ["vue", { optional: true }], ["svelte", { optional: true }],
		]);
	});
});
