/**
 * Where the board's lanes come from: `bun run beep session open --json`,
 * read as a subprocess and decoded with the lab's own schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LaneCockpitId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { decodeReportNow, LanesFailed } from "./Lanes.ts";
import type { LanesSnapshot } from "./Lanes.ts";

const $I = $LaneCockpitId.create("LaneSource");

/**
 * Shape of {@link LaneSource}.
 *
 * @category services
 * @since 0.0.0
 */
export interface LaneSourceShape {
  /** Read the current lanes. Never fails: a failed read is a {@link LanesFailed} snapshot. */
  readonly read: Effect.Effect<LanesSnapshot>;
}

/**
 * Yields the current live lanes of a repository checkout.
 *
 * **Example** (A fixed source for tests)
 *
 * ```ts
 * import { LaneSource } from "@/LaneSource"
 * import { LanesPending } from "@/Lanes"
 * import * as Effect from "effect/Effect"
 *
 * const source = LaneSource.of({ read: Effect.succeed(LanesPending.make({})) })
 * console.log(typeof source.read) // "object"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LaneSource extends Context.Service<LaneSource, LaneSourceShape>()($I`LaneSource`) {}

// How long one `session open --json` read may take before it counts as failed.
const readTimeout = Duration.seconds(20);

/**
 * Build a source that runs `command` and decodes its stdout as a session report.
 *
 * **Example** (A source over any command)
 *
 * ```ts
 * import { makeCommandSource } from "@/LaneSource"
 * import * as ChildProcess from "effect/process/ChildProcess"
 *
 * console.log(typeof makeCommandSource(ChildProcess.make("cat", ["report.json"]))) // "object"
 * ```
 *
 * @param command - A command whose stdout is a `session open --json` document.
 * @returns The source, built from the current child-process spawner.
 * @category constructors
 * @since 0.0.0
 */
export const makeCommandSource = Effect.fn("LaneSource.makeCommandSource")(function* (
  command: ChildProcess.Command
): Effect.fn.Return<LaneSourceShape, never, ChildProcessSpawner.ChildProcessSpawner> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fail = (message: string) => Effect.map(DateTime.now, (fetchedAt) => LanesFailed.make({ message, fetchedAt }));
  return LaneSource.of({
    read: spawner.string(command).pipe(
      Effect.flatMap(decodeReportNow),
      Effect.catch((error) => fail(`session open --json failed: ${error.message}`)),
      Effect.timeoutOrElse({
        duration: readTimeout,
        orElse: () => fail(`session open --json took longer than ${Duration.format(readTimeout)}`),
      }),
      Effect.withSpan("LaneSource.read")
    ),
  });
});

/**
 * The live source: runs `bun run --silent beep session open --json` in `cwd`.
 *
 * **Example** (Build the layer for a checkout)
 *
 * ```ts
 * import { layerSessionOpen } from "@/LaneSource"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerSessionOpen("/work/beep-effect"))) // true
 * ```
 *
 * @param cwd - The repository checkout whose ledger rows to show.
 * @returns A layer that needs a child-process spawner.
 * @category layers
 * @since 0.0.0
 */
export const layerSessionOpen = (
  cwd: string
): Layer.Layer<LaneSource, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.effect(
    LaneSource,
    makeCommandSource(
      ChildProcess.make("bun", ["run", "--silent", "beep", "session", "open", "--json"], { cwd, stdin: "ignore" })
    )
  );
