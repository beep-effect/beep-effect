import * as DomainCluster from "@alchemy.run/domain/EffectCluster";
import { hostParty } from "@proto/party-host/Host";
import * as Layer from "effect/Layer";
import { Default } from "../Cluster.ts";
import GatewayLive from "./Gateway.ts";
import RunsGatewayLive from "./RunsGateway.ts";

/**
 * Entry module: the Party model on this app's pool. Its policies and saga
 * re-admit every hop through the authority gateway and report review runs
 * through the runs gateway.
 *
 * @category entry
 * @since 0.0.0
 */
export default hostParty(DomainCluster.layerEntities({ name: "Party", main: import.meta.url, pool: Default })).pipe(
  Layer.provide(Layer.merge(GatewayLive, RunsGatewayLive)),
);
