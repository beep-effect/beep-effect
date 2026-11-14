/**
 * In-memory child processes and file facts for cache host tests that must not
 * reach systemd, Turbo, `/proc` or the network.
 *
 * @packageDocumentation
 */
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";

/**
 * Scripted outcome of one fake child; `running` is read each time the parent asks, and
 * `chunks`, when given, replaces `stdout` with one pull per byte chunk.
 */
export interface FakeChild {
  readonly chunks?: ReadonlyArray<Uint8Array>;
  readonly exitCode?: number;
  readonly running?: Effect.Effect<boolean>;
  readonly stdout?: string;
}

const bytes = (text: string) => (Str.isEmpty(text) ? Stream.empty : Stream.make(new TextEncoder().encode(text)));

/**
 * A child with fixed output that has exited unless `running` says otherwise.
 */
const fakeChildHandle = ({ stdout = "", chunks, exitCode = 0, running = Effect.succeed(false) }: FakeChild) =>
  ChildProcessSpawner.makeHandle({
    all: bytes(stdout),
    stdout: P.isUndefined(chunks) ? bytes(stdout) : Stream.fromIterable(chunks, { chunkSize: 1 }),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: running,
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(4242),
    unref: Effect.succeed(Effect.void),
  });

/**
 * Answers each standard command of a fake child process run.
 */
export type FakeScript = (
  command: ChildProcess.StandardCommand
) => Effect.Effect<FakeChild, PlatformError.PlatformError>;

/**
 * A spawner whose every standard command is answered by `script`; piped commands die.
 *
 * **Details**
 *
 * Use `ScriptedSpawner` from `@beep/commands/ScriptedSpawner` wherever its
 * `ScriptCompletion` covers the child. This double exists only for the three
 * shapes it lacks: a filesystem effect inside the spawn (the Turbo run writes
 * its summaries), a handle whose `isRunning` the test flips (the owned
 * adapter unit), and binary stdout split into several pulls (synthetic tar
 * streams carry bytes that are not UTF-8).
 */
export const fakeSpawner = (script: FakeScript) =>
  // biome-ignore lint/plugin/no-unrecorded-spawner-double: Own double (D-14), reason above
  ChildProcessSpawner.make((command) =>
    ChildProcess.isStandardCommand(command)
      ? Effect.map(script(command), fakeChildHandle)
      : Effect.die("Unexpected piped command")
  );

/**
 * {@link fakeSpawner} as a layer, for composing with other fake services.
 */
export const fakeSpawnerLayer = (script: FakeScript) =>
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, fakeSpawner(script));

/**
 * Stat facts of an empty regular file with the given mode, modified one second after the epoch.
 */
export const fakeFileInfo = (mode: number): FileSystem.File.Info => ({
  type: "File",
  mtime: O.some(DateTime.makeUnsafe(1_000).pipe(DateTime.toDateUtc)),
  atime: O.none(),
  birthtime: O.none(),
  dev: BigInt(0),
  ino: O.none(),
  mode,
  nlink: O.none(),
  uid: O.none(),
  gid: O.none(),
  rdev: O.none(),
  size: ByteSize.bytes(0),
  blksize: O.none(),
  blocks: O.none(),
});
