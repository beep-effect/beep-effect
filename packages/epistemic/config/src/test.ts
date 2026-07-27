/**
 * epistemic config test layer.
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
export { EpistemicConfig, type EpistemicConfigShape, EpistemicServerConfig } from "./ServerConfig.ts";
/**
 * Deterministic grant fixtures and static configuration layers.
 *
 * @category testing
 * @since 0.0.0
 */
export {
  EpistemicConfigTest,
  fixtureAllowedDestination,
  fixtureDeniedDestination,
  fixtureFrozenAt,
  fixtureFrozenGrantSet,
  makeEpistemicConfigTest,
  testEpistemicConfig,
} from "./TestLayer.ts";
