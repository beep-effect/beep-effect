/**
 * Source-only test facade for the Files command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "@beep/repo-cli/commands/Files";
export { makeFilesMatchPersonCommand } from "@beep/repo-cli/commands/Files/Files.command";
export {
  boundedPersonMatchDirectoryNamesForTesting,
  defaultPersonMatchBackendForPlatform,
  runMatchPerson,
  selectPersonMatchCacheRoot,
  validatePersonMatchBackendPlatform,
} from "@beep/repo-cli/commands/Files/internal/MatchPerson";
export {
  MatchPersonError,
  MatchPersonProtocolError,
  toFilesCommandError,
} from "@beep/repo-cli/commands/Files/internal/MatchPerson.errors";
export * from "@beep/repo-cli/commands/Files/internal/MatchPerson.inference";
export {
  acquirePinnedPersonMatchArtifactForTest,
  BuffaloArtifactPins,
  PersonMatchBuffaloPins,
  PreparedAdaFaceArtifacts,
  PreparedOnnxModels,
  prepareAdaFaceArtifacts,
  preparePersonMatchOnnxModels,
  verifyPersonMatchModelArtifacts,
  writePersonMatchModelBytes,
} from "@beep/repo-cli/commands/Files/internal/MatchPerson.model-store";
export {
  compileAdaFaceOnnx,
  decodeFaceSafetensors,
  RecognizerGraphDimensions,
} from "@beep/repo-cli/commands/Files/internal/MatchPerson.onnx";
export {
  CanonicalMatchPersonInputs,
  collectReferencesForTesting,
  compiledGraphForTesting,
  faceQualityForTesting,
  PersonMatchGraphCompiler,
  PersonMatchGraphPins,
  PersonMatchGraphSourcePins,
  PersonMatchModelArtifactVerifier,
  PersonMatchOnnxResources,
  PersonMatchWorkerService,
  PersonMatchWorkerServiceLayer,
} from "@beep/repo-cli/commands/Files/internal/MatchPerson.worker-service";
export { probeMediaCreationDate } from "@beep/repo-cli/commands/Files/internal/MediaExec";
