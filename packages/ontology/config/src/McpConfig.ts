/**
 * Server-only ontology MCP surface configuration contract.
 *
 * Kept separate from {@link OntologyServerConfig} because tool registration and
 * filesystem authority are different concerns with different blast radii:
 * `workspaceRoot` bounds what a write may touch, while this flag decides
 * whether the write tools are advertised at all.
 *
 * Registration is not authorization. Enabling this flag makes the three
 * ontology mutation tools visible in `tools/list`; every call is still
 * dispatched through the tier gate and still fails closed without an approved
 * tool policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyConfigId } from "@beep/identity/packages";
import { Config, Context } from "effect";
import * as S from "effect/Schema";

const $I = $OntologyConfigId.create("McpConfig");

/**
 * Ontology MCP mutation-registration configuration declaration.
 *
 * @example
 * ```ts
 * import { OntologyMcpMutationsEnabledConfig } from "@beep/ontology-config/server"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const program = OntologyMcpMutationsEnabledConfig.pipe(
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ ONTOLOGY_MCP_MUTATIONS_ENABLED: "true" })
 *     )
 *   )
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OntologyMcpMutationsEnabledConfig = Config.boolean("ONTOLOGY_MCP_MUTATIONS_ENABLED").pipe(
  Config.withDefault(false)
);

/**
 * Server-only ontology MCP surface settings.
 *
 * @example
 * ```ts
 * import { OntologyMcpServerConfig } from "@beep/ontology-config/server"
 *
 * const config = OntologyMcpServerConfig.make({ mutationsEnabled: false })
 * console.log(config.mutationsEnabled) // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class OntologyMcpServerConfig extends S.Class<OntologyMcpServerConfig>($I`OntologyMcpServerConfig`)(
  {
    mutationsEnabled: S.Boolean.annotateKey({
      description: "Whether ontology mutation tools are registered on the MCP surface at all.",
    }),
  },
  $I.annote("OntologyMcpServerConfig", {
    title: "Ontology MCP server config",
    description: "Server-only ontology MCP tool-registration settings.",
  })
) {}

/**
 * Resolved ontology MCP configuration service shape.
 *
 * @example
 * ```ts
 * import { OntologyMcpServerConfig } from "@beep/ontology-config/server"
 * import type { OntologyMcpConfigShape } from "@beep/ontology-config/server"
 *
 * const shape: OntologyMcpConfigShape = OntologyMcpServerConfig.make({
 *   mutationsEnabled: true
 * })
 * console.log(shape.mutationsEnabled) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyMcpConfigShape = OntologyMcpServerConfig;

/**
 * Context service supplying resolved server-only ontology MCP configuration.
 *
 * @example
 * ```ts
 * import { OntologyMcpConfig } from "@beep/ontology-config/server"
 * import { Effect } from "effect"
 *
 * const enabled = OntologyMcpConfig.pipe(
 *   Effect.map((config) => config.mutationsEnabled)
 * )
 *
 * console.log(Effect.isEffect(enabled)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyMcpConfig extends Context.Service<OntologyMcpConfig, OntologyMcpConfigShape>()(
  $I`OntologyMcpConfig`
) {}
