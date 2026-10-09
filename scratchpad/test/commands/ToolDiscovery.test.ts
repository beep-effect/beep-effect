import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { ChildProcess } from "effect/process";
import { ExecContext, LocalExec } from "../../effected/commands/LocalExec.ts";
import type { ScriptResult } from "../../effected/commands/ScriptedSpawner.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";
import { Tool, VersionFlag, VersionJson, VersionNone } from "../../effected/commands/Tool.ts";
import {
	ResolvedTool,
	ToolDiscovery,
	ToolNotFoundError,
	ToolRefusedError,
	ToolVersionMismatchError,
} from "../../effected/commands/ToolDiscovery.ts";

/** A local context: `pnpm exec <tool>` in /repo. */
const pnpmLocal = LocalExec.layerContext(
	ExecContext.make({
		label: "pnpm",
		prefix: ["pnpm", "exec"],
		dlxPrefix: ["pnpm", "dlx"],
		scriptPrefix: ["pnpm", "run"],
		directory: "/repo",
	}),
);

/**
 * Scripts a world where the global tool and the pnpm-local tool answer
 * independently. `undefined` means "absent" (the spawn fails).
 */
const world = (options: { readonly global?: string | undefined; readonly local?: string | undefined }) => {
	return (command: string, _args: ReadonlyArray<string>): ScriptResult => {
		if (command === "pnpm") {
			return options.local === undefined ? ScriptedSpawner.notFound("pnpm") : { stdout: options.local, exit: 0 };
		}
		return options.global === undefined ? ScriptedSpawner.notFound(command) : { stdout: options.global, exit: 0 };
	};
};

/** Runs `program` against a scripted world plus a LocalExec layer. */
const run = <A, E>(
	program: Effect.Effect<A, E, ToolDiscovery>,
	script: (command: string, args: ReadonlyArray<string>) => ScriptResult,
	local: Layer.Layer<LocalExec> = pnpmLocal,
) => {
	const spawner = ScriptedSpawner.make(script);
	const layer = ToolDiscovery.layer.pipe(Layer.provide(Layer.mergeAll(spawner.layer, local)));
	return { effect: Effect.provide(program, layer), spawner };
};

const resolve = (tool: Tool) =>
	Effect.gen(function* () {
		const discovery = yield* ToolDiscovery;
		return yield* discovery.resolve(tool);
	});

describe("ToolDiscovery.resolve — source requirements", () => {
	it.effect("prefers the local tool when both exist", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome")), world({ global: "1.0.0", local: "2.0.0" })).effect;
			assert.instanceOf(resolved, ResolvedTool);
			assert.strictEqual(resolved.source, "local");
			assert.deepStrictEqual(resolved.version, Option.some("2.0.0"));
			assert.deepStrictEqual(resolved.globalVersion, Option.some("1.0.0"));
			assert.deepStrictEqual(resolved.localVersion, Option.some("2.0.0"));
			assert.isTrue(resolved.mismatch);
		}),
	);

	it.effect("falls back to the global tool when there is no local one", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome")), world({ global: "1.0.0" })).effect;
			assert.strictEqual(resolved.source, "global");
			assert.isFalse(resolved.mismatch);
		}),
	);

	it.effect("fails with ToolNotFoundError when the tool is nowhere", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(run(resolve(Tool.named("biome")), world({})).effect);
			assert.instanceOf(error, ToolNotFoundError);
			if (error instanceof ToolNotFoundError) {
				assert.strictEqual(error.tool, "biome");
				assert.deepStrictEqual([...error.searched], ["global", "local"]);
			}
		}),
	);

	it.effect("source 'local' refuses a tool that exists only globally", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				run(resolve(Tool.named("biome", { source: "local" })), world({ global: "1.0.0" })).effect,
			);
			assert.instanceOf(error, ToolNotFoundError);
			if (error instanceof ToolNotFoundError) {
				assert.deepStrictEqual([...error.searched], ["local"]);
			}
		}),
	);

	it.effect("source 'global' refuses a tool that exists only locally", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				run(resolve(Tool.named("biome", { source: "global" })), world({ local: "2.0.0" })).effect,
			);
			assert.instanceOf(error, ToolNotFoundError);
		}),
	);

	it.effect("source 'both' requires both", () =>
		Effect.gen(function* () {
			const ok = yield* run(
				resolve(Tool.named("biome", { source: "both" })),
				world({ global: "1.0.0", local: "1.0.0" }),
			).effect;
			assert.strictEqual(ok.source, "local");
			const error = yield* Effect.flip(
				run(resolve(Tool.named("biome", { source: "both" })), world({ global: "1.0.0" })).effect,
			);
			assert.instanceOf(error, ToolNotFoundError);
		}),
	);

	it.effect("with no LocalExec context, only the global tool is consulted", () =>
		Effect.gen(function* () {
			const resolved = yield* run(
				resolve(Tool.named("biome")),
				world({ global: "1.0.0", local: "2.0.0" }),
				LocalExec.layerNone,
			).effect;
			assert.strictEqual(resolved.source, "global");
			assert.isTrue(Option.isNone(resolved.localVersion));
		}),
	);
});

describe("ToolDiscovery.resolve — mismatch policy", () => {
	const both = world({ global: "1.0.0", local: "2.0.0" });

	it.effect("preferLocal (the default) reports the mismatch and picks local", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome")), both).effect;
			assert.strictEqual(resolved.source, "local");
			assert.isTrue(resolved.mismatch);
		}),
	);

	it.effect("preferGlobal picks global", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome", { onMismatch: "preferGlobal" })), both).effect;
			assert.strictEqual(resolved.source, "global");
			assert.deepStrictEqual(resolved.version, Option.some("1.0.0"));
		}),
	);

	it.effect("fail refuses a mismatch with both versions on the error", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(run(resolve(Tool.named("biome", { onMismatch: "fail" })), both).effect);
			assert.instanceOf(error, ToolVersionMismatchError);
			if (error instanceof ToolVersionMismatchError) {
				assert.strictEqual(error.globalVersion, "1.0.0");
				assert.strictEqual(error.localVersion, "2.0.0");
			}
		}),
	);

	it.effect("matching versions are not a mismatch, whatever the policy", () =>
		Effect.gen(function* () {
			const resolved = yield* run(
				resolve(Tool.named("biome", { onMismatch: "fail" })),
				world({ global: "1.0.0", local: "1.0.0" }),
			).effect;
			assert.isFalse(resolved.mismatch);
		}),
	);
});

describe("ToolDiscovery.resolve — version extraction", () => {
	it.effect("extracts a version from noisy --version output", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome")), () => ({
				stdout: "Version: 2.3.1 (build abc)",
				exit: 0,
			})).effect;
			assert.deepStrictEqual(resolved.version, Option.some("2.3.1"));
		}),
	);

	it.effect("extracts a prerelease version", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("node")), () => ({ stdout: "v22.1.0-nightly.3", exit: 0 })).effect;
			assert.deepStrictEqual(resolved.version, Option.some("22.1.0-nightly.3"));
		}),
	);

	it.effect("honours a caller-supplied capture pattern", () =>
		Effect.gen(function* () {
			const tool = Tool.named("weird", { version: VersionFlag.make({ flag: "-V", pattern: "build-(\\w+)" }) });
			const resolved = yield* run(resolve(tool), () => ({ stdout: "build-deadbeef", exit: 0 })).effect;
			assert.deepStrictEqual(resolved.version, Option.some("deadbeef"));
		}),
	);

	it.effect("extracts from JSON at a dotted path", () =>
		Effect.gen(function* () {
			const tool = Tool.named("deno", { version: VersionJson.make({ flag: "info --json", path: "deno.version" }) });
			const resolved = yield* run(resolve(tool), () => ({
				stdout: JSON.stringify({ deno: { version: "1.44.0" } }),
				exit: 0,
			})).effect;
			assert.deepStrictEqual(resolved.version, Option.some("1.44.0"));
		}),
	);

	it.effect("a tool that reports no parseable version still resolves, with no version", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("tar")), () => ({ stdout: "bsdtar (unknown)", exit: 0 })).effect;
			assert.isTrue(Option.isNone(resolved.version));
			assert.strictEqual(resolved.source, "local");
		}),
	);

	it.effect("VersionNone skips extraction entirely but still proves presence", () =>
		Effect.gen(function* () {
			const tool = Tool.named("tar", { version: VersionNone.make({}) });
			const resolved = yield* run(resolve(tool), () => ({ stdout: "", exit: 0 })).effect;
			assert.isTrue(Option.isNone(resolved.version));
		}),
	);

	it.effect("a non-zero exit still proves the tool EXISTS", () =>
		// `tool --version` exiting non-zero means the tool ran. Absence is a
		// spawn failure, never an exit code.
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("weird")), () => ({ stderr: "usage", exit: 1 })).effect;
			assert.instanceOf(resolved, ResolvedTool);
		}),
	);
});

describe("ResolvedTool.command", () => {
	it.effect("a global tool runs bare", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome")), world({ global: "1.0.0" })).effect;
			const command = resolved.command("check", ".");
			if (!ChildProcess.isStandardCommand(command)) assert.fail("expected a standard command");
			assert.deepStrictEqual([command.command, ...command.args], ["biome", "check", "."]);
		}),
	);

	it.effect("a local tool runs through the launcher prefix, in its directory", () =>
		Effect.gen(function* () {
			const resolved = yield* run(resolve(Tool.named("biome")), world({ local: "2.0.0" })).effect;
			const command = resolved.command("check");
			if (!ChildProcess.isStandardCommand(command)) assert.fail("expected a standard command");
			assert.deepStrictEqual([command.command, ...command.args], ["pnpm", "exec", "biome", "check"]);
			assert.strictEqual(command.options.cwd, "/repo");
		}),
	);
});

describe("ToolDiscovery — the option-injection guard", () => {
	it.effect("refuses an option-like tool name BEFORE any spawn", () =>
		Effect.gen(function* () {
			const harness = run(resolve(Tool.named("--version")), () => {
				throw new Error("the guard must refuse before any spawn");
			});
			const error = yield* Effect.flip(harness.effect);
			assert.instanceOf(error, ToolRefusedError);
			assert.lengthOf(harness.spawner.spawns, 0, "nothing may be spawned for a refused name");
		}),
	);

	it.effect("refuses an empty tool name", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(run(resolve(Tool.named("")), () => ({ exit: 0 })).effect);
			assert.instanceOf(error, ToolRefusedError);
		}),
	);
});

describe("ToolDiscovery — caching", () => {
	it.effect("a second resolve of the same tool spawns nothing", () =>
		Effect.gen(function* () {
			const harness = run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					yield* discovery.resolve(Tool.named("biome"));
					return yield* discovery.resolve(Tool.named("biome"));
				}),
				world({ global: "1.0.0", local: "1.0.0" }),
			);
			yield* harness.effect;
			assert.lengthOf(harness.spawner.spawns, 2, "one global probe and one local probe, not four");
		}),
	);

	it.effect("two CONCURRENT resolves probe once", () =>
		Effect.gen(function* () {
			const harness = run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					return yield* Effect.all([discovery.resolve(Tool.named("biome")), discovery.resolve(Tool.named("biome"))], {
						concurrency: "unbounded",
					});
				}),
				world({ global: "1.0.0", local: "1.0.0" }),
			);
			yield* harness.effect;
			assert.lengthOf(harness.spawner.spawns, 2, "concurrent resolves must share one probe");
		}),
	);

	it.effect("invalidate forces a re-probe", () =>
		Effect.gen(function* () {
			const harness = run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					yield* discovery.resolve(Tool.named("biome"));
					yield* discovery.invalidate(Tool.named("biome"));
					return yield* discovery.resolve(Tool.named("biome"));
				}),
				world({ global: "1.0.0", local: "1.0.0" }),
			);
			yield* harness.effect;
			assert.lengthOf(harness.spawner.spawns, 4, "invalidation must re-probe both locations");
		}),
	);

	it.effect("invalidateAll forces a re-probe", () =>
		Effect.gen(function* () {
			const harness = run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					yield* discovery.resolve(Tool.named("biome"));
					yield* discovery.invalidateAll;
					return yield* discovery.resolve(Tool.named("biome"));
				}),
				world({ global: "1.0.0", local: "1.0.0" }),
			);
			yield* harness.effect;
			assert.lengthOf(harness.spawner.spawns, 4);
		}),
	);

	it.effect("the cache stores EVIDENCE, so a second Tool with different constraints is answered correctly", () =>
		// v3 keyed the cache by tool name and stored the resolved answer, so a
		// second definition with different constraints silently inherited the
		// first one's policy decision. Evidence is cached; policy is applied per
		// call.
		Effect.gen(function* () {
			const harness = run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					const lenient = yield* discovery.resolve(Tool.named("biome"));
					const strict = yield* Effect.flip(discovery.resolve(Tool.named("biome", { source: "both" })));
					return { lenient, strict };
				}),
				world({ local: "2.0.0" }),
			);
			const { lenient, strict } = yield* harness.effect;
			assert.strictEqual(lenient.source, "local");
			assert.instanceOf(strict, ToolNotFoundError);
			assert.lengthOf(harness.spawner.spawns, 2, "the second resolve reuses the cached evidence");
		}),
	);

	it.effect("ABSENCE is not memoized — a tool installed mid-process is found", () =>
		// "Not found" is a *successful* lookup carrying negative evidence, so a
		// naive success-TTL memoizes it and the tool stays absent for the process
		// lifetime. An action that provisions a runtime and then uses it is the
		// case that breaks. A tool that exists does not stop existing; a tool
		// that does not exist very often starts to.
		Effect.gen(function* () {
			let alive = false;
			const harness = run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					const first = yield* Effect.flip(discovery.resolve(Tool.named("biome")));
					alive = true;
					const second = yield* discovery.resolve(Tool.named("biome"));
					return { first, second };
				}),
				(command) => (alive ? { stdout: "1.0.0", exit: 0 } : ScriptedSpawner.notFound(command)),
			);
			const { first, second } = yield* harness.effect;
			assert.instanceOf(first, ToolNotFoundError);
			assert.instanceOf(second, ResolvedTool);
		}),
	);
});

describe("ToolDiscovery.isAvailable", () => {
	it.effect("true when the tool resolves", () =>
		Effect.gen(function* () {
			const available = yield* run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					return yield* discovery.isAvailable(Tool.named("biome"));
				}),
				world({ global: "1.0.0" }),
			).effect;
			assert.isTrue(available);
		}),
	);

	it.effect("false — never a failure — when it does not", () =>
		Effect.gen(function* () {
			const available = yield* run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					return yield* discovery.isAvailable(Tool.named("biome"));
				}),
				world({}),
			).effect;
			assert.isFalse(available);
		}),
	);

	it.effect("false for a refused name, rather than a defect", () =>
		Effect.gen(function* () {
			const available = yield* run(
				Effect.gen(function* () {
					const discovery = yield* ToolDiscovery;
					return yield* discovery.isAvailable(Tool.named("-rf"));
				}),
				() => ({ exit: 0 }),
			).effect;
			assert.isFalse(available);
		}),
	);
});

describe("ToolDiscovery test double", () => {
	it.effect("layerTest answers stubbed members", () =>
		Effect.gen(function* () {
			const discovery = yield* ToolDiscovery;
			const resolved = yield* discovery.resolve(Tool.named("biome"));
			assert.strictEqual(resolved.name, "stubbed");
		}).pipe(
			Effect.provide(
				ToolDiscovery.layerTest({
					resolve: () =>
						Effect.succeed(
							ResolvedTool.make({
								name: "stubbed",
								source: "global",
								version: Option.none(),
								globalVersion: Option.none(),
								localVersion: Option.none(),
								mismatch: false,
							}),
						),
				}),
			),
		),
	);

	it.effect("an unstubbed member dies loudly rather than lying", () =>
		Effect.gen(function* () {
			const discovery = yield* ToolDiscovery;
			const exit = yield* Effect.exit(discovery.resolve(Tool.named("biome")));
			if (exit._tag !== "Failure") {
				assert.fail("expected a defect from an unstubbed member");
			}
			assert.isTrue(exit.cause.reasons.some((reason) => reason._tag === "Die"));
		}).pipe(Effect.provide(ToolDiscovery.layerTest())),
	);
});
