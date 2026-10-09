import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
import * as Context from "effect/Context";
import * as Config from "effect/Config";
import * as Cause from "effect/Cause";
import { assertNone, assertSome, assertExitFailure, assertExitSuccess } from "@effect/vitest/utils";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import { badArgument } from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as TestClock from "effect/testing/TestClock";
import { ActionEnvironment, ToolInstaller, ToolInstallerError } from "../../effected/github-actions/index.ts";
import { settle } from "./results.ts";

const alwaysFails: typeof globalThis.fetch = Object.assign(() => Promise.resolve(new Response("no", { status: 500 })), {
	preconnect: () => {},
});

/**
 * The real thing: real filesystem, real `tar`, real `unzip`.
 *
 * **Details**
 *
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

class TarInstaller extends Context.Service<TarInstaller, ReturnType<typeof ToolInstaller.makeTest>>()(
	"@beep/scratchpad/test/github-actions/ToolInstaller.test/TarInstaller",
) {}
class ZipInstaller extends Context.Service<ZipInstaller, ReturnType<typeof ToolInstaller.makeTest>>()(
	"@beep/scratchpad/test/github-actions/ToolInstaller.test/ZipInstaller",
) {}

class TestRoot extends Context.Service<TestRoot, string>()(
	"@beep/scratchpad/test/github-actions/ToolInstaller.test/TestRoot",
) {}

const testLayer = (
	options: {
		fetch?: typeof globalThis.fetch;
		env?: Record<string, string>;
		make?: (root: string, path: Path.Path) => Layer.Layer<ToolInstaller>;
	} = {},
) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-toolcache-" });
			return Layer.mergeAll(
				Layer.succeed(TestRoot, root),
				options.make?.(root, yield* Path.Path) ?? live(root, options.fetch ?? alwaysFails, options.env ?? {}),
				NodeServices.layer,
			);
		}),
	).pipe(Layer.provide(NodeServices.layer));

/** A real gzipped tarball containing one file. */
const makeTarball = Effect.fn("ToolInstaller.test.makeTarball")(function* (directory: string, contents: string) {
	const fs = yield* FileSystem.FileSystem;
	const { join } = yield* Path.Path;
	const staging = join(directory, "payload");
	yield* fs.makeDirectory(staging, { recursive: true });
	yield* fs.writeFileString(join(staging, "tool.txt"), contents);
	const archive = join(directory, "tool.tar.gz");
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const code = yield* spawner.exitCode(ChildProcess.make("tar", ["czf", archive, "-C", staging, "tool.txt"]));
	assert.strictEqual(Number(code), 0, "tar fixture creation must succeed");
	return archive;
});

/** A real zip containing one file. */
const makeZip = Effect.fn("ToolInstaller.test.makeZip")(function* (directory: string, contents: string) {
	const fs = yield* FileSystem.FileSystem;
	const { join } = yield* Path.Path;
	const staging = join(directory, "zip-payload");
	yield* fs.makeDirectory(staging, { recursive: true });
	yield* fs.writeFileString(join(staging, "tool.txt"), contents);
	const archive = join(directory, "tool.zip");
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const code = yield* spawner.exitCode(ChildProcess.make("zip", ["-q", archive, "tool.txt"], { cwd: staging }));
	assert.strictEqual(Number(code), 0, "zip fixture creation must succeed");
	return archive;
});

/**
 * A spawner built through core's own `ChildProcessSpawner.make`, counting
 * every spawn and answering each with one scripted handle.
 *
 * **Details**
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
 * **Details**
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
	const fetch: typeof globalThis.fetch = Object.assign(
		() => {
			count += 1;
			return Promise.resolve(respond());
		},
		{ preconnect: () => {} },
	);
	return { fetch, count: () => count };
};

/** A memory filesystem with a scripted, counting process spawner. */
const liveWithSpawner = (root: string, spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
	ToolInstaller.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				ActionEnvironment.layerTest({ RUNNER_TOOL_CACHE: root }),
				// The subject needs only filesystem/path services and a scripted process.
				MemoryFileSystem.layer,
				Path.layer,
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

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("the service's cachePath is the static layout over the resolved root — pure, no IO", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						// What PackageManagerInstaller writes into its shims BEFORE the
						// swap: the same answer `cacheDir` lands at, from the same closure,
						// so the two can no longer be derived twice and diverge.
						const installer = yield* ToolInstaller;
						assert.strictEqual(
							installer.cachePath("node", "22.11.0"),
							ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch }),
						);
						assert.isFalse(
							yield* fs.exists(installer.cachePath("node", "22.11.0")),
							"cachePath must not create anything",
						);
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("cacheDir lands exactly where cachePath said it would", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const installer = yield* ToolInstaller;
						const source = join(root, "staged");
						yield* fs.makeDirectory(source, { recursive: true });
						yield* fs.writeFileString(join(source, "tool.txt"), "x");
						assert.strictEqual(
							yield* installer.cacheDir(source, "node", "1.2.3"),
							installer.cachePath("node", "1.2.3"),
						);
					}),
				),
			);
		});
	});

	describe("find", () => {
		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("reports a cached tool", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const expected = ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch });
						yield* fs.makeDirectory(expected, { recursive: true });
						assertSome(yield* (yield* ToolInstaller).find("node", "22.11.0"), expected);
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("reports nothing for a tool that is not there", () =>
				TestRoot.use(() =>
					Effect.gen(function* () {
						assertNone(yield* (yield* ToolInstaller).find("node", "0.0.1"));
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("reports nothing when the cache path is a file rather than a directory", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						// A stray file where a tool directory belongs is corruption, and
						// answering "found" for it hands the caller a path it cannot use.
						const expected = ToolInstaller.cachePath({ root, tool: "node", version: "1.0.0", arch: process.arch });
						yield* fs.makeDirectory(join(expected, ".."), { recursive: true });
						yield* fs.writeFileString(expected, "not a directory");
						assertNone(yield* (yield* ToolInstaller).find("node", "1.0.0"));
					}),
				),
			);
		});
	});

	describe("caching, and the stage-then-swap invariant", () => {
		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("installs a directory at the cache path", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const source = join(root, "src");
						yield* fs.makeDirectory(source, { recursive: true });
						yield* fs.writeFileString(join(source, "bin"), "#!/bin/sh\n");

						const installer = yield* ToolInstaller;
						const cached = yield* installer.cacheDir(source, "node", "22.11.0");
						assert.strictEqual(
							cached,
							ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch }),
						);
						assert.strictEqual(yield* fs.readFileString(join(cached, "bin")), "#!/bin/sh\n");
						assertSome(yield* installer.find("node", "22.11.0"), cached);
						// The contract: `cacheDir` CONSUMES its source. On one filesystem the
						// tree is renamed into the cache, so nothing is left at the source path.
						assert.isFalse(yield* fs.exists(source), "cacheDir must consume its source");
					}),
				),
			);
		});

		{
			let refused = 0;
			it.layer(
				testLayer({
					make: (root, path) => {
						const { join } = path;
						return liveWithFileSystem(
							root,
							(fs) => ({
								...fs,
								// A cross-device rename: Node reports EXDEV, which the platform
								// maps to an `Unknown` SystemError with the errno as its cause.
								rename: (from, to) =>
									from === join(root, "src")
										? Effect.sync(() => {
												refused += 1;
											}).pipe(Effect.flatMap(() => Effect.fail(exdev(from, to))))
										: fs.rename(from, to),
							}),
							alwaysFails,
						);
					},
				}),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("falls back to a copy when the source is on another filesystem, and still consumes it", () =>
					TestRoot.use((root) =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const { join } = yield* Path.Path;
							const source = join(root, "src");
							yield* fs.makeDirectory(join(source, "nested"), { recursive: true });
							yield* fs.writeFileString(join(source, "bin"), "#!/bin/sh\n");
							yield* fs.writeFileString(join(source, "nested", "lib.js"), "module.exports = 1;\n");

							const installer = yield* ToolInstaller;
							const cached = yield* installer.cacheDir(source, "node", "22.11.0");
							assert.strictEqual(
								refused,
								1,
								"exactly the source rename is refused; the swap into the cache stays real",
							);
							assert.strictEqual(yield* fs.readFileString(join(cached, "bin")), "#!/bin/sh\n");
							assert.strictEqual(yield* fs.readFileString(join(cached, "nested", "lib.js")), "module.exports = 1;\n");
							assertSome(yield* installer.find("node", "22.11.0"), cached);
							assert.isFalse(yield* fs.exists(source), "the copy path must consume the source too");
						}),
					),
				);
			});
		}

		{
			it.layer(
				testLayer({
					make: (root, path) => {
						const { join } = path;
						return liveWithFileSystem(
							root,
							(fs) => ({
								...fs,
								rename: (from, to) =>
									from === join(root, "src")
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
						);
					},
				}),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("does not fall back to a copy for a rename failure that is not EXDEV", () =>
					TestRoot.use((root) =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const { join } = yield* Path.Path;
							const source = join(root, "src");
							yield* fs.makeDirectory(source, { recursive: true });
							yield* fs.writeFileString(join(source, "bin"), "#!/bin/sh\n");

							const installer = yield* ToolInstaller;
							const error = yield* Effect.flip(installer.cacheDir(source, "node", "22.11.0"));
							assert.instanceOf(error, ToolInstallerError);
							assert.strictEqual(error.reason, "cacheFailed");
							// A copy fallback here would mask a real failure (a permission
							// problem, say) as a slow success — and would have consumed the source.
							assert.isTrue(
								yield* fs.exists(join(source, "bin")),
								"a non-EXDEV failure must leave the source untouched",
							);
							assertNone(yield* installer.find("node", "22.11.0"));
						}),
					),
				);
			});
		}

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("leaves NOTHING at the cache path when the install fails", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const installer = yield* ToolInstaller;
						// THE invariant. An implementation that creates the destination and
						// then copies into it leaves an empty directory behind here — and
						// `find` reports an empty directory as a hit, so every later run
						// uses a tool that is not there and never re-downloads it.
						const error = yield* Effect.flip(installer.cacheDir(join(root, "does-not-exist"), "node", "22.11.0"));
						assert.instanceOf(error, ToolInstallerError);
						assert.strictEqual(error.reason, "cacheFailed");

						const destination = ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch });
						assert.isFalse(yield* fs.exists(destination), "a failed install must not leave a partial tool behind");
						assertNone(yield* installer.find("node", "22.11.0"));
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("leaves no staging directory behind after a failure", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const installer = yield* ToolInstaller;
						yield* Effect.flip(installer.cacheDir(join(root, "does-not-exist"), "node", "22.11.0"));
						const leftovers = (yield* fs.readDirectory(root)).filter((entry) => entry.startsWith(".staging-"));
						assert.deepStrictEqual(leftovers, [], "the staging directory must be cleaned up on the failure path");
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("replaces an existing install rather than merging into it", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const installer = yield* ToolInstaller;
						const first = join(root, "first");
						yield* fs.makeDirectory(first, { recursive: true });
						yield* fs.writeFileString(join(first, "stale.txt"), "old");
						yield* installer.cacheDir(first, "node", "22.11.0");

						const second = join(root, "second");
						yield* fs.makeDirectory(second, { recursive: true });
						yield* fs.writeFileString(join(second, "fresh.txt"), "new");
						const cached = yield* installer.cacheDir(second, "node", "22.11.0");

						// A merge would leave `stale.txt` from the previous version's
						// layout sitting in the new install.
						assert.isTrue(yield* fs.exists(join(cached, "fresh.txt")));
						assert.isFalse(yield* fs.exists(join(cached, "stale.txt")), "a re-install must replace, not merge");
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("installs a single file under the name it is given", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const source = join(root, "downloaded-binary");
						yield* fs.writeFileString(source, "binary");
						const cached = yield* (yield* ToolInstaller).cacheFile(source, "mytool", "mytool", "1.0.0");
						assert.strictEqual(yield* fs.readFileString(join(cached, "mytool")), "binary");
					}),
				),
			);
		});
	});

	describe("extraction", () => {
		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("extracts a real gzipped tarball", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const archive = yield* makeTarball(root, "hello");
						const extracted = yield* (yield* ToolInstaller).extractTar(archive);
						assert.strictEqual(yield* fs.readFileString(join(extracted, "tool.txt")), "hello");
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("extracts into a destination it is given, creating it", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const archive = yield* makeTarball(root, "hello");
						const destination = join(root, "nested", "target");
						const extracted = yield* (yield* ToolInstaller).extractTar(archive, { destination });
						assert.strictEqual(extracted, destination);
						assert.strictEqual(yield* fs.readFileString(join(destination, "tool.txt")), "hello");
					}),
				),
			);
		});

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("fails typed, carrying tar's own complaint, on a corrupt archive", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const archive = join(root, "not-really.tar.gz");
						yield* fs.writeFileString(archive, "this is not a tarball");
						const error = yield* Effect.flip((yield* ToolInstaller).extractTar(archive));
						assert.strictEqual(error.reason, "extractFailed");
						// The exit code alone says only "it failed"; stderr is the difference
						// between a corrupt archive and tar not being installed.
						assert.isAbove((error.stderr ?? "").length, 0, "tar's stderr must survive");
					}),
				),
			);
		});
	});

	describe("extraction runs exactly once", () => {
		{
			const root = "/tool-cache";
			const tarSpawner = countingSpawner({ exitCode: 0, output: "" });
			const zipSpawner = countingSpawner({ exitCode: 0, output: "" });
			const tarLayer = Layer.effect(TarInstaller, ToolInstaller).pipe(
				Layer.provide(liveWithSpawner(root, tarSpawner.layer)),
			);
			// Build the second installer independently so layer memoization cannot reuse the tar spawner.
			const zipLayer = Layer.effect(ZipInstaller, ToolInstaller).pipe(
				Layer.provide(Layer.fresh(liveWithSpawner(root, zipSpawner.layer))),
			);
			it.layer(Layer.mergeAll(tarLayer, zipLayer, Path.layer), { timeout: "30 seconds" })((it) => {
				it.effect("a successful extraction spawns its command EXACTLY once", () =>
					Effect.gen(function* () {
						const { join } = yield* Path.Path;
						yield* (yield* TarInstaller).extractTar(join(root, "a.tgz"));
						assert.strictEqual(tarSpawner.count(), 1, "extractTar must spawn exactly once");
						yield* (yield* ZipInstaller).extractZip(join(root, "a.zip"));
						assert.strictEqual(zipSpawner.count(), 1, "extractZip must spawn exactly once");
					}),
				);
			});
		}

		{
			const root = "/tool-cache";
			const spawner = countingSpawner({ exitCode: 1, output: "the actual complaint" });
			it.layer(Layer.merge(liveWithSpawner(root, spawner.layer), Path.layer), { timeout: "30 seconds" })((it) => {
				it.effect("a failed extraction spawns once and reports THAT run's complaint", () =>
					Effect.gen(function* () {
						const { join } = yield* Path.Path;
						const error = yield* Effect.flip((yield* ToolInstaller).extractTar(join(root, "a.tgz")));
						assert.instanceOf(error, ToolInstallerError);
						assert.strictEqual(error.reason, "extractFailed");
						assert.strictEqual(error.stderr, "the actual complaint");
						assert.strictEqual(spawner.count(), 1, "the failure must come from the one and only run");
					}),
				);
			});
		}

		it.layer(testLayer(), { timeout: "30 seconds" })((it) => {
			it.effect("extracting the same zip twice into the same destination succeeds", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						// The idempotency claim: extraction into a pre-populated
						// destination must overwrite, not refuse — the POSIX half runs
						// here (`unzip -o`); the Windows half is the three-argument
						// ExtractToDirectory overwrite overload in the same code path.
						const archive = yield* makeZip(root, "zipped");
						const destination = join(root, "dest");
						const installer = yield* ToolInstaller;
						yield* installer.extractZip(archive, { destination });
						yield* installer.extractZip(archive, { destination });
						assert.strictEqual(yield* fs.readFileString(join(destination, "tool.txt")), "zipped");
					}),
				),
			);
		});
	});

	describe("download", () => {
		it.layer(
			testLayer({
				fetch: Object.assign(() => Promise.resolve(new Response("archive-bytes", { status: 200 })), {
					preconnect: () => {},
				}),
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("streams the body to a file", () =>
				TestRoot.use(() =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const file = yield* (yield* ToolInstaller).download("https://example.test/tool.tar.gz");
						assert.strictEqual(yield* fs.readFileString(file), "archive-bytes");
					}),
				),
			);
		});

		it.layer(
			testLayer({
				fetch: Object.assign(() => Promise.resolve(new Response("gone", { status: 404 })), { preconnect: () => {} }),
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("fails typed on a 404 and does NOT retry it", () =>
				TestRoot.use(() =>
					Effect.gen(function* () {
						// A 404 will not fix itself; retrying it three times only makes a
						// broken url take longer to fail.
						const error = yield* Effect.flip((yield* ToolInstaller).download("https://example.test/gone"));
						assert.strictEqual(error.reason, "downloadFailed");
						assert.strictEqual(error.status, 404);
						assert.isFalse(error.retryable);
					}),
				),
			);
		});

		it.effect("classifies what is worth retrying", () => {
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

		{
			const stalled: typeof globalThis.fetch = Object.assign(() => Promise.withResolvers<Response>().promise, {
				preconnect: () => {},
			});
			// This block owns its TestClock; no other test shares the clock advanced here.
			it.layer(testLayer({ fetch: stalled }), { timeout: "30 seconds" })((it) => {
				it.effect("a connection that stops moving times out typed, statusless, and retryable", () =>
					Effect.gen(function* () {
						// A never-settling connection exhausts the five-minute budget and both retries.
						const exit = yield* settle(
							Effect.flip((yield* ToolInstaller).download("https://example.test/stall")),
							TestClock.adjust("6 minutes"),
						);
						const error = yield* exit;
						assertExitSuccess(exit, error);
						assert.instanceOf(error, ToolInstallerError);
						assert.strictEqual(error.reason, "downloadFailed");
						assert.isUndefined(error.status, "a timeout has no status");
						assert.isTrue(error.retryable, "a dead connection is a transport fault, the most retryable thing there is");
					}),
				);
			});
		}
	});

	describe("provisionFile", () => {
		const options = { tool: "biome", version: "2.3.4", url: "https://example.test/biome", binary: "biome" };
		const binaryBody = "#!/bin/sh\necho biome\n";

		it.layer(
			testLayer({
				fetch: Object.assign(() => Promise.resolve(new Response(binaryBody, { status: 200 })), {
					preconnect: () => {},
				}),
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("provisions a single binary: downloaded, executable, cached, binDir answered", () =>
				TestRoot.use((root) =>
					Effect.gen(function* () {
						const fs = yield* FileSystem.FileSystem;
						const { join } = yield* Path.Path;
						const provisioned = yield* (yield* ToolInstaller).provisionFile(options);
						assert.strictEqual(
							provisioned.directory,
							ToolInstaller.cachePath({ root, tool: "biome", version: "2.3.4", arch: process.arch }),
						);
						// For a single binary the cached directory IS the addPath target.
						assert.strictEqual(provisioned.binDir, provisioned.directory);
						const file = join(provisioned.directory, "biome");
						assert.strictEqual(yield* fs.readFileString(file), binaryBody);
						// The executable bit is the difference between a cached tool and a
						// cached file, and it must be ON THE CACHED FILE — a chmod after
						// caching would mutate a swapped-in entry, and a skipped chmod
						// ships a binary the runner cannot execute.
						assert.strictEqual((yield* fs.stat(file)).mode & 0o777, 0o755);
					}),
				),
			);
		});

		{
			const counting = countingFetch(() => new Response(binaryBody, { status: 200 }));
			it.layer(testLayer({ fetch: counting.fetch }), { timeout: "30 seconds" })((it) => {
				it.effect("short-circuits on a cache hit carrying the binary, and the hit answers binDir too", () =>
					TestRoot.use((root) =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const { join } = yield* Path.Path;
							const directory = ToolInstaller.cachePath({ root, tool: "biome", version: "2.3.4", arch: process.arch });
							yield* fs.makeDirectory(directory, { recursive: true });
							yield* fs.writeFileString(join(directory, "biome"), "already cached");
							const provisioned = yield* (yield* ToolInstaller).provisionFile(options);
							assert.strictEqual(provisioned.directory, directory);
							assert.strictEqual(provisioned.binDir, directory);
							assert.strictEqual(yield* fs.readFileString(join(directory, "biome")), "already cached");
							assert.strictEqual(counting.count(), 0, "a hit must not download");
						}),
					),
				);
			});
		}

		{
			// find's own TSDoc warning made real: the tool cache is shared, and a
			// foreign entry guarantees only the location contract. An entry without
			// the named binary cannot run the tool, so it is treated as a miss —
			// answering it as a hit is the shipped-bug shape the warning records.
			const counting = countingFetch(() => new Response(binaryBody, { status: 200 }));
			it.layer(testLayer({ fetch: counting.fetch }), { timeout: "30 seconds" })((it) => {
				it.effect("reinstalls over a foreign hit that is MISSING the binary", () =>
					TestRoot.use((root) =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const { join } = yield* Path.Path;
							const directory = ToolInstaller.cachePath({ root, tool: "biome", version: "2.3.4", arch: process.arch });
							yield* fs.makeDirectory(directory, { recursive: true });
							yield* fs.writeFileString(join(directory, "other-layout.txt"), "a different writer's idea of biome");
							const provisioned = yield* (yield* ToolInstaller).provisionFile(options);
							assert.strictEqual(counting.count(), 1, "a hit without the binary must reinstall");
							assert.strictEqual(yield* fs.readFileString(join(provisioned.directory, "biome")), binaryBody);
						}),
					),
				);
			});
		}

		{
			const chmods: Array<string> = [];

			const spying = (fs: FileSystem.FileSystem): FileSystem.FileSystem => ({
				...fs,
				chmod: (file, mode) => {
					chmods.push(String(file));
					return fs.chmod(file, mode);
				},
			});
			it.layer(
				testLayer({
					make: (root) =>
						liveWithFileSystem(
							root,
							spying,
							Object.assign(() => Promise.resolve(new Response(binaryBody, { status: 200 })), { preconnect: () => {} }),
							{
								RUNNER_OS: "Windows",
							},
						),
				}),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("skips chmod entirely when RUNNER_OS is Windows", () =>
					TestRoot.use((_root) =>
						Effect.gen(function* () {
							const provisioned = yield* Effect.flatMap(ToolInstaller, (installer) => installer.provisionFile(options));
							assert.deepStrictEqual(chmods, [], "no chmod may be attempted on Windows — the bit does not exist there");
							assert.strictEqual(provisioned.binDir, provisioned.directory);
						}),
					),
				);
			});
		}

		{
			const chmods: Array<string> = [];

			const spying = (fs: FileSystem.FileSystem): FileSystem.FileSystem => ({
				...fs,
				chmod: (file, mode) => {
					chmods.push(String(file));
					return fs.chmod(file, mode);
				},
			});
			it.layer(
				testLayer({
					make: (root) =>
						liveWithFileSystem(
							root,
							spying,
							Object.assign(() => Promise.resolve(new Response(binaryBody, { status: 200 })), { preconnect: () => {} }),
						),
				}),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("the control: off Windows the same spy sees exactly one chmod, on the downloaded file", () =>
					TestRoot.use((_root) =>
						Effect.gen(function* () {
							yield* Effect.flatMap(ToolInstaller, (installer) => installer.provisionFile(options));
							assert.lengthOf(chmods, 1, "the Windows test's spy must be able to see a chmod at all");
							assert.isTrue(chmods[0]?.endsWith("download"), "the chmod lands on the downloaded file, before caching");
						}),
					),
				);
			});
		}

		{
			const failing = (fs: FileSystem.FileSystem): FileSystem.FileSystem => ({
				...fs,
				chmod: () => Effect.fail(badArgument({ module: "FileSystem", method: "chmod", description: "refused" })),
			});
			it.layer(
				testLayer({
					make: (root) =>
						liveWithFileSystem(
							root,
							failing,
							Object.assign(() => Promise.resolve(new Response(binaryBody, { status: 200 })), { preconnect: () => {} }),
						),
				}),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("a chmod failure is cacheFailed naming the downloaded file, and nothing is cached", () =>
					TestRoot.use((_root) =>
						Effect.gen(function* () {
							const error = yield* Effect.flip(
								Effect.flatMap(ToolInstaller, (installer) => installer.provisionFile(options)),
							);
							assert.instanceOf(error, ToolInstallerError);
							assert.strictEqual(error.reason, "cacheFailed");
							assert.isTrue(
								error.subject?.endsWith("download"),
								"the subject is the file that could not be made executable",
							);
							// The failure happened BEFORE caching, so the cache must not contain
							// a non-executable binary for every later run to find.
							const found = yield* Effect.flatMap(ToolInstaller, (installer) => installer.find("biome", "2.3.4"));
							assertNone(found);
						}),
					),
				);
			});
		}
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies rather than reporting a tool that is not there", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(ToolInstaller, (installer) => installer.find("node", "1")));
				assertExitFailure(
					exit,
					Cause.die(
						UnstubbedMemberError.make({
							message: "ToolInstaller.makeTest: find() was called but not stubbed — pass a `find` override.",
						}),
					),
				);
			}).pipe(Effect.provideService(ToolInstaller, ToolInstaller.makeTest())),
		);

		it.effect("an override wins", () =>
			Effect.gen(function* () {
				const found = yield* Effect.flatMap(ToolInstaller, (installer) => installer.find("node", "1"));
				assertSome(found, "/cached");
			}).pipe(
				Effect.provideService(ToolInstaller, ToolInstaller.makeTest({ find: () => Effect.succeedSome("/cached") })),
			),
		);

		it.effect(
			"cachePath is the one member with a default: the static layout over RUNNER_TOOL_CACHE or the off-runner root",
			() =>
				Effect.gen(function* () {
					// Pure and total, so dying would only punish every test that reads it
					// through PackageManagerInstaller. The default mirrors `make`'s own
					// resolution (`internal/runner.ts`), read from the ambient environment
					// because a double has no ActionEnvironment to ask.
					const root = yield* Config.String("RUNNER_TOOL_CACHE").pipe(Config.withDefault("/tmp/runner-tool-cache"));
					assert.strictEqual(
						ToolInstaller.makeTest().cachePath("node", "22.11.0"),
						ToolInstaller.cachePath({ root, tool: "node", version: "22.11.0", arch: process.arch }),
					);
					assert.strictEqual(
						ToolInstaller.makeTest({ cachePath: () => "/elsewhere" }).cachePath("node", "1"),
						"/elsewhere",
					);
				}),
		);
	});
});
