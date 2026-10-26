/**
 * The GitHub Actions runtime for Effect: the services an action needs to talk
 * to the runner it executes inside.
 *
 * **Details**
 *
 * {@link Action.run} composes the default runtime ({@link ActionRuntime}), runs
 * your program, renders a failure as an `::error::` annotation and leaves the
 * exit code to `NodeRuntime.runMain`; {@link Action.main} is the same run as an
 * Effect. {@link ActionInput} reads workflow inputs as typed `Config` values, and
 * {@link ActionOutputs}, {@link ActionState}, {@link ActionLogger} and
 * {@link ActionEnvironment} cover outputs, cross-phase state, workflow-command
 * logging and the runner's variables. Heavier protocols are opt-in services:
 * {@link ActionCache}, {@link Artifact}, {@link BlobStore}, {@link ToolInstaller},
 * {@link PackageManagerInstaller}, {@link OidcTokenIssuer} and the GitHub App
 * token bridge {@link GitHubToken}. {@link Secret} is the one place a `Redacted`
 * value becomes plaintext, and always masks first. The reporting suite
 * (`GitHubMarkdown`, `ManagedDocument`, `CheckState` and `CheckDocument`), which
 * renders what a run did onto a pull request comment, a check run or the job
 * summary, now ships as `@beep/github-reporting`.
 *
 * The cache, artifact and tool-cache protocols are implemented directly against
 * their HTTP APIs, with no `@actions/*` dependency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// `WorkflowCommand` is owned by the pure `@effected/github-commands`; this entrypoint re-exports it so it stays importable from here.
export { type AnnotationProperties, WorkflowCommand } from "@beep/github-commands";
export {
  Action,
  ActionFailedError,
  type ActionRunOptions,
  ActionRuntime,
  type ActionServices,
  describeCause,
} from "./Action.ts";
export { ActionCache, ActionCacheError, type ActionCacheShape } from "./ActionCache.ts";
export {
  ActionEnvironment,
  ActionEnvironmentError,
  type ActionEnvironmentShape,
  GitHubContext,
  RunnerContext,
} from "./ActionEnvironment.ts";
export { ActionInput, type PairsOptions } from "./ActionInput.ts";
export {
  ActionLogger,
  type ActionLoggerShape,
  type WithBufferOptions,
  type WithStepOptions,
} from "./ActionLogger.ts";
export {
  type ActionOutputError,
  ActionOutputs,
  type ActionOutputsShape,
  DetachedOutputError,
  InvalidOutputNameError,
  OutputEncodeError,
  RecordedOutput,
  type RecordedOutputMember,
  type RecordingOutputs,
  RunnerFileUnavailableError,
  RunnerFileWriteError,
} from "./ActionOutputs.ts";
export { ActionState, ActionStateError, type ActionStateShape, InvalidActionStateNameError } from "./ActionState.ts";
export { ActionsIdentityToken } from "./ActionsIdentityToken.ts";
export { ActionsProvenance } from "./ActionsProvenance.ts";
export {
  Artifact,
  ArtifactError,
  type ArtifactItem,
  type ArtifactRef,
  type ArtifactShape,
  type DownloadOptions,
  type DownloadResult,
  type UploadOptions,
  type UploadResult,
} from "./Artifact.ts";
export {
  BlobEnvelope,
  type BlobEnvelopeError,
  BlobMetadataDecodeError,
  BlobMetadataEncodeError,
  NotABlobEnvelopeError,
  TruncatedBlobEnvelopeError,
  UnsupportedBlobEnvelopeVersionError,
} from "./BlobEnvelope.ts";
export { GitHubCacheBlobStore } from "./BlobStore.githubCache.ts";
export { BlobStore, BlobStoreError, type BlobStoreShape, type S3Config, type StoredBlob } from "./BlobStore.ts";
export { BlobTransferError, type DataBlobTransfer, type FileBlobTransfer } from "./BlobTransfer.ts";
export {
  CacheKey,
  CacheKeyBadPatternError,
  type CacheKeyError,
  CacheKeyReadError,
  InvalidDigestLengthError,
} from "./CacheKey.ts";
export { ChildEnv, type PathPrependEnv, type PathPrependOptions } from "./ChildEnv.ts";
export {
  DetachedLogUnavailableError,
  DetachedNotReadyError,
  DetachedProcess,
  type DetachedProcessError,
  type DetachedProcessOps,
  DetachedSignalFailedError,
  DetachedSpawnFailedError,
  type DetachedSpawnOptions,
  InvalidPidError,
  MissingProcessIdError,
  ProcessId,
  type ReadinessOptions,
} from "./DetachedProcess.ts";
export { DryRun, type DryRunShape } from "./DryRun.ts";
export {
  type ClientLayerOptions,
  GitHubToken,
  GitHubTokenError,
  type ProvisionOptions,
  type ReadOptions,
} from "./GitHubToken.ts";
export { OidcClaims, OidcTokenError, OidcTokenIssuer, type OidcTokenIssuerShape } from "./OidcTokenIssuer.ts";
export {
  AmbientPackageManager,
  CachedPackageManager,
  InstalledPackageManager,
  PackageManagerInstaller,
  PackageManagerInstallerError,
  type PackageManagerInstallerShape,
  type PackageManagerInstallOptions,
} from "./PackageManagerInstaller.ts";
export { Secret } from "./Secret.ts";
export {
  type ExtractOptions,
  type ProvisionedFile,
  type ProvisionFileOptions,
  type ToolDownloadOptions,
  ToolInstaller,
  ToolInstallerError,
  type ToolInstallerShape,
} from "./ToolInstaller.ts";
