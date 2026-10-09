import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as R from "effect/Record";

/**
 * A hermetic temp directory minted by {@link CliTest.sandbox}, removed when its
 * scope closes.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface Sandbox {
	/** The temp directory itself; the default working directory of {@link CliTest.run}. */
	readonly root: string;
	/** The fresh `HOME` inside `root`; the XDG base directories live under it. */
	readonly home: string;
	/**
	 * The complete child environment: `HOME`, the four `XDG_*_HOME` variables,
	 * the injected `PATH` and `NO_COLOR=1`. Nothing is inherited from the host.
	 */
	readonly env: Readonly<Record<string, string>>;
}

/**
 * How {@link CliTest.run} spawns a bin.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface RunOptions {
	/** The sandbox whose environment and root the child runs in. */
	readonly sandbox: Sandbox;
	/** The node binary — pass `process.execPath` from the test file, never a PATH lookup. */
	readonly execPath: string;
	/** The child's working directory. Defaults to the sandbox `root`. */
	readonly cwd?: string | undefined;
	/**
	 * Extra environment variables, merged over the sandbox environment — the
	 * way to override `PATH` for one run.
	 */
	readonly env?: Readonly<Record<string, string>> | undefined;
	/**
	 * Text written to the child's stdin, which is then closed. Omitted or `""`,
	 * the child gets an already-ended empty input, never an open pipe.
	 */
	readonly stdin?: string | undefined;
}

/**
 * What a spawned bin did, as data: a non-zero exit is a result, not a failure.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface RunResult {
	/** The child's exit code. */
	readonly exitCode: number;
	/** Everything the child wrote to stdout, decoded as UTF-8. */
	readonly stdout: string;
	/** Everything the child wrote to stderr, decoded as UTF-8. */
	readonly stderr: string;
}

const text = <E, R>(stream: Stream.Stream<Uint8Array, E, R>): Effect.Effect<string, E, R> =>
	stream.pipe(Stream.decodeText, Stream.mkString);

/**
 * Spawn a built CLI bin hermetically and read its exit code and streams as data.
 *
 * **Example** (Test a built CLI version command in a sandbox)
 *
 * ```ts
 * import { CliTest } from "@beep/scratchpad/effected/cli/CliTest"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const sandbox = yield* CliTest.sandbox({ path: "/usr/bin" })
 *   const result = yield* CliTest.run("dist/bin.js", ["--version"], { sandbox, execPath: "/usr/bin/node" })
 *   return result.exitCode === 0
 * }).pipe(Effect.scoped)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CliTest {
	private constructor() {}

	/**
	 * A scoped temp directory with a fresh `HOME` and XDG tree, `NO_COLOR=1`,
	 * and the `PATH` you pass — the host environment is never inherited.
	 *
	 * **Gotchas**
	 *
	 * Each call mints a fresh temp directory; bind the result to a `const`
	 * within one test rather than calling this more than once per assertion.
	 *
	 * **Example** (Construct a hermetic sandbox)
	 *
	 * ```ts
	 * import { CliTest } from "@beep/scratchpad/effected/cli/CliTest"
	 * import * as Effect from "effect/Effect"
	 *
	 * const program = CliTest.sandbox({ path: "/usr/bin" })
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly sandbox = Effect.fn("sandbox")(function* (options: {
		/**
		 * The `PATH` the child sees, passed explicitly because nothing else is
		 * inherited — `process.env.PATH` when the bin shells out to host tools,
		 * a narrower list to prove it does not.
		 */
		readonly path: string;
	}): Effect.fn.Return<Sandbox, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-cli-test-" });
		const home = path.join(root, "home");
		const xdg = {
			XDG_CONFIG_HOME: path.join(home, ".config"),
			XDG_DATA_HOME: path.join(home, ".local", "share"),
			XDG_STATE_HOME: path.join(home, ".local", "state"),
			XDG_CACHE_HOME: path.join(home, ".cache"),
		};
		for (const dir of R.values(xdg)) yield* fs.makeDirectory(dir, { recursive: true });
		return { root, home, env: { HOME: home, ...xdg, PATH: options.path, NO_COLOR: "1" } };
	});

	/**
	 * Run `execPath bin ...args`; a non-zero exit is returned, never failed.
	 *
	 * **Details**
	 *
	 * `stdin` is never left as an inherited open pipe: when omitted or `""`
	 * the child gets an already-ended empty input (`Stream.empty`), so a
	 * stdin-reading bin exits instead of hanging on `effect/process`'s
	 * default `"pipe"` stdio, which stays open until something writes to and
	 * ends it.
	 *
	 * **Example** (Construct a version command with closed stdin)
	 *
	 * ```ts
	 * import { CliTest } from "@beep/scratchpad/effected/cli/CliTest"
	 * import * as Effect from "effect/Effect"
	 *
	 * const program = CliTest.run("dist/bin.js", ["--version"], {
	 *   sandbox: { root: "/tmp/cli-test", home: "/tmp/cli-test/home", env: { PATH: "/usr/bin", NO_COLOR: "1" } },
	 *   execPath: "/usr/bin/node",
	 * })
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category testing
	 * @since 0.0.0
	 */
	static readonly run = (
		bin: string,
		args: ReadonlyArray<string>,
		options: RunOptions,
	): Effect.Effect<RunResult, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> =>
		Effect.scoped(
			Effect.gen(function* () {
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const command = ChildProcess.make(options.execPath, [bin, ...args], {
					cwd: options.cwd ?? options.sandbox.root,
					env: { ...options.sandbox.env, ...options.env },
					stdin:
						options.stdin === undefined || options.stdin === ""
							? Stream.empty
							: Stream.make(new TextEncoder().encode(options.stdin)),
				});
				const handle = yield* spawner.spawn(command);
				// Read both streams and the exit concurrently: sequential reads
				// deadlock once an OS pipe buffer fills.
				const [stdout, stderr, exitCode] = yield* Effect.all(
					[text(handle.stdout), text(handle.stderr), handle.exitCode],
					{ concurrency: "unbounded" },
				);
				return { exitCode: Number(exitCode), stdout, stderr };
			}),
		);
}
