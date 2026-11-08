/**
 * Execution authority config test layer.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

/**
 * Configuration contract re-exported for test composition.
 *
 * @category testing
 * @since 0.0.0
 */
export {
  ExecutionAuthorityConfig,
  type ExecutionAuthorityConfigShape,
  ExecutionAuthorityServerConfig,
} from "./ServerConfig.ts";
/**
 * Deterministic grant fixtures and static configuration layers.
 *
 * @category testing
 * @since 0.0.0
 */
export {
  ExecutionAuthorityConfigTest,
  fixtureAllowedDestination,
  fixtureDeniedDestination,
  fixtureFrozenAt,
  fixtureFrozenGrantSet,
  makeExecutionAuthorityConfigTest,
  testExecutionAuthorityConfig,
} from "./TestLayer.ts";
