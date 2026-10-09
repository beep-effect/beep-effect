// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file nodeBuiltinImport:skip-file asyncFunction:skip-file
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import type { IntegrityHashBrand } from "../../effected/npm/index.ts";
import { CorepackIntegrityHash, IntegrityHash, PackageManagerPin } from "../../effected/npm/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Result from "effect/Result";
import { flow } from "effect/Function";
import { FetchHttpClient } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import {
	ActionEnvironment,
	AmbientPackageManager,
	CachedPackageManager,
	InstalledPackageManager,
	PackageManagerInstaller,
	PackageManagerInstallerError,
	ToolInstaller,
	ToolInstallerError,
} from "../../effected/github-actions/index.ts";

const Json = S.fromJsonString(S.Unknown);

/** A scratch tool-cache root, removed by the test that made it. */
const scratch = () => mkdtempSync(join(tmpdir(), "effected-pminstall-"));

const alwaysFails: typeof globalThis.fetch = Object.assign(async () => new Response("no", { status: 500 }), { preconnect: () => {} });

/** A fetch scripted by exact url, recording every request it sees. */
const scriptedFetch = (replies: Readonly<Record<string, () => Response>>) => {
	const calls: Array<string> = [];
	const fetch: typeof globalThis.fetch = Object.assign(async (input: Parameters<typeof globalThis.fetch>[0]) => {
		const url = String(input);
		calls.push(url);
		const reply = replies[url];
		return reply === undefined ? new Response("not scripted", { status: 404 }) : reply();
	}, { preconnect: () => {} });
	return { calls, fetch };
};

/**
 * The real thing: real filesystem, real `tar`, real `unzip`, the real
 * ToolInstaller underneath — the claims here are about what lands in the tool
 * cache, and a stubbed filesystem would only assert the stub.
 */
const live = (root: string, fetch: typeof globalThis.fetch = alwaysFails, env: Record<string, string> = {}) => {
	const platform = Layer.mergeAll(
		ActionEnvironment.layerTest({ RUNNER_TOOL_CACHE: root, ...env }),
		NodeServices.layer,
		FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
	);
	// Loggers are cleared: the "no integrity hash" warning every unsigned pin
	// emits is asserted once, by the test that records it, and leaks through
	// the reporter everywhere else.
	return PackageManagerInstaller.layer.pipe(
		Layer.provideMerge(ToolInstaller.layer),
		Layer.provideMerge(Logger.layer([])),
		Layer.provide(platform),
	);
};

const withRoot = <A, E>(
	use: (
		root: string,
	) => Effect.Effect<A, E, PackageManagerInstaller | ToolInstaller | ChildProcessSpawner.ChildProcessSpawner>,
	options: { fetch?: typeof globalThis.fetch; env?: Record<string, string> } = {},
) => {
	const root = scratch();
	return use(root).pipe(
		Effect.provide(live(root, options.fetch ?? alwaysFails, options.env ?? {})),
		// A second NodeServices at the outer level gives the TEST its own real
		// spawner for probing installed shims; the layer above consumed its own.
		Effect.provide(NodeServices.layer),
		Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
	);
};

/**
 * A registry-shaped tarball: `package/package.json` with a `bin` map plus the
 * bin files themselves, gzipped — the layout npm, pnpm, yarn 1.x and
 * `@yarnpkg/cli-dist` all publish (probed against the real tarballs).
 */
const makeManagerTarball = (
	directory: string,
	options: {
		readonly name: string;
		readonly version: string;
		readonly bin?: Record<string, string> | undefined;
		readonly binFiles?: ReadonlyArray<string> | undefined;
		readonly binFileContents?: string | undefined;
		readonly extraFiles?: ReadonlyArray<string> | undefined;
		readonly omitManifest?: boolean | undefined;
		/** Files written verbatim (path → contents), for bins whose bytes matter. */
		readonly files?: Readonly<Record<string, string>> | undefined;
		/** Extra manifest fields, e.g. pnpm 12's `optionalDependencies`. */
		readonly manifest?: Readonly<Record<string, unknown>> | undefined;
	},
): string => {
	const safeName = options.name.replaceAll("/", "-");
	const staging = join(directory, `staging-${safeName}-${options.version}`);
	const packageDir = join(staging, "package");
	mkdirSync(packageDir, { recursive: true });
	if (options.omitManifest !== true) {
		writeFileSync(
			join(packageDir, "package.json"),
			Result.getOrThrowWith(S.encodeResult(Json)({
				name: options.name,
				version: options.version,
				...(options.bin !== undefined ? { bin: options.bin } : {}),
				...options.manifest,
			}), (error) => error),
		);
	}
	for (const [file, contents] of Object.entries(options.files ?? {})) {
		mkdirSync(join(packageDir, file, ".."), { recursive: true });
		writeFileSync(join(packageDir, file), contents);
	}
	for (const file of options.binFiles ?? []) {
		mkdirSync(join(packageDir, file, ".."), { recursive: true });
		writeFileSync(
			join(packageDir, file),
			options.binFileContents ?? `#!/usr/bin/env node\nconsole.log("${options.name}");\n`,
		);
	}
	for (const file of options.extraFiles ?? []) {
		writeFileSync(join(packageDir, file), "plain file");
	}
	const archive = join(directory, `${safeName}-${options.version}.tgz`);
	execFileSync("tar", ["czf", archive, "-C", staging, "package"]);
	return archive;
};

/** A bun-release-shaped zip: `bun-<target>/bun` (the layout bun's own install script unpacks). */
const makeBunZip = (directory: string, target: string): string => {
	const staging = join(directory, "bun-staging");
	mkdirSync(join(staging, target), { recursive: true });
	writeFileSync(join(staging, target, "bun"), "#!/bin/sh\necho bun\n");
	const archive = join(directory, `${target}.zip`);
	execFileSync("zip", ["-rq", archive, target], { cwd: staging });
	return archive;
};

const tgzResponse = (archive: string) => () => new Response(new Uint8Array(readFileSync(archive)), { status: 200 });

const sha512Hex = (file: string): string => createHash("sha512").update(readFileSync(file)).digest("hex");

/** The registry's SRI spelling of a file's sha512 (`sha512-<base64>`). */
const sha512Sri = (file: string): string =>
	`sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}`;

/** Every target pnpm 12.4.2 publishes an `@pnpm/exe.*` package for, as its wrapper's `optionalDependencies`. */
const PNPM_EXE_TARGETS = [
	"win32-x64",
	"win32-arm64",
	"darwin-x64",
	"darwin-arm64",
	"linux-x64",
	"linux-arm64",
	"linux-riscv64",
	"linux-ppc64",
	"linux-s390x",
	"linux-x64-musl",
	"linux-arm64-musl",
	"freebsd-x64",
	"android-arm64",
	"android-x64",
] as const;

/** The shebang-less placeholder the pnpm 12 wrapper ships as its `pnpm` bin (probed against pnpm@12.4.2). */
const PNPM_PLACEHOLDER =
	"# pnpm's native binary replaces this file during installation (see\n# ./install.js). Until then this hands over to ./bin/pnpm.mjs.\n";

/** A `#!/bin/sh` alias bin the way the wrapper ships `pn`/`pnpx`/`pnx`: exec the sibling `pnpm`. */
const pnpmAlias = (name: string): string => `#!/bin/sh\n# ${name} is pnpm\nexec "$(dirname "$0")/pnpm" "$@"\n`;

/**
 * A pnpm 12-shaped wrapper tarball: `pnpm` a placeholder, `pn`/`pnpx`/`pnx`
 * shell aliases, `bin/pnpm.mjs` (corepack's entry, which the installer must
 * NOT pick) and `optionalDependencies` naming every `@pnpm/exe.*` target.
 */
const makePnpm12Wrapper = (
	directory: string,
	version: string,
	options: { readonly targets?: ReadonlyArray<string> | undefined; readonly nativeVersion?: string | undefined } = {},
): string =>
	makeManagerTarball(directory, {
		name: "pnpm",
		version,
		bin: { pnpm: "pnpm", pn: "pn", pnpx: "pnpx", pnx: "pnx" },
		files: {
			pnpm: PNPM_PLACEHOLDER,
			pn: pnpmAlias("pn"),
			pnpx: pnpmAlias("pnpx"),
			pnx: pnpmAlias("pnx"),
			"bin/pnpm.mjs": "console.log('corepack entry — must not be used')\n",
		},
		manifest: {
			optionalDependencies: Object.fromEntries(
				(options.targets ?? PNPM_EXE_TARGETS).map((target) => [
					`@pnpm/exe.${target}`,
					options.nativeVersion ?? version,
				]),
			),
		},
	});

/** An `@pnpm/exe.<target>`-shaped tarball: `package/pnpm` (a runnable stand-in for the executable) plus its manifest. */
const makePnpmExeTarball = (
	directory: string,
	target: string,
	version: string,
	options: { readonly omitBinary?: boolean | undefined } = {},
): string =>
	makeManagerTarball(directory, {
		name: `@pnpm/exe.${target}`,
		version,
		...(options.omitBinary === true ? {} : { files: { pnpm: `#!/bin/sh\necho "native-pnpm ${version} $*"\n` } }),
	});

/** The pnpm 12 registry conversation: wrapper tarball, exe packument, exe tarball. */
const pnpm12Urls = (version: string, target: string, registry = "https://registry.npmjs.org") => ({
	wrapper: `${registry}/pnpm/-/pnpm-${version}.tgz`,
	packument: `${registry}/@pnpm/exe.${target}/${version}`,
	exe: `${registry}/@pnpm/exe.${target}/-/exe.${target}-${version}.tgz`,
});

const jsonResponse = (body: unknown) => () =>
	new Response(Result.getOrThrowWith(S.encodeResult(Json)(body), (error) => error), { status: 200, headers: { "content-type": "application/json" } });

/** A spawner whose `string` is scripted and whose other members die loudly. */
const scriptedSpawner = (
	string: () => Effect.Effect<string, PlatformError.PlatformError>,
): Layer.Layer<ChildProcessSpawner.ChildProcessSpawner> =>
	Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, {
		spawn: Effect.fn("ChildProcessSpawner.ChildProcessSpawner.spawn")(() => Effect.die("scriptedSpawner: spawn was called but not scripted")),
		exitCode: Effect.fn("ChildProcessSpawner.ChildProcessSpawner.exitCode")(() => Effect.die("scriptedSpawner: exitCode was called but not scripted")),
		streamString: () => Stream.fromEffect(Effect.die("scriptedSpawner: streamString was called but not scripted")),
		streamLines: () => Stream.fromEffect(Effect.die("scriptedSpawner: streamLines was called but not scripted")),
		lines: Effect.fn("ChildProcessSpawner.ChildProcessSpawner.lines")(() => Effect.die("scriptedSpawner: lines was called but not scripted")),
		string,
	});

/**
 * A stub-backed layer for the short-circuit tests: no download path exists
 * unless stubbed. Loggers are cleared for the same reason `live` clears them —
 * an unsigned pin's "no integrity hash" warning would leak through the reporter.
 */
const stubbed = (options: {
	readonly installer?: Parameters<typeof ToolInstaller.layerTest>[0] | undefined;
	readonly spawner?: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner> | undefined;
	readonly env?: Record<string, string> | undefined;
}) =>
	PackageManagerInstaller.layer.pipe(
		Layer.provideMerge(Logger.layer([])),
		Layer.provide(
			Layer.mergeAll(
				ActionEnvironment.layerTest(options.env ?? {}),
				NodeServices.layer,
				options.spawner ?? Layer.empty,
				ToolInstaller.layerTest(options.installer ?? {}),
			),
		),
	);

const pin = (spec: string): PackageManagerPin => {
	const parsed = PackageManagerPin.parseResult(spec);
	if (parsed._tag !== "Success") {
		throw new Error(`test pin ${spec} did not parse`);
	}
	return parsed.success;
};

const install = (
	spec: string,
	options?: {
		requireIntegrity?: boolean;
		registry?: string;
		allowAmbient?: boolean;
		integrity?: IntegrityHashBrand | undefined;
		nativeIntegrity?: Readonly<Record<string, string>>;
	},
) => Effect.flatMap(PackageManagerInstaller, (installer) => installer.install(pin(spec), options));

/** A corepack `<algo>.<hex>` integrity, decoded through the same schema a pin's tail is. */
const corepack = (value: string): IntegrityHashBrand => flow(S.decodeResult(CorepackIntegrityHash), Result.getOrThrowWith((error) => error))(value);

/** Narrow to the tool-cache variant or fail the test loudly. */
const cachedOf = (installed: InstalledPackageManager): CachedPackageManager => {
	assert.instanceOf(installed, CachedPackageManager);
	assert.strictEqual(installed.source, "tool-cache");
	return installed as CachedPackageManager;
};

describe("PackageManagerInstaller", () => {
	describe("the tool-cache short-circuit", () => {
		it.live("answers from the cache without downloading anything, regenerating absent shims", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// The fetch always fails, so a hit here proves no download happened.
					// The entry has no `.bin` — a foreign writer (runner image, setup-*
					// action, or the previous version of this module) cached it — so
					// the shims must be regenerated into the entry.
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.7.7", arch: process.arch });
					mkdirSync(join(cached, "bin"), { recursive: true });
					writeFileSync(join(cached, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
					writeFileSync(join(cached, "bin", "pnpm.cjs"), "console.log('pnpm')");

					const installed = cachedOf(yield* install("pnpm@7.7.7"));
					assert.strictEqual(installed.directory, cached);
					assert.strictEqual(installed.binDir, join(cached, ".bin"));
					assert.deepStrictEqual(installed.bins, { pnpm: join(cached, "bin", "pnpm.cjs") });
					// The regenerated shim points INTO the cached entry, verbatim.
					assert.strictEqual(
						readFileSync(join(cached, ".bin", "pnpm"), "utf8"),
						`#!/bin/sh\nexec node "${join(cached, "bin", "pnpm.cjs")}" "$@"\n`,
					);
					assert.notStrictEqual(statSync(join(cached, ".bin", "pnpm")).mode & 0o111, 0);
				}),
			),
		);

		it.live("leaves an already-present shim untouched on a cache hit", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// The tool cache is SHARED: another writer's shim must not be
					// rewritten out from under it.
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.7.9", arch: process.arch });
					mkdirSync(join(cached, "bin"), { recursive: true });
					mkdirSync(join(cached, ".bin"), { recursive: true });
					writeFileSync(join(cached, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
					writeFileSync(join(cached, "bin", "pnpm.cjs"), "console.log('pnpm')");
					writeFileSync(join(cached, ".bin", "pnpm"), "#!/bin/sh\n# sentinel: a foreign shim\n");

					yield* install("pnpm@7.7.9");
					assert.include(readFileSync(join(cached, ".bin", "pnpm"), "utf8"), "sentinel");
				}),
			),
		);

		it.live("a shim that cannot be regenerated is a typed cacheFailed", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.8.0", arch: process.arch });
					mkdirSync(join(cached, "bin"), { recursive: true });
					writeFileSync(join(cached, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
					writeFileSync(join(cached, "bin", "pnpm.cjs"), "console.log('pnpm')");
					chmodSync(cached, 0o555); // read-only entry: the .bin mkdir must fail
					const error = yield* Effect.flip(install("pnpm@7.8.0"));
					chmodSync(cached, 0o755); // restore so cleanup can remove the root
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "cacheFailed");
				}),
			),
		);

		it.live("reports a corrupted cache entry as layoutUnexpected rather than answering with it", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.7.8", arch: process.arch });
					mkdirSync(cached, { recursive: true }); // present, but empty — no manifest
					const error = yield* Effect.flip(install("pnpm@7.7.8"));
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "layoutUnexpected");
				}),
			),
		);

		it.live("refuses a bin path that escapes the package directory, even when its target exists", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// The hostile-manifest case: the bin names a file OUTSIDE the
					// entry, and that file EXISTS — so the existence check alone would
					// pass, a shim would be written invoking it, and `bins` would
					// publish a path the artifact never legitimately owned. Only the
					// containment guard can refuse this one.
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.9.0", arch: process.arch });
					mkdirSync(cached, { recursive: true });
					writeFileSync(join(cached, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "../../../evil.js" } }), (error) => error));
					// `<root>/pnpm/7.9.0/<arch>/../../../evil.js` is `<root>/evil.js`.
					writeFileSync(join(root, "evil.js"), "console.log('payload')");
					const error = yield* Effect.flip(install("pnpm@7.9.0"));
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "layoutUnexpected");
					assert.include(error.subject ?? "", "pnpm");
					assert.include(error.subject ?? "", "escapes");
					assert.isFalse(existsSync(join(cached, ".bin")), "no shim may be written for an escaping bin");
				}),
			),
		);
	});

	describe("the ambient npm short-circuit", () => {
		it.effect("answers ambient when the probe matches the pin exactly", () =>
			Effect.gen(function* () {
				const installed = yield* install("npm@9.9.9");
				assert.instanceOf(installed, AmbientPackageManager);
				assert.strictEqual(installed.source, "ambient");
				assert.strictEqual(installed.version, "9.9.9");
				// The discriminant is structural: the ambient variant HAS no
				// directory or binDir field, rather than carrying undefined ones.
				assert.isFalse("directory" in installed);
				assert.isFalse("binDir" in installed);
				assert.deepStrictEqual(installed.bins, { npm: "npm", npx: "npx" });
			}).pipe(
				Effect.provide(
					stubbed({
						// find misses; download would DIE if the short-circuit failed to fire.
						installer: { find: () => Effect.succeedNone },
						spawner: scriptedSpawner(() => Effect.succeed("9.9.9\n")),
					}),
				),
			),
		);

		it.live("allowAmbient: false suppresses the probe even when it WOULD match, and installs to the tool cache", () =>
			Effect.gen(function* () {
				// The discriminating case for the option: the probe stands ready to
				// answer EXACTLY the pinned version — but it must never be asked. A
				// consumer that sets allowAmbient: false is replacing node in-run,
				// so the runner's npm is about to be shadowed and its answer would
				// diverge from the npm that actually executes.
				const root = scratch();
				const extracted = join(root, "extracted", "package");
				mkdirSync(join(extracted, "bin"), { recursive: true });
				writeFileSync(join(extracted, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { npm: "bin/npm-cli.js" } }), (error) => error));
				writeFileSync(join(extracted, "bin", "npm-cli.js"), "console.log('npm')");
				const destination = ToolInstaller.cachePath({ root, tool: "npm", version: "9.9.9", arch: process.arch });

				const probes: Array<string> = [];
				const installed = cachedOf(
					yield* install("npm@9.9.9", { allowAmbient: false }).pipe(
						Effect.provide(
							stubbed({
								env: { RUNNER_TOOL_CACHE: root },
								spawner: scriptedSpawner(() =>
									Effect.suspend(() => {
										probes.push("npm --version");
										return Effect.succeed("9.9.9\n"); // WOULD match — must never be consulted
									}),
								),
								installer: {
									find: () => Effect.succeedNone,
									download: () => Effect.succeed(join(root, "unused-archive")),
									extractTar: () => Effect.succeed(join(root, "extracted")),
									cacheDir: () => Effect.succeed(destination),
								},
							}),
						),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.lengthOf(probes, 0, "the ambient probe must not have been spawned at all");
				assert.strictEqual(installed.source, "tool-cache");
				assert.strictEqual(installed.binDir, join(destination, ".bin"));
			}),
		);

		it.effect("allowAmbient: true is the default behavior, spelled out", () =>
			Effect.gen(function* () {
				const installed = yield* install("npm@9.9.9", { allowAmbient: true });
				assert.instanceOf(installed, AmbientPackageManager);
				assert.strictEqual(installed.source, "ambient");
			}).pipe(
				Effect.provide(
					stubbed({
						installer: { find: () => Effect.succeedNone },
						spawner: scriptedSpawner(() => Effect.succeed("9.9.9\n")),
					}),
				),
			),
		);

		it.live("a same-major near miss (ambient 12.0.1 for a 12.0.2 pin) goes to the tool cache", () =>
			// The match is exact-string, never "close enough": a Node 26 runner
			// whose bundled npm is 12.0.1 must not answer a 12.0.2 pin, or the
			// consumer's pin bump would be a silent no-op. The scripted probe
			// answers the near miss; the dist path must run.
			Effect.gen(function* () {
				const root = scratch();
				const extracted = join(root, "extracted", "package");
				mkdirSync(join(extracted, "bin"), { recursive: true });
				writeFileSync(
					join(extracted, "package.json"),
					Result.getOrThrowWith(S.encodeResult(Json)({ bin: { npm: "bin/npm-cli.js", npx: "bin/npx-cli.js" } }), (error) => error),
				);
				writeFileSync(join(extracted, "bin", "npm-cli.js"), "console.log('npm')");
				writeFileSync(join(extracted, "bin", "npx-cli.js"), "console.log('npx')");
				const destination = ToolInstaller.cachePath({ root, tool: "npm", version: "12.0.2", arch: process.arch });

				const probes: Array<string> = [];
				const installed = cachedOf(
					yield* install("npm@12.0.2").pipe(
						Effect.provide(
							stubbed({
								env: { RUNNER_TOOL_CACHE: root },
								spawner: scriptedSpawner(() =>
									Effect.suspend(() => {
										probes.push("npm --version");
										return Effect.succeed("12.0.1\n");
									}),
								),
								installer: {
									find: () => Effect.succeedNone,
									download: () => Effect.succeed(join(root, "unused-archive")),
									extractTar: () => Effect.succeed(join(root, "extracted")),
									cacheDir: () => Effect.succeed(destination),
								},
							}),
						),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.deepStrictEqual(probes, ["npm --version"], "the ambient probe ran and was rejected");
				assert.strictEqual(installed.source, "tool-cache");
				assert.strictEqual(installed.version, "12.0.2");
				assert.strictEqual(installed.bins.npm, join(destination, "bin", "npm-cli.js"));
				assert.strictEqual(installed.bins.npx, join(destination, "bin", "npx-cli.js"));
			}),
		);

		it.live("falls through to the dist path when the probe answers a different version", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "npm",
					version: "1.0.0",
					bin: { npm: "bin/npm-cli.js", npx: "bin/npx-cli.js" },
					binFiles: ["bin/npm-cli.js", "bin/npx-cli.js"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/npm/-/npm-1.0.0.tgz": tgzResponse(archive) });
				// The REAL spawner probes the host's real npm, whose version is never
				// the fixture's 1.0.0 — so the probe answers, mismatches, and the
				// dist path runs.
				const installed = cachedOf(
					yield* install("npm@1.0.0").pipe(
						Effect.provide(live(root, script.fetch)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.deepStrictEqual(script.calls, ["https://registry.npmjs.org/npm/-/npm-1.0.0.tgz"]);
				assert.strictEqual(installed.bins.npm, join(installed.directory, "bin", "npm-cli.js"));
			}),
		);

		it.live("a failed probe is not an error — it falls through to the dist path", () =>
			Effect.gen(function* () {
				const root = scratch();
				const extracted = join(root, "extracted", "package");
				mkdirSync(join(extracted, "bin"), { recursive: true });
				writeFileSync(join(extracted, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { npm: "bin/npm-cli.js" } }), (error) => error));
				writeFileSync(join(extracted, "bin", "npm-cli.js"), "console.log('npm')");

				// The stub answers with the destination the module derives, so the
				// divergence guard passes and the record comes back tool-cache.
				const destination = ToolInstaller.cachePath({ root, tool: "npm", version: "1.2.3", arch: process.arch });
				const installed = cachedOf(
					yield* install("npm@1.2.3").pipe(
						Effect.provide(
							stubbed({
								env: { RUNNER_TOOL_CACHE: root },
								spawner: scriptedSpawner(() =>
									Effect.fail(
										PlatformError.badArgument({
											module: "Test",
											method: "string",
											description: "npm is not installed",
										}),
									),
								),
								installer: {
									find: () => Effect.succeedNone,
									download: () => Effect.succeed(join(root, "unused-archive")),
									extractTar: () => Effect.succeed(join(root, "extracted")),
									cacheDir: () => Effect.succeed(destination),
								},
							}),
						),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.strictEqual(installed.bins.npm, join(destination, "bin", "npm-cli.js"));
				assert.strictEqual(installed.binDir, join(destination, ".bin"));
			}),
		);
	});

	describe("shims", () => {
		it.live("writes executable shims as part of the cached entry, naming the final path", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "5.0.0",
					bin: { pnpm: "bin/pnpm.cjs", pnpx: "bin/pnpx.cjs" },
					binFiles: ["bin/pnpm.cjs", "bin/pnpx.cjs"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-5.0.0.tgz": tgzResponse(archive) });
				const installed = cachedOf(yield* install("pnpm@5.0.0").pipe(Effect.provide(live(root, script.fetch))));
				assert.strictEqual(installed.binDir, join(installed.directory, ".bin"));
				// The shim contents are the contract: an exec wrapper naming the
				// FINAL cached entry path — never the staging directory the entry
				// was assembled in — pinned verbatim.
				const shim = readFileSync(join(installed.binDir, "pnpm"), "utf8");
				assert.strictEqual(shim, `#!/bin/sh\nexec node "${join(installed.directory, "bin", "pnpm.cjs")}" "$@"\n`);
				assert.strictEqual(
					readFileSync(join(installed.binDir, "pnpx"), "utf8"),
					`#!/bin/sh\nexec node "${join(installed.directory, "bin", "pnpx.cjs")}" "$@"\n`,
				);
				assert.notStrictEqual(statSync(join(installed.binDir, "pnpm")).mode & 0o111, 0, "shims must be executable");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("a shim passes its arguments through intact, run for real", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "5.0.1",
					bin: { pnpm: "bin/pnpm.cjs" },
					binFiles: ["bin/pnpm.cjs"],
					binFileContents: "console.log(JSON.stringify(process.argv.slice(2)));\n",
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-5.0.1.tgz": tgzResponse(archive) });
				const program = Effect.gen(function* () {
					const installed = cachedOf(yield* install("pnpm@5.0.1"));
					// The REAL spawner executes the shim itself: shebang, executable
					// bit and `"$@"` quoting all have to hold for this to answer.
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const output = yield* spawner.string(
						ChildProcess.make(join(installed.binDir, "pnpm"), ["a b", "--flag", "c"]),
					);
					assert.deepStrictEqual(Result.getOrThrowWith(S.decodeResult(Json)(output.trim()), (error) => error), ["a b", "--flag", "c"]);
				});
				yield* program.pipe(
					Effect.provide(Layer.mergeAll(live(root, script.fetch), NodeServices.layer)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
			}),
		);

		it.live("a shim directory that cannot be created fails typed as cacheFailed, and caches nothing", () =>
			Effect.gen(function* () {
				const root = scratch();
				// The tarball ships a FILE named `.bin` where the shim directory
				// must go — the mkdir fails, and the entry must not be cached.
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "5.0.2",
					bin: { pnpm: "bin/pnpm.cjs" },
					binFiles: ["bin/pnpm.cjs"],
					extraFiles: [".bin"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-5.0.2.tgz": tgzResponse(archive) });
				const error = yield* Effect.flip(install("pnpm@5.0.2").pipe(Effect.provide(live(root, script.fetch))));
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "cacheFailed");
				const destination = ToolInstaller.cachePath({ root, tool: "pnpm", version: "5.0.2", arch: process.arch });
				assert.isFalse(existsSync(destination), "a failed shim write must not leave a cached entry behind");
				rmSync(root, { recursive: true, force: true });
			}),
		);
	});

	describe("integrity", () => {
		it.live("verifies a pin that carries integrity and proceeds on a match", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "1.0.0",
					bin: { pnpm: "bin/pnpm.cjs" },
					binFiles: ["bin/pnpm.cjs"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-1.0.0.tgz": tgzResponse(archive) });
				const installed = yield* install(`pnpm@1.0.0+sha512.${sha512Hex(archive)}`).pipe(
					Effect.provide(live(root, script.fetch)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
				assert.strictEqual(installed.source, "tool-cache");
			}),
		);

		it.live("fails closed on a mismatch, and caches NOTHING", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "1.0.1",
					bin: { pnpm: "bin/pnpm.cjs" },
					binFiles: ["bin/pnpm.cjs"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-1.0.1.tgz": tgzResponse(archive) });
				const wrong = "0".repeat(128);
				const error = yield* Effect.flip(
					install(`pnpm@1.0.1+sha512.${wrong}`).pipe(Effect.provide(live(root, script.fetch))),
				);
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "integrityMismatch");
				assert.strictEqual(error.expected, `sha512.${wrong}`);
				assert.strictEqual(error.actual, `sha512.${sha512Hex(archive)}`);
				// A measured mismatch names both hashes...
				assert.include(error.message, "Integrity mismatch");
				assert.include(error.message, `sha512.${wrong}`);
				// ...while a failure to compute the digest at all says THAT, rather
				// than reporting a mismatch it never measured as
				// "expected undefined, got undefined".
				assert.include(
					PackageManagerInstallerError.make({
						reason: "integrityMismatch",
						name: "pnpm",
						version: "1.0.1",
						subject: "/tmp/pnpm.tgz",
					}).message,
					"Could not verify the integrity",
				);
				const destination = ToolInstaller.cachePath({ root, tool: "pnpm", version: "1.0.1", arch: process.arch });
				assert.isFalse(existsSync(destination), "a failed verification must not leave anything in the cache");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("proceeds with a logged warning when the pin carries no integrity", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "1.0.2",
					bin: { pnpm: "bin/pnpm.cjs" },
					binFiles: ["bin/pnpm.cjs"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-1.0.2.tgz": tgzResponse(archive) });
				const entries: Array<{ level: string; message: unknown }> = [];
				const recorder = Logger.layer([
					Logger.make((options) => {
						entries.push({ level: options.logLevel, message: options.message });
					}),
				]);
				// Provided inside `live`, so the recorder overrides the cleared loggers.
				const installed = yield* install("pnpm@1.0.2").pipe(
					Effect.provide(recorder),
					Effect.provide(live(root, script.fetch)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
				assert.strictEqual(installed.source, "tool-cache");
				const warning = entries.find((entry) => entry.level === "Warn");
				assert.isDefined(warning, "an unverified download must be announced");
				assert.include(String(warning?.message), "integrity");
			}),
		);

		it.effect("requireIntegrity makes an integrity-less pin a typed failure, before anything else runs", () =>
			Effect.gen(function* () {
				// EVERY ToolInstaller member dies here — the strictness is a statement
				// about the pin and must be decided before the cache is even consulted.
				const error = yield* Effect.flip(install("npm@9.9.9", { requireIntegrity: true }));
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "integrityMissing");
			}).pipe(Effect.provide(stubbed({}))),
		);
	});

	describe("the integrity option", () => {
		/** A pnpm 1.x-shaped tarball served at its registry url, plus a fetch that records requests. */
		const served = (root: string, version: string) => {
			const archive = makeManagerTarball(root, {
				name: "pnpm",
				version,
				bin: { pnpm: "bin/pnpm.cjs" },
				binFiles: ["bin/pnpm.cjs"],
			});
			const url = `https://registry.npmjs.org/pnpm/-/pnpm-${version}.tgz`;
			return { archive, url, script: scriptedFetch({ [url]: tgzResponse(archive) }) };
		};
		const wrong = corepack(`sha512.${"0".repeat(128)}`);

		it.live("verifies a bare pin's tarball against the option, with no unverified-download warning", () =>
			Effect.gen(function* () {
				const root = scratch();
				const { archive, script } = served(root, "1.1.0");
				const entries: Array<{ level: string; message: unknown }> = [];
				const recorder = Logger.layer([
					Logger.make((options) => {
						entries.push({ level: options.logLevel, message: options.message });
					}),
				]);
				const installed = yield* install("pnpm@1.1.0", { integrity: corepack(`sha512.${sha512Hex(archive)}`) }).pipe(
					Effect.provide(recorder),
					Effect.provide(live(root, script.fetch)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
				assert.strictEqual(installed.source, "tool-cache");
				assert.isUndefined(
					entries.find((entry) => entry.level === "Warn"),
					"a download verified against the option is not an unverified one",
				);
			}),
		);

		it.live("a bare pin whose tarball does not hash to the option fails closed and caches nothing", () =>
			Effect.gen(function* () {
				const root = scratch();
				const { archive, script } = served(root, "1.1.1");
				const error = yield* Effect.flip(
					install("pnpm@1.1.1", { integrity: wrong }).pipe(Effect.provide(live(root, script.fetch))),
				);
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "integrityMismatch");
				assert.strictEqual(error.expected, wrong);
				assert.strictEqual(error.actual, `sha512.${sha512Hex(archive)}`);
				const destination = ToolInstaller.cachePath({ root, tool: "pnpm", version: "1.1.1", arch: process.arch });
				assert.isFalse(existsSync(destination), "a failed verification must not leave anything in the cache");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("a pin and an option that agree verify once and install", () =>
			Effect.gen(function* () {
				const root = scratch();
				const { archive, url, script } = served(root, "1.1.2");
				const hex = sha512Hex(archive);
				const installed = yield* install(`pnpm@1.1.2+sha512.${hex}`, { integrity: corepack(`sha512.${hex}`) }).pipe(
					Effect.provide(live(root, script.fetch)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
				assert.strictEqual(installed.source, "tool-cache");
				assert.deepStrictEqual(script.calls, [url]);
			}),
		);

		it.live("a pin and an option that disagree fail before any download, whichever one is right", () =>
			Effect.gen(function* () {
				// Both directions, each with a real tarball the RIGHT value would
				// verify: a mutant that silently prefers either side installs in one
				// of them instead of failing.
				const attempt = Effect.fn("attempt")(function*(version: string, side: "pin-right" | "option-right") {
						const root = scratch();
						const { archive, script } = served(root, version);
						const right = `sha512.${sha512Hex(archive)}`;
						const pinned = side === "pin-right" ? right : wrong;
						const option = corepack(side === "pin-right" ? wrong : right);
						const error = yield* Effect.flip(
							install(`pnpm@${version}+${pinned}`, { integrity: option }).pipe(
								Effect.provide(live(root, script.fetch)),
								Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
							),
						);
						assert.instanceOf(error, PackageManagerInstallerError);
						assert.strictEqual(error.reason, "integrityMismatch");
						assert.strictEqual(error.expected, option);
						assert.isUndefined(error.actual, "nothing was measured");
						assert.include(error.subject ?? "", pinned);
						assert.include(error.message, pinned);
						assert.include(error.message, "Could not verify the integrity");
						assert.deepStrictEqual(script.calls, [], "the conflict is refused before anything is fetched");
					});
				yield* attempt("1.1.3", "pin-right");
				yield* attempt("1.1.4", "option-right");
			}),
		);

		it.live("an SRI-form option fails typed before any download, even when it names the right bytes", () =>
			Effect.gen(function* () {
				const root = scratch();
				const { archive, script } = served(root, "1.1.5");
				// The tarball's CORRECT digest, in the SRI spelling a lockfile records:
				// the form is refused, not the value.
				const sri = flow(S.decodeResult(IntegrityHash), Result.getOrThrowWith((error) => error))(sha512Sri(archive));
				const error = yield* Effect.flip(
					install("pnpm@1.1.5", { integrity: sri }).pipe(
						Effect.provide(live(root, script.fetch)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "integrityMismatch");
				assert.isUndefined(error.expected);
				assert.isUndefined(error.actual);
				assert.include(error.subject ?? "", "not a corepack");
				assert.include(error.subject ?? "", sri);
				assert.include(error.message, "Could not verify the integrity");
				assert.deepStrictEqual(script.calls, [], "the malformed option is refused before anything is fetched");
			}),
		);

		it.live("a garbage option fails typed before the tool cache can answer", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// A cached entry the install would otherwise answer from: an
					// unvalidated option would be laundered by the cache hit.
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.8.1", arch: process.arch });
					mkdirSync(join(cached, "bin"), { recursive: true });
					writeFileSync(join(cached, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
					writeFileSync(join(cached, "bin", "pnpm.cjs"), "console.log('pnpm')");
					// Control: the same pin with no option IS answered from the cache.
					assert.strictEqual(cachedOf(yield* install("pnpm@7.8.1")).directory, cached);
					// An untyped caller can hand anything across; the option's type is
					// not its validation.
					const garbage = "not-an-integrity" as IntegrityHashBrand;
					const error = yield* Effect.flip(install("pnpm@7.8.1", { integrity: garbage }));
					assert.strictEqual(error.reason, "integrityMismatch");
					assert.isUndefined(error.expected);
					assert.include(error.subject ?? "", "not a corepack");
				}),
			),
		);

		it.live("the option satisfies requireIntegrity, and a cache hit is answered as for an integrity pin", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// The fetch always fails, so the only way to answer is the cache.
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version: "7.8.0", arch: process.arch });
					mkdirSync(join(cached, "bin"), { recursive: true });
					writeFileSync(join(cached, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
					writeFileSync(join(cached, "bin", "pnpm.cjs"), "console.log('pnpm')");
					// Control: the same bare pin without the option is still refused
					// before the cache is consulted.
					const refused = yield* Effect.flip(install("pnpm@7.8.0", { requireIntegrity: true }));
					assert.strictEqual(refused.reason, "integrityMissing");
					assert.include(refused.message, "requireIntegrity");
					const installed = cachedOf(
						yield* install("pnpm@7.8.0", { requireIntegrity: true, integrity: corepack(`sha512.${"a".repeat(128)}`) }),
					);
					assert.strictEqual(installed.directory, cached);
				}),
			),
		);

		it.effect("requireIntegrity with neither a pin integrity nor the option still fails before anything runs", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(install("npm@9.9.8", { requireIntegrity: true, integrity: undefined }));
				assert.strictEqual(error.reason, "integrityMissing");
			}).pipe(Effect.provide(stubbed({}))),
		);
	});

	describe("the yarn version split", () => {
		it.live("yarn 1.x downloads the yarn registry tarball", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "yarn",
					version: "1.22.10",
					// yarn 1.x publishes its bin with a `./` prefix (probed) — the
					// resolved path must normalize it away.
					bin: { yarn: "./bin/yarn.js", yarnpkg: "./bin/yarn.js" },
					binFiles: ["bin/yarn.js"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/yarn/-/yarn-1.22.10.tgz": tgzResponse(archive) });
				const installed = cachedOf(
					yield* install("yarn@1.22.10").pipe(
						Effect.provide(live(root, script.fetch)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.deepStrictEqual(script.calls, ["https://registry.npmjs.org/yarn/-/yarn-1.22.10.tgz"]);
				assert.strictEqual(installed.bins.yarn, join(installed.directory, "bin", "yarn.js"));
				assert.strictEqual(installed.bins.yarnpkg, join(installed.directory, "bin", "yarn.js"));
			}),
		);

		it.live("yarn 2+ downloads @yarnpkg/cli-dist, and verifies integrity against bin/yarn.js", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "@yarnpkg/cli-dist",
					version: "4.1.0",
					bin: { yarn: "bin/yarn.js", yarnpkg: "bin/yarn.js" },
					binFiles: ["bin/yarn.js"],
				});
				// What corepack hashes for a Berry pin is the standalone yarn.js —
				// byte-identical to the tarball's bin/yarn.js (probed) — NOT the
				// tarball. So the js-file hash must pass…
				const staged = join(root, "staging-@yarnpkg-cli-dist-4.1.0", "package", "bin", "yarn.js");
				const cliHash = createHash("sha512").update(readFileSync(staged)).digest("hex");
				const url = "https://registry.npmjs.org/@yarnpkg/cli-dist/-/cli-dist-4.1.0.tgz";
				const script = scriptedFetch({ [url]: tgzResponse(archive) });
				const installed = yield* install(`yarn@4.1.0+sha512.${cliHash}`).pipe(Effect.provide(live(root, script.fetch)));
				assert.deepStrictEqual(script.calls, [url]);
				assert.strictEqual(installed.source, "tool-cache");

				// …and the TARBALL hash — the right answer for every other manager —
				// must fail: this pair is what discriminates the Berry rule.
				rmSync(cachedOf(installed).directory, { recursive: true, force: true });
				const error = yield* Effect.flip(
					install(`yarn@4.1.0+sha512.${sha512Hex(archive)}`).pipe(Effect.provide(live(root, script.fetch))),
				);
				assert.strictEqual(error.reason, "integrityMismatch");
				rmSync(root, { recursive: true, force: true });
			}),
		);
	});

	describe("bun", () => {
		it.live("maps the runner platform onto bun's release asset, extracts, and sets the executable bit", () =>
			Effect.gen(function* () {
				// RUNNER_ARCH decides the target (F3), so the fixture's name is a
				// LITERAL — deterministic on any host.
				const root = scratch();
				const archive = makeBunZip(root, "bun-linux-x64");
				const url = "https://github.com/oven-sh/bun/releases/download/bun-v1.0.0/bun-linux-x64.zip";
				const script = scriptedFetch({
					[url]: () => new Response(new Uint8Array(readFileSync(archive)), { status: 200 }),
				});
				const installed = cachedOf(
					yield* install("bun@1.0.0").pipe(
						Effect.provide(live(root, script.fetch, { RUNNER_OS: "Linux", RUNNER_ARCH: "X64" })),
					),
				);
				assert.deepStrictEqual(script.calls, [url]);
				// bun's binDir IS the entry directory: the binary is directly
				// executable, so no shim is written for it.
				assert.strictEqual(installed.binDir, installed.directory);
				assert.isFalse(existsSync(join(installed.directory, ".bin")), "bun must get no shim directory");
				const binary = installed.bins.bun ?? "";
				assert.strictEqual(binary, join(installed.directory, "bun"));
				assert.notStrictEqual(statSync(binary).mode & 0o111, 0, "the cached bun binary must be executable");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("maps macOS and ARM64 onto bun's own spellings", () =>
			Effect.gen(function* () {
				// The 404s are the assertion vehicle: what matters are the urls the
				// mapping produced, recorded by the scripted fetch — exact literals,
				// reachable from any host because RUNNER_ARCH decides (F3).
				const darwinRoot = scratch();
				const darwin = scriptedFetch({});
				yield* Effect.flip(
					install("bun@1.0.0").pipe(
						Effect.provide(live(darwinRoot, darwin.fetch, { RUNNER_OS: "macOS", RUNNER_ARCH: "X64" })),
						Effect.ensuring(Effect.sync(() => rmSync(darwinRoot, { recursive: true, force: true }))),
					),
				);
				assert.deepStrictEqual(darwin.calls, [
					"https://github.com/oven-sh/bun/releases/download/bun-v1.0.0/bun-darwin-x64.zip",
				]);

				const armRoot = scratch();
				const arm = scriptedFetch({});
				yield* Effect.flip(
					install("bun@1.0.0").pipe(
						Effect.provide(live(armRoot, arm.fetch, { RUNNER_OS: "Linux", RUNNER_ARCH: "ARM64" })),
						Effect.ensuring(Effect.sync(() => rmSync(armRoot, { recursive: true, force: true }))),
					),
				);
				assert.deepStrictEqual(arm.calls, [
					"https://github.com/oven-sh/bun/releases/download/bun-v1.0.0/bun-linux-aarch64.zip",
				]);
			}),
		);

		it.live("fails typed on a platform bun does not publish for, without downloading", () =>
			Effect.gen(function* () {
				const root = scratch();
				const script = scriptedFetch({});
				const error = yield* Effect.flip(
					install("bun@1.0.0").pipe(
						Effect.provide(live(root, script.fetch, { RUNNER_OS: "Solaris" })),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "unsupportedPlatform");
				assert.include(error.subject ?? "", "Solaris");
				assert.deepStrictEqual(script.calls, [], "an unsupported platform must fail before any download");
			}),
		);
	});

	describe("pnpm 12 native binary", () => {
		// RUNNER_OS/RUNNER_ARCH decide the target, so the fixture names are
		// literals — deterministic on any host, like the bun tests.
		const darwinArm = { RUNNER_OS: "macOS", RUNNER_ARCH: "ARM64" };

		it.live(
			"overlays the host's native binary onto the placeholder, verified against the registry, and shims it direct",
			() =>
				Effect.gen(function* () {
					const root = scratch();
					const version = "12.0.0";
					const wrapper = makePnpm12Wrapper(root, version);
					const exe = makePnpmExeTarball(root, "darwin-arm64", version);
					const urls = pnpm12Urls(version, "darwin-arm64");
					const script = scriptedFetch({
						[urls.wrapper]: tgzResponse(wrapper),
						[urls.packument]: jsonResponse({ name: "@pnpm/exe.darwin-arm64", dist: { integrity: sha512Sri(exe) } }),
						[urls.exe]: tgzResponse(exe),
					});
					const program = Effect.gen(function* () {
						const installed = cachedOf(yield* install(`pnpm@${version}`));
						// Exactly the three registry conversations, for the HOST's target.
						assert.deepStrictEqual(script.calls, [urls.wrapper, urls.packument, urls.exe]);
						const binary = join(installed.directory, "pnpm");
						assert.strictEqual(installed.bins.pnpm, binary);
						// The placeholder is gone: what sits at `pnpm` is the exe tarball's
						// binary, executable, with `dist/` and the aliases beside it.
						assert.include(readFileSync(binary, "utf8"), "native-pnpm");
						assert.notInclude(readFileSync(binary, "utf8"), "placeholder");
						assert.notStrictEqual(statSync(binary).mode & 0o111, 0, "the overlaid binary must be executable");
						for (const alias of ["pn", "pnpx", "pnx"]) {
							assert.notStrictEqual(
								statSync(join(installed.directory, alias)).mode & 0o111,
								0,
								`${alias} must be executable`,
							);
						}
						// The shim execs the binary DIRECTLY — no `node` — and so do the
						// aliases'. `bin/pnpm.mjs` (corepack's entry) is never shimmed.
						assert.strictEqual(
							readFileSync(join(installed.binDir, "pnpm"), "utf8"),
							`#!/bin/sh\nexec "${binary}" "$@"\n`,
						);
						for (const alias of ["pn", "pnpx", "pnx"]) {
							assert.strictEqual(
								readFileSync(join(installed.binDir, alias), "utf8"),
								`#!/bin/sh\nexec "${join(installed.directory, alias)}" "$@"\n`,
							);
						}
						assert.isFalse(existsSync(join(installed.binDir, "pnpm.mjs")));
						// Run for real through the shim AND through an alias, which execs
						// its sibling `pnpm` relative to itself — the layout the binary
						// needs (the wrapper's own directory) is the layout that was cached.
						const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
						const direct = yield* spawner.string(ChildProcess.make(join(installed.binDir, "pnpm"), ["--version"]));
						assert.strictEqual(direct.trim(), `native-pnpm ${version} --version`);
						const viaAlias = yield* spawner.string(ChildProcess.make(join(installed.binDir, "pnx"), ["a b"]));
						assert.strictEqual(viaAlias.trim(), `native-pnpm ${version} a b`);
					});
					yield* program.pipe(
						Effect.provide(Layer.mergeAll(live(root, script.fetch, darwinArm), NodeServices.layer)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					);
				}),
		);

		it.live("the pnpm 11 layout is untouched: a Node entry point, an `exec node` shim, and no exe download", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "11.0.0",
					bin: { pnpm: "bin/pnpm.mjs", pnpx: "bin/pnpx.mjs" },
					binFiles: ["bin/pnpm.mjs", "bin/pnpx.mjs"],
				});
				const url = "https://registry.npmjs.org/pnpm/-/pnpm-11.0.0.tgz";
				const script = scriptedFetch({ [url]: tgzResponse(archive) });
				const installed = cachedOf(
					yield* install("pnpm@11.0.0").pipe(Effect.provide(live(root, script.fetch, darwinArm))),
				);
				assert.deepStrictEqual(script.calls, [url], "no @pnpm/exe.* conversation may happen for pnpm 11");
				assert.strictEqual(installed.bins.pnpm, join(installed.directory, "bin", "pnpm.mjs"));
				assert.strictEqual(
					readFileSync(join(installed.binDir, "pnpm"), "utf8"),
					`#!/bin/sh\nexec node "${join(installed.directory, "bin", "pnpm.mjs")}" "$@"\n`,
				);
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("the shim rule is decided by the target's extension, not by the manager", () =>
			Effect.gen(function* () {
				// The discriminating pair for the node-vs-direct rule inside ONE
				// entry: a `.cjs` and a `.mjs` bin run under node, an extensionless
				// bin is exec'd directly — inverting the rule fails both halves.
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "11.0.1",
					bin: { pnpm: "bin/pnpm.mjs", helper: "bin/helper.cjs", tool: "bin/tool" },
					binFiles: ["bin/pnpm.mjs", "bin/helper.cjs", "bin/tool"],
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-11.0.1.tgz": tgzResponse(archive) });
				const installed = cachedOf(
					yield* install("pnpm@11.0.1").pipe(Effect.provide(live(root, script.fetch, darwinArm))),
				);
				const shim = (name: string) => readFileSync(join(installed.binDir, name), "utf8");
				assert.strictEqual(
					shim("pnpm"),
					`#!/bin/sh\nexec node "${join(installed.directory, "bin", "pnpm.mjs")}" "$@"\n`,
				);
				assert.strictEqual(
					shim("helper"),
					`#!/bin/sh\nexec node "${join(installed.directory, "bin", "helper.cjs")}" "$@"\n`,
				);
				assert.strictEqual(shim("tool"), `#!/bin/sh\nexec "${join(installed.directory, "bin", "tool")}" "$@"\n`);
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("a host with no @pnpm/exe.* candidate is unsupportedPlatform, before any exe download", () =>
			Effect.gen(function* () {
				const version = "12.0.1";
				// Two ways to have no candidate: a platform pnpm never publishes for,
				// and a wrapper whose optionalDependencies omit the host's target.
				const solarisRoot = scratch();
				const solarisWrapper = makePnpm12Wrapper(solarisRoot, version);
				const solaris = scriptedFetch({ [pnpm12Urls(version, "x").wrapper]: tgzResponse(solarisWrapper) });
				const solarisError = yield* Effect.flip(
					install(`pnpm@${version}`).pipe(
						Effect.provide(live(solarisRoot, solaris.fetch, { RUNNER_OS: "Solaris", RUNNER_ARCH: "X64" })),
						Effect.ensuring(Effect.sync(() => rmSync(solarisRoot, { recursive: true, force: true }))),
					),
				);
				assert.instanceOf(solarisError, PackageManagerInstallerError);
				assert.strictEqual(solarisError.reason, "unsupportedPlatform");
				assert.strictEqual(solarisError.subject, "Solaris/x64");
				assert.deepStrictEqual(solaris.calls, [pnpm12Urls(version, "x").wrapper]);

				const omittedRoot = scratch();
				const omittedWrapper = makePnpm12Wrapper(omittedRoot, version, { targets: ["linux-x64", "darwin-x64"] });
				const omitted = scriptedFetch({ [pnpm12Urls(version, "x").wrapper]: tgzResponse(omittedWrapper) });
				const omittedError = yield* Effect.flip(
					install(`pnpm@${version}`).pipe(
						Effect.provide(live(omittedRoot, omitted.fetch, darwinArm)),
						Effect.ensuring(Effect.sync(() => rmSync(omittedRoot, { recursive: true, force: true }))),
					),
				);
				assert.strictEqual(omittedError.reason, "unsupportedPlatform");
				assert.strictEqual(omittedError.subject, "macOS/arm64");
				assert.deepStrictEqual(omitted.calls, [pnpm12Urls(version, "x").wrapper]);
			}),
		);

		it.live(
			"a wrapper pinning its native package at another version is layoutUnexpected, before any exe download",
			() =>
				Effect.gen(function* () {
					// The manifest is attacker-supplied and this string is spliced into
					// two registry urls, so only the pin's own version is ever used there.
					const root = scratch();
					const version = "12.0.1";
					const wrapper = makePnpm12Wrapper(root, version, { nativeVersion: "../../evil" });
					const scripted = scriptedFetch({ [pnpm12Urls(version, "x").wrapper]: tgzResponse(wrapper) });
					const error = yield* Effect.flip(
						install(`pnpm@${version}`).pipe(
							Effect.provide(live(root, scripted.fetch, darwinArm)),
							Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
						),
					);
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "layoutUnexpected");
					assert.strictEqual(error.subject, "@pnpm/exe.darwin-arm64 is pinned at ../../evil, not the wrapper's 12.0.1");
					assert.deepStrictEqual(scripted.calls, [pnpm12Urls(version, "x").wrapper]);
				}),
		);

		it.live(
			"an exe tarball that does not hash to the registry's dist.integrity is integrityMismatch, and caches nothing",
			() =>
				Effect.gen(function* () {
					const root = scratch();
					const version = "12.0.2";
					const wrapper = makePnpm12Wrapper(root, version);
					const exe = makePnpmExeTarball(root, "darwin-arm64", version);
					const urls = pnpm12Urls(version, "darwin-arm64");
					// A well-formed SRI that is simply not this tarball's — sha512 of "".
					const wrongSri = `sha512-${createHash("sha512").update("").digest("base64")}`;
					const wrongHex = createHash("sha512").update("").digest("hex");
					const script = scriptedFetch({
						[urls.wrapper]: tgzResponse(wrapper),
						[urls.packument]: jsonResponse({ dist: { integrity: wrongSri } }),
						[urls.exe]: tgzResponse(exe),
					});
					const error = yield* Effect.flip(
						install(`pnpm@${version}`).pipe(Effect.provide(live(root, script.fetch, darwinArm))),
					);
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "integrityMismatch");
					assert.strictEqual(error.expected, `sha512.${wrongHex}`);
					assert.strictEqual(error.actual, `sha512.${sha512Hex(exe)}`);
					assert.strictEqual(error.subject, urls.exe);
					assert.include(error.message, "Integrity mismatch");
					const destination = ToolInstaller.cachePath({ root, tool: "pnpm", version, arch: process.arch });
					assert.isFalse(existsSync(destination), "a failed verification must not leave anything in the cache");
					rmSync(root, { recursive: true, force: true });
				}),
		);

		it.live(
			"a packument without dist.integrity cannot vouch for the tarball: integrityMismatch, could-not-verify arm",
			() =>
				Effect.gen(function* () {
					const version = "12.0.3";
					const urls = pnpm12Urls(version, "darwin-arm64");
					const attempt = Effect.fn("attempt")(function*(packument: () => Response) {
							const root = scratch();
							const wrapper = makePnpm12Wrapper(root, version);
							const script = scriptedFetch({ [urls.wrapper]: tgzResponse(wrapper), [urls.packument]: packument });
							const error = yield* Effect.flip(
								install(`pnpm@${version}`).pipe(
									Effect.provide(live(root, script.fetch, darwinArm)),
									Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
								),
							);
							assert.instanceOf(error, PackageManagerInstallerError);
							assert.strictEqual(error.reason, "integrityMismatch");
							assert.isUndefined(error.expected);
							assert.isUndefined(error.actual);
							assert.strictEqual(error.subject, urls.packument);
							assert.include(error.message, "Could not verify the integrity");
							// Fail-closed BEFORE the tarball is fetched: nothing to verify it against.
							assert.deepStrictEqual(script.calls, [urls.wrapper, urls.packument]);
						});
					yield* attempt(jsonResponse({ dist: { tarball: urls.exe } }));
					yield* attempt(jsonResponse({ dist: { integrity: "md5-AAAA" } })); // no usable algorithm
					yield* attempt(() => new Response("<html>not json</html>", { status: 200 }));
				}),
		);

		describe("caller-supplied nativeIntegrity", () => {
			// A mirror that serves tarballs only: the packument route is never
			// scripted, so any request for it answers 404 and fails the install.
			const mirror = "https://mirror.example/npm";
			/** sha512 of "" — a well-formed SRI that is no tarball's. */
			const wrongSri = `sha512-${createHash("sha512").update("").digest("base64")}`;
			const wrongHex = createHash("sha512").update("").digest("hex");

			it.live("verifies the host's exe tarball against the supplied SRI and never asks for the packument", () =>
				Effect.gen(function* () {
					const root = scratch();
					const version = "12.1.0";
					const wrapper = makePnpm12Wrapper(root, version);
					const exe = makePnpmExeTarball(root, "darwin-arm64", version);
					const urls = pnpm12Urls(version, "darwin-arm64", mirror);
					const script = scriptedFetch({ [urls.wrapper]: tgzResponse(wrapper), [urls.exe]: tgzResponse(exe) });
					const installed = cachedOf(
						yield* install(`pnpm@${version}`, {
							registry: mirror,
							// Every platform, as a lockfile records them; only the host's is read.
							nativeIntegrity: { "@pnpm/exe.linux-x64": wrongSri, "@pnpm/exe.darwin-arm64": sha512Sri(exe) },
						}).pipe(Effect.provide(live(root, script.fetch, darwinArm))),
					);
					assert.deepStrictEqual(script.calls, [urls.wrapper, urls.exe], "the packument must not be requested");
					assert.include(readFileSync(installed.bins.pnpm ?? "", "utf8"), "native-pnpm");
					rmSync(root, { recursive: true, force: true });
				}),
			);

			it.live("a tarball that does not hash to the supplied SRI is integrityMismatch naming the tarball url", () =>
				Effect.gen(function* () {
					// The discriminating input: identical to the success case except the
					// HOST's entry is wrong. The packument is scripted with the CORRECT
					// SRI and a sibling key carries it too, so a mutant that consults
					// the packument, or reads a key other than the host's, installs.
					const root = scratch();
					const version = "12.1.1";
					const wrapper = makePnpm12Wrapper(root, version);
					const exe = makePnpmExeTarball(root, "darwin-arm64", version);
					const urls = pnpm12Urls(version, "darwin-arm64");
					const script = scriptedFetch({
						[urls.wrapper]: tgzResponse(wrapper),
						[urls.packument]: jsonResponse({ dist: { integrity: sha512Sri(exe) } }),
						[urls.exe]: tgzResponse(exe),
					});
					const error = yield* Effect.flip(
						install(`pnpm@${version}`, {
							nativeIntegrity: { "@pnpm/exe.darwin-x64": sha512Sri(exe), "@pnpm/exe.darwin-arm64": wrongSri },
						}).pipe(Effect.provide(live(root, script.fetch, darwinArm))),
					);
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "integrityMismatch");
					assert.strictEqual(error.subject, urls.exe);
					assert.strictEqual(error.expected, `sha512.${wrongHex}`);
					assert.strictEqual(error.actual, `sha512.${sha512Hex(exe)}`);
					assert.include(error.message, "Integrity mismatch");
					assert.deepStrictEqual(script.calls, [urls.wrapper, urls.exe]);
					const destination = ToolInstaller.cachePath({ root, tool: "pnpm", version, arch: process.arch });
					assert.isFalse(existsSync(destination), "a failed verification must not leave anything in the cache");
					rmSync(root, { recursive: true, force: true });
				}),
			);

			it.live("a map with no entry for the host's package is integrityMissing naming it, before any exe download", () =>
				Effect.gen(function* () {
					const version = "12.1.2";
					const urls = pnpm12Urls(version, "darwin-arm64");
					const attempt = Effect.fn("attempt")(function*(nativeIntegrity: Readonly<Record<string, string>>) {
							const root = scratch();
							const wrapper = makePnpm12Wrapper(root, version);
							const script = scriptedFetch({ [urls.wrapper]: tgzResponse(wrapper) });
							const error = yield* Effect.flip(
								install(`pnpm@${version}`, { nativeIntegrity }).pipe(
									Effect.provide(live(root, script.fetch, darwinArm)),
									Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
								),
							);
							assert.instanceOf(error, PackageManagerInstallerError);
							assert.strictEqual(error.reason, "integrityMissing");
							assert.strictEqual(error.subject, "@pnpm/exe.darwin-arm64");
							assert.include(error.message, "@pnpm/exe.darwin-arm64");
							assert.deepStrictEqual(script.calls, [urls.wrapper]);
						});
					yield* attempt({});
					yield* attempt({ "@pnpm/exe.linux-x64": wrongSri, "@pnpm/exe.darwin-x64": wrongSri });
					// An inherited member is not a recorded checksum.
					yield* attempt(Object.create({ "@pnpm/exe.darwin-arm64": wrongSri }) as Record<string, string>);
				}),
			);

			it.live("an entry with no usable SRI is the could-not-verify arm, before any exe download", () =>
				Effect.gen(function* () {
					const root = scratch();
					const version = "12.1.3";
					const urls = pnpm12Urls(version, "darwin-arm64");
					const wrapper = makePnpm12Wrapper(root, version);
					const script = scriptedFetch({ [urls.wrapper]: tgzResponse(wrapper) });
					const error = yield* Effect.flip(
						install(`pnpm@${version}`, { nativeIntegrity: { "@pnpm/exe.darwin-arm64": "md5-AAAA" } }).pipe(
							Effect.provide(live(root, script.fetch, darwinArm)),
							Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
						),
					);
					assert.instanceOf(error, PackageManagerInstallerError);
					assert.strictEqual(error.reason, "integrityMismatch");
					assert.strictEqual(error.subject, "@pnpm/exe.darwin-arm64");
					assert.isUndefined(error.expected);
					assert.include(error.message, "Could not verify the integrity");
					assert.deepStrictEqual(script.calls, [urls.wrapper]);
				}),
			);

			it.live("a pin with no native overlay ignores the map, even one that would fail an overlay", () =>
				Effect.gen(function* () {
					const root = scratch();
					const archive = makeManagerTarball(root, {
						name: "pnpm",
						version: "11.2.0",
						bin: { pnpm: "bin/pnpm.mjs" },
						binFiles: ["bin/pnpm.mjs"],
					});
					const url = "https://registry.npmjs.org/pnpm/-/pnpm-11.2.0.tgz";
					const script = scriptedFetch({ [url]: tgzResponse(archive) });
					const installed = cachedOf(
						yield* install("pnpm@11.2.0", { nativeIntegrity: {} }).pipe(
							Effect.provide(live(root, script.fetch, darwinArm)),
							Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
						),
					);
					assert.deepStrictEqual(script.calls, [url]);
					assert.strictEqual(installed.bins.pnpm, join(installed.directory, "bin", "pnpm.mjs"));
				}),
			);
		});

		it.live("an exe tarball missing package/pnpm is layoutUnexpected", () =>
			Effect.gen(function* () {
				const root = scratch();
				const version = "12.0.4";
				const wrapper = makePnpm12Wrapper(root, version);
				const exe = makePnpmExeTarball(root, "darwin-arm64", version, { omitBinary: true });
				const urls = pnpm12Urls(version, "darwin-arm64");
				const script = scriptedFetch({
					[urls.wrapper]: tgzResponse(wrapper),
					[urls.packument]: jsonResponse({ dist: { integrity: sha512Sri(exe) } }),
					[urls.exe]: tgzResponse(exe),
				});
				const error = yield* Effect.flip(
					install(`pnpm@${version}`).pipe(
						Effect.provide(live(root, script.fetch, darwinArm)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "layoutUnexpected");
				assert.include(error.subject ?? "", "package/pnpm");
				assert.include(error.subject ?? "", "@pnpm/exe.darwin-arm64");
			}),
		);

		it.live("the exe conversation follows the wrapper's registry override", () =>
			Effect.gen(function* () {
				const root = scratch();
				const version = "12.0.5";
				const registry = "https://mirror.example.test";
				const wrapper = makePnpm12Wrapper(root, version);
				const exe = makePnpmExeTarball(root, "darwin-arm64", version);
				const urls = pnpm12Urls(version, "darwin-arm64", registry);
				const script = scriptedFetch({
					[urls.wrapper]: tgzResponse(wrapper),
					[urls.packument]: jsonResponse({ dist: { integrity: sha512Sri(exe) } }),
					[urls.exe]: tgzResponse(exe),
				});
				const installed = yield* install(`pnpm@${version}`, { registry: `${registry}/` }).pipe(
					Effect.provide(live(root, script.fetch, darwinArm)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
				assert.strictEqual(installed.source, "tool-cache");
				assert.deepStrictEqual(script.calls, [urls.wrapper, urls.packument, urls.exe]);
			}),
		);

		it.live("a cache hit still holding the placeholder is reinstalled over, stale `exec node` shim included", () =>
			Effect.gen(function* () {
				// The entry an OLDER version of this module wrote for pnpm 12: the
				// wrapper as extracted (placeholder intact, never overlaid) plus a
				// shim that hands the placeholder to node — the production failure.
				const root = scratch();
				const version = "12.0.6";
				const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version, arch: process.arch });
				mkdirSync(join(cached, ".bin"), { recursive: true });
				mkdirSync(join(cached, "bin"), { recursive: true });
				writeFileSync(
					join(cached, "package.json"),
					Result.getOrThrowWith(S.encodeResult(Json)({
						name: "pnpm",
						version,
						bin: { pnpm: "pnpm", pn: "pn", pnpx: "pnpx", pnx: "pnx" },
						optionalDependencies: { "@pnpm/exe.darwin-arm64": version },
					}), (error) => error),
				);
				writeFileSync(join(cached, "pnpm"), PNPM_PLACEHOLDER);
				for (const alias of ["pn", "pnpx", "pnx"]) {
					writeFileSync(join(cached, alias), pnpmAlias(alias));
				}
				writeFileSync(join(cached, ".bin", "pnpm"), `#!/bin/sh\nexec node "${join(cached, "pnpm")}" "$@"\n`);
				writeFileSync(join(cached, "foreign-marker"), "written by the old entry");

				const wrapper = makePnpm12Wrapper(root, version);
				const exe = makePnpmExeTarball(root, "darwin-arm64", version);
				const urls = pnpm12Urls(version, "darwin-arm64");
				const script = scriptedFetch({
					[urls.wrapper]: tgzResponse(wrapper),
					[urls.packument]: jsonResponse({ dist: { integrity: sha512Sri(exe) } }),
					[urls.exe]: tgzResponse(exe),
				});
				const installed = cachedOf(
					yield* install(`pnpm@${version}`).pipe(Effect.provide(live(root, script.fetch, darwinArm))),
				);
				// The hit was NOT answered: the whole conversation ran…
				assert.deepStrictEqual(script.calls, [urls.wrapper, urls.packument, urls.exe]);
				// …the entry was replaced wholesale (the swap, not an in-place patch)…
				assert.strictEqual(installed.directory, cached);
				assert.isFalse(existsSync(join(cached, "foreign-marker")), "the old entry must be swapped out, not patched");
				// …the placeholder is now the binary, and the stale shim was rewritten.
				assert.include(readFileSync(join(cached, "pnpm"), "utf8"), "native-pnpm");
				assert.strictEqual(
					readFileSync(join(cached, ".bin", "pnpm"), "utf8"),
					`#!/bin/sh\nexec "${join(cached, "pnpm")}" "$@"\n`,
				);
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("a cache hit whose pnpm is already an executable is answered without downloading", () =>
			Effect.gen(function* () {
				// Both things a non-placeholder `pnpm` can be: executable magic (the
				// real Mach-O/ELF binary) and a `#!` script. Only a `#`-led NON-shebang
				// file is the placeholder; treating a shebang as one would reinstall
				// a perfectly good entry on every run.
				const heads: ReadonlyArray<readonly [string, Buffer | string]> = [
					["12.0.7", Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01])],
					["12.0.9", "#!/bin/sh\necho pnpm\n"],
				];
				for (const [version, head] of heads) {
					const root = scratch();
					const cached = ToolInstaller.cachePath({ root, tool: "pnpm", version, arch: process.arch });
					mkdirSync(cached, { recursive: true });
					writeFileSync(
						join(cached, "package.json"),
						Result.getOrThrowWith(S.encodeResult(Json)({
							bin: { pnpm: "pnpm", pn: "pn" },
							optionalDependencies: { "@pnpm/exe.darwin-arm64": version },
						}), (error) => error),
					);
					writeFileSync(join(cached, "pnpm"), head);
					writeFileSync(join(cached, "pn"), pnpmAlias("pn"));
					// No .bin at all — a foreign writer; the fetch always fails, so an
					// answer proves nothing was downloaded and the shims were regenerated
					// with the direct-exec body.
					const installed = cachedOf(
						yield* install(`pnpm@${version}`).pipe(Effect.provide(live(root, alwaysFails, darwinArm))),
					);
					assert.strictEqual(installed.directory, cached);
					assert.strictEqual(installed.bins.pnpm, join(cached, "pnpm"));
					assert.strictEqual(
						readFileSync(join(cached, ".bin", "pnpm"), "utf8"),
						`#!/bin/sh\nexec "${join(cached, "pnpm")}" "$@"\n`,
					);
					assert.strictEqual(
						readFileSync(join(cached, ".bin", "pn"), "utf8"),
						`#!/bin/sh\nexec "${join(cached, "pn")}" "$@"\n`,
					);
					rmSync(root, { recursive: true, force: true });
				}
			}),
		);

		it.live("on Windows the binary lands as <name>.exe for every wrapper bin, and the .cmd shims target the .exe", () =>
			Effect.gen(function* () {
				// The Windows branch reached from any host: RUNNER_OS decides the file
				// names, the shim flavour and the chmod skip; the filesystem is real.
				const root = scratch();
				const version = "12.0.8";
				const wrapper = makePnpm12Wrapper(root, version);
				const exeStaging = join(root, "exe-staging", "package");
				mkdirSync(exeStaging, { recursive: true });
				writeFileSync(join(exeStaging, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ name: "@pnpm/exe.win32-x64", version }), (error) => error));
				writeFileSync(join(exeStaging, "pnpm.exe"), "MZ-native-pnpm-win32");
				const exe = join(root, "exe-win32-x64.tgz");
				execFileSync("tar", ["czf", exe, "-C", join(root, "exe-staging"), "package"]);
				const urls = pnpm12Urls(version, "win32-x64");
				const script = scriptedFetch({
					[urls.wrapper]: tgzResponse(wrapper),
					[urls.packument]: jsonResponse({ dist: { integrity: sha512Sri(exe) } }),
					[urls.exe]: tgzResponse(exe),
				});
				const installed = cachedOf(
					yield* install(`pnpm@${version}`).pipe(
						Effect.provide(live(root, script.fetch, { RUNNER_OS: "Windows", RUNNER_ARCH: "X64" })),
					),
				);
				assert.deepStrictEqual(script.calls, [urls.wrapper, urls.packument, urls.exe]);
				for (const name of ["pnpm", "pn", "pnpx", "pnx"]) {
					assert.strictEqual(installed.bins[name], join(installed.directory, `${name}.exe`));
					assert.strictEqual(readFileSync(join(installed.directory, `${name}.exe`), "utf8"), "MZ-native-pnpm-win32");
					assert.strictEqual(readFileSync(join(installed.directory, name), "utf8"), "MZ-native-pnpm-win32");
					assert.strictEqual(
						readFileSync(join(installed.binDir, `${name}.cmd`), "utf8"),
						`@echo off\r\n"${join(installed.directory, `${name}.exe`)}" %*\r\n`,
					);
				}
				rmSync(root, { recursive: true, force: true });
			}),
		);
	});

	describe("the error reasons that remain", () => {
		it.live("downloadFailed carries the ToolInstaller failure as cause", () =>
			Effect.gen(function* () {
				const root = scratch();
				const script = scriptedFetch({});
				const error = yield* Effect.flip(
					install("pnpm@2.0.0").pipe(
						Effect.provide(live(root, script.fetch)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.strictEqual(error.reason, "downloadFailed");
				assert.instanceOf(error.cause, ToolInstallerError);
			}),
		);

		it.live("extractFailed when the downloaded bytes are not an archive", () =>
			Effect.gen(function* () {
				const root = scratch();
				const script = scriptedFetch({
					"https://registry.npmjs.org/pnpm/-/pnpm-2.0.1.tgz": () => new Response("not a tarball", { status: 200 }),
				});
				const error = yield* Effect.flip(
					install("pnpm@2.0.1").pipe(
						Effect.provide(live(root, script.fetch)),
						Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
					),
				);
				assert.strictEqual(error.reason, "extractFailed");
			}),
		);

		it.live("layoutUnexpected when the tarball has no package/ root", () =>
			Effect.gen(function* () {
				const root = scratch();
				const staging = join(root, "rootless");
				mkdirSync(staging, { recursive: true });
				writeFileSync(join(staging, "loose-file"), "no package dir here");
				const archive = join(root, "rootless.tgz");
				execFileSync("tar", ["czf", archive, "-C", staging, "loose-file"]);
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-2.0.2.tgz": tgzResponse(archive) });
				const error = yield* Effect.flip(install("pnpm@2.0.2").pipe(Effect.provide(live(root, script.fetch))));
				assert.strictEqual(error.reason, "layoutUnexpected");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("layoutUnexpected when the manifest names no bin", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, { name: "pnpm", version: "2.0.3" });
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-2.0.3.tgz": tgzResponse(archive) });
				const error = yield* Effect.flip(install("pnpm@2.0.3").pipe(Effect.provide(live(root, script.fetch))));
				assert.strictEqual(error.reason, "layoutUnexpected");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("layoutUnexpected when a declared bin file is missing from the artifact", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "2.0.4",
					bin: { pnpm: "bin/pnpm.cjs" }, // declared, never shipped
				});
				const script = scriptedFetch({ "https://registry.npmjs.org/pnpm/-/pnpm-2.0.4.tgz": tgzResponse(archive) });
				const error = yield* Effect.flip(install("pnpm@2.0.4").pipe(Effect.provide(live(root, script.fetch))));
				assert.strictEqual(error.reason, "layoutUnexpected");
				assert.include(error.subject ?? "", "pnpm");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("cacheFailed maps the ToolInstaller failure through", () =>
			Effect.gen(function* () {
				const root = scratch();
				const extracted = join(root, "extracted", "package");
				mkdirSync(join(extracted, "bin"), { recursive: true });
				writeFileSync(join(extracted, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
				writeFileSync(join(extracted, "bin", "pnpm.cjs"), "console.log('pnpm')");
				const error = yield* Effect.flip(
					install("pnpm@2.0.5").pipe(
						Effect.provide(
							stubbed({
								installer: {
									find: () => Effect.succeedNone,
									download: () => Effect.succeed(join(root, "unused-archive")),
									extractTar: () => Effect.succeed(join(root, "extracted")),
									cacheDir: () => Effect.fail(ToolInstallerError.make({ reason: "cacheFailed", subject: "pnpm" })),
								},
							}),
						),
					),
				);
				assert.instanceOf(error, PackageManagerInstallerError);
				assert.strictEqual(error.reason, "cacheFailed");
				assert.instanceOf(error.cause, ToolInstallerError);
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("the shims name whatever the installer's cachePath answers, not a second derivation", () =>
			Effect.gen(function* () {
				// The shim target is ToolInstaller's own answer — the same closure
				// `cacheDir` lands at — so there is no second resolution of the
				// cache root or arch in this module to diverge from it. A stubbed
				// installer answering a sentinel path proves the shims read it.
				const root = scratch();
				const extracted = join(root, "extracted", "package");
				const target = join(root, "sentinel-target");
				mkdirSync(join(extracted, "bin"), { recursive: true });
				writeFileSync(join(extracted, "package.json"), Result.getOrThrowWith(S.encodeResult(Json)({ bin: { pnpm: "bin/pnpm.cjs" } }), (error) => error));
				writeFileSync(join(extracted, "bin", "pnpm.cjs"), "console.log('pnpm')");
				const asked: Array<string> = [];
				const installed = cachedOf(
					yield* install("pnpm@2.0.6").pipe(
						Effect.provide(
							stubbed({
								installer: {
									find: () => Effect.succeedNone,
									download: () => Effect.succeed(join(root, "unused-archive")),
									extractTar: () => Effect.succeed(join(root, "extracted")),
									cachePath: (tool, version) => {
										asked.push(`${tool}@${version}`);
										return target;
									},
									// The stub does not move the tree, so the shims stay readable
									// where they were written — in the STAGED package directory.
									cacheDir: () => Effect.succeed(target),
								},
							}),
						),
					),
				);
				assert.deepStrictEqual(asked, ["pnpm@2.0.6"]);
				assert.strictEqual(installed.directory, target);
				assert.strictEqual(
					readFileSync(join(extracted, ".bin", "pnpm"), "utf8"),
					`#!/bin/sh\nexec node "${join(target, "bin", "pnpm.cjs")}" "$@"\n`,
				);
				rmSync(root, { recursive: true, force: true });
			}),
		);
	});

	describe("the registry override", () => {
		it.live("downloads from a mirror instead of registry.npmjs.org", () =>
			Effect.gen(function* () {
				const root = scratch();
				const archive = makeManagerTarball(root, {
					name: "pnpm",
					version: "3.0.0",
					bin: { pnpm: "bin/pnpm.cjs" },
					binFiles: ["bin/pnpm.cjs"],
				});
				const url = "https://mirror.example.test/pnpm/-/pnpm-3.0.0.tgz";
				const script = scriptedFetch({ [url]: tgzResponse(archive) });
				// The trailing slash must not double up in the route.
				const installed = yield* install("pnpm@3.0.0", { registry: "https://mirror.example.test/" }).pipe(
					Effect.provide(live(root, script.fetch)),
					Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
				);
				assert.deepStrictEqual(script.calls, [url]);
				assert.strictEqual(installed.source, "tool-cache");
			}),
		);
	});

	describe("the discriminated union", () => {
		it.effect("both variants round-trip through the union schema (ActionState-persistable)", () =>
			Effect.gen(function* () {
				const cached = CachedPackageManager.make({
					name: "pnpm",
					version: "1.2.3",
					directory: "/cache/pnpm/1.2.3/x64",
					binDir: "/cache/pnpm/1.2.3/x64/.bin",
					bins: { pnpm: "/cache/pnpm/1.2.3/x64/bin/pnpm.cjs" },
				});
				const ambient = AmbientPackageManager.make({ name: "npm", version: "9.9.9", bins: { npm: "npm" } });

				const encode = S.encodeUnknownEffect(InstalledPackageManager);
				const decode = S.decodeUnknownEffect(InstalledPackageManager);
				const cachedBack = yield* S.encodeResult(Json)(yield* encode(cached)).pipe(Result.getOrThrowWith((error) => error), S.decodeResult(Json), Result.getOrThrowWith((error) => error), decode);
				const ambientBack = yield* S.encodeResult(Json)(yield* encode(ambient)).pipe(Result.getOrThrowWith((error) => error), S.decodeResult(Json), Result.getOrThrowWith((error) => error), decode);

				assert.instanceOf(cachedBack, CachedPackageManager);
				assert.instanceOf(ambientBack, AmbientPackageManager);
				// The discriminant narrows in the type AND at runtime: the tool-cache
				// variant carries directory + binDir, the ambient one has neither.
				if (cachedBack.source === "tool-cache") {
					assert.strictEqual(cachedBack.binDir, "/cache/pnpm/1.2.3/x64/.bin");
				} else {
					assert.fail("cached record decoded to the wrong variant");
				}
				assert.isFalse("directory" in ambientBack);
			}),
		);
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies rather than reporting an install that did not happen", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(install("npm@1.0.0"));
				assert.strictEqual(exit._tag, "Failure");
			}).pipe(Effect.provide(PackageManagerInstaller.layerTest())),
		);

		it.effect("an override wins", () =>
			Effect.gen(function* () {
				const record = AmbientPackageManager.make({ name: "npm", version: "1.0.0", bins: { npm: "npm" } });
				const installed = yield* install("npm@1.0.0");
				assert.deepStrictEqual(installed, record);
			}).pipe(
				Effect.provide(
					PackageManagerInstaller.layerTest({
						install: () =>
							Effect.succeed(AmbientPackageManager.make({ name: "npm", version: "1.0.0", bins: { npm: "npm" } })),
					}),
				),
			),
		);
	});
});
