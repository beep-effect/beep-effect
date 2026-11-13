/**
 * Source-only test facade for the Files command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export { makeFilesMatchPersonCommand } from "../commands/Files/Files.command.ts";
export * from "../commands/Files/index.ts";
export { MatchPersonProtocolError } from "../commands/Files/internal/MatchPerson.errors.ts";
export * from "../commands/Files/internal/MatchPerson.inference.ts";
export {
  acquirePinnedPersonMatchArtifactForTest,
  PreparedAdaFaceArtifacts,
  prepareAdaFaceArtifacts,
  preparePersonMatchOnnxModels,
  verifyPersonMatchModelArtifacts,
} from "../commands/Files/internal/MatchPerson.model-store.ts";
export { compileAdaFaceOnnx } from "../commands/Files/internal/MatchPerson.onnx.ts";
export {
  boundedPersonMatchDirectoryNamesForTesting,
  defaultPersonMatchBackendForPlatform,
  runMatchPerson,
  selectPersonMatchCacheRoot,
  validatePersonMatchBackendPlatform,
} from "../commands/Files/internal/MatchPerson.ts";
export {
  CanonicalMatchPersonInputs,
  collectReferencesForTesting,
  compiledGraphForTesting,
  faceQualityForTesting,
  PersonMatchModelArtifactVerifier,
  PersonMatchWorkerService,
} from "../commands/Files/internal/MatchPerson.worker-service.ts";
export { probeMediaCreationDate } from "../commands/Files/internal/MediaExec.ts";
