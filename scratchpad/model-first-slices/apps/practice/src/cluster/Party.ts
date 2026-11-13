import * as DomainCluster from "@alchemy.run/domain/EffectCluster";
import { hostParty } from "@proto/party-host/Host";
import { Default } from "../Cluster.ts";

/**
 * Entry module: the Party model on this app's pool. The runners load this
 * module's default export to host the model; callers that build it reach the
 * model through the pool's gateway.
 *
 * @category entry
 * @since 0.0.0
 */
export default hostParty(DomainCluster.layerEntities({ name: "Party", main: import.meta.url, pool: Default }));
