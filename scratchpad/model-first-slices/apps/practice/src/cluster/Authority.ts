import * as DomainCluster from "@alchemy.run/domain/EffectCluster";
import { hostAuthority } from "@proto/authority-host/Host";
import { Default } from "../Cluster.ts";

/**
 * Entry module: the authority model on this app's pool. The Session
 * middleware every Api runs reads it, so the boundary's grants and
 * accountability live where the other models' entities do.
 *
 * @category entry
 * @since 0.0.0
 */
export default hostAuthority(DomainCluster.layerEntities({ name: "Authority", main: import.meta.url, pool: Default }));
