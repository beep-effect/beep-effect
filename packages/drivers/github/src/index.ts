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
 * import { GitHubClient } from "@beep/github/GitHubClient";
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
 * @since 0.0.0
 */

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
export { CodeScanning, CodeScanningSetup, type CodeScanningShape } from "./CodeScanning.ts";
export {
  DeploymentEnvironment,
  DeploymentEnvironmentInfo,
  type DeploymentEnvironmentShape,
} from "./DeploymentEnvironment.ts";
export { BranchOutcome, GitBranch, type GitBranchShape } from "./GitBranch.ts";
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
  AppCredentials,
  AppIdentity,
  assertPermissions,
  BotIdentity,
  GitHubApp,
  GitHubAppError,
  GitHubAppOptions,
  type GitHubAppShape,
  Installation,
  InstallationToken,
  PermissionName,
  RepositoryName,
  TokenRequest,
} from "./GitHubApp.ts";
export {
  GitHubClient,
  GitHubClientOptions,
  type GitHubClientShape,
  GitHubFixtures,
  RecordedCall,
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
  AppliedSettings,
  GitHubRepository,
  type GitHubRepositoryShape,
  GRAPHQL_ONLY_SETTINGS,
  OwnerType,
  type RepositoryPatch,
  type RepositoryPatchDraft,
  type RepositorySettings,
  repositoryPatch,
  SECURITY_ANALYSIS_STATUS_FIELDS,
  transformSecurityAndAnalysis,
} from "./GitHubRepository.ts";
export {
  GitTag,
  type GitTagShape,
  LatestSemverOptions,
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
  UpsertedPullRequest,
} from "./PullRequest.ts";
export {
  CommentMarker,
  CommentRecord,
  PullRequestComment,
  type PullRequestCommentShape,
} from "./PullRequestComment.ts";
export { InvalidRepoRefError, Repo, RepoRef } from "./Repo.ts";
export { RepositorySecret, type RepositorySecretShape, SecretInfo, SecretScope } from "./RepositorySecret.ts";
export { RepositorySecurity, type RepositorySecurityShape } from "./RepositorySecurity.ts";
export { RepositoryVariable, type RepositoryVariableShape, VariableInfo } from "./RepositoryVariable.ts";
export { RateLimitSnapshot, RetryableFailure, RetryPolicy } from "./Resilience.ts";
export { PageOptions, RequestExtras as RestExtras } from "./Rest.ts";
export {
  DiffSide,
  isOutstanding,
  outstanding,
  ReviewThread,
  ReviewThreadActor,
  ReviewThreadComment,
  ReviewThreadNode,
  ReviewThreadPage,
  ReviewThreadPageInfo,
  type ReviewThreadShape,
  ReviewThreads,
} from "./ReviewThread.ts";
export { Ruleset, RulesetInfo, RulesetPayload, type RulesetShape } from "./Ruleset.ts";
export {
  ExtraPermission,
  PermissionGap,
  PermissionLevel,
  PermissionResult,
  TokenPermissionError,
  TokenPermissions,
} from "./TokenPermissions.ts";
export {
  PollOptions,
  WorkflowDispatch,
  type WorkflowDispatchShape,
  WorkflowInfo,
  WorkflowRunStatus,
} from "./WorkflowDispatch.ts";
export type {
  Data as RestData,
  Item as RestItem,
  PaginatingRoute as RestPaginatingRoute,
  Params as RestParams,
  Response as RestResponse,
  Route as RestRoute,
} from "./Rest.ts";
