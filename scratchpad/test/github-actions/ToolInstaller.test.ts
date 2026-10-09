// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file asyncFunction:skip-file processEnv:skip-file newPromise:skip-file
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { FetchHttpClient } from "effect/http";
import { badArgument } from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";
import { ActionEnvironment, ToolInstaller, ToolInstallerError } from "../../effected/github-actions/index.ts";
import { settle } from "./results.ts";

/** A scratch tool-cache root, removed by the test that made it. */
const scratch = () => mkdtempSync(join(tmpdir(), "effected-toolcache-"));

const alwaysFails: typeof globalThis.fetch = Object.assign(async () => new Response("no", { status: 500 }), { preconnect: () => {} });

/**
 * The real thing: real filesystem, real `tar`, real `unzip`.
 *
 * @remarks
 * A stubbed filesystem cannot test this module's central claim. Stage-then-swap
 * is a statement about what the filesystem contains after a partial failure,
 * and an in-memory double would only assert the double. Extraction has the same
 * problem one level up — a fake spawner proves the arguments were assembled,
 * not that `tar` accepts them.
 */
const live = (root: string, fetch: typeof globalThis.fetch = alwaysFails, env: Record<string, string> = {}) =>
	ToolInstaller.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				ActionEnvironment.layerTest({ RUNNER_TOOL_CACHE: root, ...env }),
				NodeServices.layer,
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
			),
		),
	);

const withRoot = <A, E>(
	use: (root: string) => Effect.Effect<A, E, ToolInstaller>,
	options: { fetch?: typeof globalThis.fetch; env?: Record<string, string> } = {},
) => {
	const root = scratch();
	return use(root).pipe(
		Effect.provide(live(root, options.fetch ?? alwaysFails, options.env ?? {})),
		Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
	);
};

/** A real gzipped tarball containing one file. */
const makeTarball = (directory: string, contents: string): string => {
	const staging = join(directory, "payload");
	mkdirSync(staging, { recursive: true });
	writeFileSync(join(staging, "tool.txt"), contents);
	const archive = join(directory, "tool.tar.gz");
	execFileSync("tar", ["czf", archive, "-C", staging, "tool.txt"]);
	return archive;
};

/** A real zip containing one file. */
const makeZip = (directory: string, contents: string): string => {
	const staging = join(directory, "zip-payload");
	mkdirSync(staging, { recursive: true });
	writeFileSync(join(staging, "tool.txt"), contents);
	const archive = join(directory, "tool.zip");
	execFileSync("zip", ["-q", archive, "tool.txt"], { cwd: staging });
	return archive;
};

/**
 * A spawner built through core's own `ChildProcessSpawner.make`, counting
 * every spawn and answering each with one scripted handle.
 *
 * @remarks
 * The COUNT is the point: the convenience members (`string`, `exitCode`) each
 * spawn independently, so an implementation that composes them re-executes the
 * command — the exact defect that failed 5/5 Windows extraction jobs while
 * POSIX stayed green on idempotency. A test asserting only on outputs cannot
 * see the second execution; the counter can.
 */
const countingSpawner = (script: { readonly exitCode: number; readonly output: string }) => {
	let spawns = 0;
	const service = ChildProcessSpawner.make(() =>
		Effect.sync(() => {
			spawns += 1;
			const bytes = new TextEncoder().encode(script.output);
			return ChildProcessSpawner.makeHandle({
				pid: ChildProcessSpawner.ProcessId(4321),
				exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(script.exitCode)),
				isRunning: Effect.succeed(false),
				kill: () => Effect.void,
				stdin: Sink.drain,
				stdout: Stream.fromIterable([bytes]),
				stderr: Stream.empty,
				all: Stream.fromIterable([bytes]),
				getInputFd: () => Sink.drain,
				getOutputFd: () => Stream.empty,
				unref: Effect.succeed(Effect.void),
			});
		}),
	);
	return {
		count: () => spawns,
		layer: Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, service),
	};
};

/**
 * The live layer with one or more `FileSystem` members replaced.
 *
 * @remarks
 * Everything else stays the real thing — the point is to observe or fail
 * exactly one member (chmod) while the download, the staging copy and the
 * swap all run against the real filesystem.
 */
const liveWithFileSystem = (
	root: string,
	mutate: (fs: FileSystem.FileSystem) => FileSystem.FileSystem,
	fetch: typeof globalThis.fetch,
	env: Record<string, string> = {},
) =>
	ToolInstaller.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				ActionEnvironment.layerTest({ RUNNER_TOOL_CACHE: root, ...env }),
				// NodeServices FIRST, the mutated FileSystem after it: the last
				// provider of a duplicated service wins the merge.
				NodeServices.layer,
				Layer.effect(FileSystem.FileSystem, Effect.map(FileSystem.FileSystem, mutate)).pipe(
					Layer.provide(NodeServices.layer),
				),
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))),
			),
		),
	);

/**
 * What the Node platform hands back for a cross-device rename: the errno maps
 * to no named tag, so it is `Unknown` with the `EXDEV` exception as the cause.
 */
const exdev = (from: string, to: string) =>
	PlatformError.systemError({
		_tag: "Unknown",
		module: "FileSystem",
		method: "rename",
		pathOrDescriptor: from,
		syscall: "rename",
		cause: Object.assign(new Error(`EXDEV: cross-device link not permitted, rename '${from}' -> '${to}'`), {
			code: "EXDEV",
			syscall: "rename",
		}),
	});

/** A fetch that counts its calls — the observable for "did it download?". */
const countingFetch = (respond: () => Response) => {
	let count = 0;
	const fetch: typeof globalThis.fetch = Object.assign(async () => {
		count += 1;
		return respond();
	}, { preconnect: () => {} });
	return { fetch, count: () => count };
};

/** The live layer with the spawner replaced by a scripted, counting one. */
const liveWithSpawner = (root: string, spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
	ToolInstaller.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				ActionEnvironment.layerTest({ RUNNER_TOOL_CACHE: root }),
				// NodeServices FIRST, the scripted spawner after it: the last
				// provider of a duplicated service wins the merge.
				NodeServices.layer,
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(alwaysFails))),
				spawner,
			),
		),
	);

describe("ToolInstaller", () => {
	describe("the cache layout", () => {
		it("is the layout the runner and @actions/tool-cache both use", () => {
			// A contract with the runner, not an internal detail: a tool cached at
			// any other path is invisible to every other step in the workflow.
			assert.strictEqual(
				ToolInstaller.cachePath({ root: "/opt/hostedtoolcache", tool: "node", version: "22.11.0", arch: "x64" }),
				"/opt/hostedtoolcache/node/22.11.0/x64",
			);
		});

		it.live("the service's cachePath is the static layout over the resolved root — pure, no IO", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// What PackageManagerInstaller writes into its shims BEFORE the
					// swap: the same answer `cacheDir` lands at, from the same closure,
					// so the two can no longer be derived twice and diverge.
					const installer = yield* ToolInstaller;
					assert.strictEqual(
						installer.cachePath("node", "22.11.0"),
						ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch }),
					);
					assert.isFalse(existsSync(installer.cachePath("node", "22.11.0")), "cachePath must not create anything");
				}),
			),
		);

		it.live("cacheDir lands exactly where cachePath said it would", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const installer = yield* ToolInstaller;
					const source = join(root, "staged");
					mkdirSync(source, { recursive: true });
					writeFileSync(join(source, "tool.txt"), "x");
					assert.strictEqual(yield* installer.cacheDir(source, "node", "1.2.3"), installer.cachePath("node", "1.2.3"));
				}),
			),
		);
	});

	describe("find", () => {
		it.live("reports a cached tool", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const expected = ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch });
					mkdirSync(expected, { recursive: true });
					assert.deepStrictEqual(yield* (yield* ToolInstaller).find("node", "22.11.0"), O.some(expected));
				}),
			),
		);

		it.live("reports nothing for a tool that is not there", () =>
			withRoot(() =>
				Effect.gen(function* () {
					assert.isTrue(O.isNone(yield* (yield* ToolInstaller).find("node", "0.0.1")));
				}),
			),
		);

		it.live("reports nothing when the cache path is a file rather than a directory", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// A stray file where a tool directory belongs is corruption, and
					// answering "found" for it hands the caller a path it cannot use.
					const expected = ToolInstaller.cachePath({ root, tool: "node", version: "1.0.0", arch: process.arch });
					mkdirSync(join(expected, ".."), { recursive: true });
					writeFileSync(expected, "not a directory");
					assert.isTrue(O.isNone(yield* (yield* ToolInstaller).find("node", "1.0.0")));
				}),
			),
		);
	});

	describe("caching, and the stage-then-swap invariant", () => {
		it.live("installs a directory at the cache path", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const source = join(root, "src");
					mkdirSync(source, { recursive: true });
					writeFileSync(join(source, "bin"), "#!/bin/sh\n");

					const installer = yield* ToolInstaller;
					const cached = yield* installer.cacheDir(source, "node", "22.11.0");
					assert.strictEqual(
						cached,
						ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch }),
					);
					assert.strictEqual(readFileSync(join(cached, "bin"), "utf8"), "#!/bin/sh\n");
					assert.deepStrictEqual(yield* installer.find("node", "22.11.0"), O.some(cached));
					// The contract: `cacheDir` CONSUMES its source. On one filesystem the
					// tree is renamed into the cache, so nothing is left at the source path.
					assert.isFalse(existsSync(source), "cacheDir must consume its source");
				}),
			),
		);

		it.live("falls back to a copy when the source is on another filesystem, and still consumes it", () => {
			const root = scratch();
			const source = join(root, "src");
			let refused = 0;
			return Effect.gen(function* () {
				mkdirSync(join(source, "nested"), { recursive: true });
				writeFileSync(join(source, "bin"), "#!/bin/sh\n");
				writeFileSync(join(source, "nested", "lib.js"), "module.exports = 1;\n");

				const installer = yield* ToolInstaller;
				const cached = yield* installer.cacheDir(source, "node", "22.11.0");
				assert.strictEqual(refused, 1, "exactly the source rename is refused; the swap into the cache stays real");
				assert.strictEqual(readFileSync(join(cached, "bin"), "utf8"), "#!/bin/sh\n");
				assert.strictEqual(readFileSync(join(cached, "nested", "lib.js"), "utf8"), "module.exports = 1;\n");
				assert.deepStrictEqual(yield* installer.find("node", "22.11.0"), O.some(cached));
				assert.isFalse(existsSync(source), "the copy path must consume the source too");
			}).pipe(
				Effect.provide(
					liveWithFileSystem(
						root,
						(fs) => ({
							...fs,
							// A cross-device rename: Node reports EXDEV, which the platform
							// maps to an `Unknown` SystemError with the errno as its cause.
							rename: (from, to) =>
								from === source
									? Effect.sync(() => {
											refused += 1;
										}).pipe(Effect.flatMap(() => Effect.fail(exdev(from, to))))
									: fs.rename(from, to),
						}),
						alwaysFails,
					),
				),
				Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
			);
		});

		it.live("does not fall back to a copy for a rename failure that is not EXDEV", () => {
			const root = scratch();
			const source = join(root, "src");
			return Effect.gen(function* () {
				mkdirSync(source, { recursive: true });
				writeFileSync(join(source, "bin"), "#!/bin/sh\n");

				const installer = yield* ToolInstaller;
				const error = yield* Effect.flip(installer.cacheDir(source, "node", "22.11.0"));
				assert.instanceOf(error, ToolInstallerError);
				assert.strictEqual(error.reason, "cacheFailed");
				// A copy fallback here would mask a real failure (a permission
				// problem, say) as a slow success — and would have consumed the source.
				assert.isTrue(existsSync(join(source, "bin")), "a non-EXDEV failure must leave the source untouched");
				assert.isTrue(O.isNone(yield* installer.find("node", "22.11.0")));
			}).pipe(
				Effect.provide(
					liveWithFileSystem(
						root,
						(fs) => ({
							...fs,
							rename: (from, to) =>
								from === source
									? Effect.fail(
											PlatformError.systemError({
												_tag: "PermissionDenied",
												module: "FileSystem",
												method: "rename",
												pathOrDescriptor: from,
												cause: Object.assign(new Error(`EACCES: permission denied, rename '${from}' -> '${to}'`), {
													code: "EACCES",
												}),
											}),
										)
									: fs.rename(from, to),
						}),
						alwaysFails,
					),
				),
				Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
			);
		});

		it.live("leaves NOTHING at the cache path when the install fails", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const installer = yield* ToolInstaller;
					// THE invariant. An implementation that creates the destination and
					// then copies into it leaves an empty directory behind here — and
					// `find` reports an empty directory as a hit, so every later run
					// uses a tool that is not there and never re-downloads it.
					const error = yield* Effect.flip(installer.cacheDir(join(root, "does-not-exist"), "node", "22.11.0"));
					assert.instanceOf(error, ToolInstallerError);
					assert.strictEqual(error.reason, "cacheFailed");

					const destination = ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch });
					assert.isFalse(existsSync(destination), "a failed install must not leave a partial tool behind");
					assert.isTrue(O.isNone(yield* installer.find("node", "22.11.0")));
				}),
			),
		);

		it.live("leaves no staging directory behind after a failure", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const installer = yield* ToolInstaller;
					yield* Effect.flip(installer.cacheDir(join(root, "does-not-exist"), "node", "22.11.0"));
					const { readdirSync } = yield* Effect.promise(() => import("node:fs"));
					const leftovers = readdirSync(root).filter((entry) => entry.startsWith(".staging-"));
					assert.deepStrictEqual(leftovers, [], "the staging directory must be cleaned up on the failure path");
				}),
			),
		);

		it.live("replaces an existing install rather than merging into it", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const installer = yield* ToolInstaller;
					const first = join(root, "first");
					mkdirSync(first, { recursive: true });
					writeFileSync(join(first, "stale.txt"), "old");
					yield* installer.cacheDir(first, "node", "22.11.0");

					const second = join(root, "second");
					mkdirSync(second, { recursive: true });
					writeFileSync(join(second, "fresh.txt"), "new");
					const cached = yield* installer.cacheDir(second, "node", "22.11.0");

					// A merge would leave `stale.txt` from the previous version's
					// layout sitting in the new install.
					assert.isTrue(existsSync(join(cached, "fresh.txt")));
					assert.isFalse(existsSync(join(cached, "stale.txt")), "a re-install must replace, not merge");
				}),
			),
		);

		it.live("installs a single file under the name it is given", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const source = join(root, "downloaded-binary");
					writeFileSync(source, "binary");
					const cached = yield* (yield* ToolInstaller).cacheFile(source, "mytool", "mytool", "1.0.0");
					assert.strictEqual(readFileSync(join(cached, "mytool"), "utf8"), "binary");
				}),
			),
		);
	});

	describe("extraction", () => {
		it.live("extracts a real gzipped tarball", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const archive = makeTarball(root, "hello");
					const extracted = yield* (yield* ToolInstaller).extractTar(archive);
					assert.strictEqual(readFileSync(join(extracted, "tool.txt"), "utf8"), "hello");
				}),
			),
		);

		it.live("extracts into a destination it is given, creating it", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const archive = makeTarball(root, "hello");
					const destination = join(root, "nested", "target");
					const extracted = yield* (yield* ToolInstaller).extractTar(archive, { destination });
					assert.strictEqual(extracted, destination);
					assert.strictEqual(readFileSync(join(destination, "tool.txt"), "utf8"), "hello");
				}),
			),
		);

		it.live("fails typed, carrying tar's own complaint, on a corrupt archive", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					const archive = join(root, "not-really.tar.gz");
					writeFileSync(archive, "this is not a tarball");
					const error = yield* Effect.flip((yield* ToolInstaller).extractTar(archive));
					assert.strictEqual(error.reason, "extractFailed");
					// The exit code alone says only "it failed"; stderr is the difference
					// between a corrupt archive and tar not being installed.
					assert.isAbove((error.stderr ?? "").length, 0, "tar's stderr must survive");
				}),
			),
		);
	});

	describe("extraction runs exactly once", () => {
		it.live("a successful extraction spawns its command EXACTLY once", () =>
			Effect.gen(function* () {
				// This counter is the mutant that was alive in production: `string`
				// then `exitCode` are two spawns, and the second one is what failed
				// 5/5 on Windows where ExtractToDirectory refuses to overwrite.
				const root = scratch();
				const tarSpawner = countingSpawner({ exitCode: 0, output: "" });
				yield* Effect.flatMap(ToolInstaller, (installer) => installer.extractTar(join(root, "a.tgz"))).pipe(
					Effect.provide(liveWithSpawner(root, tarSpawner.layer)),
				);
				assert.strictEqual(tarSpawner.count(), 1, "extractTar must spawn exactly once");

				const zipSpawner = countingSpawner({ exitCode: 0, output: "" });
				yield* Effect.flatMap(ToolInstaller, (installer) => installer.extractZip(join(root, "a.zip"))).pipe(
					Effect.provide(liveWithSpawner(root, zipSpawner.layer)),
				);
				assert.strictEqual(zipSpawner.count(), 1, "extractZip must spawn exactly once");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("a failed extraction spawns once and reports THAT run's complaint", () =>
			Effect.gen(function* () {
				const root = scratch();
				const spawner = countingSpawner({ exitCode: 1, output: "the actual complaint" });
				const error = yield* Effect.flip(
					Effect.flatMap(ToolInstaller, (installer) => installer.extractTar(join(root, "a.tgz"))).pipe(
						Effect.provide(liveWithSpawner(root, spawner.layer)),
					),
				);
				assert.instanceOf(error, ToolInstallerError);
				assert.strictEqual(error.reason, "extractFailed");
				assert.strictEqual(error.stderr, "the actual complaint");
				assert.strictEqual(spawner.count(), 1, "the failure must come from the one and only run");
				rmSync(root, { recursive: true, force: true });
			}),
		);

		it.live("extracting the same zip twice into the same destination succeeds", () =>
			withRoot((root) =>
				Effect.gen(function* () {
					// The idempotency claim: extraction into a pre-populated
					// destination must overwrite, not refuse — the POSIX half runs
					// here (`unzip -o`); the Windows half is the three-argument
					// ExtractToDirectory overwrite overload in the same code path.
					const archive = makeZip(root, "zipped");
					const destination = join(root, "dest");
					const installer = yield* ToolInstaller;
					yield* installer.extractZip(archive, { destination });
					yield* installer.extractZip(archive, { destination });
					assert.strictEqual(readFileSync(join(destination, "tool.txt"), "utf8"), "zipped");
				}),
			),
		);
	});

	describe("download", () => {
		it.live("streams the body to a file", () =>
			withRoot(
				() =>
					Effect.gen(function* () {
						const file = yield* (yield* ToolInstaller).download("https://example.test/tool.tar.gz");
						assert.strictEqual(readFileSync(file, "utf8"), "archive-bytes");
					}),
				{ fetch: Object.assign(async () => new Response("archive-bytes", { status: 200 }), { preconnect: () => {} }) },
			),
		);

		it.live("fails typed on a 404 and does NOT retry it", () =>
			withRoot(
				() =>
					Effect.gen(function* () {
						// A 404 will not fix itself; retrying it three times only makes a
						// broken url take longer to fail.
						const error = yield* Effect.flip((yield* ToolInstaller).download("https://example.test/gone"));
						assert.strictEqual(error.reason, "downloadFailed");
						assert.strictEqual(error.status, 404);
						assert.isFalse(error.retryable);
					}),
				{ fetch: Object.assign(async () => new Response("gone", { status: 404 }), { preconnect: () => {} }) },
			),
		);

		it.live("classifies what is worth retrying", () => {
			const of = (status?: number) =>
				ToolInstallerError.make({
					reason: "downloadFailed",
					subject: "https://example.test/tool.tgz",
					...(status === undefined ? {} : { status }),
				});
			assert.isTrue(of(500).retryable);
			assert.isTrue(of(503).retryable);
			assert.isTrue(of(408).retryable);
			assert.isTrue(of(429).retryable);
			assert.isTrue(of().retryable, "a transport fault with no status is the most retryable thing there is");
			assert.isFalse(of(404).retryable);
			assert.isFalse(of(401).retryable);
			assert.isFalse(ToolInstallerError.make({ reason: "extractFailed", subject: "tool.tgz" }).retryable);
			return Effect.void;
		});

		it.effect("a connection that stops moving times out typed, statusless, and retryable", () =>
			Effect.gen(function* () {
				// A fetch that never settles is the dead connection: without the
				// per-attempt budget this is a silent hang to the job timeout. Under
				// the virtual clock the default five-minute budget (plus the two
				// retries it makes possible) elapses instantly.
				const root = scratch();
				const stalled: typeof globalThis.fetch = Object.assign(() => new Promise<Response>(() => {}), { preconnect: () => {} });
				const exit = yield* settle(
					Effect.flip(
						Effect.flatMap(ToolInstaller, (installer) => installer.download("https://example.test/stall")).pipe(
							Effect.provide(live(root, stalled)),
						),
					),
					TestClock.adjust("6 minutes"),
				);
				rmSync(root, { recursive: true, force: true });
				assert.strictEqual(exit._tag, "Success", "the download must FAIL typed, not hang");
				if (exit._tag === "Success") {
					const error = exit.value;
					assert.instanceOf(error, ToolInstallerError);
					assert.strictEqual(error.reason, "downloadFailed");
					assert.isUndefined(error.status, "a timeout has no status");
					assert.isTrue(error.retryable, "a dead connection is a transport fault, the most retryable thing there is");
				}
			}),
		);
	});

	describe("provisionFile", () => {
		const options = { tool: "biome", version: "2.3.4", url: "https://example.test/biome", binary: "biome" };
		const binaryBody = "#!/bin/sh\necho biome\n";

		it.live("provisions a single binary: downloaded, executable, cached, binDir answered", () =>
			withRoot(
				(root) =>
					Effect.gen(function* () {
						const provisioned = yield* (yield* ToolInstaller).provisionFile(options);
						assert.strictEqual(
							provisioned.directory,
							ToolInstaller.cachePath({ root, tool: "biome", version: "2.3.4", arch: process.arch }),
						);
						// For a single binary the cached directory IS the addPath target.
						assert.strictEqual(provisioned.binDir, provisioned.directory);
						const file = join(provisioned.directory, "biome");
						assert.strictEqual(readFileSync(file, "utf8"), binaryBody);
						// The executable bit is the difference between a cached tool and a
						// cached file, and it must be ON THE CACHED FILE — a chmod after
						// caching would mutate a swapped-in entry, and a skipped chmod
						// ships a binary the runner cannot execute.
						assert.strictEqual(statSync(file).mode & 0o777, 0o755);
					}),
				{ fetch: Object.assign(async () => new Response(binaryBody, { status: 200 }), { preconnect: () => {} }) },
			),
		);

		it.live("short-circuits on a cache hit carrying the binary, and the hit answers binDir too", () => {
			const counting = countingFetch(() => new Response(binaryBody, { status: 200 }));
			return withRoot(
				(root) =>
					Effect.gen(function* () {
						const directory = ToolInstaller.cachePath({ root, tool: "biome", version: "2.3.4", arch: process.arch });
						mkdirSync(directory, { recursive: true });
						writeFileSync(join(directory, "biome"), "already cached");
						const provisioned = yield* (yield* ToolInstaller).provisionFile(options);
						assert.strictEqual(provisioned.directory, directory);
						assert.strictEqual(provisioned.binDir, directory);
						assert.strictEqual(readFileSync(join(directory, "biome"), "utf8"), "already cached");
						assert.strictEqual(counting.count(), 0, "a hit must not download");
					}),
				{ fetch: counting.fetch },
			);
		});

		it.live("reinstalls over a foreign hit that is MISSING the binary", () => {
			// find's own TSDoc warning made real: the tool cache is shared, and a
			// foreign entry guarantees only the location contract. An entry without
			// the named binary cannot run the tool, so it is treated as a miss —
			// answering it as a hit is the shipped-bug shape the warning records.
			const counting = countingFetch(() => new Response(binaryBody, { status: 200 }));
			return withRoot(
				(root) =>
					Effect.gen(function* () {
						const directory = ToolInstaller.cachePath({ root, tool: "biome", version: "2.3.4", arch: process.arch });
						mkdirSync(directory, { recursive: true });
						writeFileSync(join(directory, "other-layout.txt"), "a different writer's idea of biome");
						const provisioned = yield* (yield* ToolInstaller).provisionFile(options);
						assert.strictEqual(counting.count(), 1, "a hit without the binary must reinstall");
						assert.strictEqual(readFileSync(join(provisioned.directory, "biome"), "utf8"), binaryBody);
					}),
				{ fetch: counting.fetch },
			);
		});

		it.live("skips chmod entirely when RUNNER_OS is Windows", () => {
			const root = scratch();
			const chmods: Array<string> = [];
			const spying = (fs: FileSystem.FileSystem): FileSystem.FileSystem => ({
				...fs,
				chmod: (file, mode) => {
					chmods.push(String(file));
					return fs.chmod(file, mode);
				},
			});
			return Effect.gen(function* () {
				const provisioned = yield* Effect.flatMap(ToolInstaller, (installer) => installer.provisionFile(options));
				assert.deepStrictEqual(chmods, [], "no chmod may be attempted on Windows — the bit does not exist there");
				assert.strictEqual(provisioned.binDir, provisioned.directory);
			}).pipe(
				Effect.provide(
					liveWithFileSystem(root, spying, Object.assign(async () => new Response(binaryBody, { status: 200 }), { preconnect: () => {} }), {
						RUNNER_OS: "Windows",
					}),
				),
				Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
			);
		});

		it.live("the control: off Windows the same spy sees exactly one chmod, on the downloaded file", () => {
			const root = scratch();
			const chmods: Array<string> = [];
			const spying = (fs: FileSystem.FileSystem): FileSystem.FileSystem => ({
				...fs,
				chmod: (file, mode) => {
					chmods.push(String(file));
					return fs.chmod(file, mode);
				},
			});
			return Effect.gen(function* () {
				yield* Effect.flatMap(ToolInstaller, (installer) => installer.provisionFile(options));
				assert.lengthOf(chmods, 1, "the Windows test's spy must be able to see a chmod at all");
				assert.isTrue(chmods[0]?.endsWith("download"), "the chmod lands on the downloaded file, before caching");
			}).pipe(
				Effect.provide(liveWithFileSystem(root, spying, Object.assign(async () => new Response(binaryBody, { status: 200 }), { preconnect: () => {} }))),
				Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
			);
		});

		it.live("a chmod failure is cacheFailed naming the downloaded file, and nothing is cached", () => {
			const root = scratch();
			const failing = (fs: FileSystem.FileSystem): FileSystem.FileSystem => ({
				...fs,
				chmod: () => Effect.fail(badArgument({ module: "FileSystem", method: "chmod", description: "refused" })),
			});
			return Effect.gen(function* () {
				const error = yield* Effect.flip(
					Effect.flatMap(ToolInstaller, (installer) => installer.provisionFile(options)),
				);
				assert.instanceOf(error, ToolInstallerError);
				assert.strictEqual(error.reason, "cacheFailed");
				assert.isTrue(error.subject?.endsWith("download"), "the subject is the file that could not be made executable");
				// The failure happened BEFORE caching, so the cache must not contain
				// a non-executable binary for every later run to find.
				const found = yield* Effect.flatMap(ToolInstaller, (installer) => installer.find("biome", "2.3.4"));
				assert.isTrue(O.isNone(found));
			}).pipe(
				Effect.provide(liveWithFileSystem(root, failing, Object.assign(async () => new Response(binaryBody, { status: 200 }), { preconnect: () => {} }))),
				Effect.ensuring(Effect.sync(() => rmSync(root, { recursive: true, force: true }))),
			);
		});
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies rather than reporting a tool that is not there", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(ToolInstaller, (installer) => installer.find("node", "1")));
				assert.strictEqual(exit._tag, "Failure");
			}).pipe(Effect.provide(ToolInstaller.layerTest())),
		);

		it.effect("an override wins", () =>
			Effect.gen(function* () {
				const found = yield* Effect.flatMap(ToolInstaller, (installer) => installer.find("node", "1"));
				assert.deepStrictEqual(found, O.some("/cached"));
			}).pipe(Effect.provide(ToolInstaller.layerTest({ find: () => Effect.succeedSome("/cached") }))),
		);

		it("cachePath is the one member with a default: the static layout over RUNNER_TOOL_CACHE or the off-runner root", () => {
			// Pure and total, so dying would only punish every test that reads it
			// through PackageManagerInstaller. The default mirrors `make`'s own
			// resolution (`internal/runner.ts`), read from the ambient environment
			// because a double has no ActionEnvironment to ask.
			const root = process.env.RUNNER_TOOL_CACHE ?? "/tmp/runner-tool-cache";
			assert.strictEqual(
				ToolInstaller.makeTest().cachePath("node", "22.11.0"),
				ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch }),
			);
			assert.strictEqual(
				ToolInstaller.makeTest({ cachePath: () => "/elsewhere" }).cachePath("node", "1"),
				"/elsewhere",
			);
		});
	});
});
