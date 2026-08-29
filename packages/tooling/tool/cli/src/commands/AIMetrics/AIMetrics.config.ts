/**
 * Effect ConfigProvider-backed AI metrics command resolution helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Effect Config-backed AI metrics resolution helpers.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  readOptionalConfigString,
  readOptionalRedactedConfigString,
  requireHashSaltForTarget,
  requireHashSaltSecretRefForTarget,
  requireRawArchiveKeySecretRefForTarget,
  resolveDataRoot,
  resolveHashSalt,
  resolveHashSaltSecretRef,
  resolveHomeDir,
  resolveRawArchiveKey,
  resolveRawArchiveKeySecretRef,
  resolveRepoRoot,
} from "./internal/Programs.ts";
