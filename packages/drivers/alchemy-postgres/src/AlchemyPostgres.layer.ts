/**
 * Everything a `@alchemy.run/domain` model needs from Postgres in one Layer.
 *
 * **Details**
 *
 * The same surface as `Domain.InMemory`: the `Platform` that hosts the model
 * and the `WorkflowEngine` its sagas run on, both over the ambient effect/sql
 * `SqlClient`. Swap `Domain.InMemory` for this Layer and nothing else changes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Layer from "effect/Layer";
import { AlchemyPostgresConfig } from "./AlchemyPostgres.config.ts";
import * as AlchemyPostgresPlatform from "./AlchemyPostgresPlatform.ts";
import * as AlchemyPostgresWorkflows from "./AlchemyPostgresWorkflows.ts";
import type { Platform } from "@alchemy.run/domain/Platform";
import type * as Config from "effect/Config";
import type * as SqlClient from "effect/sql/SqlClient";
import type * as WorkflowEngine from "effect/workflow/WorkflowEngine";
import type { AlchemyPostgresError } from "./AlchemyPostgres.errors.ts";

/**
 * Host a model and run its sagas on Postgres.
 *
 * **Example** (Host a model on Postgres)
 *
 * ```ts
 * import * as AlchemyPostgres from "@beep/alchemy-postgres/AlchemyPostgres.layer"
 * import * as Layer from "effect/Layer"
 *
 * // Provide an effect/sql `SqlClient` (Postgres or PGlite) to finish it.
 * console.log(Layer.isLayer(AlchemyPostgres.layer())) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (
  config: AlchemyPostgresConfig = AlchemyPostgresConfig.make({})
): Layer.Layer<
  Platform | WorkflowEngine.WorkflowEngine,
  AlchemyPostgresError | Config.ConfigError,
  SqlClient.SqlClient
> => Layer.merge(AlchemyPostgresPlatform.layer(config), AlchemyPostgresWorkflows.layer);
