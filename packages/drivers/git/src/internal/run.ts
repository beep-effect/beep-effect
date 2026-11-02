/**
 * Scoped, concurrent, byte-bounded collection of one child process's output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GitId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as PlatformError from "effect/PlatformError";
import type * as ChildProcess from "effect/process/ChildProcess";
import type * as Scope from "effect/Scope";

const $I = $GitId.create("internal/run");

/** 16 MiB: the ceiling {@link runCollected} applies when a caller names none. */
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/**
 * Raised when one collected stream grows past its byte ceiling; the child
 * has already been killed by the time it surfaces. The classifier maps it
 * to `GitCommandError` of kind `"truncated"`.
 *
 * **Example** (Name the offending stream)
 *
 * ```ts import.meta.vitest name="Name the offending stream"
 * import { OutputTooLarge } from "@beep/git/internal/run";
 *
 * const error = OutputTooLarge.make({ stream: "stdout", limit: 1024 });
 * `${error.stream} > ${error.limit}` // => "stdout > 1024"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OutputTooLarge extends S.TaggedError<OutputTooLarge, { readonly brand: unique symbol }>(
  $I`OutputTooLarge`
)(
  "OutputTooLarge",
  {
    stream: S.Literals(["stdout", "stderr"]).pipe(
      $I.annoteKey("OutputTooLarge.stream", { description: "Which of the two collected streams outgrew the limit." })
    ),
    limit: S.Finite.pipe(
      $I.annoteKey("OutputTooLarge.limit", { description: "The per-stream byte ceiling that was exceeded." })
    ),
  },
  $I.annoteError<OutputTooLarge>("OutputTooLarge", {
    description: "A collected child-process stream grew past its byte ceiling.",
  })
) {}

/**
 * Collects one byte stream into a string, failing the moment more than
 * `limit` bytes have arrived.
 *
 * The budget is enforced DURING accumulation on raw bytes: checking a
 * finished string's length would mean the memory had already been spent,
 * which is the failure the ceiling exists to prevent.
 */
const collectBounded = (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  name: OutputTooLarge["stream"],
  limit: number
): Effect.Effect<string, PlatformError.PlatformError | OutputTooLarge> =>
  stream.pipe(
    Stream.mapAccumEffect(
      () => 0,
      (seen, chunk) => {
        const total = seen + chunk.length;
        return total > limit
          ? Effect.fail(OutputTooLarge.make({ stream: name, limit }))
          : Effect.succeed<readonly [number, ReadonlyArray<Uint8Array>]>([total, [chunk]]);
      }
    ),
    Stream.decodeText,
    Stream.mkString
  );

/**
 * The stdout, stderr, and exit code of one completed run of a `Command`,
 * collected separately (never interleaved).
 *
 * **Example** (Make a collected run)
 *
 * ```ts
 * import { Collected } from "@beep/git/internal/run";
 *
 * const collected = Collected.make({ exitCode: 0, stderr: "", stdout: "ok\n" });
 * console.log(collected.exitCode); // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Collected extends S.Opaque<Collected, { readonly brand: unique symbol }>()(
  S.Struct({
    exitCode: S.Finite.pipe($I.annoteKey("Collected.exitCode", { description: "The run's process exit code." })),
    stderr: S.String.pipe($I.annoteKey("Collected.stderr", { description: "The run's decoded stderr text." })),
    stdout: S.String.pipe($I.annoteKey("Collected.stdout", { description: "The run's decoded stdout text." })),
  }).pipe(
    $I.annoteSchema("Collected", {
      description: "The stdout, stderr, and exit code of one completed run, collected separately.",
    })
  )
) {}

/**
 * Spawns `command` and collects its stdout, stderr, and exit code as a single
 * triple, each stream bounded to `maxOutputBytes` (default 16 MiB).
 *
 * **Details**
 *
 * The ceiling is per stream and enforced on raw bytes as they arrive. The
 * first stream to exceed it kills the child (so the other stream stops
 * growing too) and fails the run with {@link OutputTooLarge}; nothing
 * partial is returned.
 *
 * **Gotchas**
 *
 * Collection is concurrent (`{ concurrency: "unbounded" }`) — this is
 * load-bearing, not a style choice. Reading stdout, stderr, and exit code
 * sequentially can deadlock the moment either pipe's OS buffer fills:
 * upstream `git` blocks writing to a full pipe while nothing is draining it,
 * and the sequential reader that would drain it is still waiting on the
 * *other* stream to finish first. The bound does not change that: both
 * streams keep draining concurrently right up to the byte that breaks it.
 *
 * **Example** (Construct a command-output collection effect)
 *
 * ```ts
 * import { runCollected } from "@beep/git/internal/run"
 * import * as Effect from "effect/Effect"
 * import * as ChildProcess from "effect/process/ChildProcess";
 * const program = runCollected(ChildProcess.make("git", ["--version"]), 64 * 1024)
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const runCollected = Effect.fnUntraced(function* (
  command: ChildProcess.Command,
  maxOutputBytes: number = DEFAULT_MAX_OUTPUT_BYTES
): Effect.fn.Return<
  Collected,
  PlatformError.PlatformError | OutputTooLarge,
  ChildProcessSpawner.ChildProcessSpawner | Scope.Scope
> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(command);
  // { concurrency: "unbounded" } is load-bearing: collecting these three
  // sequentially would deadlock the moment a real OS pipe buffer fills
  // (upstream git blocks writing while nothing drains it, and the
  // sequential reader that would drain it is still waiting on the other
  // stream). No mock test can regress this — it needs a real pipe. The
  // regression guard is the dedicated "runCollected drains stdout and
  // stderr concurrently under simultaneous backpressure on both pipes"
  // test in test/integration/Git.int.test.ts (G5) — it puts pressure
  // on BOTH pipes at once, which is what actually discriminates this
  // option; a large-output-on-one-stream case does not.
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      collectBounded(handle.stdout, "stdout", maxOutputBytes),
      collectBounded(handle.stderr, "stderr", maxOutputBytes),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  ).pipe(
    // The first stream over its ceiling fails the whole collection (the
    // other two are interrupted) and the child is killed BEFORE the failure
    // surfaces, so no caller sees a typed failure with a still-writing child.
    // The kill is best-effort: the scope's own release signals the process
    // group as well, and a child that already exited has nothing to kill.
    Effect.catchTag("OutputTooLarge", (error) => Effect.andThen(Effect.ignore(handle.kill()), Effect.fail(error)))
  );
  return Collected.make({ stdout, stderr, exitCode: Number(exitCode) });
}, Effect.scoped);

/**
 * Whether `command` can be run at all — any COMPLETED run, regardless of exit
 * code, proves the command exists. Only a `PlatformError` (spawn itself
 * failing — e.g. the executable is not found) means `command` is
 * unavailable.
 *
 * **Example** (Construct an executable availability check)
 *
 * ```ts
 * import { available } from "@beep/git/internal/run"
 * import * as Effect from "effect/Effect"
 * import * as ChildProcess from "effect/process/ChildProcess";
 * const program = available(ChildProcess.make("git", ["--version"]))
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const available = (
  command: ChildProcess.Command
): Effect.Effect<boolean, never, ChildProcessSpawner.ChildProcessSpawner> =>
  runCollected(command).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
