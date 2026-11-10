/**
 * A leaf sink for `gh` child processes, so the repo-run executor can report
 * spawns without depending on the GitHub budget ledger.
 *
 * **Details**
 *
 * The default binding is a no-op. The CLI root binds it to the ledger's
 * `ghSink`, which reduces the argv to a subcommand before anything is written;
 * the full argv never leaves this process.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/GhSpawnSink");

/**
 * One `gh` child process, in memory only.
 *
 * **Example** (Build an observation)
 *
 * ```ts
 * import { GhSpawnObservation } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const spawn = GhSpawnObservation.make({ args: ["pr", "view"], exitCode: 0, durationMillis: 12, at: DateTime.makeUnsafe(0) })
 * console.log(spawn.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhSpawnObservation extends S.Opaque<GhSpawnObservation, { readonly brand: unique symbol }>()(
  S.Struct({ args: S.Array(S.String), exitCode: S.Int, durationMillis: S.Int, at: S.DateTimeUtc }).pipe(
    $I.annoteSchema("GhSpawnObservation", {
      description: "One gh child process; the argv is reduced to a subcommand before it is persisted.",
    })
  )
) {}

/**
 * What a `gh` spawn sink accepts.
 *
 * @category services
 * @since 0.0.0
 */
export interface GhSpawnSinkShape {
  /** Accept one spawn; never fails. */
  readonly record: (spawn: GhSpawnObservation) => Effect.Effect<void>;
}

/**
 * Where `gh` spawns are reported; a no-op until the CLI root binds the ledger.
 *
 * **Example** (Read the default sink)
 *
 * ```ts
 * import { GhSpawnSink } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(typeof Effect.runSync(GhSpawnSink).record) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GhSpawnSink: Context.Reference<GhSpawnSinkShape> = Context.Reference<GhSpawnSinkShape>($I`GhSpawnSink`, {
  defaultValue: () => ({ record: () => Effect.void }),
});

/**
 * Run a `gh` spawn and report it to {@link GhSpawnSink} when it ends.
 *
 * **Details**
 *
 * A failed spawn is reported with exit code `-1`. A failing or dying sink is
 * logged at debug and never changes the spawn's result.
 *
 * **Example** (Report a spawn)
 *
 * ```ts
 * import { attributeGhSpawn } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * const result = Effect.runSync(attributeGhSpawn(["pr", "view"], Effect.succeed({ exitCode: 0 })))
 * console.log(result.exitCode) // 0
 * ```
 *
 * @param args - The `gh` argv.
 * @param run - The spawn.
 * @returns The spawn's result.
 * @category utilities
 * @since 0.0.0
 */
export const attributeGhSpawn = Effect.fnUntraced(function* <A extends { readonly exitCode: number }, E, R>(
  args: ReadonlyArray<string>,
  run: Effect.Effect<A, E, R>
) {
  const sink = yield* GhSpawnSink;
  const started = yield* Clock.currentTimeMillis;
  return yield* run.pipe(
    Effect.onExit((exit) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((ended) =>
          sink.record(
            GhSpawnObservation.make({
              args,
              at: DateTime.makeUnsafe(ended),
              durationMillis: ended - started,
              exitCode: Exit.isSuccess(exit) ? exit.value.exitCode : -1,
            })
          )
        ),
        Effect.catchCause((cause) => Effect.logDebug("github.ghSpawnSink", cause))
      )
    )
  );
});
