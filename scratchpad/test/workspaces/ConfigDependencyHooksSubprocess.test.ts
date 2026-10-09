// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file newPromise:skip-file
// Parent-side plumbing of `ConfigDependencyHooks.layerSubprocess`, over the
// public `ScriptedSpawner` double from `@effected/commands`.
//
// The child-process semantics (real hook replay, per-name load failures) live
// in `integration/ConfigDependencyHooksSubprocess.int.test.ts`, which spawns a
// real `node`; the declared-version resolution ladder the parent runs BEFORE
// spawning is pinned in `integration/ConfigDependencyResolution.int.test.ts`.
// This suite pins everything else the PARENT decides: when a spawn happens at
// all, the exact argv contract, and how each transport outcome maps onto the
// typed error taxonomy.
//
// The ladder reads the real disk (it must — the pnpm store is real even when
// a FileSystem is virtual), so the root here is a real temp directory whose
// `.pnpm-config/<name>` entries are installed at `1.0.0` with a pnpmfile the
// scripted spawner never actually loads.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { ScriptedSpawner } from "../../effected/commands/index.ts";
import { CatalogAssemblyError } from "../../effected/npm/index.ts";
import { Effect, Fiber, Layer, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { ConfigDependencyHooks } from "../../effected/workspaces/index.ts";

const JsonValue = Schema.fromJsonString(Schema.Unknown);

let ROOT: string;
const SEED = { default: { effect: "^4.0.0" }, named: { "left-pad": "^1.0.0" } } as const;
const INSTALLED = ["dep", "dep-a", "@scope/dep-b", "@scope/pkg", "broken-dep"] as const;

/** The pnpmfile path the parent resolves for an installed fixture. */
const pnpmfileOf = (name: string): string => join(ROOT, "node_modules", ".pnpm-config", name, "pnpmfile.mjs");
/** The `file:` URL the child receives for a resolved pnpmfile — the parent converts, the child only imports. */
const pnpmfileUrlOf = (name: string): string => pathToFileURL(pnpmfileOf(name)).href;

beforeAll(() => {
	ROOT = mkdtempSync(join(tmpdir(), "effected-hooks-argv-"));
	for (const name of INSTALLED) {
		const dir = join(ROOT, "node_modules", ".pnpm-config", name);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
		writeFileSync(join(dir, "pnpmfile.mjs"), "export const hooks = {};\n");
	}
});

afterAll(() => {
	if (ROOT !== undefined) rmSync(ROOT, { recursive: true, force: true });
});

/** A payload the subprocess protocol would print, framed as the final stdout line. */
const emitted = (payload: unknown, noise = ""): string => `${noise}\n${JSON.stringify(payload)}\n`;

/** The layer under test over a scripted spawner, plus the spawn log. */
const harness = (script: Parameters<typeof ScriptedSpawner.make>[0]) => {
	const spawner = ScriptedSpawner.make(script);
	const layer = ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(spawner.layer));
	return { spawner, layer };
};

describe("ConfigDependencyHooks.layerSubprocess — no-spawn fast paths", () => {
	it.effect("empty configDependencies returns the seed without spawning anything", () => {
		const { spawner, layer } = harness(() => ({ stdout: emitted({ ok: true, config: {} }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, {}, SEED);
			assert.deepStrictEqual(result, {
				catalogs: SEED,
				releaseAge: {},
				peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny: [] },
				replays: {},
			});
			// The discriminating half: nothing was spawned to produce that answer.
			assert.strictEqual(spawner.spawns.length, 0);
		}).pipe(Effect.provide(layer));
	});

	it.effect("a '..' path segment in a name fails typed BEFORE any spawn", () => {
		const { spawner, layer } = harness(() => ({ stdout: emitted({ ok: true, config: {} }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject(ROOT, { "../../evil": "1.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			assert.strictEqual(error.path, "../../evil");
			// The malicious name never reached a subprocess.
			assert.strictEqual(spawner.spawns.length, 0);
		}).pipe(Effect.provide(layer));
	});

	it.effect("a scoped name (a legitimate '/') is not rejected and DOES spawn", () => {
		const { spawner, layer } = harness(() => ({ stdout: emitted({ ok: true, config: {} }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			yield* hooks.inject(ROOT, { "@scope/pkg": "1.0.0" }, SEED);
			assert.strictEqual(spawner.spawns.length, 1);
		}).pipe(Effect.provide(layer));
	});
});

describe("ConfigDependencyHooks.layerSubprocess — the argv contract", () => {
	it.effect("spawns node with the static script and seed/rules/resolved pairs via argv, never interpolated", () => {
		const { spawner, layer } = harness(() => ({ stdout: emitted({ ok: true, config: {} }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			yield* hooks.inject(ROOT, { "dep-a": "1.0.0", "@scope/dep-b": "1.0.0+sha512-abc" }, SEED);
			const spawn = spawner.spawns[0];
			assert.isDefined(spawn);
			assert.strictEqual(spawn.command, "node");
			assert.strictEqual(spawn.args[0], "--input-type=module");
			assert.strictEqual(spawn.args[1], "-e");
			const script = spawn.args[2];
			assert.isDefined(script);
			// The script is a STATIC constant: no runtime value is spliced into the
			// program text — seed, rules and the resolved pairs travel exclusively
			// as argv.
			assert.isFalse(script?.includes(ROOT));
			assert.isFalse(script?.includes("dep-a"));
			assert.deepStrictEqual(Result.getOrThrow(Schema.decodeResult(JsonValue)(spawn.args[3] ?? "")), SEED);
			// The rules seed rides the same argv channel, in its own slot ahead of
			// the pairs — never spliced into the program text either.
			assert.deepStrictEqual(Result.getOrThrow(Schema.decodeResult(JsonValue)(spawn.args[4] ?? "")), {
				allowedVersions: {},
				ignoreMissing: [],
				allowAny: [],
			});
			// The PARENT resolved each declared version to a pnpmfile and converted
			// it to a `file:` URL; the child receives `[name, fileUrl]` pairs as ONE
			// JSON argument and performs no lookup or path conversion of its own.
			assert.deepStrictEqual(Result.getOrThrow(Schema.decodeResult(JsonValue)(spawn.args[5] ?? "")), [
				["dep-a", pnpmfileUrlOf("dep-a")],
				["@scope/dep-b", pnpmfileUrlOf("@scope/dep-b")],
			]);
			assert.strictEqual(spawn.args.length, 6);
		}).pipe(Effect.provide(layer));
	});

	it.effect("a declared version the ladder cannot resolve fails typed BEFORE any spawn", () => {
		const { spawner, layer } = harness(() => ({ stdout: emitted({ ok: true, config: {} }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			// `dep` is installed at 1.0.0; declaring 2.0.0 finds nothing anywhere.
			const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "2.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			assert.strictEqual(error.path, "dep");
			assert.strictEqual(spawner.spawns.length, 0);
		}).pipe(Effect.provide(layer));
	});

	it.effect("carries the supplied peer-dependency rules through argv, not the empty default", () => {
		const { spawner, layer } = harness(() => ({ stdout: emitted({ ok: true, config: {} }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const rules = { allowedVersions: { "a>b": "1.2.3" }, ignoreMissing: ["c"], allowAny: [] };
			yield* hooks.inject(ROOT, { "dep-a": "1.0.0" }, SEED, rules);
			const spawn = spawner.spawns[0];
			assert.isDefined(spawn);
			// Seeded, not merged by us: the workspace file's rules go INTO the
			// threaded config so the hooks merge onto them, exactly as pnpm seeds
			// its own config.
			assert.deepStrictEqual(Result.getOrThrow(Schema.decodeResult(JsonValue)(spawn.args[4] ?? "")), rules);
			assert.isFalse(spawn.args[2]?.includes("1.2.3"));
		}).pipe(Effect.provide(layer));
	});
});

describe("ConfigDependencyHooks.layerSubprocess — transport failures are typed, never defects", () => {
	it.effect("a spawn failure (node not found) fails typed as a hooks-source CatalogAssemblyError", () => {
		const { layer } = harness((command) => ScriptedSpawner.notFound(command));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			assert.strictEqual(error.path, ROOT);
		}).pipe(Effect.provide(layer));
	});

	it.effect("a non-zero exit with no result payload fails typed, carrying exit code and stderr", () => {
		const { layer } = harness(() => ({ stdout: "", stderr: "boom from node", exit: 7 }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			assert.strictEqual(error.path, ROOT);
			// The cause is Run.jsonLine's CommandOutputError, whose message carries
			// the exit code and the stderr tail as context.
			assert.include(String((error.cause as Error).message), "exit 7");
			assert.include(String((error.cause as Error).message), "boom from node");
		}).pipe(Effect.provide(layer));
	});

	it.effect("unparseable stdout (a zero exit, but no JSON line) fails typed", () => {
		const { layer } = harness(() => ({ stdout: "definitely not json\nnor this\n" }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
		}).pipe(Effect.provide(layer));
	});

	it.effect("a replay that never settles fails typed at the thirty-second ceiling", () => {
		// A pnpmfile that loops or awaits forever presents as a child that never
		// exits: `hang: true` makes the scripted handle's exitCode never resolve.
		// The replay's hard-coded timeout must kill it and surface through the
		// same typed `hooks`-source path as any other transport failure — never a
		// hang of the memoized assemble pass, never a defect.
		const { spawner, layer } = harness(() => ({ hang: true }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const fiber = yield* Effect.forkChild(Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED)));
			// The parent resolves the declared version over REAL async fs before it
			// spawns, and the virtual clock cannot advance that — so let the event
			// loop turn until the spawn has happened, THEN jump past the ceiling.
			// Bounded: if the ladder ever stops resolving `dep@1.0.0`, inject fails
			// typed BEFORE any spawn and an unbounded loop would spin until vitest's
			// timeout killed the file; this instead fails on the assertion that
			// names the real cause.
			for (let turn = 0; spawner.spawns.length === 0 && turn < 1_000; turn++) {
				yield* Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));
			}
			assert.strictEqual(spawner.spawns.length, 1, "the replay child was never spawned — did resolution fail first?");
			yield* TestClock.adjust("31 seconds");
			const error = yield* Fiber.join(fiber);
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			assert.strictEqual(error.path, ROOT);
		}).pipe(Effect.provide(layer));
	});

	it.effect("a serialized per-name failure maps to a typed error NAMING that dependency", () => {
		const { layer } = harness(() => ({
			stdout: emitted({
				ok: false,
				name: "broken-dep",
				message: "Unexpected token",
				stack: "SyntaxError: Unexpected token\n  at x",
			}),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject(ROOT, { "broken-dep": "1.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			// Per-name attribution survives the process boundary.
			assert.strictEqual(error.path, "broken-dep");
			const cause = error.cause as Error;
			assert.strictEqual(cause.message, "Unexpected token");
			assert.strictEqual(cause.stack, "SyntaxError: Unexpected token\n  at x");
		}).pipe(Effect.provide(layer));
	});
});

describe("ConfigDependencyHooks.layerSubprocess — result folding in the parent", () => {
	it.effect("the returned config slice folds through the same normalization as layerLive", () => {
		const { layer } = harness(() => ({
			stdout: emitted(
				{
					ok: true,
					config: {
						catalog: { effect: "^4.0.0", "hooked-dep": "^9.9.9" },
						catalogs: { named: { "left-pad": "^1.0.0" }, extra: { "extra-dep": "^1.2.3" } },
						minimumReleaseAge: 1440,
						minimumReleaseAgeExclude: ["@scope/b"],
					},
				},
				// A hook's own console noise on stdout: the parent reads the LAST line.
				"hook says hello\n{not json either",
			),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED);
			// The default catalog is re-folded under "default", named catalogs kept.
			assert.strictEqual(result.catalogs.default?.["hooked-dep"], "^9.9.9");
			assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
			assert.strictEqual(result.catalogs.named?.["left-pad"], "^1.0.0");
			assert.strictEqual(result.catalogs.extra?.["extra-dep"], "^1.2.3");
			// Release-age keys map onto the partial gate's field names.
			assert.deepStrictEqual(result.releaseAge, { ageMinutes: 1440, exclude: ["@scope/b"] });
		}).pipe(Effect.provide(layer));
	});

	it.effect("a hook MERGING onto the seeded rules keeps both, which is why we seed", () => {
		// The measured behaviour this design rests on: pnpm seeds its own config
		// and takes back what the hooks return, so a hook that merges leaves the
		// seeded rules in place beside its own. The kit therefore never merges the
		// two sources itself.
		const { layer } = harness(() => ({
			stdout: emitted({
				ok: true,
				config: {
					peerDependencyRules: {
						allowedVersions: { "seeded>peer": "1.0.0", "hooked>peer": "2.0.0" },
						ignoreMissing: ["from-hook"],
						allowAny: [],
					},
				},
			}),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, {
				allowedVersions: { "seeded>peer": "1.0.0" },
				ignoreMissing: [],
				allowAny: [],
			});
			assert.deepStrictEqual(result.peerDependencyRules, {
				allowedVersions: { "seeded>peer": "1.0.0", "hooked>peer": "2.0.0" },
				ignoreMissing: ["from-hook"],
				allowAny: [],
			});
		}).pipe(Effect.provide(layer));
	});

	it.effect("a hook OVERWRITING the seeded rules wins — pnpm's behaviour, not a bug to repair", () => {
		// Stated as behaviour so nobody "fixes" it into a merger: a hook that
		// replaces the block replaces it for pnpm too.
		const { layer } = harness(() => ({
			stdout: emitted({
				ok: true,
				config: { peerDependencyRules: { allowedVersions: { "only>hook": "3.0.0" } } },
			}),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, {
				allowedVersions: { "seeded>peer": "1.0.0" },
				ignoreMissing: [],
				allowAny: [],
			});
			assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "only>hook": "3.0.0" });
		}).pipe(Effect.provide(layer));
	});

	it.effect("a malformed rules axis leaves the prior value, without blanking its siblings", () => {
		// Wrong in exactly one way: `ignoreMissing` alone is garbage, and it must
		// not take a well-formed `allowedVersions` down with it.
		const { layer } = harness(() => ({
			stdout: emitted({
				ok: true,
				config: { peerDependencyRules: { allowedVersions: { "a>b": "1.0.0" }, ignoreMissing: "not-an-array" } },
			}),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, {
				allowedVersions: {},
				ignoreMissing: ["seeded-ignore"],
				allowAny: [],
			});
			assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "a>b": "1.0.0" });
			assert.deepStrictEqual(result.peerDependencyRules.ignoreMissing, ["seeded-ignore"]);
		}).pipe(Effect.provide(layer));
	});

	it.effect("an allowedVersions entry that is not a string is a malformed axis too", () => {
		// The sibling of the test above, on the axis it does not cover: the block
		// IS an object, so an object-shaped check accepts it, but one entry is a
		// number. The public contract is name→RANGE, and a non-string value
		// reaches range parsing as a rule nobody can evaluate — so the whole axis
		// is malformed and the prior value stands.
		const { layer } = harness(() => ({
			stdout: emitted({
				ok: true,
				config: { peerDependencyRules: { allowedVersions: { "a>b": 1 }, ignoreMissing: ["from-hook"] } },
			}),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, {
				allowedVersions: { "seeded>peer": "1.0.0" },
				ignoreMissing: [],
				allowAny: [],
			});
			assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "seeded>peer": "1.0.0" });
			// And it does not blank its siblings, exactly as the array axes do not.
			assert.deepStrictEqual(result.peerDependencyRules.ignoreMissing, ["from-hook"]);
		}).pipe(Effect.provide(layer));
	});

	it.effect("an allowedVersions block whose entries are ALL strings still wins", () => {
		// The regression guard for the test above, wrong in exactly one way
		// against it: the same shape with a string value. A check that fired on
		// the block's presence rather than on its entries would fail here.
		const { layer } = harness(() => ({
			stdout: emitted({
				ok: true,
				config: { peerDependencyRules: { allowedVersions: { "a>b": "1" } } },
			}),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, {
				allowedVersions: { "seeded>peer": "1.0.0" },
				ignoreMissing: [],
				allowAny: [],
			});
			assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "a>b": "1" });
		}).pipe(Effect.provide(layer));
	});

	it.effect("hooks that touch no rules return the seeded rules unchanged", () => {
		const { layer } = harness(() => ({ stdout: emitted({ ok: true, config: { catalog: {} } }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const seeded = { allowedVersions: { "a>b": "1.0.0" }, ignoreMissing: [], allowAny: [] };
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, seeded);
			assert.deepStrictEqual(result.peerDependencyRules, seeded);
		}).pipe(Effect.provide(layer));
	});

	it.effect("a malformed returned config slice falls back to the seed — data is never fatal", () => {
		const { layer } = harness(() => ({ stdout: emitted({ ok: true, config: "garbage" }) }));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED);
			assert.deepStrictEqual(result.catalogs, SEED);
			assert.deepStrictEqual(result.releaseAge, {});
		}).pipe(Effect.provide(layer));
	});

	it.effect("absent release-age keys contribute an empty gate, never explicit undefined", () => {
		const { layer } = harness(() => ({
			stdout: emitted({ ok: true, config: { catalog: {}, catalogs: {} } }),
		}));
		return Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED);
			assert.deepStrictEqual(result.releaseAge, {});
			assert.isFalse("ageMinutes" in result.releaseAge);
			assert.isFalse("exclude" in result.releaseAge);
		}).pipe(Effect.provide(layer));
	});
});
