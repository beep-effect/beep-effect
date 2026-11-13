import * as ClusterDocker from "@alchemy.run/effect-cluster/Docker";
import * as Layer from "effect/Layer";

/**
 * Postgres on the local Docker swarm: where the cluster keeps every hosted
 * model's events, state and outbox. The only file that names a cloud.
 *
 * @category cluster
 * @since 0.0.0
 */
export const Database = ClusterDocker.Database("Practice");

/**
 * Two runners on the local Docker swarm. Every cluster class this app runs
 * is given to this pool.
 *
 * @category cluster
 * @since 0.0.0
 */
export const Default = ClusterDocker.SwarmPool("Default", { replicas: 2 }).pipe(Layer.provide(Database));
