/**
 * Server-only ontology configuration contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyConfigId } from "@beep/identity/packages";
import { Config, Context } from "effect";
import * as S from "effect/Schema";

const $I = $OntologyConfigId.create("ServerConfig");

/**
 * Required ontology workspace-root configuration declaration.
 *
 * @example
 * ```ts
 * import { OntologyWorkspaceRootConfig } from "@beep/ontology-config/server"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const program = OntologyWorkspaceRootConfig.pipe(
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: "/srv/ontology" })
 *     )
 *   )
 * )
 *
 * Effect.runPromise(program).then(console.log) // "/srv/ontology"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OntologyWorkspaceRootConfig = Config.nonEmptyString("ONTOLOGY_WORKSPACE_ROOT");

/**
 * Server-only ontology filesystem authority settings.
 *
 * @example
 * ```ts
 * import { OntologyServerConfig } from "@beep/ontology-config/server"
 *
 * const config = OntologyServerConfig.make({ workspaceRoot: "/srv/ontology" })
 * console.log(config.workspaceRoot)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class OntologyServerConfig extends S.Class<OntologyServerConfig>($I`OntologyServerConfig`)(
  {
    workspaceRoot: S.NonEmptyString.annotateKey({
      description: "Existing directory that bounds ontology file reads and writes.",
    }),
  },
  $I.annote("OntologyServerConfig", {
    title: "Ontology server config",
    description: "Server-only filesystem authority settings for ontology documents.",
  })
) {}

/**
 * Resolved ontology configuration service shape.
 *
 * @example
 * ```ts
 * import { OntologyServerConfig } from "@beep/ontology-config/server"
 * import type { OntologyConfigShape } from "@beep/ontology-config/server"
 *
 * const shape: OntologyConfigShape = OntologyServerConfig.make({
 *   workspaceRoot: "/srv/ontology"
 * })
 * console.log(shape.workspaceRoot) // "/srv/ontology"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyConfigShape = OntologyServerConfig;

/**
 * Context service supplying resolved server-only ontology configuration.
 *
 * @example
 * ```ts
 * import { OntologyConfig } from "@beep/ontology-config/server"
 * import { Effect } from "effect"
 *
 * const workspaceRoot = OntologyConfig.pipe(
 *   Effect.map((config) => config.workspaceRoot)
 * )
 *
 * console.log(Effect.isEffect(workspaceRoot)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyConfig extends Context.Service<OntologyConfig, OntologyConfigShape>()($I`OntologyConfig`) {}
