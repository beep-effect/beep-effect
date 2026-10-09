import { assert, describe, it, layer } from "@effect/vitest";
import { ScriptedSpawner } from "../../effected/commands/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { ConfigProvider, Effect, Layer, Path, Redacted, Stream, Result, Schema } from "effect";
import { WorkspaceDiscovery, WorkspacePackage } from "../../effected/workspaces/index.ts";
import { InstalledConsumer, PackedInstall } from "../../effected/workspaces/testing.ts";

const JsonValue = Schema.fromJsonString(Schema.Unknown);

const carrier = WorkspacePackage.make({
	name: "@x/carrier",
	version: "1.0.0",
	path: "/repo/packages/carrier",
	packageJsonPath: "/repo/packages/carrier/package.json",
	relativePath: "packages/carrier",
	workspaceRoot: "/repo",
	dependencies: { "@x/lib": "workspace:^" },
});
const lib = WorkspacePackage.make({
	name: "@x/lib",
	version: "1.0.0",
	path: "/repo/packages/lib",
	packageJsonPath: "/repo/packages/lib/package.json",
	relativePath: "packages/lib",
	workspaceRoot: "/repo",
});
const Discovery = WorkspaceDiscovery.layerTest({ listPackages: () => Effect.succeed([carrier, lib]) });
const PROD = "dist/prod/npm/pkg";
const options = { carrier: "@x/carrier", closure: "auto" } as const;

const suite = (seed: Record<string, string>) =>
	layer(Layer.mergeAll(MemoryFileSystem.layerWith(seed), Path.layer, Discovery));

/** Run `self` with `env` as the only configuration, as a test stubs the environment. */
const withEnv =
	(env: Record<string, string>) =>
	<A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
		Effect.provideService(self, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

describe("PackedInstall.preflight and gate", () => {
	suite({
		[`/repo/packages/carrier/${PROD}/package.json`]: "{}",
		[`/repo/packages/lib/${PROD}/package.json`]: "{}",
	})("when the prod build is present", (it) => {
		it.effect("is ready with nothing missing, and gate says run even under CI", () =>
			Effect.gen(function* () {
				const result = yield* PackedInstall.preflight(options);
				assert.deepStrictEqual(result, { ready: true, missing: [] });
				assert.deepStrictEqual(yield* PackedInstall.gate(result).pipe(withEnv({ CI: "true" })), {
					action: "run",
					message: "",
				});
			}),
		);
	});

	// Only the carrier is built; lib has only a dev build, which does not count.
	suite({
		[`/repo/packages/carrier/${PROD}/package.json`]: "{}",
		"/repo/packages/lib/dist/dev/pkg/package.json": "{}",
	})("when one closure member has no prod build", (it) => {
		it.effect("names exactly the missing manifest", () =>
			Effect.gen(function* () {
				const result = yield* PackedInstall.preflight(options);
				assert.deepStrictEqual(result, { ready: false, missing: [`/repo/packages/lib/${PROD}/package.json`] });
			}),
		);

		it.effect("honours packFrom: another directory is checked, and source checks nothing", () =>
			Effect.gen(function* () {
				const dev = yield* PackedInstall.preflight({ ...options, packFrom: { directory: "dist/dev/pkg" } });
				assert.deepStrictEqual(dev, { ready: false, missing: ["/repo/packages/carrier/dist/dev/pkg/package.json"] });
				const source = yield* PackedInstall.preflight({ ...options, packFrom: "source" });
				assert.deepStrictEqual(source, { ready: true, missing: [] });
			}),
		);

		it.effect("an unknown carrier fails UnknownPackage, as run does", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(PackedInstall.preflight({ carrier: "@x/nope", closure: "auto" }));
				assert.strictEqual(error.reason, "UnknownPackage");
			}),
		);
	});

	it.effect("gate skips locally and fails under CI when not ready, naming the paths and the build", () =>
		Effect.gen(function* () {
			const missing = { ready: false, missing: ["/a/package.json", "/b/package.json"] };
			for (const env of [{}, { CI: "" }, { CI: "0" }, { CI: "false" }, { CI: "FALSE" }]) {
				const gate = yield* PackedInstall.gate(missing).pipe(withEnv(env));
				assert.strictEqual(gate.action, "skip", Result.getOrThrow(Schema.encodeResult(JsonValue)(env)));
				assert.include(gate.message, "/a/package.json, /b/package.json");
				assert.include(gate.message, "build:prod");
			}
			for (const ci of ["true", "1", "yes"]) {
				const gate = yield* PackedInstall.gate(missing).pipe(withEnv({ CI: ci }));
				assert.strictEqual(gate.action, "fail", ci);
				assert.include(gate.message, "/a/package.json");
			}
		}),
	);
});

describe("InstalledConsumer.runBin stdin", () => {
	const consumer = InstalledConsumer.make({
		manager: "npm",
		managerVersion: "11.19.1",
		directory: "/scratch/consumer-npm",
		env: Redacted.make({ PATH: "/usr/bin" }),
	});
	const runs = ScriptedSpawner.make(() => ({ stdout: "ok" }));
	layer(runs.layer)((it) => {
		it.effect("omitted and empty stdin are the null device, never an open pipe", () =>
			Effect.gen(function* () {
				yield* consumer.runBin("tool");
				yield* consumer.runBin("tool", [], { stdin: "" });
				assert.deepStrictEqual(
					runs.spawns.map((spawn) => spawn.options.stdin),
					["ignore", "ignore"],
				);
			}),
		);

		it.effect("a string, bytes or a stream reach the spawner as a byte stream", () =>
			Effect.gen(function* () {
				yield* consumer.runBin("tool", [], { stdin: "hello" });
				yield* consumer.runBin("tool", [], { stdin: new Uint8Array([1, 2]) });
				yield* consumer.runBin("tool", [], { stdin: Stream.make(new Uint8Array([3])) });
				for (const spawn of runs.spawns.slice(-3)) {
					assert.notStrictEqual(spawn.options.stdin, "ignore");
					assert.strictEqual(typeof spawn.options.stdin, "object");
				}
			}),
		);
	});
});
