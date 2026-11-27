/**
 * Hermetic subprocess tests for a built bin: a sandbox with its own home and XDG directories, and a run that
 * returns the exit code and both streams as data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";

const $I = $CliKitId.create("CliTest");

/**
 * A hermetic temp directory minted by {@link CliTest.sandbox}, removed when its
 * scope closes.
 *
 * **Example** (Validate a plain sandbox)
 *
 * ```ts
 * import { Sandbox } from "@beep/cli-kit/CliTest"
 * import * as S from "effect/Schema"
 * console.log(S.is(Sandbox)({ root: "/tmp/cli", home: "/tmp/cli/home", env: {} })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Sandbox extends S.Opaque<Sandbox, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The temp directory itself; the default working directory of {@link CliTest.run}. */
    root: S.String.pipe($I.annoteKey("Sandbox.root", { description: "The scoped temporary working directory." })),
    /** The fresh `HOME` inside `root`; the XDG base directories live under it. */
    home: S.String.pipe($I.annoteKey("Sandbox.home", { description: "The fresh child HOME inside the sandbox root." })),
    /**
     * The complete child environment: `HOME`, the four `XDG_*_HOME` variables,
     * the injected `PATH` and `NO_COLOR=1`. Nothing is inherited from the host.
     */
    env: S.Record(S.String, S.String).pipe(
      $I.annoteKey("Sandbox.env", { description: "The complete child environment, without inherited host variables." })
    ),
  }).pipe($I.annoteSchema("Sandbox", { description: "A hermetic scoped directory and its child environment." }))
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { Sandbox } from "@beep/cli-kit/CliTest"
 * import * as S from "effect/Schema"
 *
 * const plain: Sandbox.Encoded = { root: "/tmp/sandbox", home: "/tmp/sandbox/home", env: { HOME: "/tmp/sandbox/home" } }
 * console.log(S.is(Sandbox)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Sandbox {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Sandbox.Encoded;
}

/**
 * How {@link CliTest.run} spawns a bin.
 *
 * **Example** (Validate spawn options with omitted overrides)
 *
 * ```ts
 * import { RunOptions } from "@beep/cli-kit/CliTest"
 * import * as S from "effect/Schema"
 * console.log(S.is(RunOptions)({ sandbox: { root: "/tmp/cli", home: "/tmp/cli/home", env: {} }, execPath: "/usr/bin/node" })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RunOptions extends S.Opaque<RunOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The sandbox whose environment and root the child runs in. */
    sandbox: Sandbox.pipe(
      $I.annoteKey("RunOptions.sandbox", { description: "The sandbox whose environment and root the child runs in." })
    ),
    /** The node binary — pass `process.execPath` from the test file, never a PATH lookup. */
    execPath: S.String.pipe(
      $I.annoteKey("RunOptions.execPath", { description: "The explicitly selected runtime executable." })
    ),
    /** The child's working directory. Defaults to the sandbox `root`. */
    cwd: S.optionalKey(S.String).pipe(
      $I.annoteKey("RunOptions.cwd", {
        description: "An optional working-directory override; otherwise the sandbox root.",
      })
    ),
    /**
     * Extra environment variables, merged over the sandbox environment — the
     * way to override `PATH` for one run.
     */
    env: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("RunOptions.env", {
        description: "Optional environment overrides merged over the sandbox environment.",
      })
    ),
    /**
     * Text written to the child's stdin, which is then closed. Omitted or `""`,
     * the child gets an already-ended empty input, never an open pipe.
     */
    stdin: S.optionalKey(S.String).pipe(
      $I.annoteKey("RunOptions.stdin", {
        description: "Optional child input; omitted or empty means an already-ended stream.",
      })
    ),
  }).pipe($I.annoteSchema("RunOptions", { description: "Plain subprocess spawn options with optional overrides." }))
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { RunOptions } from "@beep/cli-kit/CliTest"
 *
 * const accepts = (_value: RunOptions.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RunOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RunOptions.Encoded;
}

/**
 * What a spawned bin did, as data: a non-zero exit is a result, not a failure.
 *
 * **Example** (Validate a non-zero exit as data)
 *
 * ```ts
 * import { RunResult } from "@beep/cli-kit/CliTest"
 * import * as S from "effect/Schema"
 * console.log(S.is(RunResult)({ exitCode: 3, stdout: "", stderr: "failed" })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RunResult extends S.Opaque<RunResult, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The child's exit code. */
    exitCode: S.Finite.pipe(
      $I.annoteKey("RunResult.exitCode", {
        description: "The child's finite numeric exit code, including non-zero results.",
      })
    ),
    /** Everything the child wrote to stdout, decoded as UTF-8. */
    stdout: S.String.pipe(
      $I.annoteKey("RunResult.stdout", { description: "All child standard output decoded as UTF-8." })
    ),
    /** Everything the child wrote to stderr, decoded as UTF-8. */
    stderr: S.String.pipe(
      $I.annoteKey("RunResult.stderr", { description: "All child standard error decoded as UTF-8." })
    ),
  }).pipe(
    $I.annoteSchema("RunResult", { description: "A plain subprocess exit code and its captured output streams." })
  )
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { RunResult } from "@beep/cli-kit/CliTest"
 * import * as S from "effect/Schema"
 *
 * const plain: RunResult.Encoded = { exitCode: 0, stdout: "ok\n", stderr: "" }
 * console.log(S.is(RunResult)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RunResult {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RunResult.Encoded;
}

const text = <E, R>(stream: Stream.Stream<Uint8Array, E, R>): Effect.Effect<string, E, R> =>
  stream.pipe(Stream.decodeText, Stream.mkString);

/**
 * Spawn a built CLI bin hermetically and read its exit code and streams as data.
 *
 * **Example** (Test a built CLI version command in a sandbox)
 *
 * ```ts
 * import { CliTest } from "@beep/cli-kit/CliTest"
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
export abstract class CliTest {
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
   * import { CliTest } from "@beep/cli-kit/CliTest"
   * import * as Effect from "effect/Effect"
   *
   * const program = CliTest.sandbox({ path: "/usr/bin" })
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly sandbox = Effect.fn("CliTest.sandbox")(function* (options: {
    /**
     * The `PATH` the child sees, passed explicitly because nothing else is
     * inherited — `process.env.PATH` when the bin shells out to host tools,
     * a narrower list to prove it does not.
     */
    readonly path: string;
  }): Effect.fn.Return<Sandbox.Encoded, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
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
   * ends it. Both streams and the exit are read concurrently: sequential
   * reads deadlock once an OS pipe buffer fills.
   *
   * **Example** (Construct a version command with closed stdin)
   *
   * ```ts
   * import { CliTest } from "@beep/cli-kit/CliTest"
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
  static readonly run: {
    (
      bin: string,
      args: ReadonlyArray<string>,
      options: RunOptions.Encoded
    ): Effect.Effect<RunResult.Encoded, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner>;
    (
      args: ReadonlyArray<string>,
      options: RunOptions.Encoded
    ): (
      bin: string
    ) => Effect.Effect<RunResult.Encoded, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner>;
  } = dual(
    3,
    (
      bin: string,
      args: ReadonlyArray<string>,
      options: RunOptions.Encoded
    ): Effect.Effect<RunResult.Encoded, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> =>
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
          const [stdout, stderr, exitCode] = yield* Effect.all(
            [text(handle.stdout), text(handle.stderr), handle.exitCode],
            { concurrency: "unbounded" }
          );
          return { exitCode: Number(exitCode), stdout, stderr };
        })
      )
  );
}
