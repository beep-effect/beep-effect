/**
 * Service contract for the git/PR-verified terminal-lane authority residue reap consults.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type { ResidueTerminalLaneAuthority } from "./ResidueReap.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/ResidueTerminalLane");

/**
 * Service contract: prove, live, that one checkout is a finished lane.
 *
 * **Details**
 *
 * `verify` fails closed. Any probe error, missing fact, or failed check
 * answers `None`; it never guesses and never fails the caller. Residue reap
 * calls it only for rows in the checkout it runs from, once at discovery and
 * again immediately before each apply.
 *
 * **Example** (Describe a probe that proves nothing)
 *
 * ```ts
 * import type { ResidueTerminalLaneProbeShape } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const unproven: ResidueTerminalLaneProbeShape = { verify: () => Effect.succeedNone }
 * console.log(Effect.isEffect(unproven.verify("/work/lane"))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type ResidueTerminalLaneProbeShape = {
  readonly verify: (checkoutRoot: string) => Effect.Effect<O.Option<ResidueTerminalLaneAuthority>>;
};

/**
 * Context tag for the terminal-lane probe residue reap requires.
 *
 * **Details**
 *
 * The live layer (`ResidueTerminalLaneProbeLive` in the quality command)
 * checks git, `gh`, `/proc` and the session ledger. Tests provide
 * `layerResidueTerminalLaneProbeTest`.
 *
 * **Example** (Request the probe)
 *
 * ```ts
 * import { ResidueTerminalLaneProbe } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const probe = yield* ResidueTerminalLaneProbe
 *   return yield* probe.verify("/work/lane")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ResidueTerminalLaneProbe extends Context.Service<
  ResidueTerminalLaneProbe,
  ResidueTerminalLaneProbeShape
>()($I`ResidueTerminalLaneProbe`) {}

/**
 * Probe layer answering from a fixture function instead of git and `gh`.
 *
 * **Example** (Provide a probe that never proves a lane)
 *
 * ```ts
 * import { layerResidueTerminalLaneProbeTest } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const unproven = layerResidueTerminalLaneProbeTest(() => Effect.succeedNone)
 * console.log(typeof unproven) // "object"
 * ```
 *
 * @param verify - The fixture answer for each checkout root.
 * @returns A layer providing `ResidueTerminalLaneProbe`.
 * @category testing
 * @since 0.0.0
 */
export const layerResidueTerminalLaneProbeTest = (
  verify: ResidueTerminalLaneProbeShape["verify"]
): Layer.Layer<ResidueTerminalLaneProbe> =>
  Layer.succeed(ResidueTerminalLaneProbe, ResidueTerminalLaneProbe.of({ verify }));
