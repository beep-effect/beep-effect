// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file
// The fetch rung's guards, over the public `ScriptedSpawner` double: what the
// rung refuses to use even when pnpm exits zero, and how a pnpm that never
// ran is reported. The #842 scenario end to end, with real git and a fake
// pnpm, lives in `integration/ConfigDependencyFetch.int.test.ts`.
//
// The ladder reads the real disk (the pnpm store is real even when a
// FileSystem is virtual), so the root and store are real temp directories.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { ScriptedSpawner } from "../../effected/commands/index.ts";
import { CatalogAssemblyError } from "../../effected/npm/index.ts";
import { Effect, Layer } from "effect";
import { ConfigDependencyHooks } from "../../effected/workspaces/index.ts";
import { storeDirArgument } from "../../effected/workspaces/internal/configDependencyFetch.ts";

const NAME = "cfg-fetch-guard";
const SRI = `sha512-${"C".repeat(86)}==`;
const SPEC = `1.0.0+${SRI}`;

let root: string;
let store: string;

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "effected-fetch-guard-root-"));
	store = join(mkdtempSync(join(tmpdir(), "effected-fetch-guard-store-")), "v11");
	mkdirSync(store, { recursive: true });
	mkdirSync(join(root, "node_modules"), { recursive: true });
	writeFileSync(join(root, "node_modules", ".modules.yaml"), `"storeDir": ${JSON.stringify(store)}\n`);
});

afterAll(() => {
	for (const dir of [root, dirname(store)]) if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
});

const optionOf = (args: ReadonlyArray<string>, flag: string): string => args[args.indexOf(flag) + 1] ?? "";

/** Link the scratch workspace's `.pnpm-config/<NAME>` at `target`, as pnpm does. */
const linkScratch = (args: ReadonlyArray<string>, target: string): void => {
	const link = join(optionOf(args, "--dir"), "node_modules", ".pnpm-config", NAME);
	mkdirSync(dirname(link), { recursive: true });
	symlinkSync(target, link, "dir");
};

/** A package directory holding `version`, at `dir`. */
const packageAt = (dir: string, version: string): string => {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: NAME, version }));
	return dir;
};

const failureWith = (script: Parameters<typeof ScriptedSpawner.make>[0]) => {
	const spawner = ScriptedSpawner.make(script);
	return Effect.gen(function* () {
		const hooks = yield* ConfigDependencyHooks;
		const error = yield* Effect.flip(hooks.inject(root, { [NAME]: SPEC }, {}));
		assert.instanceOf(error, CatalogAssemblyError);
		assert.strictEqual(error.path, NAME);
		// Nothing was replayed: the only spawns are pnpm's.
		assert.isTrue(spawner.spawns.every((spawn) => spawn.command === "pnpm"));
		return { error, spawner };
	}).pipe(Effect.provide(ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(spawner.layer))));
};

describe("the fetch rung refuses what it cannot verify", () => {
	it.effect("a pnpm that rewrites the pinned lockfile is not trusted, even on a zero exit", () =>
		Effect.gen(function* () {
			const { error, spawner } = yield* failureWith((_command, args) => {
				const scratch = optionOf(args, "--dir");
				writeFileSync(join(scratch, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n");
				// Linked outside the store so no later test finds it there; the
				// lockfile guard runs first either way.
				linkScratch(args, packageAt(join(dirname(store), "rewritten", NAME), "1.0.0"));
				return {};
			});
			assert.strictEqual(error.reason, "fetchFailed");
			assert.include(error.message, "rewrote the integrity-pinned scratch lockfile");
			assert.strictEqual(spawner.spawns.length, 1);
		}),
	);

	it.effect("a link that is not a store copy of the declared version is not used", () =>
		Effect.gen(function* () {
			const { error } = yield* failureWith((_command, args) => {
				linkScratch(args, packageAt(join(dirname(store), "elsewhere", NAME), "1.0.0"));
				return {};
			});
			assert.strictEqual(error.reason, "fetchFailed");
			assert.include(error.message, "not a store copy of that version");
		}),
	);

	it.effect("pnpm missing from PATH fails fetchFailed with the remediation", () =>
		Effect.gen(function* () {
			const { error } = yield* failureWith((command) => ScriptedSpawner.notFound(command));
			assert.strictEqual(error.reason, "fetchFailed");
			assert.include(error.message, `pnpm add --config ${NAME}@1.0.0`);
			// The spawn failure stays on the cause chain beneath the diagnosis.
			assert.instanceOf(error.cause, Error);
			assert.isDefined(error.cause.cause);
		}),
	);

	it.effect(
		"an unreadable declaring-side lockfile fails every missing dependency integrityUnavailable, before any spawn",
		() =>
			Effect.gen(function* () {
				const spawner = ScriptedSpawner.make(() => ({}));
				const second = `${NAME}-second`;
				const error = yield* Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					return yield* Effect.flip(
						hooks.inject(root, { [NAME]: SPEC, [second]: SPEC }, {}, undefined, { lockfile: "a: [", ref: "broken" }),
					);
				}).pipe(Effect.provide(ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(spawner.layer))));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.reason, "integrityUnavailable");
				assert.include([NAME, second], error.path);
				// Mapped per dependency: the message names the dependency that failed.
				assert.include(error.message, `config dependency ${error.path}@1.0.0 must be fetched`);
				assert.include(error.message, "the pnpm-lock.yaml of ref broken cannot be read");
				assert.strictEqual(spawner.spawns.length, 0);
			}),
	);

	it.effect("the scratch lockfile pins the declared integrity, and the scratch workspace is removed", () =>
		Effect.gen(function* () {
			let scratch = "";
			let pinned = "";
			yield* failureWith((_command, args) => {
				scratch = optionOf(args, "--dir");
				pinned = readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8");
				return { exit: 1, stderr: "ERR_PNPM_TARBALL_INTEGRITY" };
			});
			assert.include(pinned, `"${NAME}@1.0.0":\n    resolution: {integrity: "${SRI}"}`);
			assert.throws(() => readFileSync(join(scratch, "pnpm-lock.yaml")));
		}),
	);
});

describe("storeDirArgument", () => {
	it("hands pnpm the parent of a versioned store directory, since pnpm appends it", () => {
		assert.strictEqual(storeDirArgument(["/s/store/v11", "/other/v10"]), "/s/store");
	});

	it("passes an unversioned directory through", () => {
		assert.strictEqual(storeDirArgument(["/s/custom"]), "/s/custom");
	});

	it("omits the flag when no store was discovered", () => {
		assert.isUndefined(storeDirArgument([]));
	});
});
