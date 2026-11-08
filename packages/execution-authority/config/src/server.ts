/**
 * Execution authority server config exports.
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
  ExecutionAuthorityConfig,
  type ExecutionAuthorityConfigShape,
  ExecutionAuthorityDestinationAllowlistConfig,
  ExecutionAuthorityPolicyRevisionConfig,
  ExecutionAuthorityServerConfig,
} from "./ServerConfig.ts";
