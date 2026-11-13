/**
 * Source-only cache command test kit.
 *
 * @internal
 * @since 0.0.0
 */

export * as CacheRuntimeFileGuards from "@beep/repo-cli-kit/cli/FsGuards";
export * as CacheRuntimeProcess from "@beep/repo-cli-kit/process/StepExec";
export {
  CacheProducerAcceptanceReference,
  CacheProducerImportPreview,
  CacheProducerImportRequest,
  CacheProducerPublication,
  CacheProducerStoreConfiguration,
  CacheProducerTrustLocations,
} from "../commands/Cache/Cache.acceptance.schemas.ts";
export {
  loadCacheProducerStoreConfiguration,
  persistCacheProducerAcceptance,
  readCacheProducerAcceptance,
} from "../commands/Cache/Cache.acceptance.store.ts";
export {
  deriveCacheProducerEvidence,
  previewCacheProducerImport,
  validateCacheProducerImport,
} from "../commands/Cache/Cache.acceptance.ts";
export {
  CacheOwnedAdapterHost,
  type CacheOwnedAdapterHostShape,
  cacheLoopbackHealthy,
  cacheOwnedAdapterHostLive,
  cacheOwnedAdapterLauncher,
  observeCacheAdapterSnapshot,
} from "../commands/Cache/Cache.adapter.host.ts";
export {
  CacheAdapterObservationExpectation,
  CacheAdapterProcessSnapshot,
  CacheAdapterRuntimeObservation,
  CacheAdapterWriterAfterLoad,
  CacheAdapterWriterReady,
  CacheOwnedAdapterStartup,
  CacheProducerAdapterLaunch,
  CacheProducerAdapterReceipt,
} from "../commands/Cache/Cache.adapter.schemas.ts";
export { withCacheProducerAdapter } from "../commands/Cache/Cache.adapter.ts";
export { forwardsBiomeConfigPath, joinCacheCensusPlan } from "../commands/Cache/Cache.census.ts";
export {
  makeCacheCommandForTesting,
  runCacheWarmForTesting,
  runCacheWarmLaneForTesting,
} from "../commands/Cache/Cache.command.ts";
export {
  CacheConformanceProxyOptions,
  makeCacheConformanceSocketProxy,
} from "../commands/Cache/Cache.conformance.proxy.ts";
export { CacheConformanceProxyEvent } from "../commands/Cache/Cache.conformance.schemas.ts";
export {
  inspectCacheDependencyTree,
  readCacheDependencyMaterialization,
} from "../commands/Cache/Cache.dependencies.ts";
export {
  compareCacheDiagnosticSource,
  encodeCacheDiagnosticJson,
  encodeCacheDiagnosticRefusal,
  observeCacheDependencies,
  planCacheDiagnosticPublication,
  readCacheDiagnosticSource,
  snapshotCacheDependencies,
  writeCacheDependencyDiagnostic,
} from "../commands/Cache/Cache.diagnostics.ts";
export {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  makePrivateSupervisorStorage,
  readCacheEvidenceBytes,
  readCacheExperimentBytes,
} from "../commands/Cache/Cache.evidence.ts";
export {
  equivalentCacheFixtureRuns,
  inspectCacheFixtureCapture,
} from "../commands/Cache/Cache.experiment.ts";
export {
  collectCacheFileCreationMask,
  collectCacheGitExclusions,
  collectCacheToolchain,
  collectCacheTrackedSourceIndex,
  collectCacheTrackedTestMembership,
  fingerprintCacheComputation,
  projectCacheActivation,
  projectCacheSignedActivation,
  projectCacheSignedRoot,
  readCacheSignatureRequired,
} from "../commands/Cache/Cache.fingerprint.ts";
export {
  collectCacheRuntimeLinker,
  inspectCacheLinkedFile,
  inspectCacheLinkerResolution,
  parseCacheLinkerOutput,
} from "../commands/Cache/Cache.linker.ts";
export {
  cacheSignedCaptureDiagnostic,
  extractCachePilotLog,
  extractCacheSignedPilotLog,
  inspectCacheSignedPilotArchive,
} from "../commands/Cache/Cache.pilot.capture.ts";
export { runCacheProducerUploadExperiment } from "../commands/Cache/Cache.pilot.runner.ts";
export { runCachePilotForTesting, runCacheSignedPilotUploadWorker } from "../commands/Cache/Cache.pilot.ts";
export {
  assertCacheProducerPrivateLocation,
  hashCacheProducerContract,
  initializeCacheProducerIssuer,
  inspectCacheProducerDirectory,
  inspectCacheProducerFile,
  makeCacheProducerIssuer,
  openCacheProducerIssuer,
  openCacheProducerVerifier,
  readCacheProducerExecutionProfile,
  readCacheProducerHostedApproval,
  readCacheProducerProvisioning,
  revokeCacheProducerIssuer,
  validateCacheProducerApproval,
  validateCacheProducerBinding,
  validateCacheProducerBundle,
} from "../commands/Cache/Cache.producer.ts";
export * as CacheRuntimeProfile from "../commands/Cache/Cache.profile.ts";
export {
  renderCacheIdentityLintProfile,
  verifyCacheIdentityLintProfile,
  writeCacheIdentityLintProfile,
} from "../commands/Cache/Cache.profile.ts";
export { serveCachePrivateSocket } from "../commands/Cache/Cache.protocol.fixture.ts";
export { cacheR2Command } from "../commands/Cache/Cache.r2.command.ts";
export { runCacheR2Fleet } from "../commands/Cache/Cache.r2.fleet.ts";
export { layerCacheR2ProbeIo } from "../commands/Cache/Cache.r2.live.ts";
export {
  CacheR2FleetReceipt,
  CacheR2FleetRequest,
  CacheR2FleetRow,
  CacheR2FleetStatus,
  CacheR2Marker,
  CacheR2Method,
  CacheR2PayloadRow,
  CacheR2ProbeMode,
  CacheR2ProbeReceipt,
  CacheR2ProbeTarget,
  CacheR2Request,
  CacheR2Response,
  CacheR2StoredReceipt,
  CacheR2TaskCache,
  CacheR2TaskExecution,
  CacheR2TaskRow,
} from "../commands/Cache/Cache.r2.schemas.ts";
export {
  CacheR2ProbeIo,
  cacheR2ProbeFixture,
  runCacheR2Probe,
  selectCacheR2SummaryTask,
} from "../commands/Cache/Cache.r2.ts";
export {
  CacheHostedProducerApproval,
  CacheHostedProducerCompleteReport,
  CacheHostedProducerObservation,
  CacheHostedProducerReference,
  CacheHostedProducerReport,
  CacheHostedProducerReusableWorkflowApproval,
  CacheHostedProducerRunReference,
  CacheHostedProducerUpload,
} from "../commands/Cache/Cache.workflow.github.schemas.ts";
export {
  buildCacheHostedProducerCompleteReport,
  CacheHostedProducerVerifier,
  CacheHostedProducerVerifierLive,
  layerCacheHostedProducerMetadata,
  verifyCacheHostedProducerObservation,
  verifyCacheHostedProducerUpload,
} from "../commands/Cache/Cache.workflow.github.ts";
export {
  CacheProducerExecutionProfile,
  CacheProducerObservation,
  CacheProducerStorageRuntime,
  CacheProducerUploadRuntime,
  CacheProducerWorkflow,
  CacheProducerWorkflowFile,
} from "../commands/Cache/Cache.workflow.schemas.ts";
export {
  downloadCacheProducerPrivateObservation,
  readCacheProducerPrivateObservation,
  removeCacheProducerPrivateObservation,
  uploadCacheProducerPrivateObservation,
} from "../commands/Cache/Cache.workflow.storage.ts";
export {
  assertCacheProducerUploadRuntime,
  assertCacheProducerWorkflowLocation,
  assertCacheProducerWorkflowProfile,
  collectCacheProducerWorkflowFiles,
  hashCacheProducerUploadKey,
  hashCacheProducerUploadTarget,
  hashCacheProducerWorkflow,
  initializeCacheProducerExecution,
  inspectCacheProducerWorkflow,
  loadCacheProducerExecutionRuntime,
  loadCacheProducerStorageRuntime,
  runCacheProducerWorkflow,
} from "../commands/Cache/Cache.workflow.ts";
export { CacheProducerUploadApproval } from "../commands/Cache/Cache.workflow.upload.schemas.ts";
export { joinCacheProducerUpload } from "../commands/Cache/Cache.workflow.upload.ts";
export * as CacheRuntimeAdmission from "../internal/repo-run/QualityScheduler.ts";
