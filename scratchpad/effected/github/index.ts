/**
 * Typed GitHub REST and GraphQL for Effect: a route-keyed client, one error
 * taxonomy, GitHub App auth, and one resource service per GitHub noun.
 *
 * **Details**
 *
 * `GitHubClient.request` types both the parameters and the returned `data` from
 * the route literal. Every REST failure is a `GitHubError` whose `kind` you
 * branch on. Resource services (`GitBranch`, `GitTag`, `CheckRun`,
 * `PullRequest`, `GitHubRelease` and others) turn multi-call sequences into one
 * call, and a configuration tier writes secrets, variables, rulesets,
 * deployment environments and security settings. `GitHubApp` mints and revokes
 * installation tokens.
 *
 * **Example** (Read the default branch with a configured GitHub client)
 *
 * ```ts
 * import { GitHubClient } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* GitHubClient;
 *   const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "effect-ts", repo: "effect" });
 *   return repo.default_branch;
 * });
 *
 * // GITHUB_TOKEN is read through the ambient ConfigProvider.
 * Effect.runPromise(program.pipe(Effect.provide(GitHubClient.layerFromConfig())));
 * ```
 *
 * @packageDocumentation
 */

// Six issue-reference names from `@effected/github-references` are re-exported
// here for existing consumers; the closing-list dialect is deliberately not.
export {
	type BareLineReference,
	CLOSING_KEYWORDS,
	type ClosingKeyword,
	type IssueReference,
	harvestIssueReferences,
	parseBareLineReference,
} from "../github-references/index.ts";
export { ArtifactMetadata, type ArtifactMetadataShape, StorageRecordInput } from "./ArtifactMetadata.ts";
export { Attestation, AttestationListEntry, AttestationRecord, type AttestationShape } from "./Attestation.ts";
export {
	Annotation,
	AnnotationLevel,
	CheckConclusion,
	CheckRun,
	CheckRunOutput,
	CheckRunRef,
	type CheckRunShape,
	type ConcludeCheckRun,
} from "./CheckRun.ts";
export { CodeScanning, type CodeScanningSetup, type CodeScanningShape } from "./CodeScanning.ts";
export {
	DeploymentEnvironment,
	type DeploymentEnvironmentInfo,
	type DeploymentEnvironmentShape,
} from "./DeploymentEnvironment.ts";
export { type BranchOutcome, GitBranch, type GitBranchShape } from "./GitBranch.ts";
export {
	CommitRef,
	FileChange,
	FileContent,
	FileDeletion,
	FileMode,
	GitCommit,
	type GitCommitShape,
} from "./GitCommit.ts";
export {
	type AppCredentials,
	AppIdentity,
	BotIdentity,
	GitHubApp,
	GitHubAppError,
	type GitHubAppOptions,
	type GitHubAppShape,
	Installation,
	InstallationToken,
	type TokenRequest,
} from "./GitHubApp.ts";
export {
	GitHubClient,
	type GitHubClientOptions,
	type GitHubClientShape,
	type GitHubFixtures,
	type RecordedCall,
} from "./GitHubClient.ts";
export {
	CommitComparison,
	CommitFile,
	CommitSummary,
	FileStatus,
	GitHubCommit,
	type GitHubCommitShape,
} from "./GitHubCommit.ts";
export { GitHubContent, type GitHubContentShape } from "./GitHubContent.ts";
export { GitHubError, GitHubErrorKind, GitHubValidationCode, GitHubValidationEntry } from "./GitHubError.ts";
export { CommentOnceResult, GitHubIssue, type GitHubIssueShape, IssueInfo, LinkedIssue } from "./GitHubIssue.ts";
export { GitHubRelease, type GitHubReleaseShape, ReleaseAsset, ReleaseInfo } from "./GitHubRelease.ts";
export {
	type AppliedSettings,
	GRAPHQL_ONLY_SETTINGS,
	GitHubRepository,
	type GitHubRepositoryShape,
	type OwnerType,
	type RepositoryPatch,
	type RepositoryPatchDraft,
	type RepositorySettings,
	SECURITY_ANALYSIS_STATUS_FIELDS,
	repositoryPatch,
	transformSecurityAndAnalysis,
} from "./GitHubRepository.ts";
export {
	GitTag,
	type GitTagShape,
	type LatestSemverOptions,
	SemverTag,
	TagRef,
	type VersionFromTag,
	versionFromTag,
} from "./GitTag.ts";
export { GitHubGraphQLError, GraphQLDocument, GraphQLErrorEntry } from "./GraphQL.ts";
export {
	MergeMethod,
	PullRequest,
	PullRequestInfo,
	type PullRequestShape,
	type UpsertedPullRequest,
} from "./PullRequest.ts";
export {
	CommentMarker,
	CommentRecord,
	PullRequestComment,
	type PullRequestCommentShape,
} from "./PullRequestComment.ts";
export { InvalidRepoRefError, Repo, RepoRef } from "./Repo.ts";
export { RepositorySecret, type RepositorySecretShape, type SecretInfo, type SecretScope } from "./RepositorySecret.ts";
export { RepositorySecurity, type RepositorySecurityShape } from "./RepositorySecurity.ts";
export { RepositoryVariable, type RepositoryVariableShape, type VariableInfo } from "./RepositoryVariable.ts";
export { RateLimitSnapshot, RetryPolicy, type RetryableFailure } from "./Resilience.ts";
export type {
	Data as RestData,
	Item as RestItem,
	PaginatingRoute as RestPaginatingRoute,
	Params as RestParams,
	RequestExtras as RestExtras,
	Response as RestResponse,
	Route as RestRoute,
} from "./Rest.ts";
export { PageOptions } from "./Rest.ts";
export { Ruleset, type RulesetInfo, RulesetPayload, type RulesetShape } from "./Ruleset.ts";
export {
	ExtraPermission,
	PermissionGap,
	PermissionLevel,
	PermissionResult,
	TokenPermissionError,
	TokenPermissions,
} from "./TokenPermissions.ts";
export {
	type PollOptions,
	WorkflowDispatch,
	type WorkflowDispatchShape,
	type WorkflowInfo,
	WorkflowRunStatus,
} from "./WorkflowDispatch.ts";
