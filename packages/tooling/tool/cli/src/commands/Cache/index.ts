/**
 * Public cache command exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Public cache command operations.
 *
 * @category cli-commands
 * @since 0.0.0
 */

export {
  cacheTaskSelectionArgs,
  collectCacheCensus,
  collectCacheTaskSelection,
  isCacheTaskInspectionArg,
  resolveCacheTurboBinary,
} from "./Cache.census.ts";
/**
 * Cache execution and policy commands.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  buildCacheDashboard,
  cacheCommand,
  runCachePolicyAudit,
  runCacheRestorationProbe,
  runCacheWarm,
} from "./Cache.command.ts";
/**
 * Frozen-rubric backend comparison.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  CacheConformanceComparison,
  CacheConformanceEvidence,
  CacheConformanceEvidenceCheck,
  CacheConformanceEvidenceVerdict,
  CacheConformanceGateEvidence,
  CacheConformanceGateResult,
  CacheConformanceGateStatus,
  CacheConformanceObligationCheck,
  CacheConformanceRubric,
  CacheConformanceTargetComparison,
  compareCacheConformanceRuns,
  renderCacheConformanceComparison,
} from "./Cache.conformance.compare.ts";
/**
 * Remote Cache conformance corpus generation.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  buildCacheConformanceCorpus,
  CacheConformancePaths,
  renderCacheConformanceCorpus,
  syncCacheConformanceCorpus,
} from "./Cache.conformance.corpus.ts";
/**
 * Native signed-cache matrix with exact pinned clients.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  CacheConformanceClientPin,
  CacheConformanceNativeOutcome,
  cacheConformancePinsPath,
  resolveCacheConformanceClient,
  runCacheConformanceNative,
} from "./Cache.conformance.native.ts";
/**
 * Loopback fault proxy for conformance runs.
 *
 * @category commands
 * @since 0.0.0
 */
export { CacheConformanceProxyOptions, makeCacheConformanceFaultProxy } from "./Cache.conformance.proxy.ts";
/**
 * Remote Cache conformance corpus, target, receipt and run-report contracts.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  CacheConformanceBackendResult,
  CacheConformanceBearers,
  CacheConformanceCase,
  CacheConformanceCaseClass,
  CacheConformanceCaseId,
  CacheConformanceCaseResult,
  CacheConformanceCaseVerdicts,
  CacheConformanceClientRecord,
  CacheConformanceCorpus,
  CacheConformanceCredentialRole,
  CacheConformanceDimension,
  CacheConformanceEnvName,
  CacheConformanceExchange,
  CacheConformanceExecutor,
  CacheConformanceFault,
  CacheConformanceHashShape,
  CacheConformanceLoadEnvelope,
  CacheConformanceMeasurement,
  CacheConformanceMethod,
  CacheConformanceOperation,
  CacheConformanceOperationId,
  CacheConformanceOrigin,
  CacheConformanceOutcome,
  CacheConformanceProfile,
  CacheConformanceProxyEvent,
  CacheConformanceResponseShape,
  CacheConformanceRoute,
  CacheConformanceRun,
  CacheConformanceSelectorShape,
  CacheConformanceTarget,
  CacheConformanceTopology,
  CacheConformanceVerdict,
  CacheConformanceVerdictCounts,
  CacheConformanceVerdictKind,
} from "./Cache.conformance.schemas.ts";
/**
 * Score a Remote Cache target against the conformance corpus.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  assembleCacheConformanceRun,
  assertCacheConformanceTargetBoundary,
  cacheConformanceCaseVerdicts,
  cacheConformanceLoadEnvelopePath,
  cacheConformanceVerdictOf,
  encodeCacheConformanceRun,
  loadCacheConformanceBearers,
  loadCacheConformanceEnvelope,
  mergeCacheConformanceRuns,
  runCacheConformance,
  runCacheConformanceLab,
  skippedCacheConformanceCase,
} from "./Cache.conformance.ts";
/**
 * Direct-wire Remote Cache case execution.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  CacheConformanceWireCheck,
  CacheConformanceWireOutcome,
  cacheConformanceLabCaseIds,
  classifyCacheConformanceBackendResult,
  classifyCacheConformanceMediaType,
  classifyCacheConformanceStatus,
  readCacheConformanceReply,
  runCacheConformanceLabCase,
  runCacheConformanceWireCase,
} from "./Cache.conformance.wire.ts";
/**
 * Installed dependency identities and materialization contracts.
 *
 * @category models
 * @since 0.0.0
 */
export {
  CacheDependencyLink,
  CacheDependencyMaterialization,
  CacheDependencyTree,
} from "./Cache.dependencies.schemas.ts";
/**
 * Materialize and verify installed dependency snapshots.
 *
 * @category commands
 * @since 0.0.0
 */
export { materializeCacheDependencies, verifyCacheDependencies } from "./Cache.dependencies.ts";
/**
 * Source-review artifact and census attachment contracts.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  CacheCensusEntrypointReview,
  CacheEntrypointArtifact,
  CacheEntrypointArtifactFormat,
  CacheEntrypointArtifactReference,
  CacheEntrypointReviewRequest,
} from "./Cache.entrypoints.schemas.ts";
/**
 * Attach verified source-review evidence to the executable census.
 *
 * @category commands
 * @since 0.0.0
 */
export { attachCacheEntrypointReview } from "./Cache.entrypoints.ts";
/**
 * Local fixture observation records shared by the pilot and conformance runners.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  CacheCaptureViolation,
  CacheLocalOrigin,
  CacheSyntheticCheck,
  CacheSyntheticRun,
} from "./Cache.experiment.schemas.ts";
/**
 * Runtime identity input validation.
 *
 * @category validation
 * @since 0.0.0
 */
export { hashCacheToolchain } from "./Cache.fingerprint.ts";
/**
 * Supervised signed real-pilot execution.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export { runCacheSignedPilotExperiment } from "./Cache.pilot.runner.ts";
/**
 * Native pilot requests, observations and negative controls.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  CachePilotExecutionInterval,
  CachePilotLogInput,
  CachePilotMutation,
  CachePilotNonExecution,
  CachePilotOutcome,
  CachePilotReceipt,
  CachePilotRequest,
  CachePilotRun,
  CachePilotShadow,
  CachePilotTask,
  CacheSignedPilotLogInput,
} from "./Cache.pilot.schemas.ts";
export {
  CacheSignedPilotArchive,
  CacheSignedPilotCaptureControl,
  CacheSignedPilotFreshPair,
  CacheSignedPilotMutation,
  CacheSignedPilotNonExecution,
  CacheSignedPilotPair,
  CacheSignedPilotPolicyRefusal,
  CacheSignedPilotProtection,
  CacheSignedPilotReceipt,
  CacheSignedPilotRequest,
  CacheSignedPilotRun,
  CacheSignedPilotShadow,
  CacheSignedPilotTask,
} from "./Cache.pilot.signed.schemas.ts";
/**
 * Signed real-pilot observation consistency.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  validateCacheSignedPilotConcurrency,
  validateCacheSignedPilotFreshPair,
  validateCacheSignedPilotMutation,
  validateCacheSignedPilotPair,
  validateCacheSignedPilotReceipt,
  validateCacheSignedPilotShadow,
} from "./Cache.pilot.signed.ts";
/**
 * Run native identity lint qualification controls.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export { runCachePilotExperiment, runCacheSignedPilotWorker } from "./Cache.pilot.ts";
/**
 * Producer envelope identities and authentication contracts.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  CacheProducerApproval,
  CacheProducerBinding,
  CacheProducerBody,
  CacheProducerBundle,
  CacheProducerEnvelope,
  CacheProducerEvidenceFragment,
} from "./Cache.producer.schemas.ts";
export {
  CacheFixtureArtifactKey,
  CacheFixtureCredentials,
  CacheFixtureEvent,
  CacheFixtureFault,
  CacheFixtureScenario,
} from "./Cache.protocol.fixture.schemas.ts";
export {
  corruptCacheArtifactBody,
  makeCacheProtocolFixture,
  serveCacheLoopback,
  tamperCacheArtifactTag,
} from "./Cache.protocol.fixture.ts";
export {
  CacheProtocolExecution,
  CacheProtocolIsolationRoot,
  CacheProtocolReadFailure,
  CacheProtocolRequest,
} from "./Cache.protocol.runner.schemas.ts";
export {
  assertCachePrivateNetwork,
  CacheProtocolNativeSummary,
  cacheProtocolSandboxMounts,
  runCacheProtocolExperiment,
  runCacheProtocolWorker,
} from "./Cache.protocol.runner.ts";
export { CacheProtocolObservation } from "./Cache.protocol.schemas.ts";
export { validateCacheProtocolExecution, validateCacheProtocolObservation } from "./Cache.protocol.ts";
/**
 * Execute tasks with a runtime-owned identity.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  assertCacheRuntimeKeyUnspecified,
  cacheRuntimeStep,
  resolveCacheSigningPosture,
  runCacheRuntimeTasks,
} from "./Cache.runtime.ts";
/**
 * Public cache command schemas and errors.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  CacheActivationPreview,
  CacheActivationRequest,
  CacheBaselineRequest,
  CacheCensusDefinition,
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheCensusWorkspace,
  CacheCommandError,
  CacheComputationConfiguration,
  CacheDashboardReport,
  CacheDashboardReportJson,
  CacheExecutablePin,
  CacheLambdaSummary,
  CacheLinkedFile,
  CacheLinkerResolution,
  CacheLiveIdentity,
  CacheRemoteReadsRequest,
  CacheRunMode,
  CacheRuntimeExecutable,
  CacheRuntimeLinkerSnapshot,
  CacheSigningKeyState,
  CacheSigningPosture,
  CacheSigningRequest,
  CacheSigningRole,
  CacheToolchainSnapshot,
  CacheTransitionRequest,
  CacheWallTime,
  CacheWarmLane,
  CacheWarmReceipt,
  CacheWarmReceiptJson,
} from "./Cache.schemas.ts";
/**
 * Govern qualification lifecycle changes and cache policy queries.
 *
 * @category services
 * @since 0.0.0
 */
export {
  CacheQualificationLive,
  CacheQualificationService,
  type CacheQualificationServiceShape,
  encodeCachePolicyBaselineText,
} from "./Cache.service.ts";
