/**
 * How the suites hand the code under test the kit's one scripted spawner.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

/**
 * Provide a `ScriptedSpawner`'s `ChildProcessSpawner` to one effect, where the
 * hand-rolled doubles were `Effect.provideService`d.
 *
 * **Details**
 *
 * The spawner's layer is a pure `Layer.succeed`, built in a scope of its own,
 * so the effect keeps any `Scope` it requires from its surroundings, exactly as
 * under `Effect.provideService` (`provideScopedLayer` would close the effect's
 * scoped resources at its end instead).
 *
 * **Example** (Script a revision lookup for one effect)
 *
 * ```ts
 * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
 * import { Run } from "@beep/commands/Run";
 * import * as ChildProcess from "effect/process/ChildProcess";
 * import { provideSpawner } from "./ScriptedProcess.ts";
 *
 * const spawner = ScriptedSpawner.make(() => ({ stdout: "abc123\n" }));
 * const head = Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"])).pipe(provideSpawner(spawner));
 * ```
 */
export const provideSpawner =
  (spawner: ScriptedSpawner) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, ChildProcessSpawner.ChildProcessSpawner>> =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(spawner.layer, scope), (context) => Effect.provideContext(effect, context))
    );
