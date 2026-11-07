/**
 * Durable workflow engine for `@alchemy.run/domain` sagas on Postgres.
 *
 * **Details**
 *
 * Sagas run on the platform's `WorkflowEngine`. This is effect's cluster
 * engine (`ClusterWorkflowEngine`) over a single runner whose message and
 * runner storage are SQL tables on the ambient `SqlClient`, so a saga's
 * activities, durable deferreds and clocks survive a restart of the process.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as ClusterWorkflowEngine from "effect/cluster/ClusterWorkflowEngine";
import * as SingleRunner from "effect/cluster/SingleRunner";
import * as Digest from "effect/crypto/Digest";
import * as Layer from "effect/Layer";
import type * as Config from "effect/Config";
import type * as SqlClient from "effect/sql/SqlClient";
import type * as WorkflowEngine from "effect/workflow/WorkflowEngine";

/**
 * The cluster workflow engine on one SQL-backed runner.
 *
 * **Example** (Build the engine Layer)
 *
 * ```ts
 * import * as AlchemyPostgresWorkflows from "@beep/alchemy-postgres/AlchemyPostgresWorkflows"
 * import * as Layer from "effect/Layer"
 *
 * // Provide an effect/sql `SqlClient` (Postgres or PGlite) to finish it.
 * console.log(Layer.isLayer(AlchemyPostgresWorkflows.layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<WorkflowEngine.WorkflowEngine, Config.ConfigError, SqlClient.SqlClient> =
  ClusterWorkflowEngine.layer.pipe(
    Layer.provide(SingleRunner.layer({ runnerStorage: "sql" })),
    Layer.provide(Digest.layerWebCrypto)
  );
