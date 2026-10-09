// @effect-diagnostics nodeBuiltinImport:skip-file processEnvInEffect:skip-file
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: fixture file contents
//
// PackedInstall against real package managers and a real fixture workspace.
//
// The unit suite (PackedInstall.test.ts) stops at the pack: the tarball lands
// in a random temp directory that memfs cannot pre-seed. Everything past it —
// a real `npm pack` and `pnpm pack`, reading the packed manifest with the
// host's `tar`, the macOS /var -> /private/var realpath, the installs, the
// bins, and the scratch directory's removal — is proven here.
//
// Hermetic by construction: the fixture has no external dependencies, and
// every install runs with its network routed to a dead proxy and corepack's
// network switched off. A manager that tried to reach the registry (an
// override that missed) or to download itself (a `packageManager` pin that
// did not match the running version) fails instead of quietly succeeding.
//
// Run it through pnpm (`pnpm test` or `pnpm vitest run`): the first test
// asserts the parent manager's context is present, so the scrub is exercised
// against the real variables rather than a hand-written list.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, describe, layer } from "@effect/vitest";
import { Run } from "../../../effected/commands/index.ts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/process";
import type { PackageManagerName } from "../../../effected/workspaces/index.ts";
import { Workspaces } from "../../../effected/workspaces/index.ts";
import type { InstalledConsumer, PackedInstallBudget } from "../../../effected/workspaces/testing.ts";
import { PackedInstall } from "../../../effected/workspaces/testing.ts";

const JsonValue = S.fromJsonString(S.Record(S.String, S.Unknown));

const CARRIER = "@effected/packed-install-fixture-carrier";
const LIB = "@effected/packed-install-fixture-lib";
const PLUGIN = "@effected/packed-install-fixture-plugin";
const VERSION = "0.0.0-fixture";
const GREETING = "hello from the packed lib";
const BIN_NAME = "fixture-carrier";
const BIN = `#!/usr/bin/env node\nimport { greet } from "${LIB}";\nconsole.log(greet());\n`;
const SHARED_CARRIER = "@effected/packed-install-fixture-shared-plugin";
const SHARED_FRONT = "@effected/packed-install-fixture-shared-cli";
const SHARED_BIN = "fixture-shared";
/** The effected bundler's prod npm output, and PackedInstall's default pack source. */
const PROD = "dist/prod/npm/pkg";

// A port nothing listens on. Every manager honours HTTP(S)_PROXY, so a
// registry fetch or a self-download fails fast with ECONNREFUSED.
//
// Assumes no proxy in the user's ~/.npmrc. HOME is inherited on purpose, so a
// `proxy` or `https-proxy` set there may win over these variables (precedence
// not verified). The dead-proxy control below would then fail with a proxy or
// E404 error instead of ECONNREFUSED. The installs stay hermetic either way,
// because the fixture has no external dependencies. The scrub strips every
// `npm_config_*` variable, so an env override cannot pin it from here.
const DEAD_PROXY = "http://127.0.0.1:9";
const OFFLINE: Readonly<Record<string, string | undefined>> = {
	...process.env,
	HTTPS_PROXY: DEAD_PROXY,
	HTTP_PROXY: DEAD_PROXY,
	https_proxy: DEAD_PROXY,
	http_proxy: DEAD_PROXY,
	NO_PROXY: undefined,
	no_proxy: undefined,
	COREPACK_ENABLE_NETWORK: "0",
};
/** What the bins and the fixture's own spawns run under: the same scrub the installs get. */
const CHILD_ENV = PackedInstall.scrubEnv(OFFLINE);

const write = (root: string, file: string, content: string, mode?: number): void => {
	mkdirSync(dirname(join(root, file)), { recursive: true });
	writeFileSync(join(root, file), content, mode === undefined ? undefined : { mode });
};
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * A three-package pnpm workspace. The source manifests carry `workspace:^`;
 * each `dist/prod/npm/pkg` is the publish-ready build with those specifiers
 * resolved, as the bundler writes it. `carrier/dist/raw` is a broken build
 * that still carries `workspace:^`.
 *
 * - lib: exports `greet`.
 * - carrier: a bin that prints lib's greeting (a runtime dependency on lib).
 * - plugin: a peer dependency on lib and no bin — P3's S1 shape, where the
 *   consumer itself imports the peer.
 */
const writeFixture = (): string => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "packed-install-fixture-")));
	write(root, "package.json", json({ name: "packed-install-fixture-root", version: "0.0.0", private: true }));
	write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");

	const lib = { name: LIB, version: VERSION, type: "module", exports: { ".": "./index.js" }, files: ["index.js"] };
	const greet = `export const greet = () => "${GREETING}";\n`;
	for (const dir of ["packages/lib", `packages/lib/${PROD}`]) {
		write(root, `${dir}/package.json`, json(lib));
		write(root, `${dir}/index.js`, greet);
	}

	const carrier = (dependency: string) => ({
		name: CARRIER,
		version: VERSION,
		type: "module",
		bin: { [BIN_NAME]: "./bin.js" },
		files: ["bin.js"],
		dependencies: { [LIB]: dependency },
	});
	const carriers: ReadonlyArray<readonly [string, string]> = [
		["packages/carrier", "workspace:^"],
		[`packages/carrier/${PROD}`, VERSION],
		["packages/carrier/dist/raw", "workspace:^"],
	];
	for (const [dir, dependency] of carriers) {
		write(root, `${dir}/package.json`, json(carrier(dependency)));
		write(root, `${dir}/bin.js`, BIN, 0o755);
	}

	const plugin = (peer: string) => ({
		name: PLUGIN,
		version: VERSION,
		type: "module",
		exports: { ".": "./index.js" },
		files: ["index.js"],
		peerDependencies: { [LIB]: peer },
	});
	const shout = `import { greet } from "${LIB}";\nexport const shout = () => greet().toUpperCase();\n`;
	for (const [dir, peer] of [
		["packages/plugin", "workspace:^"],
		[`packages/plugin/${PROD}`, VERSION],
	] as const) {
		write(root, `${dir}/package.json`, json(plugin(peer)));
		write(root, `${dir}/index.js`, shout);
	}

	// A carrier and a front end that BOTH declare fixture-shared: the mirror-bin shape allowSharedBins permits.
	const shared = (name: string, printed: string, dependencies: Record<string, string>) => ({
		manifest: {
			name,
			version: VERSION,
			type: "module",
			bin: { [SHARED_BIN]: "./bin.js" },
			files: ["bin.js"],
			dependencies,
		},
		bin: `#!/usr/bin/env node\nconsole.log(${JSON.stringify(printed)});\n`,
	});
	for (const [dir, pkg] of [
		["packages/shared-cli", shared(SHARED_FRONT, "front", {})],
		[`packages/shared-cli/${PROD}`, shared(SHARED_FRONT, "front", {})],
		["packages/shared-plugin", shared(SHARED_CARRIER, "carrier", { [SHARED_FRONT]: "workspace:^" })],
		[`packages/shared-plugin/${PROD}`, shared(SHARED_CARRIER, "carrier", { [SHARED_FRONT]: VERSION })],
	] as const) {
		write(root, `${dir}/package.json`, json(pkg.manifest));
		write(root, `${dir}/bin.js`, pkg.bin, 0o755);
	}
	return root;
};

/** The version a manager reports from outside any project, or undefined when it is absent. */
const probe = (pm: string): string | undefined => {
	const out = spawnSync(pm, ["--version"], { cwd: tmpdir(), env: CHILD_ENV, encoding: "utf8" });
	return out.status === 0 ? out.stdout.trim().replace(/^v/, "") : undefined;
};
const VERSIONS: Readonly<Record<PackageManagerName, string | undefined>> = {
	npm: probe("npm"),
	pnpm: probe("pnpm"),
	yarn: probe("yarn"),
	bun: probe("bun"),
};
const HAS_NPM = VERSIONS.npm !== undefined;
const HAS_PNPM = VERSIONS.pnpm !== undefined;
const HAS_YARN = VERSIONS.yarn !== undefined;

const ROOT = writeFixture();
// P3 C8: pnpm packs a `workspace:` specifier only in an INSTALLED workspace.
// No external dependencies, so the install is offline.
const PREINSTALL = HAS_PNPM
	? spawnSync("pnpm", ["install", "--offline", "--config.ignore-scripts=true"], {
			cwd: ROOT,
			env: CHILD_ENV,
			encoding: "utf8",
		})
	: undefined;
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

const Live = Workspaces.layer({ cwd: ROOT }).pipe(Layer.provideMerge(NodeServices.layer));

const LINKED = "@effected/packed-install-fixture-linked";
const BRIDGE = "@effected/packed-install-fixture-bridge";
/** Outside the workspace, and at a version no registry has: only an override can install it. */
const EXTERNAL = "@effected/packed-install-fixture-external";
const EXTERNAL_VERSION = "7.7.7-unpublished";
const LINKED_BIN = "fixture-linked";
const BRIDGED = "bridged from the unpublished external";

/**
 * A second workspace for `overrides`: carrier `linked` -> closure member
 * `bridge` -> `external@7.7.7-unpublished`, which lives beside the workspace,
 * not in it. The root's `pnpm-workspace.yaml` links it the dogfood way,
 * `"<name>": "file:../external"`, and `externalTarball` is the same package
 * packed with npm. Nothing here is ever installed in the workspace itself.
 */
const writeLinkedFixture = (): { readonly base: string; readonly root: string; readonly externalTarball: string } => {
	const base = realpathSync(mkdtempSync(join(tmpdir(), "packed-install-linked-")));
	const root = join(base, "workspace");
	write(root, "package.json", json({ name: "packed-install-linked-root", version: "0.0.0", private: true }));
	write(
		root,
		"pnpm-workspace.yaml",
		`packages:\n  - packages/*\noverrides:\n  ${JSON.stringify(EXTERNAL)}: "file:../external"\n`,
	);
	const external = {
		name: EXTERNAL,
		version: EXTERNAL_VERSION,
		type: "module",
		exports: { ".": "./index.js" },
		files: ["index.js"],
	};
	write(base, "external/package.json", json(external));
	write(base, "external/index.js", 'export const origin = () => "from the unpublished external";\n');

	const bridge = {
		name: BRIDGE,
		version: VERSION,
		type: "module",
		exports: { ".": "./index.js" },
		files: ["index.js"],
		dependencies: { [EXTERNAL]: EXTERNAL_VERSION },
	};
	const bridged = `import { origin } from "${EXTERNAL}";\nexport const bridge = () => "bridged " + origin();\n`;
	for (const dir of ["packages/bridge", `packages/bridge/${PROD}`]) {
		write(root, `${dir}/package.json`, json(bridge));
		write(root, `${dir}/index.js`, bridged);
	}
	const linked = (dependency: string) => ({
		name: LINKED,
		version: VERSION,
		type: "module",
		bin: { [LINKED_BIN]: "./bin.js" },
		files: ["bin.js"],
		dependencies: { [BRIDGE]: dependency },
	});
	for (const [dir, dependency] of [
		["packages/linked", "workspace:^"],
		[`packages/linked/${PROD}`, VERSION],
	] as const) {
		write(root, `${dir}/package.json`, json(linked(dependency)));
		write(
			root,
			`${dir}/bin.js`,
			`#!/usr/bin/env node\nimport { bridge } from "${BRIDGE}";\nconsole.log(bridge());\n`,
			0o755,
		);
	}

	const tarballs = join(base, "tarballs");
	mkdirSync(tarballs, { recursive: true });
	const packed = HAS_NPM
		? spawnSync("npm", ["pack", "--ignore-scripts", "--pack-destination", tarballs], {
				cwd: join(base, "external"),
				env: CHILD_ENV,
				encoding: "utf8",
			})
		: undefined;
	const externalTarball = packed?.status === 0 ? join(tarballs, packed.stdout.trim().split("\n").at(-1) ?? "") : "";
	return { base, root, externalTarball };
};
const LINKED_FIXTURE = writeLinkedFixture();
afterAll(() => rmSync(LINKED_FIXTURE.base, { recursive: true, force: true }));
const LinkedLive = Workspaces.layer({ cwd: LINKED_FIXTURE.root }).pipe(Layer.provideMerge(NodeServices.layer));

const spawn = (executable: string, args: ReadonlyArray<string>, cwd?: string) =>
	Run.collect(
		ChildProcess.make(executable, args, {
			...(cwd === undefined ? {} : { cwd }),
			env: CHILD_ENV,
			extendEnv: false,
			stdin: "ignore",
		}),
		{ timeout: "30 seconds" },
	);

/**
 * An outer `Effect.timeout` sized by the run's own ceilings, and vitest's guard a
 * minute above it, so a named PackedInstallError fires before either guard does.
 */
const guards = (...runs: ReadonlyArray<PackedInstallBudget>) => {
	const effect = runs.map(PackedInstall.timeoutBudget).reduce(Duration.sum, Duration.zero);
	return { effect, vitest: Duration.toMillis(effect) + 60_000 };
};

const readJson = (file: string): Record<string, unknown> => JSON.parse(readFileSync(file, "utf8"));

/** Every consumer-side fact the install path promises, for one consumer. */
const assertConsumer = Effect.fn("assertConsumer")(function* (consumer: InstalledConsumer, tarballs: Readonly<Record<string, string>>) {
		const scratch = dirname(consumer.directory);
		// The realpath'd scratch: file: specs and the install cwd agree.
		assert.strictEqual(consumer.directory, realpathSync(consumer.directory), consumer.manager);
		if (process.platform === "darwin") assert.match(consumer.directory, /^\/private\//, consumer.manager);
		for (const tarball of Object.values(tarballs)) assert.isTrue(tarball.startsWith(`${scratch}/`), tarball);
		const manifest = readJson(join(consumer.directory, "package.json"));
		if (consumer.manager === "pnpm") {
			assert.deepInclude(manifest, {
				devEngines: { packageManager: { name: "pnpm", version: VERSIONS.pnpm, onFail: "ignore" } },
			});
			assert.notProperty(manifest, "packageManager");
		} else {
			assert.deepInclude(manifest, { packageManager: `${consumer.manager}@${VERSIONS[consumer.manager]}` });
		}
		assert.strictEqual(consumer.managerVersion, VERSIONS[consumer.manager]);
		// The same manager, run inside the consumer, does not switch versions.
		const inside = yield* spawn(consumer.manager, ["--version"], consumer.directory);
		assert.strictEqual(inside.stdout.trim().replace(/^v/, ""), consumer.managerVersion, consumer.manager);
		// The bin, run through binPath while the scope is open, reaches the packed lib.
		const out = yield* spawn(consumer.binPath(BIN_NAME), []);
		assert.strictEqual(out.stdout.trim(), GREETING, `${consumer.manager}: ${out.stderr}`);
		assert.strictEqual(out.exitCode, 0, consumer.manager);
		// runBin, under the env the install carried, runs the same bin to the same result.
		const ran = yield* consumer.runBin(BIN_NAME);
		assert.deepStrictEqual([ran.stdout.trim(), ran.exitCode], [GREETING, 0], `${consumer.manager}: ${ran.stderr}`);
		// A symlinking manager's .bin entry resolves into the carrier; pnpm's shim is not read.
		const provenance = yield* consumer.binProvenance(BIN_NAME);
		if (consumer.manager === "pnpm") {
			assert.isUndefined(provenance);
		} else {
			assert.strictEqual(provenance?.package, CARRIER, consumer.manager);
			assert.isTrue(provenance?.target.startsWith(`${consumer.directory}/node_modules/`), provenance?.target);
		}
	});

describe("PackedInstall against a real fixture workspace", () => {
	layer(Live, { excludeTestServices: true })((it) => {
		it.effect("runs under pnpm, and every manager spawn gets the parent's context scrubbed", () =>
			Effect.sync(() => {
				// Positive control: the real pnpm context is present in this process.
				const leaked = Object.keys(process.env).filter((key) => /^(npm_|pnpm_config_|PNPM_SCRIPT_SRC_DIR$)/i.test(key));
				assert.isAbove(leaked.length, 0, "run this suite through pnpm (pnpm test) so its context is real");
				assert.match(process.env.npm_config_user_agent ?? "", /^pnpm\//);
				assert.deepStrictEqual(
					Object.keys(CHILD_ENV).filter((key) => leaked.includes(key)),
					[],
				);
				assert.strictEqual(CHILD_ENV.HTTPS_PROXY, DEAD_PROXY);
			}),
		);

		it.effect.skipIf(!HAS_NPM)("the dead proxy the installs run behind really blocks the registry", () =>
			Effect.gen(function* () {
				// Without this control, "installed with no network" would be vacuous.
				const out = yield* spawn(
					"npm",
					["view", LIB, "version", "--prefer-online", "--fetch-retries=0"],
					realpathSync(tmpdir()),
				);
				assert.isFalse(out.succeeded);
				assert.include(out.stderr, "ECONNREFUSED");
			}).pipe(Effect.timeout("25 seconds")),
		);

		const prodManagers = (["npm", "pnpm", "bun"] as const).filter((pm) => VERSIONS[pm] !== undefined);
		it.effect.skipIf(!HAS_NPM)(
			"packs dist/prod/npm/pkg by default, installs under every available manager, runs the bin, then removes the scratch directory",
			() =>
				Effect.gen(function* () {
					const seen = yield* Effect.scoped(
						Effect.gen(function* () {
							const result = yield* PackedInstall.run({
								carrier: CARRIER,
								closure: "auto",
								managers: prodManagers,
								require: "all",
								bins: [BIN_NAME],
								env: OFFLINE,
								installTimeout: "90 seconds",
							});
							assert.deepStrictEqual(Object.keys(result.tarballs).sort(), [CARRIER, LIB].sort());
							assert.deepStrictEqual(result.unavailable, []);
							assert.deepStrictEqual(
								result.consumers.map((consumer) => consumer.manager),
								[...prodManagers],
							);
							// The packed manifest, read back with the host tar (bsdtar on macOS).
							const carrierTarball = result.tarballs[CARRIER] ?? "";
							const packed = spawnSync("tar", ["-xzOf", carrierTarball, "package/package.json"], { encoding: "utf8" });
							assert.strictEqual(packed.status, 0, packed.stderr);
							assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(packed.stdout)).dependencies, { [LIB]: VERSION });
							for (const consumer of result.consumers) yield* assertConsumer(consumer, result.tarballs);
							const scratch = dirname(result.consumers[0]?.directory ?? "");
							assert.isTrue(existsSync(scratch), "the scratch directory exists while the scope is open");
							return scratch;
						}),
					);
					assert.isFalse(existsSync(seen), `${seen} survived the scope`);
				}).pipe(Effect.timeout("150 seconds")),
			180_000,
		);

		const sourceManagers = (["npm", "pnpm", "bun"] as const).filter((pm) => VERSIONS[pm] !== undefined);
		it.effect.skipIf(!HAS_PNPM)(
			"packs from source in the installed workspace, rewriting workspace:^, and every available manager's bin runs",
			() =>
				Effect.gen(function* () {
					assert.strictEqual(PREINSTALL?.status, 0, `${PREINSTALL?.stdout}\n${PREINSTALL?.stderr}`);
					const result = yield* PackedInstall.run({
						carrier: CARRIER,
						closure: "auto",
						managers: sourceManagers,
						require: "all",
						packFrom: "source",
						bins: [BIN_NAME],
						env: OFFLINE,
						installTimeout: "90 seconds",
					});
					const packed = spawnSync("tar", ["-xzOf", result.tarballs[CARRIER] ?? "", "package/package.json"], {
						encoding: "utf8",
					});
					assert.strictEqual(packed.status, 0, packed.stderr);
					// pnpm rewrote workspace:^ to the lib's version.
					assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(packed.stdout)).dependencies, { [LIB]: `^${VERSION}` });
					assert.deepStrictEqual(
						result.consumers.map((consumer) => consumer.manager),
						[...sourceManagers],
					);
					for (const consumer of result.consumers) yield* assertConsumer(consumer, result.tarballs);
				}).pipe(Effect.timeout("150 seconds")),
			180_000,
		);

		// The development machine has no yarn, so this skips there. It was run
		// once (2026-09-23) with scratch installs of yarn 1.22.22 and 4.18.0
		// prepended to PATH, and passed under both; a machine with yarn on PATH
		// (a GitHub-hosted runner ships yarn 1) runs it every time.
		it.effect.skipIf(!HAS_YARN)(
			"yarn installs the packed carrier (skipped where yarn is not on PATH)",
			() =>
				Effect.gen(function* () {
					const result = yield* PackedInstall.run({
						carrier: CARRIER,
						closure: "auto",
						managers: ["yarn"],
						require: "all",
						bins: [BIN_NAME],
						env: OFFLINE,
						installTimeout: "90 seconds",
					});
					const [yarn] = result.consumers;
					assert.strictEqual(yarn?.manager, "yarn");
					if (yarn !== undefined) yield* assertConsumer(yarn, result.tarballs);
				}).pipe(Effect.timeout("100 seconds"), Effect.scoped),
			120_000,
		);

		it.effect.skipIf(!HAS_NPM || HAS_YARN)(
			"a requested manager that is not installed lands in unavailable (yarn, on a machine without it)",
			() =>
				Effect.gen(function* () {
					const result = yield* PackedInstall.run({
						carrier: CARRIER,
						closure: "auto",
						managers: ["npm", "yarn"],
						bins: [BIN_NAME],
						env: OFFLINE,
						installTimeout: "90 seconds",
					});
					assert.deepStrictEqual(result.unavailable, ["yarn"]);
					assert.deepStrictEqual(
						result.consumers.map((consumer) => consumer.manager),
						["npm"],
					);
				}).pipe(Effect.timeout("100 seconds"), Effect.scoped),
			120_000,
		);

		/** Import the plugin AND its peer from the consumer ROOT, as the consumer's own code would. */
		const importFromRoot = (consumer: InstalledConsumer) =>
			spawn(
				process.execPath,
				[
					"--input-type=module",
					"-e",
					`import { greet } from "${LIB}"; import { shout } from "${PLUGIN}"; console.log(greet() + "|" + shout());`,
				],
				consumer.directory,
			);

		// Every available manager, npm included: a consumerDependencies range for a
		// packed package once met npm's EOVERRIDE (a direct spec that differs from
		// the override), which a pnpm-only run could not see.
		const s1Managers = (["npm", "pnpm", "bun"] as const).filter((pm) => VERSIONS[pm] !== undefined);
		it.effect.skipIf(!HAS_NPM)(
			"P3 S1 under every available manager: a peer the consumer imports is declared through consumerDependencies",
			() =>
				Effect.gen(function* () {
					const result = yield* PackedInstall.run({
						carrier: PLUGIN,
						closure: "auto",
						managers: s1Managers,
						require: "all",
						bins: [],
						env: OFFLINE,
						consumerDependencies: { [LIB]: VERSION },
						installTimeout: "90 seconds",
					});
					assert.deepStrictEqual(Object.keys(result.tarballs).sort(), [LIB, PLUGIN].sort());
					assert.deepStrictEqual(
						result.consumers.map((consumer) => consumer.manager),
						[...s1Managers],
					);
					for (const consumer of result.consumers) {
						// The range the caller passed became the packed tarball: the one spec npm accepts beside the override.
						const manifest = readJson(join(consumer.directory, "package.json"));
						assert.deepInclude(
							manifest.dependencies as Record<string, string>,
							{ [LIB]: `file:${result.tarballs[LIB]}` },
							consumer.manager,
						);
						const out = yield* importFromRoot(consumer);
						assert.strictEqual(
							out.stdout.trim(),
							`${GREETING}|${GREETING.toUpperCase()}`,
							`${consumer.manager}: ${out.stderr}`,
						);
					}
				}).pipe(Effect.timeout("150 seconds"), Effect.scoped),
			180_000,
		);

		it.effect.skipIf(!HAS_PNPM)(
			"P3 S1 control: without consumerDependencies pnpm resolves the peer inside the plugin but not at the root",
			() =>
				Effect.gen(function* () {
					const result = yield* PackedInstall.run({
						carrier: PLUGIN,
						closure: "auto",
						managers: ["pnpm"],
						require: "all",
						bins: [],
						env: OFFLINE,
						installTimeout: "90 seconds",
					});
					const [pnpm] = result.consumers;
					assert.strictEqual(pnpm?.manager, "pnpm");
					if (pnpm === undefined) return;
					const out = yield* importFromRoot(pnpm);
					assert.isFalse(out.succeeded);
					assert.include(out.stderr, "ERR_MODULE_NOT_FOUND");
					assert.include(out.stderr, LIB);
				}).pipe(Effect.timeout("100 seconds"), Effect.scoped),
			120_000,
		);

		// A front end sharing the carrier's bin name: BinConflict by default; with allowSharedBins
		// a flat layout can hand the .bin slot to the front end, and runCarrierBin still reaches the carrier.
		const sharedManagers = (["npm", "pnpm", "yarn", "bun"] as const).filter((pm) => VERSIONS[pm] !== undefined);
		const SHARED_GUARDS = guards(
			// The refused run probes and packs, then stops before any install.
			{ managers: sharedManagers, installTimeout: "0 seconds", packages: 2, perConsumer: "0 seconds" },
			// The allowed run: runBin and runCarrierBin per consumer, a minute each.
			{ managers: sharedManagers, installTimeout: "90 seconds", packages: 2, perConsumer: "2 minutes" },
		);
		it.effect.skipIf(!HAS_NPM)(
			"allowSharedBins: .bin may run the front end under a flat layout, runCarrierBin always runs the carrier",
			() =>
				Effect.gen(function* () {
					const options = {
						carrier: SHARED_CARRIER,
						closure: "auto",
						managers: sharedManagers,
						require: "all",
						bins: [SHARED_BIN],
						env: OFFLINE,
						installTimeout: "90 seconds",
					} as const;
					const refused = yield* Effect.flip(PackedInstall.run(options));
					assert.deepStrictEqual([refused.reason, refused.package], ["BinConflict", SHARED_FRONT]);

					const result = yield* PackedInstall.run({ ...options, allowSharedBins: true });
					const seen: Record<string, string> = {};
					for (const consumer of result.consumers) {
						const slot = yield* consumer.runBin(SHARED_BIN);
						const provenance = yield* consumer.binProvenance(SHARED_BIN);
						// What .bin ran agrees with who owns the slot.
						if (provenance !== undefined) {
							assert.strictEqual(
								slot.stdout.trim(),
								provenance.package === SHARED_FRONT ? "front" : "carrier",
								consumer.manager,
							);
						}
						seen[consumer.manager] = slot.stdout.trim();
						const own = yield* consumer.runCarrierBin(SHARED_BIN);
						assert.deepStrictEqual(
							[own.stdout.trim(), own.exitCode],
							["carrier", 0],
							`${consumer.manager}: ${own.stderr}`,
						);
					}
					// Observed with npm 11.19 and bun 1.4: the package whose name sorts first takes the slot, so
					// shared-cli (the front end) beats shared-plugin (the carrier), as @vitest-agent/cli beats
					// @vitest-agent/plugin; named the other way round, the carrier won both. Yarn 1.22 and 4.18
					// (node-modules linker) gave the slot to the carrier, the consumer's direct dependency. pnpm
					// links only the direct dependency. Every manager on PATH is asserted, yarn included.
					const winner: Record<PackageManagerName, string> = {
						npm: "front",
						bun: "front",
						yarn: "carrier",
						pnpm: "carrier",
					};
					assert.deepStrictEqual(seen, Object.fromEntries(sharedManagers.map((pm) => [pm, winner[pm]])));
				}).pipe(Effect.timeout(SHARED_GUARDS.effect), Effect.scoped),
			SHARED_GUARDS.vitest,
		);

		it.effect.skipIf(!HAS_NPM)(
			"a built directory still carrying workspace: fails UnresolvedProtocol, naming the specifier",
			() =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						PackedInstall.run({
							carrier: CARRIER,
							closure: [],
							managers: ["npm"],
							packFrom: { directory: "dist/raw" },
							bins: [],
							env: OFFLINE,
						}),
					);
					assert.strictEqual(error.reason, "UnresolvedProtocol");
					assert.include(error.message, `dependencies.${LIB}: workspace:^`);
				}).pipe(Effect.timeout("60 seconds"), Effect.scoped),
			90_000,
		);

		it.effect.skipIf(!HAS_NPM)(
			"an expected bin the carrier does not ship fails MissingBin",
			() =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						PackedInstall.run({
							carrier: CARRIER,
							closure: "auto",
							managers: ["npm"],
							bins: ["not-a-bin"],
							env: OFFLINE,
							installTimeout: "90 seconds",
						}),
					);
					assert.deepStrictEqual([error.reason, error.manager], ["MissingBin", "npm"]);
				}).pipe(Effect.timeout("100 seconds"), Effect.scoped),
			120_000,
		);
	});
});

describe("PackedInstall overrides: a dependency no registry has, supplied from outside the workspace", () => {
	/** Every manager on this machine: yarn joins wherever it is on PATH. */
	const linkedManagers = (["npm", "pnpm", "yarn", "bun"] as const).filter((pm) => VERSIONS[pm] !== undefined);

	/** The bin reaches external through bridge, by runBin and by the command runBin builds, under every consumer. */
	const assertLinked = Effect.fn("assertLinked")(function* (consumers: ReadonlyArray<InstalledConsumer>) {
			assert.deepStrictEqual(
				consumers.map((consumer) => consumer.manager),
				[...linkedManagers],
			);
			for (const consumer of consumers) {
				const ran = yield* consumer.runBin(LINKED_BIN);
				assert.deepStrictEqual([ran.stdout.trim(), ran.exitCode], [BRIDGED, 0], `${consumer.manager}: ${ran.stderr}`);
				const direct = yield* Run.collect(consumer.command(LINKED_BIN), { timeout: "30 seconds" });
				assert.deepStrictEqual([direct.stdout.trim(), direct.exitCode], [BRIDGED, 0], `${consumer.manager}: command`);
				// The external the bridge resolves is the supplied one, at the version no registry has.
				const resolved = yield* spawn(
					process.execPath,
					[
						"--input-type=module",
						"-e",
						[
							'import { createRequire } from "node:module";',
							'import { readFileSync } from "node:fs";',
							'import { dirname, join } from "node:path";',
							`const carrier = createRequire(process.cwd() + "/").resolve("${LINKED}/package.json");`,
							`const bridge = createRequire(carrier).resolve("${BRIDGE}");`,
							`const external = createRequire(bridge).resolve("${EXTERNAL}");`,
							'console.log(JSON.parse(readFileSync(join(dirname(external), "package.json"), "utf8")).version);',
						].join(" "),
					],
					consumer.directory,
				);
				assert.strictEqual(resolved.stdout.trim(), EXTERNAL_VERSION, `${consumer.manager}: ${resolved.stderr}`);
			}
		});

	// bun gives up on the dead proxy at once; npm and pnpm retry until installTimeout fires (about 90 seconds).
	const CONTROL = VERSIONS.bun === undefined ? "npm" : "bun";
	// The probe, both packs, the install to its ceiling, and the kill of the child it interrupts.
	const CONTROL_GUARDS = guards({
		managers: [CONTROL],
		installTimeout: "90 seconds",
		packages: [LINKED, BRIDGE],
		perConsumer: "0 seconds",
	});
	// Per consumer: runBin (a minute), the direct command and the resolve spawn (30 seconds each).
	const LINKED_GUARDS = guards({
		managers: linkedManagers,
		installTimeout: "90 seconds",
		packages: [LINKED, BRIDGE, EXTERNAL],
		perConsumer: "2 minutes",
	});

	layer(LinkedLive, { excludeTestServices: true })((it) => {
		it.effect.skipIf(!HAS_NPM)(
			"the fixture really is unresolvable: without an override the install fails behind the dead proxy",
			() =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						PackedInstall.run({
							carrier: LINKED,
							closure: "auto",
							managers: [CONTROL],
							require: "all",
							bins: [LINKED_BIN],
							env: OFFLINE,
							installTimeout: "90 seconds",
						}),
					);
					assert.deepStrictEqual([error.reason, error.manager], ["InstallFailed", CONTROL]);
					// It failed on the external, not on something else.
					assert.include(`${error.message}\n${error.output ?? ""}`, CONTROL === "bun" ? EXTERNAL : "timed out");
				}).pipe(Effect.timeout(CONTROL_GUARDS.effect), Effect.scoped),
			CONTROL_GUARDS.vitest,
		);

		it.effect.skipIf(!HAS_NPM)(
			"overrides: a supplied .tgz installs for the closure's transitive reference under every available manager",
			() =>
				Effect.gen(function* () {
					assert.isTrue(LINKED_FIXTURE.externalTarball.endsWith(".tgz"), "the fixture packed external");
					const options = {
						carrier: LINKED,
						closure: "auto",
						managers: linkedManagers,
						require: "all",
						bins: [LINKED_BIN],
						env: OFFLINE,
						installTimeout: "90 seconds",
						overrides: { [EXTERNAL]: LINKED_FIXTURE.externalTarball },
					} as const;
					const planned = yield* PackedInstall.closure(LINKED, options);
					assert.deepStrictEqual(planned, [LINKED, BRIDGE, EXTERNAL]);
					const result = yield* PackedInstall.run(options);
					assert.deepStrictEqual(Object.keys(result.tarballs), planned, "closure names exactly what the run packed");
					assert.strictEqual(result.tarballs[EXTERNAL], LINKED_FIXTURE.externalTarball, "a tarball is used as it is");
					yield* assertLinked(result.consumers);
				}).pipe(Effect.timeout(LINKED_GUARDS.effect), Effect.scoped),
			LINKED_GUARDS.vitest,
		);

		it.effect.skipIf(!HAS_NPM)(
			"workspaceOverrides: the workspace's own file: link to a directory installs under every available manager",
			() =>
				Effect.gen(function* () {
					const result = yield* PackedInstall.run({
						carrier: LINKED,
						closure: "auto",
						managers: linkedManagers,
						require: "all",
						bins: [LINKED_BIN],
						env: OFFLINE,
						installTimeout: "90 seconds",
						workspaceOverrides: true,
					});
					assert.deepStrictEqual(Object.keys(result.tarballs), [LINKED, BRIDGE, EXTERNAL]);
					// The directory was npm-packed into the scratch root, not used in place.
					assert.isTrue(result.tarballs[EXTERNAL]?.startsWith(`${result.scratch}/`), result.tarballs[EXTERNAL]);
					yield* assertLinked(result.consumers);
				}).pipe(Effect.timeout(LINKED_GUARDS.effect), Effect.scoped),
			LINKED_GUARDS.vitest,
		);
	});
});
