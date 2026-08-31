/**
 * Source-only test facade for the Files command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "../commands/Files/index.ts";
export { acquirePinnedPersonMatchArtifactForTest } from "../commands/Files/internal/MatchPerson.model-store.ts";
export {
  defaultPersonMatchBackendForPlatform,
  trustedUvExecutableNameForPlatform,
  trustedUvRootDirectoriesForPlatform,
  validatePersonMatchBackendPlatform,
} from "../commands/Files/internal/MatchPerson.ts";
export {
  PersonMatchModelArtifactVerifier,
  PersonMatchWorkerPolicyForTest,
} from "../commands/Files/internal/MatchPerson.worker-service.ts";
