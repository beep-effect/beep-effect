import { assert, describe, it, layer } from "@effect/vitest";
import type { SpawnScript } from "../../effected/commands/index.ts";
import { ScriptedSpawner } from "../../effected/commands/index.ts";
import type { MemoryFileSystemSeed } from "../../effected/memfs/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Duration, Effect, FileSystem, Layer, Path, PlatformError, Redacted, Result, Schema } from "effect";
import { WorkspaceDiscovery, WorkspaceInfo, WorkspacePackage } from "../../effected/workspaces/index.ts";
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
const Discovery = WorkspaceDiscovery.layerTest({ listPackages: Effect.suspend(() => Effect.succeed([carrier, lib])) });
const ENV = {
	PATH: "/usr/bin",
	HOME: "/home/u",
	CI: "true",
	INIT_CWD: "/repo",
	NODE_V8_COVERAGE: "/cov",
	npm_config_user_agent: "pnpm/12",
	pnpm_config_verify_deps_before_run: "false",
	PNPM_SCRIPT_SRC_DIR: "/repo/packages/carrier",
	YARN_NODE_LINKER: "pnp",
};
const SCRUBBED = { PATH: "/usr/bin", HOME: "/home/u" };
const versions: Readonly<Record<string, string>> = { npm: "11.19.1\n", pnpm: "12.5.1\n", bun: "1.4.2\n" };

/** Answers `--version` from `versions` (absent = not installed); everything else from `rest`. */
const script =
	(rest: SpawnScript = () => ({})): SpawnScript =>
	(command, args) => {
		if (args[0] === "--version") {
			const out = versions[command];
			return out === undefined ? ScriptedSpawner.notFound(command) : { stdout: out };
		}
		return rest(command, args);
	};

const suite = (spawner: ScriptedSpawner, seed: Record<string, string> = {}) =>
	layer(Layer.mergeAll(MemoryFileSystem.layerWith(seed), Path.layer, spawner.layer, Discovery));

describe("PackedInstall.run", () => {
	const probing = ScriptedSpawner.make(script());
	suite(probing)((it) => {
		it.effect("probes each manager with --version from the scratch dir, under a scrubbed env, stdin ignored", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm", "pnpm", "yarn", "bun"],
						packFrom: { directory: "dist/pkg" },
						bins: ["x"],
						env: ENV,
					}),
				);
				assert.strictEqual(error.reason, "PackSourceMissing");
				assert.strictEqual(error.package, "@x/carrier");
				const probes = probing.spawns.slice(0, 4);
				assert.deepStrictEqual(
					probes.map((spawn) => [spawn.command, ...spawn.args]),
					[
						["npm", "--version"],
						["pnpm", "--version"],
						["yarn", "--version"],
						["bun", "--version"],
					],
				);
				for (const spawn of probes) {
					assert.strictEqual(spawn.cwd, probes[0]?.cwd);
					assert.isTrue(spawn.cwd?.startsWith("/tmp/"), `probed from ${spawn.cwd}, never the repo`);
					assert.deepStrictEqual(spawn.env, SCRUBBED);
					assert.strictEqual(spawn.extendEnv, false);
					assert.strictEqual(spawn.options.stdin, "ignore");
				}
				assert.strictEqual(probing.spawns.length, 4, "nothing packed from a missing directory");
			}),
		);
	});

	suite(ScriptedSpawner.make(script(() => ({}))))((it) => {
		it.effect("fails NoManagerAvailable rather than succeeding with nothing installed", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["yarn"], bins: [], env: ENV }),
				);
				assert.strictEqual(error.reason, "NoManagerAvailable");
			}),
		);

		it.effect("an empty managers list fails NoManagerAvailable saying so, before anything spawns", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: [], bins: [], env: ENV }),
				);
				assert.strictEqual(error.reason, "NoManagerAvailable");
				assert.include(error.message, "managers is empty");
			}),
		);

		it.effect("require all: a missing manager fails ManagerUnavailable, naming it", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm", "yarn"],
						require: "all",
						bins: [],
						env: ENV,
					}),
				);
				assert.deepStrictEqual([error.reason, error.manager], ["ManagerUnavailable", "yarn"]);
			}),
		);

		it.effect("fails UnknownPackage for a carrier the workspace does not contain", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/nope", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.package], ["UnknownPackage", "@x/nope"]);
			}),
		);
	});

	// bun prints a perfectly good version and exits 1 (a corepack refusal looks like this): only the exit code rules it out.
	const refusing: SpawnScript = (command, args) =>
		command === "bun" && args[0] === "--version" ? { exit: 1, stdout: "1.4.2\n" } : script()(command, args);
	suite(ScriptedSpawner.make(refusing))((it) => {
		it.effect("a manager whose --version exits non-zero is unavailable", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm", "bun"],
						require: "all",
						bins: [],
						env: ENV,
					}),
				);
				assert.deepStrictEqual([error.reason, error.manager], ["ManagerUnavailable", "bun"]);
			}),
		);
	});

	const failing = ScriptedSpawner.make(
		script((command) =>
			command === "pnpm"
				? { exit: 1, stdout: "ERR_PNPM_BOOM the pack broke", stderr: "WARN this project pins pnpm@12.6.0" }
				: {},
		),
	);
	suite(failing)((it) => {
		it.effect(
			"source mode runs pnpm pack in the package dir into an empty destination, and carries both streams on failure",
			() =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						PackedInstall.run({
							carrier: "@x/carrier",
							closure: "auto",
							managers: ["npm"],
							packFrom: "source",
							bins: [],
							env: ENV,
						}),
					);
					assert.deepStrictEqual([error.reason, error.package], ["PackFailed", "@x/carrier"]);
					assert.include(error.output ?? "", "ERR_PNPM_BOOM", "the real error on stdout survives a stderr banner");
					assert.include(error.output ?? "", "WARN this project pins");
					assert.notInclude(error.message, "pnpm install", "the hint is reserved for the workspace-protocol failure");
					const pack = failing.spawns[1];
					assert.strictEqual(pack?.command, "pnpm");
					assert.strictEqual(pack?.cwd, "/repo/packages/carrier");
					assert.deepStrictEqual(
						pack?.args.filter((arg) => !arg.startsWith("/")),
						["pack", "--pack-destination", "--config.ignore-scripts=true"],
					);
				}),
		);
	});

	const backslash = Layer.effect(
		Path.Path,
		Effect.gen(function* () {
			const posix = yield* Path.Path;
			return { ...posix, sep: "\\" };
		}),
	).pipe(Layer.provide(Path.layer));
	const refused = ScriptedSpawner.make(script());
	layer(Layer.mergeAll(MemoryFileSystem.layerWith({}), backslash, refused.layer, Discovery))((it) => {
		it.effect("refuses a non-POSIX platform before spawning anything", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.strictEqual(error.reason, "UnsupportedPlatform");
				assert.strictEqual(refused.spawns.length, 0);
			}),
		);
	});

	const defaulted = ScriptedSpawner.make(script());
	suite(defaulted, { "/repo/packages/carrier/dist/prod/npm/pkg/package.json": "{}" })((it) => {
		it.effect("packs from dist/prod/npm/pkg with npm by default, and fails when no tarball lands", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.package], ["PackFailed", "@x/carrier"]);
				assert.include(error.message, "found 0");
				const pack = defaulted.spawns[1];
				assert.strictEqual(pack?.command, "npm");
				assert.strictEqual(pack?.cwd, "/repo/packages/carrier/dist/prod/npm/pkg");
				const destination = pack?.args[3] ?? "";
				assert.deepStrictEqual(pack?.args, ["pack", "--ignore-scripts", "--pack-destination", destination]);
				assert.isTrue(
					destination.startsWith(defaulted.spawns[0]?.cwd ?? "<no probe>"),
					"the destination lives in the scratch dir",
				);
			}),
		);
	});

	const uninstalled = ScriptedSpawner.make(
		script((command) =>
			command === "pnpm"
				? {
						exit: 1,
						stderr:
							'ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL Cannot resolve workspace protocol of dependency "@x/lib" because this dependency is not installed. Try running "pnpm install".',
					}
				: {},
		),
	);
	suite(uninstalled)((it) => {
		it.effect("source mode in a never-installed workspace names the missing pnpm install", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						packFrom: "source",
						bins: [],
						env: ENV,
					}),
				);
				assert.deepStrictEqual([error.reason, error.package], ["PackFailed", "@x/carrier"]);
				assert.include(error.message, "run pnpm install in the workspace");
				assert.include(error.output ?? "", "ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL");
			}),
		);
	});
});

describe("PackedInstall.run past the pack", () => {
	// The scratch directory is pinned to /scratch through a fault handler, so a
	// seed can stand in for what npm pack writes and what an install links.
	const SCRATCH = "/scratch";
	const CARRIER_TGZ = "/scratch/tarballs/0/x-carrier-1.0.0.tgz";
	const LIB_TGZ = "/scratch/tarballs/1/x-lib-1.0.0.tgz";
	const BIN = MemoryFileSystem.file("#!/usr/bin/env node\n", { mode: 0o755 });
	const seedWith = (extra: MemoryFileSystemSeed = {}): MemoryFileSystemSeed => ({
		"/repo/packages/carrier/dist/prod/npm/pkg/package.json": "{}",
		"/repo/packages/lib/dist/prod/npm/pkg/package.json": "{}",
		[SCRATCH]: MemoryFileSystem.directory(),
		[CARRIER_TGZ]: "",
		[LIB_TGZ]: "",
		...extra,
	});
	const manifests = (carrierDeps: Record<string, string> = { "@x/lib": "^1.0.0" }): SpawnScript =>
		script((command, args) => {
			if (command === "tar") {
				const name = args[1] === CARRIER_TGZ ? "@x/carrier" : "@x/lib";
				const dependencies = name === "@x/carrier" ? carrierDeps : {};
				return { stdout: JSON.stringify({ name, version: "1.0.0", dependencies }) };
			}
			return {};
		});
	const installSuite = (
		spawner: ScriptedSpawner,
		seed: MemoryFileSystemSeed,
		options?: { excludeTestServices: true },
	) =>
		layer(
			Layer.mergeAll(
				MemoryFileSystem.layerWith(seed, { faults: { makeTempDirectoryScoped: () => Effect.succeed(SCRATCH) } }),
				Path.layer,
				spawner.layer,
				Discovery,
			),
			options,
		);

	const happy = ScriptedSpawner.make(manifests());
	installSuite(
		happy,
		seedWith({
			"/scratch/consumer-npm/node_modules/.bin/x": BIN,
			"/scratch/consumer-pnpm/node_modules/.bin/x": BIN,
		}),
	)((it) => {
		it.effect("installs under every available manager and reports consumers, unavailable managers and tarballs", () =>
			Effect.gen(function* () {
				const result = yield* PackedInstall.run({
					carrier: "@x/carrier",
					closure: "auto",
					managers: ["npm", "yarn", "pnpm"],
					bins: ["x"],
					env: ENV,
				});
				assert.deepStrictEqual(
					result.consumers.map((c) => [c.manager, c.managerVersion, c.directory]),
					[
						["npm", "11.19.1", "/scratch/consumer-npm"],
						["pnpm", "12.5.1", "/scratch/consumer-pnpm"],
					],
				);
				assert.strictEqual(result.consumers[0]?.binPath("x"), "/scratch/consumer-npm/node_modules/.bin/x");
				assert.deepStrictEqual(result.unavailable, ["yarn"], "require defaults to any");
				assert.deepStrictEqual(result.tarballs, { "@x/carrier": CARRIER_TGZ, "@x/lib": LIB_TGZ });
				assert.strictEqual(result.scratch, SCRATCH, "the scratch root is exposed");
				assert.strictEqual(result.consumers[0]?.carrier, "@x/carrier", "each consumer records its carrier");
				assert.include(String(result.consumers[0]), "/scratch/consumer-npm", "the printed consumer shows its fields");
				assert.notInclude(String(result.consumers[0]), "/home/u", "but its env prints redacted");

				const tars = happy.spawns.filter((spawn) => spawn.command === "tar");
				assert.deepStrictEqual(
					tars.map((spawn) => [spawn.cwd, ...spawn.args]),
					[
						["/scratch/tarballs/0", "-xzOf", CARRIER_TGZ, "package/package.json"],
						["/scratch/tarballs/1", "-xzOf", LIB_TGZ, "package/package.json"],
					],
				);

				const installs = happy.spawns.filter((spawn) => spawn.args[0] === "install");
				assert.deepStrictEqual(
					installs.map((spawn) => [spawn.command, spawn.cwd, ...spawn.args]),
					[
						["npm", "/scratch/consumer-npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
						["pnpm", "/scratch/consumer-pnpm", "install", "--config.ignore-scripts=true"],
					],
				);
				for (const spawn of installs) {
					assert.deepStrictEqual(spawn.env, SCRUBBED);
					assert.strictEqual(spawn.extendEnv, false);
					assert.strictEqual(spawn.options.stdin, "ignore");
				}

				const fs = yield* FileSystem.FileSystem;
				const npmManifest = Result.getOrThrow(Schema.decodeResult(JsonValue)(yield* fs.readFileString("/scratch/consumer-npm/package.json"))) as Record<
					string,
					unknown
				>;
				assert.strictEqual(npmManifest.packageManager, "npm@11.19.1");
				assert.deepStrictEqual(npmManifest.dependencies, { "@x/carrier": `file:${CARRIER_TGZ}` });
				assert.deepStrictEqual(npmManifest.overrides, { "@x/lib": `file:${LIB_TGZ}` });
				assert.strictEqual(
					yield* fs.readFileString("/scratch/consumer-pnpm/pnpm-workspace.yaml"),
					`minimumReleaseAge: 0\noverrides:\n  "@x/lib": "file:${LIB_TGZ}"\n`,
				);
			}),
		);
	});

	const unresolved = ScriptedSpawner.make(manifests({ "@x/lib": "workspace:^" }));
	installSuite(
		unresolved,
		seedWith(),
	)((it) => {
		it.effect("a packed manifest still carrying workspace: fails UnresolvedProtocol before any install", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.package], ["UnresolvedProtocol", "@x/carrier"]);
				assert.include(error.message, "dependencies.@x/lib: workspace:^");
				assert.strictEqual(
					unresolved.spawns.filter((spawn) => spawn.command === "tar").length,
					1,
					"the manifest was read",
				);
				assert.isFalse(unresolved.spawns.some((spawn) => spawn.args[0] === "install"));
			}),
		);
	});

	const absent = ScriptedSpawner.make(manifests());
	installSuite(
		absent,
		seedWith({ "/scratch/consumer-npm/node_modules/.bin/x": BIN }),
	)((it) => {
		it.effect("a bin the install did not link fails MissingBin, naming it", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						bins: ["x", "ghost"],
						env: ENV,
					}),
				);
				assert.deepStrictEqual([error.reason, error.manager], ["MissingBin", "npm"]);
				assert.include(error.message, ".bin/ghost", "x is present and passed; ghost is the one reported");
				// What .bin DOES hold separates a wrong bin name from a link that never happened.
				assert.strictEqual(error.package, "@x/carrier");
				assert.strictEqual(error.output, "node_modules/.bin holds: x");
				assert.include(error.message, "node_modules/.bin holds: x");
			}),
		);
	});

	installSuite(
		ScriptedSpawner.make(manifests()),
		seedWith(),
	)((it) => {
		it.effect("MissingBin says so when the install linked no .bin directory at all", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: ["x"], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.package], ["MissingBin", "@x/carrier"]);
				assert.strictEqual(error.output, "node_modules/.bin does not exist or cannot be listed");
			}),
		);
	});

	const twice = ScriptedSpawner.make(manifests());
	installSuite(
		twice,
		seedWith({ "/scratch/consumer-npm/node_modules/.bin/x": BIN }),
	)((it) => {
		it.effect("a manager listed twice is probed and installed once, never twice into one directory", () =>
			Effect.gen(function* () {
				const result = yield* PackedInstall.run({
					carrier: "@x/carrier",
					closure: "auto",
					managers: ["npm", "npm"],
					bins: ["x"],
					env: ENV,
				});
				assert.deepStrictEqual(
					result.consumers.map((consumer) => consumer.manager),
					["npm"],
				);
				assert.strictEqual(twice.spawns.filter((spawn) => spawn.args[0] === "--version").length, 1);
				assert.strictEqual(twice.spawns.filter((spawn) => spawn.args[0] === "install").length, 1);
			}),
		);
	});

	const unexecutable = ScriptedSpawner.make(manifests());
	installSuite(
		unexecutable,
		seedWith({ "/scratch/consumer-npm/node_modules/.bin/x": MemoryFileSystem.file("", { mode: 0o644 }) }),
	)((it) => {
		it.effect("a bin present without an execute bit fails MissingBin", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: ["x"], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.manager], ["MissingBin", "npm"]);
				assert.include(error.message, ".bin/x is missing or not executable");
			}),
		);
	});

	const crowded = ScriptedSpawner.make(manifests());
	installSuite(
		crowded,
		seedWith({ "/scratch/tarballs/0/stale-0.9.0.tgz": "" }),
	)((it) => {
		it.effect("two tarballs in one destination fail PackFailed rather than picking one", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.package], ["PackFailed", "@x/carrier"]);
				assert.include(error.message, "found 2");
			}),
		);
	});

	const LONG = "a".repeat(3000);
	const brokenInstall = ScriptedSpawner.make((command, args) =>
		args[0] === "install" ? { exit: 1, stdout: LONG, stderr: "ERR_INSTALL_BOOM" } : manifests()(command, args),
	);
	installSuite(
		brokenInstall,
		seedWith(),
	)((it) => {
		it.effect("a failed install fails InstallFailed with the tail of both streams", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.manager], ["InstallFailed", "npm"]);
				const output = error.output ?? "";
				assert.isTrue(output.endsWith("ERR_INSTALL_BOOM"), "stderr comes last");
				assert.isTrue(output.startsWith("aaa"), "stdout precedes it");
				assert.strictEqual(output.length, 2000, "only the tail is kept");
			}),
		);
	});

	// The real clock: installTimeout is a real ceiling, and a hung install must trip it.
	const hungInstall = ScriptedSpawner.make((command, args) =>
		args[0] === "install" ? { hang: true } : manifests()(command, args),
	);
	installSuite(hungInstall, seedWith(), { excludeTestServices: true })((it) => {
		it.effect("an install that outlives installTimeout fails InstallFailed naming the manager and the ceiling", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						bins: [],
						env: ENV,
						installTimeout: "50 millis",
					}),
				).pipe(Effect.timeout("3 seconds"));
				assert.deepStrictEqual([error.reason, error.manager], ["InstallFailed", "npm"]);
				assert.strictEqual(error.message, "npm install timed out after 50ms");
				assert.isTrue(
					hungInstall.spawns.some((spawn) => spawn.args[0] === "install"),
					"the install was spawned",
				);
			}),
		);
	});

	// The discriminating control: a spawn that never started keeps the spawn-failure message.
	const unspawnable = ScriptedSpawner.make((command, args) =>
		args[0] === "install" ? ScriptedSpawner.notFound(command) : manifests()(command, args),
	);
	installSuite(
		unspawnable,
		seedWith(),
	)((it) => {
		it.effect("an install that cannot spawn fails InstallFailed as could not run, not as a timeout", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.manager], ["InstallFailed", "npm"]);
				assert.strictEqual(error.message, "npm install could not run");
			}),
		);
	});

	// Overrides: packages from outside the workspace, a directory packed like the closure and a tarball used as it is.
	const DIR_TGZ = "/scratch/tarballs/2/y-dir-9.0.0.tgz";
	const EXT_TGZ = "/ext/y-tgz-9.0.0.tgz";
	const overrideSeed = (extra: MemoryFileSystemSeed = {}) =>
		seedWith({
			"/ext/dir/package.json": "{}",
			"/repo/vendor/y-dir/package.json": "{}",
			[EXT_TGZ]: "",
			[DIR_TGZ]: "",
			"/scratch/consumer-npm/node_modules/.bin/x": BIN,
			"/scratch/consumer-pnpm/node_modules/.bin/x": BIN,
			...extra,
		});
	/** Each tarball's packed manifest; the carrier declares the bin x. */
	const packedManifests = (overrides: Record<string, unknown> = {}): SpawnScript =>
		script((command, args) => {
			if (command !== "tar") return {};
			const manifests: Record<string, unknown> = {
				[CARRIER_TGZ]: { name: "@x/carrier", bin: { x: "./x.js" }, dependencies: { "@x/lib": "^1.0.0" } },
				[LIB_TGZ]: { name: "@x/lib", dependencies: { "@y/dir": "^9.0.0" } },
				[DIR_TGZ]: { name: "@y/dir", bin: { "y-dir": "./y.js" }, dependencies: { "@y/tgz": "^9.0.0" } },
				[EXT_TGZ]: { name: "@y/tgz" },
				...overrides,
			};
			return { stdout: JSON.stringify(manifests[args[1] ?? ""] ?? {}) };
		});
	const WithRoot = (root: string) =>
		WorkspaceDiscovery.layerTest({
			listPackages: Effect.suspend(() => Effect.succeed([carrier, lib])),
			info: Effect.suspend(() => Effect.succeed(WorkspaceInfo.make({ root, patterns: ["packages/*"] }))),
		});
	const rootedSuite = (spawner: ScriptedSpawner, seed: MemoryFileSystemSeed, root = "/repo") =>
		layer(
			Layer.mergeAll(
				MemoryFileSystem.layerWith(seed, { faults: { makeTempDirectoryScoped: () => Effect.succeed(SCRATCH) } }),
				Path.layer,
				spawner.layer,
				WithRoot(root),
			),
		);
	const readManifest = Effect.fn("readManifest")(function* (file: string) {
			const fs = yield* FileSystem.FileSystem;
			return Result.getOrThrow(Schema.decodeResult(JsonValue)(yield* fs.readFileString(file))) as Record<string, Record<string, string>>;
		});

	const overridden = ScriptedSpawner.make(packedManifests());
	rootedSuite(
		overridden,
		overrideSeed(),
	)((it) => {
		it.effect(
			"overrides: a directory is npm-packed, a tarball used as it is, and every manager steers both to the tarball",
			() =>
				Effect.gen(function* () {
					const options = {
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm", "pnpm"],
						bins: ["x"],
						env: ENV,
						// A relative path resolves against the workspace root (/repo), never /; a file: prefix is accepted.
						overrides: { "@y/tgz": EXT_TGZ, "@y/dir": "file:vendor/y-dir" },
						consumerDependencies: { "@y/tgz": "^9.0.0" },
					} as const;
					const planned = yield* PackedInstall.closure(options.carrier, options);
					assert.strictEqual(overridden.spawns.length, 0, "closure spawns nothing");
					const result = yield* PackedInstall.run(options);
					assert.deepStrictEqual(result.tarballs, {
						"@x/carrier": CARRIER_TGZ,
						"@x/lib": LIB_TGZ,
						"@y/dir": DIR_TGZ,
						"@y/tgz": EXT_TGZ,
					});
					assert.deepStrictEqual(
						planned,
						Object.keys(result.tarballs),
						"closure names exactly what the run packed, in order",
					);

					const packs = overridden.spawns.filter((spawn) => spawn.args[0] === "pack");
					assert.deepStrictEqual(
						packs.map((spawn) => [spawn.command, spawn.cwd, spawn.args[3]]),
						[
							["npm", "/repo/packages/carrier/dist/prod/npm/pkg", "/scratch/tarballs/0"],
							["npm", "/repo/packages/lib/dist/prod/npm/pkg", "/scratch/tarballs/1"],
							["npm", "/repo/vendor/y-dir", "/scratch/tarballs/2"],
						],
						"the directory is packed in place, the tarball is not packed at all",
					);
					const tars = overridden.spawns.filter((spawn) => spawn.command === "tar");
					assert.deepStrictEqual(
						tars.at(-1)?.args,
						["-xzOf", EXT_TGZ, "package/package.json"],
						"its manifest is still read",
					);

					const specs = {
						"@x/lib": `file:${LIB_TGZ}`,
						"@y/dir": `file:${DIR_TGZ}`,
						"@y/tgz": `file:${EXT_TGZ}`,
					};
					const npm = yield* readManifest("/scratch/consumer-npm/package.json");
					assert.deepStrictEqual(npm.overrides, specs);
					assert.deepStrictEqual(npm.dependencies, {
						"@x/carrier": `file:${CARRIER_TGZ}`,
						"@y/tgz": `file:${EXT_TGZ}`,
					});
					const fs = yield* FileSystem.FileSystem;
					assert.strictEqual(
						yield* fs.readFileString("/scratch/consumer-pnpm/pnpm-workspace.yaml"),
						`minimumReleaseAge: 0\noverrides:\n${Object.entries(specs)
							.map(([name, spec]) => `  "${name}": "${spec}"`)
							.join("\n")}\n`,
					);
				}),
		);
	});

	const fromWorkspace = ScriptedSpawner.make(packedManifests());
	rootedSuite(
		fromWorkspace,
		overrideSeed({
			"/repo/pnpm-workspace.yaml": [
				"packages:",
				"  - packages/*",
				"overrides:",
				'  "@y/dir": "file:../ext/dir"',
				'  "@y/tgz": "file:/ext/stale.tgz"',
				'  "@y/registry": "^1.0.0"',
				'  "parent>@y/child": "file:../ext/child"',
				"",
			].join("\n"),
		}),
	)((it) => {
		it.effect("workspaceOverrides takes the root's file: overrides, and an explicit entry wins over one", () =>
			Effect.gen(function* () {
				const result = yield* PackedInstall.run({
					carrier: "@x/carrier",
					closure: "auto",
					managers: ["npm"],
					bins: ["x"],
					env: ENV,
					workspaceOverrides: true,
					overrides: { "@y/tgz": EXT_TGZ },
				});
				const npm = yield* readManifest("/scratch/consumer-npm/package.json");
				assert.deepStrictEqual(npm.overrides, {
					"@x/lib": `file:${LIB_TGZ}`,
					"@y/dir": `file:${DIR_TGZ}`,
					"@y/tgz": `file:${EXT_TGZ}`,
				});
				assert.deepStrictEqual(Object.keys(result.tarballs), ["@x/carrier", "@x/lib", "@y/dir", "@y/tgz"]);
			}),
		);

		it.effect("a workspace override whose path does not exist fails InvalidOverride naming it", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(PackedInstall.closure("@x/carrier", { workspaceOverrides: true }));
				assert.deepStrictEqual([error.reason, error.package], ["InvalidOverride", "@y/tgz"]);
				assert.strictEqual(error.message, "override @y/tgz: /ext/stale.tgz does not exist");
			}),
		);
	});

	const invalid = ScriptedSpawner.make(packedManifests());
	rootedSuite(
		invalid,
		overrideSeed({
			"/ext/readme.md": "",
			"/ext/empty": MemoryFileSystem.directory(),
			"/broken/pnpm-workspace.yaml": "overrides: [unclosed\n",
		}),
	)((it) => {
		const reject = Effect.fn("reject")(function* (overrides: Record<string, string>, message: string) {
				const error = yield* Effect.flip(PackedInstall.closure("@x/carrier", { overrides }));
				assert.deepStrictEqual([error.reason, error.message], ["InvalidOverride", message]);
			});

		it.effect(
			"an override naming the carrier or a closure member fails InvalidOverride: the workspace copy is proven",
			() =>
				Effect.gen(function* () {
					yield* reject(
						{ "@x/lib": "/ext/dir" },
						"override @x/lib: a closure member is always packed from the workspace; overrides replace only packages outside it",
					);
					yield* reject(
						{ "@x/carrier": "/ext/dir" },
						"override @x/carrier: the carrier is always packed from the workspace; overrides replace only packages outside it",
					);
				}),
		);

		it.effect(
			"a path that is neither a package directory nor a .tgz fails InvalidOverride, before anything spawns",
			() =>
				Effect.gen(function* () {
					yield* reject(
						{ "@y/doc": "/ext/readme.md" },
						"override @y/doc: /ext/readme.md is neither a package directory nor a .tgz",
					);
					yield* reject({ "@y/empty": "/ext/empty" }, "override @y/empty: /ext/empty has no package.json to pack");
					yield* reject({ "@y/gone": "/ext/gone" }, "override @y/gone: /ext/gone does not exist");
					assert.strictEqual(invalid.spawns.length, 0);
				}),
		);

		it.effect("closure defaults to auto and lists the overrides after the closure, by name", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* PackedInstall.closure("@x/carrier"), ["@x/carrier", "@x/lib"]);
				assert.deepStrictEqual(
					yield* PackedInstall.closure("@x/carrier", {
						closure: [],
						overrides: { "@y/tgz": EXT_TGZ, "@y/dir": "/ext/dir" },
					}),
					["@x/carrier", "@y/dir", "@y/tgz"],
				);
			}),
		);
	});

	rootedSuite(
		ScriptedSpawner.make(packedManifests()),
		overrideSeed(),
		"/norepo",
	)((it) => {
		it.effect("workspaceOverrides at a root with no pnpm-workspace.yaml fails InvalidOverride", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(PackedInstall.closure("@x/carrier", { workspaceOverrides: true }));
				assert.deepStrictEqual(
					[error.reason, error.message],
					["InvalidOverride", "workspaceOverrides reads /norepo/pnpm-workspace.yaml, which could not be read"],
				);
			}),
		);
	});

	rootedSuite(
		ScriptedSpawner.make(packedManifests()),
		overrideSeed({ "/broken/pnpm-workspace.yaml": "overrides: [unclosed\n" }),
		"/broken",
	)((it) => {
		it.effect("workspaceOverrides over a pnpm-workspace.yaml that is not YAML fails InvalidOverride", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(PackedInstall.closure("@x/carrier", { workspaceOverrides: true }));
				assert.deepStrictEqual(
					[error.reason, error.message],
					["InvalidOverride", "/broken/pnpm-workspace.yaml is not valid YAML"],
				);
			}),
		);
	});

	const misnamed = ScriptedSpawner.make(packedManifests({ [EXT_TGZ]: { name: "@y/other" } }));
	rootedSuite(
		misnamed,
		overrideSeed(),
	)((it) => {
		it.effect("an override whose tarball packs another name fails InvalidOverride before any install", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						bins: [],
						env: ENV,
						overrides: { "@y/tgz": EXT_TGZ },
					}),
				);
				assert.deepStrictEqual([error.reason, error.package], ["InvalidOverride", "@y/tgz"]);
				assert.strictEqual(error.message, `override @y/tgz: ${EXT_TGZ} packs @y/other, not @y/tgz`);
				assert.isFalse(misnamed.spawns.some((spawn) => spawn.args[0] === "install"));
			}),
		);
	});

	// Only the carrier declares its bins: a closure member declaring one of them could take the .bin slot.
	const conflicting = ScriptedSpawner.make(
		packedManifests({ [LIB_TGZ]: { name: "@x/lib", bin: { "lib-only": "./l.js", x: "./mirror.js" } } }),
	);
	rootedSuite(
		conflicting,
		overrideSeed(),
	)((it) => {
		it.effect("a closure member declaring the carrier's bin fails BinConflict before any install", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({ carrier: "@x/carrier", closure: "auto", managers: ["npm"], bins: [], env: ENV }),
				);
				assert.deepStrictEqual([error.reason, error.package], ["BinConflict", "@x/lib"]);
				assert.include(error.message, "@x/lib declares the bin x, which the carrier @x/carrier declares");
				assert.include(error.message, "pass allowSharedBins: true", "the message names the way out");
				assert.isFalse(conflicting.spawns.some((spawn) => spawn.args[0] === "install"));
			}),
		);

		it.effect("allowSharedBins skips BinConflict, deliberately sharing the name, and still verifies the bins", () =>
			Effect.gen(function* () {
				const result = yield* PackedInstall.run({
					carrier: "@x/carrier",
					closure: "auto",
					managers: ["npm"],
					bins: ["x"],
					env: ENV,
					allowSharedBins: true,
				});
				assert.deepStrictEqual(
					result.consumers.map((consumer) => consumer.manager),
					["npm"],
				);
				assert.isTrue(
					conflicting.spawns.some((spawn) => spawn.args[0] === "install"),
					"the install ran",
				);
				const missing = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						bins: ["x", "ghost"],
						env: ENV,
						allowSharedBins: true,
					}),
				);
				assert.deepStrictEqual([missing.reason, missing.manager], ["MissingBin", "npm"]);
				assert.include(missing.message, ".bin/ghost");
			}),
		);

		it.effect("allowSharedBins: false is the default: shared bin names still fail", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						bins: [],
						env: ENV,
						allowSharedBins: false,
					}),
				);
				assert.strictEqual(error.reason, "BinConflict");
			}),
		);
	});

	// A string bin links under the unscoped package name: @y/x's "./x.js" is the bin x.
	const conflictingOverride = ScriptedSpawner.make(packedManifests({ [EXT_TGZ]: { name: "@y/x", bin: "./x.js" } }));
	rootedSuite(
		conflictingOverride,
		overrideSeed(),
	)((it) => {
		it.effect("an override package declaring the carrier's bin fails BinConflict too", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: [],
						managers: ["npm"],
						bins: [],
						env: ENV,
						overrides: { "@y/x": EXT_TGZ },
					}),
				);
				assert.deepStrictEqual([error.reason, error.package], ["BinConflict", "@y/x"]);
				assert.isFalse(conflictingOverride.spawns.some((spawn) => spawn.args[0] === "install"));
			}),
		);
	});

	// The real clock: packTimeout is a real ceiling.
	const hungPack = ScriptedSpawner.make((command, args) =>
		args[0] === "pack" ? { hang: true } : manifests()(command, args),
	);
	installSuite(hungPack, seedWith(), { excludeTestServices: true })((it) => {
		it.effect("a pack that outlives packTimeout fails PackFailed naming the package and the ceiling", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.run({
						carrier: "@x/carrier",
						closure: "auto",
						managers: ["npm"],
						bins: [],
						env: ENV,
						packTimeout: "50 millis",
					}),
				).pipe(Effect.timeout("3 seconds"));
				assert.deepStrictEqual([error.reason, error.package], ["PackFailed", "@x/carrier"]);
				assert.strictEqual(error.message, "npm pack timed out after 50ms for @x/carrier");
			}),
		);
	});
});

describe("InstalledConsumer.runBin", () => {
	const BIN_DIR = "/scratch/consumer-npm";
	const consumer = InstalledConsumer.make({
		manager: "npm",
		managerVersion: "11.19.1",
		directory: BIN_DIR,
		// A trap left in a hand-made consumer's env is still scrubbed from the base.
		env: Redacted.make({ PATH: "/usr/bin", HOME: "/home/u", XDG_DATA_HOME: "/home/u/.local/share", INIT_CWD: "/repo" }),
	});
	const runs = ScriptedSpawner.make((command) =>
		command.endsWith("/tool") ? { stdout: "1.2.3\n", stderr: "warn\n", exit: 3 } : ScriptedSpawner.notFound(command),
	);
	layer(runs.layer)((it) => {
		it.effect(
			"runs the bin from the consumer under the install env, the caller's env winning over the scrub, a non-zero exit a result",
			() =>
				Effect.gen(function* () {
					const output = yield* consumer.runBin("tool", ["--version"], {
						env: { XDG_DATA_HOME: "/scratch/xdg", HOME: undefined, CI: "true", npm_config_user_agent: "pnpm/12" },
					});
					assert.deepStrictEqual([output.stdout, output.stderr, output.exitCode], ["1.2.3\n", "warn\n", 3]);
					const [spawn] = runs.spawns;
					assert.deepStrictEqual(
						[spawn?.command, ...(spawn?.args ?? [])],
						[`${BIN_DIR}/node_modules/.bin/tool`, "--version"],
					);
					assert.strictEqual(spawn?.cwd, BIN_DIR);
					// HOME: undefined deletes; CI and npm_config_* are explicit, so they survive the scrub.
					assert.deepStrictEqual(spawn?.env, {
						PATH: "/usr/bin",
						XDG_DATA_HOME: "/scratch/xdg",
						CI: "true",
						npm_config_user_agent: "pnpm/12",
					});
					assert.strictEqual(spawn?.extendEnv, false);
					assert.strictEqual(spawn?.options.stdin, "ignore");
				}),
		);

		it("command is the Command runBin spawns, stdin left to the spawner so a probe can write to it", () => {
			const command = consumer.command("tool", ["--version"], {
				env: { XDG_DATA_HOME: "/scratch/xdg", HOME: undefined, CI: "true" },
				cwd: "/elsewhere",
			});
			assert.strictEqual(command.command, `${BIN_DIR}/node_modules/.bin/tool`);
			assert.deepStrictEqual(command.args, ["--version"]);
			assert.strictEqual(command.options.cwd, "/elsewhere");
			assert.deepStrictEqual(command.options.env, { PATH: "/usr/bin", XDG_DATA_HOME: "/scratch/xdg", CI: "true" });
			assert.strictEqual(command.options.extendEnv, false);
			assert.isUndefined(command.options.stdin);
			assert.strictEqual(consumer.command("tool").options.cwd, BIN_DIR, "the cwd defaults to the consumer");
		});

		it.effect("runBin spawns command's bin, arguments, cwd and environment, with stdin ignored", () =>
			Effect.gen(function* () {
				const options = { env: { XDG_DATA_HOME: "/scratch/xdg", INIT_CWD: "/kept" }, cwd: "/work" };
				yield* consumer.runBin("tool", ["a", "b"], options);
				const spawn = runs.spawns.at(-1);
				const command = consumer.command("tool", ["a", "b"], options);
				assert.deepStrictEqual(
					[spawn?.command, spawn?.args, spawn?.cwd, spawn?.env, spawn?.extendEnv],
					[command.command, command.args, command.options.cwd, command.options.env, command.options.extendEnv],
				);
				assert.strictEqual(spawn?.options.stdin, "ignore");
			}),
		);

		it.effect("a bin that cannot spawn fails BinFailed naming the manager and the bin", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(consumer.runBin("absent"));
				assert.deepStrictEqual([error.reason, error.manager], ["BinFailed", "npm"]);
				assert.strictEqual(error.message, "npm: absent could not run");
			}),
		);

		it.effect("a hand-made consumer without env runs under only the options env, from the cwd given", () =>
			Effect.gen(function* () {
				const bare = InstalledConsumer.make({ manager: "pnpm", managerVersion: "12.5.1", directory: BIN_DIR });
				yield* bare.runBin("tool", [], { env: { PATH: "/bin" }, cwd: "/elsewhere" });
				const spawn = runs.spawns.at(-1);
				assert.deepStrictEqual(spawn?.env, { PATH: "/bin" });
				assert.strictEqual(spawn?.cwd, "/elsewhere");
			}),
		);
	});

	// The real clock: the bin's ceiling is a real ceiling.
	const hung = ScriptedSpawner.make(() => ({ hang: true }));
	layer(hung.layer, { excludeTestServices: true })((it) => {
		it.effect("a bin that outlives its timeout fails BinFailed naming the ceiling", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(consumer.runBin("tool", [], { timeout: "50 millis" })).pipe(
					Effect.timeout("3 seconds"),
				);
				assert.deepStrictEqual([error.reason, error.message], ["BinFailed", "npm: tool timed out after 50ms"]);
			}),
		);
	});
});

describe("PackedInstall.timeoutBudget", () => {
	const minutes = (duration: Duration.Duration): number => Duration.toMillis(duration) / 60_000;

	it("sums every manager's probe, install and perConsumer, every package's pack and manifest read, the slack and cleanup", () => {
		const budget = PackedInstall.timeoutBudget({
			managers: ["npm", "pnpm", "yarn", "bun"],
			installTimeout: "3 minutes",
			packages: 3,
			perConsumer: "2 minutes",
		});
		// 4 x (0.5 + 3 + 2) + 3 x (2 + 0.5) + 0.5 untimed + 1 cleanup
		assert.strictEqual(minutes(budget), 31);
		assert.strictEqual(Duration.format(budget), "31m");
	});

	it("defaults installTimeout to the run's four minutes and perConsumer to one runBin's minute, and counts a repeated manager once", () => {
		const budget = PackedInstall.timeoutBudget({ managers: ["npm", "npm"], packages: 1 });
		// 1 x (0.5 + 4 + 1) + 1 x 2.5 + 0.5 untimed + 1 cleanup
		assert.strictEqual(minutes(budget), 9.5);
		// An install-only test passes zero explicitly.
		assert.strictEqual(
			minutes(PackedInstall.timeoutBudget({ managers: ["npm"], packages: 1, perConsumer: "0 seconds" })),
			8.5,
		);
	});

	it("takes the run's packTimeout per package, and the names closure returns as the package count", () => {
		const budget = PackedInstall.timeoutBudget({
			managers: ["npm", "pnpm", "yarn", "bun"],
			installTimeout: "3 minutes",
			packTimeout: "30 seconds",
			packages: ["my-tool", "my-tool-cli", "my-tool-core"],
			perConsumer: "2 minutes",
		});
		// 4 x (0.5 + 3 + 2) + 3 x (0.5 + 0.5) + 0.5 untimed + 1 cleanup
		assert.strictEqual(Duration.format(budget), "26m 30s");
		assert.strictEqual(
			minutes(PackedInstall.timeoutBudget({ managers: ["npm"], packages: ["a", "b"] })),
			minutes(PackedInstall.timeoutBudget({ managers: ["npm"], packages: 2 })),
		);
	});
});

describe("InstalledConsumer.binProvenance", () => {
	const DIR = "/scratch/consumer-npm";
	const NM = `${DIR}/node_modules`;
	const at = (manager: "npm" | "pnpm", directory = DIR) =>
		InstalledConsumer.make({ manager, managerVersion: "1.0.0", directory });
	const SEED: MemoryFileSystemSeed = {
		// A named manifest AT the bound: a walk that passed the consumer directory would claim the orphan for it.
		[`${DIR}/package.json`]: JSON.stringify({ name: "the-consumer", private: true }),
		[`${NM}/@x/carrier/package.json`]: JSON.stringify({ name: "@x/carrier", version: "1.0.0" }),
		[`${NM}/@x/carrier/dist/package.json`]: JSON.stringify({ type: "module" }),
		[`${NM}/@x/carrier/dist/bin.js`]: "#!/usr/bin/env node\n",
		[`${NM}/@x/cli/package.json`]: JSON.stringify({ name: "@x/cli", version: "1.0.0" }),
		[`${NM}/@x/cli/bin.js`]: "#!/usr/bin/env node\n",
		[`${NM}/@x/nulled/package.json`]: JSON.stringify({ name: "@x/nulled", version: "1.0.0" }),
		[`${NM}/@x/nulled/lib/package.json`]: "null",
		[`${NM}/@x/nulled/lib/cli.js`]: "#!/usr/bin/env node\n",
		[`${NM}/@x/broken/package.json`]: "{ not json",
		[`${NM}/@x/broken/cli.js`]: "#!/usr/bin/env node\n",
		[`${NM}/loose.js`]: "#!/usr/bin/env node\n",
		[`${NM}/.bin/tool`]: MemoryFileSystem.symlink("../@x/carrier/dist/bin.js"),
		[`${NM}/.bin/shadowed`]: MemoryFileSystem.symlink("../@x/cli/bin.js"),
		[`${NM}/.bin/nulled`]: MemoryFileSystem.symlink("../@x/nulled/lib/cli.js"),
		[`${NM}/.bin/broken`]: MemoryFileSystem.symlink("../@x/broken/cli.js"),
		[`${NM}/.bin/orphan`]: MemoryFileSystem.symlink("../loose.js"),
		[`${NM}/.bin/dangling`]: MemoryFileSystem.symlink("../@x/gone/bin.js"),
		[`${NM}/.bin/shim`]: MemoryFileSystem.file('#!/bin/sh\nexec node "$basedir/../@x/carrier/dist/bin.js" "$@"\n', {
			mode: 0o755,
		}),
		"/alias": MemoryFileSystem.symlink("/scratch"),
	};
	layer(Layer.mergeAll(MemoryFileSystem.layerWith(SEED), Path.layer))((it) => {
		it.effect("names the package a .bin symlink resolves into, past a nameless nested package.json", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* at("npm").binProvenance("tool"), {
					package: "@x/carrier",
					target: `${NM}/@x/carrier/dist/bin.js`,
				});
			}),
		);

		it.effect("tells a hoisted bin from another package apart from the carrier's", () =>
			Effect.gen(function* () {
				assert.strictEqual((yield* at("npm").binProvenance("shadowed"))?.package, "@x/cli");
			}),
		);

		it.effect("passes over a package.json that is valid JSON but not an object", () =>
			Effect.gen(function* () {
				assert.strictEqual((yield* at("npm").binProvenance("nulled"))?.package, "@x/nulled");
			}),
		);

		it.effect("realpaths the consumer directory first, so an alias or a trailing slash keeps the bound", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* at("npm", "/alias/consumer-npm/").binProvenance("tool"), {
					package: "@x/carrier",
					target: `${NM}/@x/carrier/dist/bin.js`,
				});
			}),
		);

		it.effect("undefined means only an existing entry that is not a symlink (pnpm's shim)", () =>
			Effect.gen(function* () {
				assert.isUndefined(yield* at("pnpm").binProvenance("shim"));
			}),
		);

		it.effect("a link into no named package inside the consumer fails UnownedBin, never the consumer's own name", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(at("npm").binProvenance("orphan"));
				assert.deepStrictEqual([error.reason, error.manager], ["UnownedBin", "npm"]);
				assert.strictEqual(
					error.message,
					`npm: node_modules/.bin/orphan links to ${NM}/loose.js, which lies in no named package inside ${DIR}`,
				);
			}),
		);

		it.effect("a missing entry and a dangling link both fail MissingBin", () =>
			Effect.gen(function* () {
				const absent = yield* Effect.flip(at("npm").binProvenance("absent"));
				assert.deepStrictEqual(
					[absent.reason, absent.message],
					["MissingBin", "npm: node_modules/.bin/absent does not exist"],
				);
				const dangling = yield* Effect.flip(at("npm").binProvenance("dangling"));
				assert.deepStrictEqual(
					[dangling.reason, dangling.message],
					["MissingBin", "npm: node_modules/.bin/dangling is a link to nothing"],
				);
			}),
		);

		it.effect("a package.json that is not JSON fails Io saying so", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(at("npm").binProvenance("broken"));
				assert.deepStrictEqual([error.reason, error.message], ["Io", `${NM}/@x/broken/package.json is not JSON`]);
			}),
		);
	});

	// Node reports "not a link" as EINVAL, tagged Unknown with the errno on the cause; anything else is a real failure.
	const readLinkFails = (tag: "Unknown" | "PermissionDenied" | "BadResource", code: string) =>
		MemoryFileSystem.layerWith(SEED, {
			faults: {
				readLink: (path) =>
					Effect.fail(
						PlatformError.systemError({
							_tag: tag,
							module: "FileSystem",
							method: "readLink",
							pathOrDescriptor: path,
							cause: Object.assign(new Error(code), { code }),
						}),
					),
			},
		});
	layer(Layer.mergeAll(readLinkFails("Unknown", "EINVAL"), Path.layer))((it) => {
		it.effect("a Node-style EINVAL from readLink on an existing entry is a shim: undefined", () =>
			Effect.gen(function* () {
				assert.isUndefined(yield* at("pnpm").binProvenance("shim"));
			}),
		);
	});
	layer(Layer.mergeAll(readLinkFails("PermissionDenied", "EACCES"), Path.layer))((it) => {
		it.effect("an EACCES from readLink propagates as Io, never read as a shim", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(at("npm").binProvenance("tool"));
				assert.deepStrictEqual([error.reason, error.message], ["Io", `could not read the link ${NM}/.bin/tool`]);
			}),
		);
	});
	// memfs once tagged "not a link" BadResource; it now raises Node's shape, so BadResource is a real failure.
	layer(Layer.mergeAll(readLinkFails("BadResource", "EBADF"), Path.layer))((it) => {
		it.effect("a BadResource from readLink propagates as Io, never read as a shim", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(at("pnpm").binProvenance("shim"));
				assert.deepStrictEqual([error.reason, error.message], ["Io", `could not read the link ${NM}/.bin/shim`]);
			}),
		);
	});
	// An Unknown whose errno is not EINVAL is a real failure too: the errno, not the tag, decides.
	layer(Layer.mergeAll(readLinkFails("Unknown", "EIO"), Path.layer))((it) => {
		it.effect("an Unknown readLink failure with another errno propagates as Io", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(at("pnpm").binProvenance("shim"));
				assert.strictEqual(error.reason, "Io");
			}),
		);
	});
});

describe("PackedInstall.timeoutBudgetFor", () => {
	layer(Layer.mergeAll(MemoryFileSystem.layerWith({}), Path.layer, Discovery))((it) => {
		it.effect("plans the closure from the run's own options and budgets exactly what timeoutBudget would", () =>
			Effect.gen(function* () {
				const options = {
					carrier: "@x/carrier",
					closure: "auto",
					managers: ["npm", "pnpm"],
					bins: [],
					env: ENV,
					installTimeout: "3 minutes",
					packTimeout: "20 seconds",
				} as const;
				const budget = yield* PackedInstall.timeoutBudgetFor(options, { perConsumer: "1 minute" });
				assert.deepStrictEqual(
					budget,
					PackedInstall.timeoutBudget({
						managers: ["npm", "pnpm"],
						installTimeout: "3 minutes",
						packTimeout: "20 seconds",
						packages: ["@x/carrier", "@x/lib"],
						perConsumer: "1 minute",
					}),
				);
				// 2 x (0.5 + 3 + 1) + 2 x (20s + 30s) + 0.5 untimed + 1 cleanup
				assert.strictEqual(Duration.format(budget), "12m 10s");
				// Defaults: the run's own four-minute install and two-minute pack, no per-consumer work.
				const defaults = yield* PackedInstall.timeoutBudgetFor({
					...options,
					installTimeout: undefined,
					packTimeout: undefined,
					closure: [],
				});
				assert.strictEqual(
					Duration.format(defaults),
					Duration.format(PackedInstall.timeoutBudget({ managers: ["npm", "pnpm"], packages: 1 })),
				);
			}),
		);

		it.effect("fails as closure does", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					PackedInstall.timeoutBudgetFor({
						carrier: "@x/nope",
						closure: "auto",
						managers: ["npm"],
						bins: [],
						env: ENV,
					}),
				);
				assert.deepStrictEqual([error.reason, error.package], ["UnknownPackage", "@x/nope"]);
			}),
		);
	});
});

describe("PackedInstall.timeoutBudgetFor with overrides", () => {
	layer(Layer.mergeAll(MemoryFileSystem.layerWith({ "/ext/y-1.0.0.tgz": "" }), Path.layer, Discovery))((it) => {
		it.effect("counts an override package, because it plans with the run's options, overrides included", () =>
			Effect.gen(function* () {
				const options = {
					carrier: "@x/carrier",
					closure: "auto",
					managers: ["npm"],
					bins: [],
					env: ENV,
					overrides: { "@y/pkg": "/ext/y-1.0.0.tgz" },
				} as const;
				const budget = yield* PackedInstall.timeoutBudgetFor(options);
				assert.deepStrictEqual(
					budget,
					PackedInstall.timeoutBudget({ managers: ["npm"], packages: ["@x/carrier", "@x/lib", "@y/pkg"] }),
				);
				assert.notDeepEqual(budget, PackedInstall.timeoutBudget({ managers: ["npm"], packages: 2 }));
			}),
		);
	});
});

describe("InstalledConsumer.carrierCommand and runCarrierBin", () => {
	const DIR = "/scratch/consumer-npm";
	const NM = `${DIR}/node_modules`;
	const at = (carrier: string | undefined, env: Record<string, string> = { PATH: "/usr/bin", INIT_CWD: "/repo" }) =>
		InstalledConsumer.make({
			manager: "npm",
			managerVersion: "11.19.1",
			directory: DIR,
			env: Redacted.make(env),
			...(carrier === undefined ? {} : { carrier }),
		});
	const SEED: MemoryFileSystemSeed = {
		[`${NM}/@x/carrier/package.json`]: JSON.stringify({
			name: "@x/carrier",
			bin: { tool: "./dist/tool.js", gone: "./dist/gone.js" },
		}),
		[`${NM}/@x/carrier/dist/tool.js`]: "#!/usr/bin/env node\n",
		// The front end won the .bin slot: a link to its bin, not the carrier's.
		[`${NM}/@x/cli/package.json`]: JSON.stringify({ name: "@x/cli", bin: { tool: "./bin.js" } }),
		[`${NM}/@x/cli/bin.js`]: "#!/usr/bin/env node\n",
		[`${NM}/.bin/tool`]: MemoryFileSystem.symlink("../@x/cli/bin.js"),
		[`${NM}/@x/broken/package.json`]: "{ not json",
	};
	const runs = ScriptedSpawner.make((command, args) =>
		command === "node" ? { stdout: `ran ${args.join(" ")}\n`, exit: 2 } : ScriptedSpawner.notFound(command),
	);
	layer(Layer.mergeAll(MemoryFileSystem.layerWith(SEED), Path.layer, runs.layer))((it) => {
		it.effect(
			"resolves the bin through the carrier's own bin map, not the .bin slot, under command's environment",
			() =>
				Effect.gen(function* () {
					const consumer = at("@x/carrier");
					const command = yield* consumer.carrierCommand("tool", ["--version"], {
						env: { XDG_DATA_HOME: "/scratch/xdg" },
						cwd: "/work",
					});
					assert.strictEqual(command.command, "node");
					assert.deepStrictEqual(command.args, [`${NM}/@x/carrier/dist/tool.js`, "--version"]);
					assert.strictEqual(command.options.cwd, "/work");
					assert.strictEqual(command.options.extendEnv, false);
					assert.isUndefined(command.options.stdin, "left open for a probe");
					// The same scrub and layering command() applies.
					const same = consumer.command("tool", [], { env: { XDG_DATA_HOME: "/scratch/xdg" } });
					assert.deepStrictEqual(command.options.env, same.options.env);
					assert.deepStrictEqual(command.options.env, { PATH: "/usr/bin", XDG_DATA_HOME: "/scratch/xdg" });
					// The .bin slot belongs to the front end; carrierCommand never looked there.
					assert.strictEqual((yield* consumer.binProvenance("tool"))?.package, "@x/cli");
					assert.strictEqual((yield* consumer.carrierCommand("tool")).options.cwd, DIR);
				}),
		);

		it.effect("runCarrierBin runs that command with stdin ignored; a non-zero exit is a result", () =>
			Effect.gen(function* () {
				const output = yield* at("@x/carrier").runCarrierBin("tool", ["a"]);
				assert.deepStrictEqual([output.stdout, output.exitCode], [`ran ${NM}/@x/carrier/dist/tool.js a\n`, 2]);
				const spawn = runs.spawns.at(-1);
				assert.deepStrictEqual([spawn?.command, spawn?.cwd, spawn?.options.stdin], ["node", DIR, "ignore"]);
			}),
		);

		it.effect("every way the carrier's bin cannot be found fails MissingBin, naming it", () =>
			Effect.gen(function* () {
				const reasons = [];
				for (const [consumer, name] of [
					[at(undefined), "tool"],
					[at("@x/absent"), "tool"],
					[at("@x/carrier"), "other"],
				] as const) {
					const error = yield* Effect.flip(consumer.carrierCommand(name));
					reasons.push([error.reason, error.message]);
				}
				assert.deepStrictEqual(reasons, [
					["MissingBin", "npm: the carrier's bin tool cannot be found: this consumer records no carrier"],
					["MissingBin", `npm: the carrier's bin tool cannot be found: @x/absent is not installed at ${NM}/@x/absent`],
					["MissingBin", "npm: the carrier's bin other is not declared by @x/carrier"],
				]);
			}),
		);

		it.effect("a bin the carrier declares whose file is not there fails MissingBin, and spawns nothing", () =>
			Effect.gen(function* () {
				const before = runs.spawns.length;
				const error = yield* Effect.flip(at("@x/carrier").runCarrierBin("gone"));
				assert.deepStrictEqual(
					[error.reason, error.package, error.message],
					[
						"MissingBin",
						"@x/carrier",
						`npm: the carrier's bin gone points at ${NM}/@x/carrier/dist/gone.js, which does not exist`,
					],
				);
				assert.strictEqual(runs.spawns.length, before);
			}),
		);

		it.effect("a carrier manifest that is not JSON fails Io", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(at("@x/broken").carrierCommand("tool"));
				assert.deepStrictEqual(
					[error.reason, error.message],
					["Io", `${NM}/@x/broken/package.json is not a JSON object`],
				);
			}),
		);
	});
});
