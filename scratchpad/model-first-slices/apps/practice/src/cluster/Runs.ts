import * as DomainCluster from "@alchemy.run/domain/EffectCluster";
import { hostRuns } from "@proto/runs-host/Host";
import * as Layer from "effect/Layer";
import { Default } from "../Cluster.ts";
import GatewayLive from "./Gateway.ts";

/**
 * Entry module: the runs model on this app's pool, granted through the authority gateway.
 *
 * @category entry
 * @since 0.0.0
 */
export default hostRuns(DomainCluster.layerEntities({ name: "Runs", main: import.meta.url, pool: Default })).pipe(
  Layer.provide(GatewayLive),
);
