/**
 * epistemic server config exports.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

/**
 * Destination-to-audience resolver.
 *
 * @category configuration
 * @since 0.0.0
 */
export { resolveSinkAudience } from "./Audience.ts";
/**
 * Server-only execution-authority configuration contract.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  defaultPolicyRevision,
  EpistemicConfig,
  type EpistemicConfigShape,
  EpistemicDestinationAllowlistConfig,
  EpistemicPolicyRevisionConfig,
  EpistemicServerConfig,
} from "./ServerConfig.ts";
