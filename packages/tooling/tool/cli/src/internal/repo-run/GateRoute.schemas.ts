/**
 * Gate routing by compute profile (goal compute-profile-gate-routing, D6).
 *
 * One typed table says, for each gate family and pre-commit hook, whether it
 * may run locally or is hosted-only on each compute profile. The scheduler,
 * `yeet final-check`/`ready` and the lefthook skip test all read this table.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { ComputeProfile } from "./ComputeProfile.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/GateRoute.schemas");

/**
 * Gate families and pre-commit hooks that the routing table covers.
 *
 * **Details**
 *
 * The first nine ids are the `yeet final-check` gate families; the `hook:`
 * ids are the two catalog pre-commit hooks.
 *
 * **Example** (Recognize a hook route id)
 *
 * ```ts
 * import { GateRouteId } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(GateRouteId.is["hook:schema-catalog"]("hook:schema-catalog")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateRouteId = LiteralKit([
  "expectation-rewrite",
  "cheap-gates",
  "lint-policy",
  "lint",
  "repo-sanity",
  "check",
  "docgen",
  "fallow",
  "coverage",
  "hook:schema-catalog",
  "hook:instrumentation-catalog",
]).pipe(
  $I.annoteSchema("GateRouteId", {
    description: "A gate family or catalog pre-commit hook routed by compute profile.",
  })
);

/**
 * A gate family or catalog pre-commit hook routed by compute profile.
 *
 * @category models
 * @since 0.0.0
 */
export type GateRouteId = typeof GateRouteId.Type;

/**
 * Whether a gate may run locally or must defer to hosted CI.
 *
 * **Example** (Recognize a hosted-only route)
 *
 * ```ts
 * import { GateRouteMode } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(GateRouteMode.is["hosted-only"]("hosted-only")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateRouteMode = LiteralKit(["local", "hosted-only"]).pipe(
  $I.annoteSchema("GateRouteMode", {
    description: "Whether a gate may run locally or must defer to hosted CI.",
  })
);

/**
 * Whether a gate may run locally or must defer to hosted CI.
 *
 * @category models
 * @since 0.0.0
 */
export type GateRouteMode = typeof GateRouteMode.Type;

/**
 * Route of one gate on each compute profile.
 *
 * **Example** (Construct a hosted-only-on-worker route)
 *
 * ```ts
 * import { GateRouteModes } from "@beep/repo-cli/test/RepoRun"
 *
 * const modes = GateRouteModes.make({ workstation: "local", worker: "hosted-only" })
 * console.log(modes.worker) // "hosted-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateRouteModes extends S.Opaque<GateRouteModes, { readonly brand: unique symbol }>()(
  S.Struct({
    workstation: GateRouteMode,
    worker: GateRouteMode,
  }).pipe(
    $I.annoteSchema("GateRouteModes", {
      description: "Route of one gate on the workstation and worker compute profiles.",
    })
  )
) {}

const everywhereLocal = GateRouteModes.make({ workstation: "local", worker: "local" });
const hostedOnlyOnWorker = GateRouteModes.make({ workstation: "local", worker: "hosted-only" });

const gateRouteRecord: Record<GateRouteId, GateRouteModes> = {
  "expectation-rewrite": everywhereLocal,
  "cheap-gates": hostedOnlyOnWorker,
  "lint-policy": hostedOnlyOnWorker,
  lint: everywhereLocal,
  "repo-sanity": everywhereLocal,
  check: hostedOnlyOnWorker,
  docgen: hostedOnlyOnWorker,
  fallow: hostedOnlyOnWorker,
  coverage: hostedOnlyOnWorker,
  "hook:schema-catalog": hostedOnlyOnWorker,
  "hook:instrumentation-catalog": hostedOnlyOnWorker,
};

/**
 * The D6 default routing table.
 *
 * **Details**
 *
 * On `worker`, `expectation-rewrite`, package-scoped `lint` and `repo-sanity`
 * stay local; `cheap-gates`, `lint-policy`, `check`, `docgen`, `fallow`,
 * `coverage` and both catalog hooks are hosted-only. On `workstation` every
 * gate is local. The table is built from a total record, so a new
 * {@link GateRouteId} without a row fails to compile.
 *
 * **Example** (Read the coverage route)
 *
 * ```ts
 * import { gateRouteTable } from "@beep/repo-cli/test/RepoRun"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * const coverage = HashMap.get(gateRouteTable, "coverage")
 * console.log(O.map(coverage, (modes) => modes.worker)) // { _id: 'Option', _tag: 'Some', value: 'hosted-only' }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const gateRouteTable: HashMap.HashMap<GateRouteId, GateRouteModes> = HashMap.fromIterable(
  R.toEntries(gateRouteRecord)
);

/**
 * Route of one gate on one compute profile.
 *
 * **Example** (Route check on a worker)
 *
 * ```ts
 * import { gateRouteFor } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(gateRouteFor("check", "worker")) // "hosted-only"
 * console.log(gateRouteFor("check", "workstation")) // "local"
 * ```
 *
 * @param gate - The gate family or hook to route.
 * @param profile - The resolved compute profile.
 * @returns The gate's route on that profile.
 * @category utilities
 * @since 0.0.0
 */
export const gateRouteFor: {
  (gate: GateRouteId, profile: ComputeProfile): GateRouteMode;
  (profile: ComputeProfile): (gate: GateRouteId) => GateRouteMode;
} = dual(
  2,
  (gate: GateRouteId, profile: ComputeProfile): GateRouteMode =>
    HashMap.get(gateRouteTable, gate).pipe(
      O.getOrElse(() => everywhereLocal),
      (modes) => modes[profile]
    )
);
