/**
 * The GitHub Actions runtime for Effect: the services an action needs to talk
 * to the runner it executes inside.
 *
 * {@link Action.run} composes the default runtime ({@link ActionRuntime}), runs
 * your program, renders a failure as an `::error::` annotation and sets the exit
 * code. {@link ActionInput} reads workflow inputs as typed `Config` values, and
 * {@link ActionOutputs}, {@link ActionState}, {@link ActionLogger} and
 * {@link ActionEnvironment} cover outputs, cross-phase state, workflow-command
 * logging and the runner's variables. Heavier protocols are opt-in services:
 * {@link ActionCache}, {@link Artifact}, {@link BlobStore}, {@link ToolInstaller},
 * {@link PackageManagerInstaller}, {@link OidcTokenIssuer} and the GitHub App
 * token bridge {@link GitHubToken}. {@link Secret} is the one place a `Redacted`
 * value becomes plaintext, and always masks first. A reporting suite
 * ({@link GitHubMarkdown}, {@link ManagedDocument}, {@link CheckState} and
 * {@link CheckDocument}) renders what a run did onto a pull request comment, a
 * check run or the job summary.
 *
 * The cache, artifact and tool-cache protocols are implemented directly against
 * their HTTP APIs, with no `@actions/*` dependency.
 *
 * @packageDocumentation
 */

// `WorkflowCommand` is owned by the pure `@effected/github-commands`; this entrypoint re-exports it so it stays importable from here.
export { type AnnotationProperties, WorkflowCommand } from "../github-commands/index.ts";
export {
	Action,
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
export { CacheKey, CacheKeyBadPatternError, type CacheKeyError, CacheKeyReadError, InvalidDigestLengthError } from "./CacheKey.ts";
export {
	CheckDocument,
	CheckDocumentError,
	type CheckDocumentOptions,
	type CheckDocumentShape,
	type CheckDocumentSink,
	CheckDocumentStamp,
	type CheckFlushOutcome,
	CheckReport,
} from "./CheckDocument.ts";
export {
	type CheckRunConclusion,
	type CheckRunProjection,
	CheckState,
	projectCheckState,
	UnhandledCheckStateError,
} from "./CheckState.ts";
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
	type GitHubHeadingDepth,
	type GitHubListOptions,
	GitHubMarkdown,
	type GitHubRowSchema,
	type GitHubSchemaTable,
	type GitHubSchemaTableColumn,
	type GitHubSchemaTableColumns,
	type GitHubSchemaTableFormatRequiredKeys,
	type GitHubSchemaTableFormattedColumn,
	type GitHubSchemaTableOptions,
} from "./GitHubMarkdown.ts";
export {
	type ClientLayerOptions,
	GitHubToken,
	GitHubTokenError,
	type ProvisionOptions,
	type ReadOptions,
} from "./GitHubToken.ts";
export { ManagedDocument, ManagedDocumentError, type ManagedDocumentSource, RejectedRegionDialectError } from "./ManagedDocument.ts";
export { OidcClaims, OidcTokenError, OidcTokenIssuer, type OidcTokenIssuerShape } from "./OidcTokenIssuer.ts";
export {
	AmbientPackageManager,
	CachedPackageManager,
	InstalledPackageManager,
	type PackageManagerInstallOptions,
	PackageManagerInstaller,
	PackageManagerInstallerError,
	type PackageManagerInstallerShape,
} from "./PackageManagerInstaller.ts";
export { Secret } from "./Secret.ts";
export {
	type ExtractOptions,
	type ProvisionFileOptions,
	type ProvisionedFile,
	type ToolDownloadOptions,
	ToolInstaller,
	ToolInstallerError,
	type ToolInstallerShape,
} from "./ToolInstaller.ts";
