/**
 * A scripted child process that may also act on the filesystem the test
 * provides — a fake `pnpm` that leaves a lockfile or a store link behind —
 * so the config-dependency ladder can be exercised on `@beep/memfs`.
 *
 * @packageDocumentation
 */
import { ScriptedSpawner } from "@beep/commands";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import type { SpawnScript } from "@beep/commands";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import type * as CommandLine from "effect/process/CommandLine";

const wordText = (word: CommandLine.Word): string => (Redacted.isRedacted(word) ? Redacted.value(word) : word);

/** What a fake process does to the filesystem before its scripted reply is read. */
export type ProcessAction = (
  command: string,
  args: ReadonlyArray<string>
) => Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>;

/** What a fake process does, and how it then answers. */
export interface FakeProcessScript {
  /** Acts on the filesystem before the reply is read. */
  readonly act: ProcessAction;
  /** The scripted reply, a `ScriptedSpawner` script; a clean zero exit when omitted. */
  readonly reply?: SpawnScript | undefined;
}

/** The scripted spawner, whose `spawns` record every call, and the layer that runs `act` first. */
export interface FakeProcess {
  readonly layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner, never, FileSystem.FileSystem | Path.Path>;
  readonly scripted: ScriptedSpawner;
}

/**
 * Builds a {@link FakeProcess}: each spawn runs `act` over the provided
 * `FileSystem` and `Path`, then answers with `reply` exactly as a
 * `ScriptedSpawner` does.
 */
export const fakeProcess = ({ act, reply = () => ({}) }: FakeProcessScript): FakeProcess => {
  const scripted = ScriptedSpawner.make(reply);
  const layer = Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const inner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      return ChildProcessSpawner.make((command) =>
        (ChildProcess.isStandardCommand(command)
          ? act(command.command, A.map(command.args, wordText))
          : Effect.void
        ).pipe(Effect.provide(services), Effect.andThen(inner.spawn(command)))
      );
    })
  ).pipe(Layer.provide(scripted.layer));
  return { scripted, layer };
};
