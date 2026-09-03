/**
 * Source-only test facade for the Files command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "../commands/Files/index.ts";
export {
  acquirePinnedPersonMatchArtifactForTest,
  PreparedAdaFaceArtifacts,
  prepareAdaFaceArtifacts,
  verifyPersonMatchModelArtifacts,
} from "../commands/Files/internal/MatchPerson.model-store.ts";
export {
  boundedPersonMatchDirectoryNamesForTesting,
  defaultPersonMatchBackendForPlatform,
  runMatchPerson,
  trustedUvExecutableNameForPlatform,
  trustedUvRootDirectoriesForPlatform,
  validatePersonMatchBackendPlatform,
} from "../commands/Files/internal/MatchPerson.ts";
export {
  CanonicalMatchPersonInputs,
  PersonMatchModelArtifactVerifier,
  PersonMatchWorkerPolicyForTest,
  PersonMatchWorkerService,
} from "../commands/Files/internal/MatchPerson.worker-service.ts";
