import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as Initial from "./Initial.ts";
import { Name, Sequence } from "./Measure.ts";

/**
 * One version of a published integration fact: who produces it, the fact's
 * contract name and its version.
 *
 * @category models
 * @since 0.0.0
 */
export const FactVersion = S.Struct({ producer: Name, contract: Name, version: Sequence });
/**
 * @category models
 * @since 0.0.0
 */
export type FactVersion = typeof FactVersion.Type;

/**
 * What a hosted process does: serve a gateway or feed, poll a source, drain
 * an inbox, or authenticate a session.
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessKind = LiteralKit(["gateway", "feed", "poller", "inbox", "session"]);
/**
 * @category models
 * @since 0.0.0
 */
export type ProcessKind = typeof ProcessKind.Type;

/**
 * How a context is wired on a cluster (D13, D39): the module and export of
 * its cluster wiring, each part it provides (a gateway, a feed, a process)
 * with the parts it uses, and the parts its Apis use. The app's generator
 * reads this to compose entry modules; it names no model itself.
 *
 * @category models
 * @since 0.0.0
 */
export const ClusterWiring = S.Struct({
  module: S.String,
  export: Name,
  parts: Initial.empty(
    S.Struct({
      name: Name,
      uses: Initial.empty(Name, { description: "The parts this part uses; none unless stated." }),
    }), { description: "The parts the wiring provides; none unless stated." }),
  apis: Initial.empty(Name, { description: "The parts the context's Apis use; none unless stated." }),
});
/**
 * @category models
 * @since 0.0.0
 */
export type ClusterWiring = typeof ClusterWiring.Type;

/**
 * A deployment descriptor (D13, D34): what one context's host runs and how it
 * meets other contexts. Its models, its processes, the fact versions it
 * publishes and the fact versions it consumes. The app composes descriptors
 * and names no model or process itself; the consumed versions are the
 * registry that decides when a producer may retire a version.
 *
 * **Example** (A context that consumes one fact)
 * ```ts
 * import { DeploymentDescriptor } from "@proto/kernel/Deployment";
 *
 * const runs = DeploymentDescriptor.make({
 *   context: "runs",
 *   models: ["Runs"],
 *   processes: [{ name: "ClaimDecidedInbox", kind: "inbox" }],
 *   consumes: [{ producer: "party", contract: "ClaimDecided", version: 1 }],
 *   cluster: { module: "@proto/runs-host/Runs.cluster", export: "RunsCluster" },
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeploymentDescriptor = S.Struct({
  context: Name,
  models: S.Array(Name),
  processes: Initial.empty(S.Struct({ name: Name, kind: ProcessKind }), { description: "The processes the host runs beside its models; none unless stated." }),
  publishes: Initial.empty(FactVersion, { description: "The fact versions the context publishes; none unless stated." }),
  consumes: Initial.empty(FactVersion, { description: "The fact versions the context consumes; none unless stated." }),
  cluster: ClusterWiring,
});
/**
 * @category models
 * @since 0.0.0
 */
export type DeploymentDescriptor = typeof DeploymentDescriptor.Type;
