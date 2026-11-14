import * as S from "effect/Schema";

/**
 * One version of a published integration fact: who produces it, the fact's
 * contract name and its version.
 *
 * @category models
 * @since 0.0.0
 */
export const FactVersion = S.Struct({ producer: S.String, contract: S.String, version: S.Int });
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
export const ProcessKind = S.Literals(["gateway", "feed", "poller", "inbox", "session"]);
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
  export: S.String,
  parts: S.Array(S.Struct({ name: S.String, uses: S.Array(S.String) })),
  apis: S.Array(S.String),
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
 *   publishes: [],
 *   consumes: [{ producer: "party", contract: "ClaimDecided", version: 1 }],
 *   cluster: { module: "@proto/runs-host/Runs.cluster", export: "RunsCluster", parts: [], apis: [] },
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeploymentDescriptor = S.Struct({
  context: S.String,
  models: S.Array(S.String),
  processes: S.Array(S.Struct({ name: S.String, kind: ProcessKind })),
  publishes: S.Array(FactVersion),
  consumes: S.Array(FactVersion),
  cluster: ClusterWiring,
});
/**
 * @category models
 * @since 0.0.0
 */
export type DeploymentDescriptor = typeof DeploymentDescriptor.Type;
