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
 * The first nine ids are the `yeet final-check` gate families;
 * `effect-vitest-files` is the scoped `lint effect-vitest --files` replay a
 * worker runs over the diff's test files while Lint Policy is deferred; the
 * `hook:` ids are the two catalog pre-commit hooks.
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
  "effect-vitest-files",
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
  // Local on worker only as its changeset status check; the rest of the lane,
  // the schema catalog scan included, is left to hosted Repo Sanity by
  // routeFinalCheckStepsForProfile.
  "repo-sanity": everywhereLocal,
  check: hostedOnlyOnWorker,
  docgen: hostedOnlyOnWorker,
  fallow: hostedOnlyOnWorker,
  coverage: hostedOnlyOnWorker,
  // One syntax-only parse per test file of the diff (0.5 s, 166 MB on dankserver, 2026-11-13):
  // the cheap part of Lint Policy a worker can see before hosted CI.
  "effect-vitest-files": everywhereLocal,
  "hook:schema-catalog": hostedOnlyOnWorker,
  "hook:instrumentation-catalog": hostedOnlyOnWorker,
};

/**
 * The D6 default routing table.
 *
 * **Details**
 *
 * On `worker`, `expectation-rewrite`, package-scoped `lint`, `repo-sanity`
 * and `effect-vitest-files` stay local; `cheap-gates`, `lint-policy`, `check`, `docgen`, `fallow`,
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

/**
 * How `--force-local` runs a gate that is hosted-only on the `worker` profile.
 *
 * **Details**
 *
 * `Serial` runs the gate one task at a time (concurrency 1). `Refused` keeps
 * it deferred to hosted CI because its measured run did not complete inside
 * the worker slice, or because it has no measured worker budget; the reason
 * names the measurement and where it is recorded.
 *
 * **Example** (Build a refusal)
 *
 * ```ts
 * import { WorkerForcedRoute } from "@beep/repo-cli/test/RepoRun"
 *
 * const route = WorkerForcedRoute.cases.Refused.make({ reason: "its compiler held 4.07 GB" })
 * console.log(route._tag) // "Refused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorkerForcedRoute = S.TaggedUnion({
  Serial: {},
  Refused: { reason: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("WorkerForcedRoute", {
    description: "How --force-local runs a gate that is hosted-only on the worker compute profile.",
  })
);

/**
 * How `--force-local` runs a gate that is hosted-only on the `worker` profile.
 *
 * @category models
 * @since 0.0.0
 */
export type WorkerForcedRoute = typeof WorkerForcedRoute.Type;

const forcedSerial = WorkerForcedRoute.cases.Serial.make({});
const forcedRefused = (reason: string): WorkerForcedRoute => WorkerForcedRoute.cases.Refused.make({ reason });

// Measured on dankserver (15 GiB host, 7 GiB worker slice) and recorded in
// goals/compute-profile-gate-routing/research/2026-11-13-worker-host-acceptance.md,
// its -repeat.md sibling and the 2026-11-08 repo-sanity decision. Only coverage, scoped to the
// diff's own packages, stays forceable; a gate whose measured run did not complete inside the slice
// refuses, and a gate without a measurement refuses as having no measured worker budget.
const FIRST_NOTE = "2026-11-13-worker-host-acceptance.md";
const REPEAT_NOTE = "2026-11-13-worker-host-acceptance-repeat.md";
const SCHEMA_SCAN_DECISION = "decision 2026-11-08 worker-final-check-runs-only-changeset-status-for-repo-sanity";
const NO_MEASURED_BUDGET = "no measured worker budget on dankserver";
const schemaScanReason = `its whole-repo schema catalog scan held 5.2 GB of the 7 GiB worker slice for 25 minutes (${SCHEMA_SCAN_DECISION})`;
const testTypeCheckReason = `the @beep/repo-cli test type-check's tsc held 2.59 GB for one process and gave no result in 30 minutes under a 3 GiB cap (${FIRST_NOTE})`;

const workerForcedRouteEntries: ReadonlyArray<readonly [GateRouteId, WorkerForcedRoute]> = [
  ["cheap-gates", forcedRefused(schemaScanReason)],
  ["lint-policy", forcedRefused(`it owns the test-file type check: ${testTypeCheckReason}`)],
  // Local on worker as its changeset status check; --force-local does not restore the full lane.
  ["repo-sanity", forcedRefused(`only its changeset status check runs here; ${schemaScanReason}`)],
  ["check", forcedRefused(testTypeCheckReason)],
  ["docgen", forcedRefused(NO_MEASURED_BUDGET)],
  [
    "fallow",
    forcedRefused(
      `run serially, its first sub-lane fallow:audit:check (204 packages) held a 2 GB-capped scope at its ceiling (2.15 GB aggregate) until slice pressure passed 15 at 523 s (${REPEAT_NOTE}); unserialized it reached 3.06 GB and gave no result in 29.5 minutes (${FIRST_NOTE})`
    ),
  ],
  ["coverage", forcedSerial],
];

/**
 * The `--force-local` route of each gate that `worker` does not run in full.
 *
 * **Details**
 *
 * Only `coverage` runs, one task at a time, and `yeet final-check` still
 * refuses it when its affected plan is not a selected set of packages.
 * `cheap-gates`, `lint-policy`, `check` and `fallow` are refused with the
 * figure measured on dankserver; `docgen` has no measured worker budget.
 * `repo-sanity` keeps its changeset status narrowing: the full lane's
 * catalog scan is refused. Other gates have no row.
 *
 * **Example** (Read the fallow route)
 *
 * ```ts
 * import { workerForcedRouteTable } from "@beep/repo-cli/test/RepoRun"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * console.log(O.map(HashMap.get(workerForcedRouteTable, "fallow"), (route) => route._tag)) // Some("Refused")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const workerForcedRouteTable: HashMap.HashMap<GateRouteId, WorkerForcedRoute> =
  HashMap.fromIterable(workerForcedRouteEntries);

/**
 * Why `--force-local` refuses a gate on the `worker` profile, if it does.
 *
 * **Example** (Refuse check, run coverage)
 *
 * ```ts
 * import { workerForcedRefusal } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(workerForcedRefusal("check"))) // true
 * console.log(O.isNone(workerForcedRefusal("coverage"))) // true
 * ```
 *
 * @param gate - The gate family to route.
 * @returns The refusal reason when the gate cannot be forced on a worker.
 * @category utilities
 * @since 0.0.0
 */
export const workerForcedRefusal = (gate: GateRouteId): O.Option<string> =>
  HashMap.get(workerForcedRouteTable, gate).pipe(
    O.filter(WorkerForcedRoute.guards.Refused),
    O.map((route) => route.reason)
  );

/**
 * The reason `yeet final-check` records for a gate it skipped because the
 * gate is hosted-only on the resolved compute profile.
 *
 * **Details**
 *
 * `yeet ready` treats a skip carrying exactly this reason as deferred to
 * hosted CI and checks the gate's hosted context; any other reason is an
 * operator skip it only names.
 *
 * **Example** (Recognize a profile skip)
 *
 * ```ts
 * import { COMPUTE_PROFILE_WORKER_SKIP_REASON } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(COMPUTE_PROFILE_WORKER_SKIP_REASON) // "compute-profile=worker"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const COMPUTE_PROFILE_WORKER_SKIP_REASON = "compute-profile=worker" as const;

/**
 * The pull request label `yeet open` adds on a `worker` host.
 *
 * **Details**
 *
 * The hosted catalog regeneration job keys on it: a worker host skips both
 * catalog pre-commit writers, so hosted CI regenerates the shards instead.
 * Adding a label through the REST issues endpoint creates it when missing.
 *
 * **Example** (Read the label name)
 *
 * ```ts
 * import { COMPUTE_PROFILE_WORKER_LABEL } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(COMPUTE_PROFILE_WORKER_LABEL) // "compute-profile-worker"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const COMPUTE_PROFILE_WORKER_LABEL = "compute-profile-worker" as const;

// Check-run names exactly as hosted CI reports them (verified 2026-11-08
// against the check runs of origin/main 0c1b780e564 and merged PR heads).
// Only gates that are hosted-only on some profile need a row; both catalog
// hooks are proven by the catalog checks inside Repo Sanity.
const gateHostedContextEntries: ReadonlyArray<readonly [GateRouteId, string]> = [
  ["cheap-gates", "Repo Sanity"],
  ["lint-policy", "Heavy / Lint Policy"],
  ["check", "Heavy / Check"],
  ["docgen", "Heavy / Docgen"],
  ["fallow", "Fallow Advisory Envelopes"],
  ["coverage", "Heavy / Coverage Regression"],
  ["hook:schema-catalog", "Repo Sanity"],
  ["hook:instrumentation-catalog", "Repo Sanity"],
];

/**
 * The hosted check run that proves each hosted-only gate.
 *
 * **Details**
 *
 * `yeet ready` reads the latest run of this name on the pull request head to
 * accept a gate `yeet final-check` deferred with
 * {@link COMPUTE_PROFILE_WORKER_SKIP_REASON}. Every gate that is hosted-only
 * on `worker` has a row.
 *
 * **Example** (Read the check gate's hosted context)
 *
 * ```ts
 * import { gateHostedContextTable } from "@beep/repo-cli/test/RepoRun"
 * import * as HashMap from "effect/HashMap"
 *
 * console.log(HashMap.get(gateHostedContextTable, "check")) // { _id: 'Option', _tag: 'Some', value: 'Heavy / Check' }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const gateHostedContextTable: HashMap.HashMap<GateRouteId, string> =
  HashMap.fromIterable(gateHostedContextEntries);

/**
 * The hosted check run that proves one gate, when it has one.
 *
 * **Example** (Look up the docgen context)
 *
 * ```ts
 * import { gateHostedContextFor } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(gateHostedContextFor("docgen"))) // "Heavy / Docgen"
 * console.log(O.isNone(gateHostedContextFor("lint"))) // true
 * ```
 *
 * @param gate - The gate family or hook.
 * @returns The hosted check-run name, or none for a gate that always runs locally.
 * @category utilities
 * @since 0.0.0
 */
export const gateHostedContextFor = (gate: GateRouteId): O.Option<string> => HashMap.get(gateHostedContextTable, gate);
