/**
 * Source-only cache command test kit.
 *
 * @internal
 * @since 0.0.0
 */

export { joinCacheCensusPlan } from "../commands/Cache/Cache.census.ts";
export {
  makeCacheCommandForTesting,
  runCacheWarmForTesting,
  runCacheWarmLaneForTesting,
} from "../commands/Cache/Cache.command.ts";
export { inspectCacheDependencyTree } from "../commands/Cache/Cache.dependencies.ts";
export {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheEvidenceBytes,
  readCacheExperimentBytes,
} from "../commands/Cache/Cache.evidence.ts";
export {
  equivalentCacheFixtureRuns,
  inspectCacheFixtureCapture,
  runCacheSyntheticForTesting,
} from "../commands/Cache/Cache.experiment.ts";
export {
  collectCacheGitExclusions,
  collectCacheToolchain,
  fingerprintCacheComputation,
  projectCacheActivation,
} from "../commands/Cache/Cache.fingerprint.ts";
export {
  collectCacheRuntimeLinker,
  inspectCacheLinkedFile,
  inspectCacheLinkerResolution,
  parseCacheLinkerOutput,
} from "../commands/Cache/Cache.linker.ts";
export { extractCachePilotLog, extractCacheSignedPilotLog } from "../commands/Cache/Cache.pilot.capture.ts";
export { runCachePilotForTesting } from "../commands/Cache/Cache.pilot.ts";
export {
  initializeCacheProducerIssuer,
  makeCacheProducerIssuer,
  openCacheProducerIssuer,
  openCacheProducerVerifier,
  revokeCacheProducerIssuer,
} from "../commands/Cache/Cache.producer.ts";
export * as CacheRuntimeProfile from "../commands/Cache/Cache.profile.ts";
export {
  renderCacheIdentityLintProfile,
  verifyCacheIdentityLintProfile,
  writeCacheIdentityLintProfile,
} from "../commands/Cache/Cache.profile.ts";
export {
  CacheProducerObservation,
  CacheProducerWorkflow,
  CacheProducerWorkflowFile,
} from "../commands/Cache/Cache.workflow.schemas.ts";
export {
  assertCacheProducerWorkflowLocation,
  assertCacheProducerWorkflowProfile,
  collectCacheProducerWorkflowFiles,
  hashCacheProducerWorkflow,
  inspectCacheProducerWorkflow,
  runCacheProducerWorkflow,
} from "../commands/Cache/Cache.workflow.ts";
export * as CacheRuntimeFileGuards from "../internal/cli/FsGuards.ts";
export * as CacheRuntimeProcess from "../internal/process/StepExec.ts";
