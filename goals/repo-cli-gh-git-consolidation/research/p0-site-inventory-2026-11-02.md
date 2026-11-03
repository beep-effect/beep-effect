# P0 site inventory: repo-cli gh/git consolidation

Read-only survey of the checkout at origin/main `7ae3f01401` (the W0 base), 2026-11-01, by a Claude Opus 5.5 research subagent. All repo paths below are repo-relative;
`R` = `packages/tooling/tool/cli/src`, `A` = `packages/tooling/library/ai-metrics/src`. Line numbers are from this head.

Headline findings, before the tables:

1. The site list (copied from the 2026-10-20 promotion map) is partly stale. repo-cli's `internal/github/` already wraps
   `@beep/github`: `GithubRest` (`R/internal/github/GithubRest.ts:346,594`), `GithubGraphql.readGithubReviewThreads`
   (`GithubGraphql.ts:181`), `GraphqlBudget` (`GraphqlBudget.ts:273,343`) and `GithubIdentity.layerGithubClientFor`
   (`GithubIdentity.ts:310`) all build on `GitHubClient`. `Yeet/internal/GhOps.ts` consumes them through `layerYeetGh`
   (`GhOps.ts:557`). Rows #77, #84 and #281 are therefore "already on the kit; the remaining question is where the
   repo-cli-local wrappers belong", not "gh-CLI surface".
2. The genuine gh-CLI surface is still large: 12 `runRepoCommandCapture("gh", ...)`, 12 `ghOutput(...)`, 11 `yeetGh(...)`
   and 5 `capture("gh", ...)` call sites under `R/commands/Yeet`, plus Ci (3 files) and Reviewer (1 file). All of them
   ride the gh CLI's own credential (its login), which is the one behaviour the kit cannot reproduce without a gh-token
   client (see gap G1).
3. The git side has two owners today: `R/internal/repo-run/GitExec.ts` (1096 lines, adapter-shaped, fail-closed NUL
   parsers, 8 MiB bound) and about a dozen group-private wrappers over `runRepoCommandCapture`/`runCaptured`. Three sites
   already use `@beep/git` (R10: `Skills/internal/MergeBase.ts`, `internal/repo-run/GitWorktree.ts`,
   `Yeet/internal/ProvenanceFooter.ts`) via leaf `Effect.provideServiceEffect(Git, Git.make)`.
4. `@beep/commands` is NOT a dependency of repo-cli or ai-metrics (`packages/tooling/tool/cli/package.json:200-201` lists
   only `@beep/git` and `@beep/github`). The test sweep needs that dependency added (devDependency is enough for tests).
5. `Git.isAncestor` does not exist. Nothing in `GitShape` (`packages/drivers/git/src/Git.ts:1907-3399`) or `GitCommand.ts`
   mentions `--is-ancestor`; the closest member is `mergeBaseOption` (`Git.ts:2606`).

## 1. KIT SURFACE

### 1a. `@beep/git` (`packages/drivers/git/src`)

`GitShape` members (`Git.ts:1907-3399`), one per line, data-first/data-last `dual` overloads omitted:

| Member | Line | Purpose (five words) |
| --- | --- | --- |
| add | 1912 | stage paths for next commit |
| branchCreate | 1942 | create branch, optional checkout/force |
| branchDelete | 1967 | delete local branch (-d/-D) |
| branchList | 1983 | list branches as BranchEntry |
| changedFiles | 2000 | `diff --name-only -z base...head` |
| checkIgnore | 2022 | ignored subset via stdin NUL |
| checkout | 2039 | move tree to existing ref |
| clean | 2064 | delete untracked, forced, scoped |
| commit | 2087 | create commit with message |
| commitInfo | 2112 | sha/author/dates of one commit |
| commonDir | 2135 | `rev-parse --git-common-dir` |
| configGet / configGetAll / configList / configRemoveSection / configRenameSection / configSet / configUnset | 2147-2289 | typed `git config` read/write |
| currentBranch | 2305 | current branch name or none |
| defaultBranch | 2313 | remote HEAD default branch |
| fetch / fetchAny / fetchUnshallow | 2346-2410 | network fetch variants, typed |
| forEachRef | 2424 | `for-each-ref` as RefEntry |
| isShallow | 2446 | `rev-parse --is-shallow-repository` |
| log | 2476 | commits with paths, pathspec, follow |
| lsFiles | 2513 | index entries, optional pathspec |
| lsRemote | 2539 | remote refs over network |
| lsTree | 2564 | tree entries at ref, pathspec |
| mergeBase | 2584 | common ancestor, loud on none |
| mergeBaseOption | 2606 | common ancestor as Option probe |
| mv | 2622 | rename tracked path |
| nameStatus | 2640 | `diff --name-status -z` entries |
| pull | 2670 | fetch and integrate, typed conflicts |
| push | 2708 | push with NonFastForward typing |
| refExists | 2732 | ref presence boolean |
| remoteAdd / remoteRemove / remoteSetUrl / remoteUrl | 2741-2779 | remote management and `get-url` |
| repoRoot | 2799 | `rev-parse --show-toplevel` |
| reset / restore | 2818-2845 | index/tree reset and restore |
| revList | 2869 | commit shas, limit, first-parent |
| revParse | 2881 | `rev-parse --verify <ref>` full sha |
| rm | 2891 | remove paths, cached/recursive |
| show | 2911 | file at ref as Option |
| sparseCheckoutSet | 2927 | set sparse-checkout patterns |
| stagedChanges / unstagedChanges / untrackedFiles / workingChanges | 2939, 3304, 3314, 3332 | path lists for the three dirty axes and their union |
| stashApply / stashDrop / stashList / stashPop / stashPush | 2954-3027 | stash lifecycle |
| status | 3043 | `status --porcelain -z` StatusEntry |
| submodule* (Absorbgitdirs, Add, Deinit, Foreach, Init, SetBranch, SetUrl, Status, Sync, Update) | 3051-3235 | submodule management |
| tagCreate / tagDelete / tagList | 3266-3294 | tag lifecycle |
| worktreeAdd | 3346 | add worktree, ref/detach/force |
| worktreeList | 3369 | `worktree list --porcelain -z` entries |
| worktreeRemove | 3377 | remove worktree, optional force |

Statics: `Git.make` (`Git.ts:3537`, the leaf-provision form R10 added), `Git.layer` (3561), `Git.makeTest` (3607),
`Git.layerTest` (3717).

Models (`Git.models.ts`): `StatusEntry {x, y, path, origPath}` (322-334), `NameStatusEntry {status, path, oldPath}`
(98-111; the similarity score digits are dropped, `parsers.ts:140-143`), `CommitLogEntry {sha, authoredAt, committedAt,
authorName, authorEmail, paths}` (202-218 plus `paths` from `parsers.ts:235`; NO per-path status),
`WorktreeEntry {path, head, branch, detached, bare, locked}` (732-756; no `prunable`).

How the kit handles the four gap axes today:

- Output bounding: none. `internal/run.ts:72-91` collects stdout and stderr with `Stream.mkString` (unbounded) and the
  only limit is a 30 s wall clock (`internal/classification.ts:303-312`, `GIT_TIMEOUT`, answered as
  `GitCommandError{kind:"failed", detail:"timed out after 30s"}`). There is no `maxOutputBytes`, no truncation flag and
  no `tooLarge` error. Compare repo-cli: `StepExec.repoRunOutputBound` 512 KiB (`R/internal/process/StepExec.ts:294-296`),
  the GitExec filename inventory bound 8 MiB (`R/internal/repo-run/GitExec.ts:373`), and `@beep/commands`
  `DEFAULT_MAX_OUTPUT_BYTES` 16 MiB (`packages/drivers/commands/src/Run.ts:62`) with `CommandOutputError{kind:"tooLarge"}`
  (`Run.ts:654-675`).
- Parsing failures: fail-OPEN everywhere except `parseLog`. `parseNameStatus` (`parsers.ts:156-171`) and
  `nameStatusEntryAt` (124-137) substitute `""` for a missing path token and `"unknown"` for an unrecognised letter;
  `parseStatus` (330+) skips empty tokens and never reports a malformed record; `parseWorktreeList`, `parseLsTree`,
  `parseLsFiles` likewise return whatever decodes. Only `parseLog` (`parsers.ts:260`) returns
  `Result<ReadonlyArray<CommitLogEntry>, string>` and the service fails it closed. Compare repo-cli's
  `gitTreeEntriesFromNulOutput` / `gitRenameEntriesFromNulOutput` (`GitExec.ts:96-110, 166-190`): `O.none()` on a missing
  trailing NUL, an unparseable record, or a record-count mismatch; callers turn `None` into a typed error
  (`readGitRenames` at 787, `readGitTree` at 772). Several sites depend on that (ExpectationRewrite, KnowledgeDoctor).
- Rename detection: `GitCommand.nameStatus` (`GitCommand.ts:343-352`) is `diff --name-status -z (--relative|--no-relative)
  [base | base...head]`. No `-M<score>` / `--find-renames=<n>`, no `--diff-filter`, no `--no-renames`, and no pathspec.
  repo-cli's `readGitRenames` needs `--find-renames=50%` and a trailing `-- ...pathspec` (`GitExec.ts:801`).
- Pathspec: only `log`, `lsFiles`, `lsTree`, `clean`, `add`, `rm`, `checkIgnore` take paths. `changedFiles`
  (`GitCommand.ts:205-206`), `nameStatus`, `stagedChanges`/`unstagedChanges` (209-214), `status` (453: fixed
  `status --porcelain -z`, no `--untracked-files=all`, `--ignore-submodules=none`, `--no-renames`, `-uall`) and
  `untrackedFiles` take none. Sites need `--diff-filter=ACMR` + `-- *.ts ...` (`R/commands/Quality/Quality.command.ts:1412-1425`),
  `--no-renames` (`ChangedFiles.ts:155`, `Settle.ts:512`, `TmpfsReap.ts:814`), `-- goals/` (`Retire.ts:511`).
- Also absent: `merge-base --is-ancestor`, `worktree prune`, `git grep`, `ls-files --error-unmatch`, the
  `--no-optional-locks` / `--literal-pathspecs` / `-c core.quotePath=false` global flags, `update-ref -d`, `show-ref
  --verify`, `rev-parse --abbrev-ref --symbolic-full-name @{u}`, `archive`, `rev-parse --git-path`,
  `rev-parse --path-format=absolute --show-toplevel --absolute-git-dir --git-common-dir` (multi-value), `cat-file -e`,
  `init --bare`, `switch`, `log --name-status --diff-filter=DR -M` (per-path status in log), `commit --allow-empty --only
  --no-verify`.
- Errors (`Git.errors.ts`): `GitCommandError` (59), `NotARepositoryError` (159), `UnknownRefError` (206),
  `NonFastForwardError` (267), `MergeConflictError` (334), `DirtyWorktreeError` (393), `NotStubbedError` (444).
- `isAncestor`: ABSENT (rg over `Git.ts`, `GitCommand.ts`, `parsers.ts` for `isAncestor|is-ancestor` is empty).

### 1b. `@beep/github` (`packages/drivers/github/src`)

Services and modules (barrel `index.ts`): `GitHubClient` (client core), `GitHubApp` (App auth), `PullRequest`,
`PullRequestComment`, `CheckRun`, `WorkflowDispatch`, `GitHubIssue`, `GitHubRepository`, `GitBranch`, `GitCommit`,
`GitHubCommit`, `GitTag`, `GitHubContent`, `GitHubRelease`, `Ruleset`, `RepositorySecret`, `RepositoryVariable`,
`RepositorySecurity`, `CodeScanning`, `DeploymentEnvironment`, `Attestation`, `ArtifactMetadata`, `TokenPermissions`,
`Resilience` (`RetryPolicy`, `RateLimitSnapshot`), `Rest` (`PageOptions`, `RequestExtras`), `GraphQL`
(`GraphQLDocument`, `GitHubGraphQLError`), `Repo`/`RepoRef`, `GitHubError`.

Authentication:

- `GitHubClientShape` (`GitHubClient.ts:77-190`): `graphql`, `paginate`, `paginateStream`, `rateLimit`, `request`,
  `requestDecoded`. Layers: `layerFromToken({token: Redacted})` (544), `layerFromConfig(name = "GITHUB_TOKEN")` (570),
  `layerTest` (633), `layerFixture` (662, recorded `GitHubFixtures`).
- `GitHubApp` (`GitHubApp.ts:838`): shape `{token, scopedToken, revoke, identity, installations}` (1000-1029).
  `token(TokenRequest)` mints `POST /app/installations/{id}/access_tokens` (725) with an EMPTY body: `TokenRequest`
  is `{installationId?, owner?}` only (226-241). `InstallationToken.permissions` records what GitHub granted (309-312),
  and `TokenPermissions` (TokenPermissions.ts:298) compares granted vs required. `GitHubApp.clientLayer({appId,
  privateKey, installationId})` builds a `GitHubClient` on a minted token (used by `R/internal/github/GithubIdentity.ts:329`).
- `Ruleset` (`Ruleset.ts:223`): `delete`, `roleId`, `teamId`, `upsert(RulesetPayload)` (151-177) over `Repo`.
- `PullRequest` (`PullRequest.ts`): `addLabels`, `create`, `get`, `list`, `listAssociatedWithCommit`, `listFiles`,
  `merge`, `requestReviewers`, `setAutoMerge`, `update`, `upsert` (256-576); `markReadyForReview` GraphQL document at 215-223.
- `PullRequestComment` (`PullRequestComment.ts:240`): issue-comment `create`, `delete`, `find`, `upsert` with a
  `CommentMarker` (54). This is issue comments, not review threads.
- `GitHubIssue` has `linkedIssues` via GraphQL (326) and `isCrossReferencedBy`.

Three asked-for features:

- Review-thread (GraphQL `reviewThreads`) resource: ABSENT from the kit (rg `reviewThreads|ReviewThread|isResolved`
  over `packages/drivers/github/src` is empty). repo-cli carries FOUR copies of the query: `GithubGraphql.reviewThreadsPageDocument`
  (`R/internal/github/GithubGraphql.ts:142-145`, already a `GraphQLDocument` over `GitHubClient.graphql`),
  `Status.reviewThreadsQuery` (`Status.ts:626-627`, `node(id:)` form via `gh api graphql`), `WatchMode.ts:245`
  (same `node(id:)` form via gh), `MergeGate.ts:983` (via `yeetGh`), and `closeout/Gh.schemas.reviewThreadsPageQuery`
  (`Gh.schemas.ts:1113-1117`, via gh in GhCollect; `Reply.ts:198` embeds another).
- Down-scoped App installation token (`repositories` + `permissions` body): ABSENT. `GitHubApp.token` posts no body
  (`GitHubApp.ts:725`); `TokenRequest` has no `permissions`/`repositories` fields. `R/commands/Reviewer/GitHubAppAuth.ts:208-227`
  needs `{repositories:["beep-effect"], permissions:{checks:"write", pull_requests:"write", issues:"write",
  contents:"read", metadata:"read"}}`.
- gh-CLI-token-backed client: ABSENT from the kit (rg `gh auth|"gh"` over the three kits is empty). repo-cli has it
  locally: `GithubIdentity.layerGithubClientFor` spawns `gh auth token` through `runRepoCommandCaptureRaw`
  (`GithubIdentity.ts:347,252`) and hands the result to `GitHubClient.layerFromToken` (348). Identity order:
  `--token-ref` > `BEEP_GH_TOKEN_REF` (1Password `op read`) > `BEEP_GH_APP_*` triple (App) > `gh auth token`
  (`GithubIdentity.ts:180-240`). `layerGithubRepoFor` spawns `git remote get-url origin` (405).

### 1c. `@beep/commands` (`packages/drivers/commands/src`)

- `Run` (`Run.ts:1188`): `collect` (865: `(command, options?) => Effect<CommandOutput, CommandFailedError |
  CommandOutputError, ChildProcessSpawner>`), `collectTee` (884), `text` (912), `lines` (931), `json(command, schema)`
  (954), `jsonLine` (985), `exitCode` (1047), `succeeds` (1067, `Effect<boolean, never>`), `detach` (1087), `stream`
  (1104), `extendEnv`, `DEFAULT_MAX_OUTPUT_BYTES` = 16 MiB (62), `REDACTED`. `RunOptions {timeout?, redact,
  maxOutputBytes?}` (189-284). Errors: `CommandFailedError.nonZero / .spawn / .timedOut` (402-549),
  `CommandOutputError{kind: "notJson" | "schema" | "tooLarge"}` (654-675). This is the bounded-output and
  truncation-signal primitive the git kit lacks.
- `ScriptedSpawner` (`ScriptedSpawner.ts`): class with private constructor (410-413) holding `layer:
  Layer<ChildProcessSpawner>` (428) and `spawns: ReadonlyArray<SpawnRecord>` (450). `ScriptedSpawner.make(script:
  SpawnScript)` (481). `SpawnScript = (command, args) => ScriptResult.Encoded` (151) where `ScriptResult =
  PlatformError | ScriptCompletion{stdout?, stderr?, exit?, hang?}` (62-118; `{}` scripts a silent success, `hang: true`
  never resolves `exitCode`). `SpawnRecord {command, args, cwd, env, extendEnv, options, unrefed}` (314-340).
  Helpers `ScriptedSpawner.notFound(command)` (558) and `.permissionDenied(command)` (577) build `PlatformError`s.
  Piped commands die with `ScriptedPipelineError` (`make` body 415-425). Tests provide it with
  `Effect.provide(spawner.layer)` and assert on `spawner.spawns`.
  Limitation vs the hand-rolled fakes: the script sees `(command, args)` only, not `options` (cwd/env/stdin), while
  `packages/drivers/git/test/fixtures.ts:29` and `packages/drivers/tailscale/test/tailscale.test.ts:88-90` pass
  `command.options` to the handler; argv-order assertions move to `spawns`.

## 2. SITE TABLE

Helper legend. `RRC` = `runRepoCommandCapture` (`R/internal/repo-run/RepoRun.executor.ts:108`, 512 KiB bound via
`StepExec.repoRunOutputBound`, returns `{exitCode, output, truncated}`); `RRCraw` = `runRepoCommandCaptureRaw`
(178, untrimmed); `SE` = `StepExec.runCaptured` / `runCapturedStreams` (`R/internal/process/StepExec.ts:750`);
`GX` = `R/internal/repo-run/GitExec.ts` adapter runners (`runGitOutput` 424, `runGitPathList` 472, `runGitLines` 514,
`runGitRawOutput` 525, `runGitFoldedStdout` 576, `resolveGitCommit` 594, `resolveGitMergeBase` 607, `readGitTree` 772,
`readGitRenames` 787, `collectStaged/Unstaged/UntrackedPaths` 832-905, `currentBranch` 948, `ensureOriginMain` 992,
`writeGitArchive` 710, `guardCloneLocalGitAttributes` 740); `YGX` = `R/commands/Yeet/internal/GitExec.ts`
(`YeetCommandError` adapter at 36-52 with `onTruncated` set, so truncation fails closed); `GhC` = `ghOutput`
(`R/internal/github/GhCommand.ts:95`, fails on non-zero AND on truncation, 118-120); `GhCall` = `yeetGh` /
`decodeYeetGhOutput` (`R/commands/Yeet/internal/GhCall.ts`, wraps `GhC` into `YeetCommandError`);
`GhOps` = `withYeetGh`/`layerYeetGh` (`GhOps.ts:557-610`, kit-backed).

Importer blast radius (rg, `R/` prefix dropped, `index.ts` barrels excluded):

- `ghOutput`: Yeet/internal/{Sweep, Status, GhCall, Retire, Reply, ReadyGate, PullRequest, Merge,
  closeout/GhCollect}, Ci/{RouteCorpus, CiRerunRunnerLoss}, Worktree/Worktree.service, Goals/CompletionEvidence (13).
- `ghGraphqlPage`: Yeet/internal/{Status, Reply, closeout/GhCollect}. `collectTruncatableThreadPages`: Reply, GhCollect.
- `yeetGh` / `decodeYeetGhOutput`: Yeet/internal/{SquashCommitlint, MergeGate}.
- `withYeetGh`: Yeet/internal/ReadyGate. `GithubRest`/`readGithubReviewThreads`: GhOps only.
  `layerGithubClientFor`: GhOps, Cache/Cache.workflow.github.
- `reviewerGh`: Reviewer/ReviewerRuleset only. `GitHubAppAuth`: Reviewer/{ReviewerService, ReviewerCommand}.
- GX `runGitOutput`: Yeet/internal/{Handler, ReadyGate, GitExec, PullRequestTitle, PullRequest, PublishScope,
  FinalCheckRefresh, ProvenanceFooter, FinalCheck, Provenance, ProofState, MergedPreview}, Holds/Holds.command,
  Goals/{Doctor, CompletionEvidence}, Worktree/Worktree.service, Session/SessionLedger.service (17).
- GX `runGitPathList`: Yeet/internal/{PullRequest, GateStaleness, PublishScope, FinalCheckRefresh, FinalCheck,
  ExpectationRewrite, GitExec, PortfolioIndexGuard}, Lint/OpaqueRoundtrips, Knowledge/KnowledgeDoctor.service (10).
- GX `runGitLines`: Knowledge/Knowledge.service, repo-run/ChangedFiles, Ci/CiOperational.service,
  Docgen/internal/{Doctest, quality/Quality.scope}, Quality/{CheckCensus, internal/PackageVerify,
  internal/JSDocRatchet, internal/JSDocDocumentationInventory} (9).
- GX `runGitRawOutput`: Worktree/Worktree.service, Quality/Quality.command, Lint/internal/EffectSchemaInventorySource,
  Ci/RouteClassify, Laws/{SchemaTagIdioms, internal/TrackedTextFiles}, Quality/internal/CoverageRegression (7).
- GX `resolveGitCommit`: Ci/RouteClassify, Knowledge/{KnowledgeDoctor.service, Knowledge.service},
  Quality/{CheckCensus, internal/CoverageRegression}, Worktree/Worktree.service. `resolveGitMergeBase`:
  Knowledge x2, CoverageRegression. `readGitTree`: Knowledge x2. `readGitRenames`: Yeet/ExpectationRewrite, Knowledge x2.
- GX `collectUntrackedPaths`: Yeet/{PublishScope, Handler, GitExec, GateStaleness}, Worktree.service.
  `currentBranch`/`ensureOriginMain`: Quality/Quality.command (+ YGX). `writeGitArchive`,
  `guardCloneLocalGitAttributes`: Knowledge.service.
- YGX exports (`collectStagedPublishPaths`, `collectUnstagedTrackedPaths`, `refreshBaseRef`, `currentYeetBranch`,
  `currentCommitSha`, `lockfileChangedSinceBase`): Yeet/internal/{Handler, PublishScope, GateStaleness, ProofState}.
- `RRCraw`: internal/github/GithubIdentity, Ci/RouteCensus.

### 2a. gh-CLI rows (17)

**#74 / #124 / #303 `R/commands/Reviewer/GitHubAppAuth.ts` (258 lines).** Hand-rolled GitHub App auth: PKCS#1 to
PKCS#8 DER wrap with `Buffer` (180-191), WebCrypto RS256 JWT (194-207), `HttpClientRequest.post
.../app/installations/{id}/access_tokens` with `{repositories:["beep-effect"], permissions:{...}}` (208-227), cached
with 5-minute skew under a semaphore (230-241). Two non-gh spawns: `op read 'op://BEEP_SECRETS/beep-reviewer GitHub
App/<field>'` or `ssh -o BatchMode=yes -- <host> op read ...` (`secretRead`, 47-60) and `op-doctor` on failure (66-69),
both raw `ChildProcess.make` with `stderr: "ignore"`. No `gh` or `git` spawn in this file. Errors: `ReviewerError`
(kinds `jwt`, `token`). Kit replacement: `GitHubApp.token` / `GitHubApp.clientLayer` (`GitHubApp.ts:725, 838`).
GAP: installation token with `permissions` + `repositories` down-scope (G2). Spawns: `Run.text` with
`RunOptions.redact` (promotion map #124's own recommendation). Difficulty M. Recommendation: migrate after G2; move the
`op`/`ssh` spawns onto `Run.text` in the same PR (same owner, `Reviewer`), keep `op-doctor` as a `Run.exitCode` call.
Parity to record: minted-token permissions set equals the hand-rolled body (compare `InstallationToken.permissions`),
refresh-before-expiry behaviour, the `jwt`/`token` error kinds on bad PEM / HTTP != 201.

**#75 `R/commands/Reviewer/ReviewerService.ts` (377 lines).** No gh/git spawn. Raw `HttpClient` against
`https://api.github.com/repos/beep-effect/beep-effect` (27, 173-184) with the `GitHubAppAuth` token: `GET /pulls/{n}`,
`/commits/{sha}/pulls`, `/pulls/{n}/files`, `GET/POST/PATCH /check-runs`, `/issues/{n}/comments` (193-357). Errors:
`ReviewerError`. Kit replacement: `PullRequest.get/listAssociatedWithCommit/listFiles`, `CheckRun.create/update/get`,
`PullRequestComment.upsert` with a `CommentMarker`, all over a `GitHubApp.clientLayer`. GAP: none beyond G2 (the token).
Difficulty M (page-walk semantics and the editable-summary comment must keep `commentOnce`-style identity).
Recommendation: migrate after G2, one PR, parity = recorded `GitHubFixtures` replay of the existing
`reviewer-bootstrap.test.ts` calls.

**#76 / #247 `R/commands/Reviewer/ReviewerRuleset.ts` (466 lines).** `reviewerGh(args, input?)` (141-161): raw
`ChildProcess.make("gh", args, {stdout:"pipe", stderr:"ignore", stdin?})`, unbounded `Stream.mkString`, any non-zero
exit folded to one `ReviewerError{operation:"ruleset"}`. Argv: `["api", <path>]` (164), `["api", "user", "--jq",
".login"]` (245, must equal `kriegcloud`, 247), `["api", "--method", "PUT", <rulesets path>, "--input", "-"]` with the
JSON body on stdin (290). Kit replacement: `Ruleset.upsert` / `GitHubClient.request("GET /user")`. GAP: this site
deliberately uses the HUMAN gh login (the operator's account, which holds repository administration) and checks the
login name; the kit has no gh-token client (G1). Difficulty S once G1 exists. Recommendation: KEEP until G1 lands,
then migrate with `GitHubClient` from a gh-token source and an explicit login assertion. Reason wording if it stays:
"Ruleset administration must run as the operator's gh login (admin permission); the kit has no gh-credential client."

**#77 `R/internal/github/GithubGraphql.ts` (202 lines).** Already kit-backed: `GraphQLDocument.make` documents
(`markPullRequestReadyDocument` 68, `reviewThreadsPageDocument` 142) executed with `GitHubClient.graphql` (189), paged
by hand on `pageInfo` (181-197), errors mapped by `graphqlErrorToGitHubError` (50). No spawn. Kit replacement: a
`ReviewThread` service in `@beep/github` (G3) would absorb `GithubReviewThreadNode`, `GithubReviewThreads` and the
page walk; `PullRequest` already owns `markReadyForReview`. Difficulty S. Recommendation: migrate after G3 (promote
this file's document and schemas into the kit; delete the local copy).

**#83 `R/internal/github/GhCommand.ts` (324 lines).** gh plumbing over `RRC`: `ghOutput` (95, fails on non-zero and on
truncation), `cursorArgs`/`nextCursor` (136, 163), `ghGraphqlPage` (225: `gh api graphql -f query=... -F ...`),
`collectTruncatableThreadPages` (302: walks pages, warns on threads whose `comments.pageInfo.hasNextPage`). Error type is
caller-supplied (`GhCommandFailure {spawn|nonzero-exit|truncated}`, 47). 13 importers (above). Kit replacement:
`GitHubClient.graphql` + `paginate` for the page walk; `Run.text` is not needed once the gh spawn is gone. GAP: G1 (every
caller inherits the gh login) and G3. Difficulty L (blast radius). Recommendation: last to delete; shrinks as each Yeet
site moves to `GithubRest`/`ReviewThread`.

**#84 `R/internal/github/GithubRest.ts` (597 lines).** Already kit-backed: `GithubRest` service (346) over
`GitHubClient` + `Repo` (`layerGithubRest` 594) with `addLabels`, `cancelWorkflowRun`, `checkRuns`,
`createIssueComment`, `hasReviewComments`, `headFirstReceivedAt`, `mergePullRequest`, `openPullRequestForBranch`,
`pullRequest`, `rateLimit`, `removeLabel`, `requiredStatusContexts`, `rerunFailedJobs`, `reviewTimeline`,
`updatePullRequest`, `workflowRunsForSha` (266-346). No spawn. Several members duplicate kit services (`PullRequest.
addLabels/merge/update/get`, `CheckRun`, `WorkflowDispatch.runStatus`). Difficulty M. Recommendation: KEEP as the
repo-cli facade for now (it IS the kit path); fold members onto `PullRequest`/`CheckRun` where the record shapes
match, one member group per PR, after the Yeet sites below have moved onto it. Reason wording: "repo-cli-local facade
over `@beep/github`; not a hand-rolled spawn."

**#78 `R/commands/Yeet/internal/Status.ts` (2201 lines).** git via `RRC` (694: `runGitPaths`, argv `["diff",
"--cached", "--name-only", "-z"]` and `["diff", "--name-only", "-z"]` at 719-720) and gh via `RRC` and `GhC`: `["pr",
"checks", ("--required")?, "--json", YEET_STATUS_CHECK_FIELDS]` (1019), `["api", "graphql", "-f", "query=...node(id:)
reviewThreads...", "-F", "id=...", ("-F", "cursor=...")?]` paged by hand (1053-1080, with a fallow-ignore note at 1053
saying "move onto ghGraphqlPage"), `["run", "list", "--branch", <branch>, "--limit", "20", "--json",
"databaseId,headSha,status,conclusion,name"]` (1166, failures swallowed to exit 1), `["pr", "view", ...]`, `["api",
"repos/{owner}/{repo}/pulls/<n>"]`, `["api", "repos/{owner}/{repo}/pulls/<n>/comments?per_page=1"]` (1434-1501).
Errors: `YeetCommandError`. Kit replacement: `Git.stagedChanges`/`Git.unstagedChanges`; `GithubRest.checkRuns`,
`GithubRest.pullRequest`, `GithubRest.hasReviewComments`, `GithubRest.workflowRunsForSha`, and G3 for threads.
GAPS: G1 (gh login), G3 (review threads), and `gh pr checks --required` has no REST twin (it merges check-runs,
statuses and required contexts: `GithubRest.requiredStatusContexts` + `checkRuns` cover it). Difficulty L.
Recommendation: migrate after G1+G3; git half can move now onto `Git.stagedChanges/unstagedChanges` (parity:
`-z` path lists equal).

**#79 `R/commands/Yeet/internal/WatchMode.ts` (1158 lines).** gh via `RRC`: `["pr", "checks", ("--required")?,
"--json", "name,state,bucket,link,workflow,description"]` (257-262), `["api", "graphql", "-f", "query=<node(id:)
reviewThreads>", "-F", ...]` paged by hand (336-348, query at 245), `["pr", "view", "--json",
"id,number,state,isDraft,isCrossRepository,mergeable,mergeStateStatus,reviewDecision,headRefOid,labels"]` (428-437).
Errors: `YeetCommandError`. Replacement: `GithubRest.pullRequest` + `checkRuns`, G3. GAP: G1, G3; `mergeStateStatus`
is GraphQL-only in REST v3 (`mergeable_state` string is the REST twin and `GithubPullRequestRecord` already decodes a
PR record, check it carries it). Difficulty M. Recommendation: migrate after G1+G3, in the same PR as #78 (shared
query and check-field decoding).

**#80 `R/commands/Yeet/internal/MergeGate.ts` (1425 lines).** gh via `GhCall.yeetGh`: `["api",
"repos/{owner}/{repo}/pulls/<n>"]` (1020), `["api", <check-runs path>, "--paginate", "--slurp"]` (1026), `["api",
"graphql", "-f", "query=<reviewThreads by owner/name/number>", "-F", "owner={owner}", ...]` (1034, query 983),
`["api", "-X", "PUT", <merge path>, "-f", "merge_method=squash", "-f", ...]` (1137), `["api", "-X", "POST", <comments
path>, "-f", ...]` (1219), `["api", <runs path>, "--paginate", "--slurp"]` (1236), `["api", "-X", "POST", <cancel
path>]` (1258). Errors: `YeetCommandError`, plus `decodeYeetGhOutput` schema failures. Replacement: `GithubRest.
pullRequest/checkRuns/mergePullRequest/createIssueComment/workflowRunsForSha/cancelWorkflowRun` (all exist, 266-346)
and G3. Note `GhOps.decideYeetGhMergeGate` + `countOutstandingThreads(GithubReviewThreads)` (`GhOps.ts:446, 490`)
already implement the kit-backed `yeet gh merge-gate` twin. GAP: G1, G3. Difficulty M (two implementations of the same
gate exist; pick one). Recommendation: migrate after G1+G3 by deleting the gh path in favour of `GhOps.runYeetGhMerge`
(1020) and recording a differential between the two gate verdicts over fixture PR states.

**#81 `R/commands/Yeet/internal/closeout/GhCollect.ts` (383 lines).** gh via `GhC` (77) and a local `ghGraphqlPage`
(128, `gh api graphql`) for three paged queries: comments, `reviewThreadsPageQuery` (`Gh.schemas.ts:1113`), reviews
(169-223), collected with `collectTruncatableThreadPages` (194). Errors: closeout error type via `onFailure`.
Replacement: `GitHubClient.graphql` + `paginate`; G3. GAP: G1, G3. Difficulty M. Recommendation: migrate after G3.

**#82 `R/commands/Yeet/internal/Reply.ts` (1432 lines).** gh via `GhC` (884, `replyGhFailure`) and
`ghGraphqlPage`/`collectTruncatableThreadPages` (1000-1013) with its own `reviewThreads` query (198). Replies and
resolves threads through `gh api graphql` mutations. Errors: `YeetCommandError`. Replacement: G3 (`ReviewThread.list /
reply / resolve`). GAP: G1, G3 (mutations `addPullRequestReviewThreadReply`, `resolveReviewThread`). Difficulty L.
Recommendation: migrate after G3; parity = `yeet-reply-engine.test.ts` replies/resolutions identical over fixtures.

**#85 `R/commands/Skills/Skills.command.ts` (1796 lines).** No gh or git spawn in this file or anywhere under
`R/commands/Skills` (rg for `"gh"`, `"git"`, `ghOutput`, `ChildProcess.make` is empty; `Skills/internal/MergeBase.ts`
already uses `@beep/git`, R10). The GitHub tree API is fetched over `HttpClient` (233-234). Recommendation: KEEP, row
is stale. Reason wording: "no gh or git spawn; GitHub reads go through HttpClient (skills-lock fetch), outside this
goal's scope."

**#248 `R/commands/Ci/LaneTimings.ts` (3456 lines).** gh via `RRC` in `ghApiJsonAttempt` (878-900: `["api",
<endpoint>, ("--jq", ...)?]`), with a hand-rolled transient classifier and retry schedule (`CiGhApiTransientExit`,
exponential with jitter, 861-870); truncated capture fails (891). Errors: `CiCommandError`. Replacement:
`GitHubClient.paginate/requestDecoded` + `Resilience.RetryPolicy`/`RateLimitSnapshot`. GAP: G1 (gh login in CI
runners, where `gh` carries `GITHUB_TOKEN`; `GitHubClient.layerFromConfig` reads `GITHUB_TOKEN` directly, so this site
may NOT need G1). Difficulty M. Recommendation: migrate now onto `GitHubClient.layerFromConfig` where the command runs
under Actions; record the parity as recorded fixtures of the timings endpoints and the transient-retry decisions.

**#249 `R/commands/Ci/CiGovernance.ts` (772) and `Ci/CiRerunRunnerLoss.ts` (491).** CiGovernance:
`GithubPolicyClient` (233) over `RRC("gh", ["api", ...args])` (240) reading `repos/{owner}/{repo}/rulesets/10240248`
(617), `.../environments/professional-desktop-release` (653), `.../actions/workflows/check.yml/runs?...` (669),
`.../actions/runs/<id>/pending_deployments` (678), plus a `write` arm (`--method PUT` payloads). Errors:
`CiCommandError` ("state is unknown" on truncation or non-zero, 248-252). CiRerunRunnerLoss: `GhC` for `gh run rerun
...` (352-364). Replacement: `Ruleset`, `DeploymentEnvironment`, `WorkflowDispatch.runStatus`, `GithubRest.
rerunFailedJobs`. GAP: G1 for local runs (the governance command is operator-run with the gh login). Difficulty M.
Recommendation: migrate after G1; `GithubPolicyClient` is already a service boundary, so swap its implementation.

**#250 Yeet gh-CLI surface (PullRequest, Planner, Merge, MonitorLoop, MonitorComments, Settle, ReadyGate, Retire,
Sweep, SquashCommitlint).** Argv found:
- `PullRequest.ts` (1092): `GhC` `["api", <pulls?head=...>, "--jq", "map({number, headRefName: .head.ref, ...})"]`
  (58-66), `["api", "repos/{owner}/{repo}", "--jq", ".default_branch"]` (108-115), `["api", "-X", "POST",
  "repos/{owner}/{repo}/pulls", "-f", ...]` (569-580), `["pr", "create", ("--draft")?, "--base", <base>, "--title",
  <title>, "--body-file", <path>]` (616-621), `["api", "-X", "PATCH", "repos/{owner}/{repo}/pulls/<n>", "-f",
  "title=...", "--jq", ".title"]` (676-683), `capture("gh", ["pr", "edit", <n>, "--title", <title>])` (711),
  `["api", "-X", "POST", <labels path>, "-f", ..., "--jq", 'map(.name) | join(",")']` (1029-1040); git via YGX
  `["remote", "get-url", "--push", "origin"]` (66), `["merge-base", <base>, "HEAD"]` (276), `["log", "--reverse",
  "--pretty=format:## %s%n%n%b", <range>]` (331), `["diff", "--name-only", "-z", "<base>...HEAD"]` (951).
- `Planner.ts` (1079): no spawn; builds `RepoPlanStep{command:"gh"|"git", args}` descriptors (205-220, 570-840) that
  `RepoRun.executeRepoPlanStep` (`RepoRun.executor.ts:256`) runs through `RRC`. gh steps: `pr create --draft ...`,
  `pr view --json ...` (663, 748, 795), `api graphql -f query=<yeet-closeout-review-query>` (762), `pr checks --json`
  (833); git step `status --short --branch` (781).
- `Merge.ts` (`GhC` `["pr", "view", <sel>, "--json", <fields>]` 134; `RRC` `["pr", "merge", <n>, "--squash",
  "--match-head-commit", <sha>]` 247-250), `MonitorLoop.ts` (`["run", "view", <id>, "--json", "jobs"]` 965, `["run",
  "view", "--job", <id>, "--log-failed"]` 1012, `SE` `["api", "--allow-escape-sequences", "repos/{owner}/{repo}/actions/
  jobs/<id>/logs"]` 1022, `["run", "rerun", "--job", <id>]` 1151), `MonitorComments.ts` (`capture("gh", ["api",
  "user", "--jq", ".login"])` 1141; `["api", "--method", "GET", <comments path>, "--paginate", "--slurp", "-f",
  "per_page=100"]` 1164-1175), `Settle.ts` (`["api", "repos/{owner}/{repo}/rules/branches/<base>"]` 358; `SE` git
  `["diff", "--name-only", "--no-renames", "-z", <range>]` 512), `ReadyGate.ts` (`GhC` `["pr", "view", <n>,
  "--json", "author", "--jq", ".author.login"]` 577; git YGX `["rev-parse", "HEAD"]`, `["commit", "--allow-empty",
  "--only", "--no-verify", "-m", ...]`, `["push", "origin", "HEAD:refs/heads/<branch>"]` 700-713; already calls
  `withYeetGh(O.none())` at 546 for the ready flip), `Retire.ts` (`GhC` `["pr", "view", <branch>, "--json",
  "files"]` 496; git `gitOutput` over `RRC` 52-63: `rev-parse --path-format=absolute --git-common-dir`, `rev-parse
  --show-toplevel`, `rev-parse --abbrev-ref HEAD`, `merge-base <main> HEAD`, `diff --name-only <mb> HEAD -- goals/`
  215-511), `Sweep.ts` (`GhC` `["pr", "view", <branch>, "--json", "number,headRefName,state,headRefOid"]` 781; git
  `captureGit` over `RRC` 707-711: `rev-parse --verify --quiet <ref>`, `rev-parse --abbrev-ref HEAD`, `status
  --porcelain`, `rev-parse --show-toplevel`, `worktree list --porcelain`, `switch <main>`, `fetch --prune origin`,
  `fetch origin <main>:<main>`, `branch -d|-D <branch>` 771-1452), `SquashCommitlint.ts` (`yeetGh`).
  Errors: `YeetCommandError` throughout (`GhCall.ts:11-16` formats `"<what> failed (<tag> <exit>: <output>)"`).
  Replacement: `GithubRest`/`PullRequest.create/update/addLabels/merge`, `WorkflowDispatch.runStatus`, job-log REST
  (`GET .../jobs/{id}/logs` is a 302 redirect to a blob: `GitHubClient.request` follows it), G3 for the closeout query;
  git: `Git.remoteUrl({push})`, `mergeBase`, `log` (needs `%b` body, see gap), `changedFiles`, `revParse`, `commit`,
  `push`, `commonDir`, `repoRoot`, `currentBranch`, `refExists`, `status`, `worktreeList`, `checkout`/`switch`,
  `fetch`, `branchDelete`. GAPS: G1 (every gh call inherits the login), G3, `Git.log` has no commit body (`%b`) or
  `--reverse`, `changedFiles` has no pathspec / `--no-renames`, no `switch` member (checkout covers), no
  `fetch --prune`. Difficulty L overall; S per file. Recommendation: git halves migrate now onto `Git` members that
  already exist (Retire, Sweep, ReadyGate `rev-parse`/`push`, PullRequest `remote`/`merge-base`); gh halves wait on G1.

### 2b. git wrapper rows (11)

**#100 / #251 `R/internal/repo-run/GitExec.ts` (1096 lines).** The shared adapter layer. Argv: `rev-parse --verify
--end-of-options <ref>^{commit}` (600), `merge-base -- <a> <b>` (613), `rev-parse --git-path info/attributes` (753),
`ls-tree -r -z --full-tree <commit>` (782), `diff --name-status -z --find-renames=50% <base> <head> -- ...pathspec`
(801), `diff --cached --name-only -z` (836), `diff --name-only -z` (868), `ls-files --others --exclude-standard -z`
(905), `branch --show-current` | `rev-parse --abbrev-ref HEAD` (955), `rev-parse --is-shallow-repository`, `fetch
origin --quiet --unshallow`, `fetch origin main:refs/remotes/origin/main --quiet` (996-1000), `archive` with
`GIT_ATTR_NOSYSTEM=1` (669-710). Parsers are fail-closed (`O.none()` on malformed output, 96-190). Output: 512 KiB
default, 8 MiB for path inventories (373), `onTruncated` adapter hook (215-230). Error type is the caller's via
`GitCommandErrorAdapter<E>` (215). Importers: ~45 files (list above). Kit replacement: `Git.revParse`, `mergeBase`,
`lsTree`, `nameStatus`, `stagedChanges`, `unstagedChanges`, `untrackedFiles`, `currentBranch`, `isShallow`,
`fetchUnshallow`, `fetch`. GAPS: fail-closed parsers (G4), `--find-renames=<n>` + pathspec on `nameStatus` (G5),
bounded output with a truncation signal (G6), `archive` + `rev-parse --git-path` (no member), the
`^{commit}` peel on `revParse`, `currentBranch` ref-mode choice. Difficulty L. Recommendation: migrate in slices
after G4-G6, deleting one runner per PR; `writeGitArchive`/`guardCloneLocalGitAttributes` KEEP (reason: "single
Knowledge consumer; `git archive` is not a kit concern until a second site needs it").

**#101 `R/commands/Yeet/internal/GitExec.ts` (395 lines).** Thin `YeetCommandError` adapter over #100 (36-52) plus
Yeet-only readers: `refreshBaseRef` (`rev-parse --verify --end-of-options <base>` 303, plus fetch), `currentYeetBranch`
(323), `currentCommitSha` (`rev-parse HEAD` 357), `lockfileChangedSinceBase` (383), `collectStagedPublishPaths` /
`collectUnstagedTrackedPaths` / `collectUntrackedPaths` (152-206). Importers: Handler, PublishScope, GateStaleness,
ProofState, PullRequest, ReadyGate, FinalCheck*, Provenance*, MergedPreview, PullRequestTitle, PortfolioIndexGuard,
ExpectationRewrite. Replacement: `Git.revParse`, `stagedChanges`, `unstagedChanges`, `untrackedFiles`,
`currentBranch`, `changedFiles`. GAP: G6 (its `onTruncated` arm must stay fail-closed), `revParse` `^{commit}` peel.
Difficulty M. Recommendation: migrate after G6, one PR that re-exports the same six names over `Git` and keeps
`YeetCommandError` mapping (parity: `yeet-*.test.ts` suites green, differential over scratch repos for the three
dirty-path collectors against `Git.workingChanges` decomposition).

**#102 `R/internal/repo-run/ChangedFiles.ts` (165 lines).** Local `runGitLines` over `SE` (`runCaptured`, source
"stdout", 43-58, `DomainError` on non-zero, NO bound awareness: `truncated` is ignored), `collectDirtyWorktreeFiles`
with probes `diff --name-only <diffArgs> HEAD -- <pathspec>`, `diff --cached --name-only <diffArgs> -- <pathspec>`,
`ls-files --others --exclude-standard -- <pathspec>` (73-75), and `diff --no-renames --name-only <base>...<head>`
(155). Importer: Quality.command (via `--diff-filter=ACMR` and `*.ts` pathspecs, `Quality.command.ts:1412-1425`).
Replacement: `Git.workingChanges` + `changedFiles`. GAPS: pathspec and `--diff-filter` / `--no-renames` on
`changedFiles`/`stagedChanges`/`unstagedChanges`/`untrackedFiles` (G7). Difficulty S after G7. Recommendation: migrate
after G7.

**#105 `R/commands/Worktree/Worktree.schemas.ts` (1574 lines).** No spawn. `WorktreeListEntry {path, head, branch,
detached, locked, prunable}` (54-80) and `parseWorktreePorcelain` (866), fail-closed: `decodeWorktreePorcelainInput`
refuses line-delimited (non `-z`) input (837) and drops blocks before the first header (803-804). Consumers:
Worktree.service (`["worktree", "list", "--porcelain", "-z"]` at 1528), Fleet.service (556), Sweep (`worktree list
--porcelain` WITHOUT `-z`, 901, 1384, parsed separately). Kit: `Git.worktreeList` + `WorktreeEntry {path, head,
branch, detached, bare, locked}`. GAP: `prunable` field and a fail-closed parser (G4; the kit's `parseWorktreeList`
has no refusal). Difficulty S. Recommendation: migrate after G4 adds `prunable` and the refusal; parity =
`worktree-command.test.ts` fixtures through both parsers.

**#106 `R/commands/Worktree/Fleet.service.ts` (1377 lines).** `runGitProbe` (483-505) over `SE runCapturedStreams`
with `repoRunOutputBound`, `trim:false`, `Effect.option`: any spawn failure, non-zero or truncation is `O.none()`
(fail-silent probe by design). Argv: `remote get-url origin` (524, 1269), `worktree list --porcelain -z` (556), `init
--bare --quiet` (870), `fetch ...` into a scanner dir (887, 911), `cat-file -e <sha>^{commit}` (905), `status
--porcelain=v1 -z -uall` (963), `merge-base <target> <head>` (1001), `diff --name-only -z <mb> <head>` (1019),
`diff --name-only -z <mb> <target> -- ...FLEET_POLICY_SURFACE` (1050-1052), `merge-tree` (1160), `rev-parse
--git-common-dir` (1282), with a custom `env` for the scanner. Replacement: `Git.remoteUrl`, `worktreeList`,
`mergeBaseOption`, `changedFiles`, `commonDir`, `status`. GAPS: `init --bare`, `cat-file -e`, `merge-tree`, pathspec
on `changedFiles` (G7), `status -uall` flags (G7), per-call `env` injection (the kit reads env once at `make`,
`execution.ts:101-130`), and the Option-on-truncation policy needs G6. Difficulty L. Recommendation: migrate the
simple reads (remote, worktree list, merge-base, common-dir) after G6/G7; KEEP `init --bare`, `cat-file -e`,
`merge-tree` and the scanner-env fetches with reason "fleet scanner repository plumbing; single consumer, not a kit
concern."

**#107 / #304 `A/config-snapshot.ts` (1522) and `A/git-root-evidence.ts` (227).** Raw `ChildProcessSpawner` +
`ChildProcess.make("git", ...)`: `ls-files -z` with unbounded `Stream.mkString` (636-650), `rev-parse --show-toplevel`
via `spawner.string` (692-696), `rev-parse --git-dir` with stderr capped at 2 Ki (748-770); git-root-evidence: `config
--local --get remote.origin.url` (exit 0 or 1 accepted, 185-188) and `-c core.fsmonitor=false rev-parse
--path-format=absolute --show-toplevel --absolute-git-dir --git-common-dir` (203-212), whole probe under
`Effect.timeoutOption("5 seconds")` (224) and every failure folded to `unknown("probe-failed"|"timed-out"|
"git-unavailable")`. Errors: `configSnapshotFailure` (AiMetricsConfigSnapshotError), `GitRootEvidence` unknown-kinds.
ai-metrics has no `@beep/git` dependency. Replacement: `Git.lsFiles` (paths only), `Git.repoRoot`, `Git.commonDir`,
`Git.configGet("remote.origin.url", {local})`. GAPS: `--absolute-git-dir` (no member; `rev-parse --git-dir` absent),
`-c core.fsmonitor=false` (no per-call `-c`), a 5 s timeout (kit is fixed 30 s, `classification.ts:303`), bounded
output (G6). Difficulty M. Recommendation: migrate `config-snapshot.ts` now for `ls-files`/`show-toplevel` (parity:
`config-snapshot-bounds.test.ts` + `-failures.test.ts` unchanged); KEEP `git-root-evidence.ts` with reason "5-second
bounded, fsmonitor-disabled, multi-value rev-parse probe whose every failure is evidence, not an error; the kit's 30 s
fixed timeout and typed errors would change the evidence model" unless the kit grows a per-call timeout option.

**#110 `R/commands/Knowledge/KnowledgeDoctor.grouping.ts` (393 lines).** No spawn. Defines
`KNOWLEDGE_PATH_REMOVAL_LOG_ARGS = ["-c", "core.quotePath=false", "log", "--diff-filter=DR", "-M", "--name-status",
"--format=%x1e%H%x1f%s"]` (160-168) and `parseKnowledgePathRemovals` (225) reading `R<score>\t<old>\t<new>` / `D\t<path>`
records. Run by `KnowledgeDoctor.service.pathRemovalsLive` (1571+). Kit: `Git.log` yields `paths` but no per-path
status, no `--diff-filter`, no `-M`, no subject (`%s`), no `-c core.quotePath=false`. GAP: `Git.log` name-status
variant (G8). Difficulty M. Recommendation: migrate after G8 (promotion map #110 names the same gap).

**#111 `R/commands/Knowledge/KnowledgeDoctor.service.ts` (2248 lines).** `isAncestorLive` (1535-1562) over `SE
runCapturedStreams`: `merge-base --is-ancestor <cited> <tree>` exit 0 -> true, 1 -> false, other -> `rev-parse
--is-shallow-repository` and either `KnowledgeOperationalError` (shallow) or false. Also `rev-parse
--is-shallow-repository` x3 (1551, 1568, 1736), GX `resolveGitCommit`/`resolveGitMergeBase`/`readGitRenames`/
`readGitTree`/`runGitPathList(["diff", "--name-only", "-z", <mb>, <head>])` (1745-1891). The same probe appears in
`Quality/internal/ResidueTerminalLaneLive.ts:131` and `Ci/RouteCensus.ts:684`. Replacement: `Git.isAncestor` (G9),
`Git.isShallow`, `revParse`, `mergeBase`, `nameStatus` (G5), `lsTree`, `changedFiles`. GAP: G9 first (the tri-state:
`Effect<boolean, GitCommandError | UnknownRefError>` where exit 1 is `false` and a missing object is the typed error, so
the shallow branch stays at the call site). Difficulty M. Recommendation: migrate after G9 (`isAncestor`) + G5 (renames);
the README already names `isAncestor` as the first gap to close.

**#112 per-group git wrappers (promotion map: "about ten group-private runners").** Found: Yeet `Retire.gitOutput`
(`RRC`, 52-63), Yeet `Sweep.captureGit` (`RRC`, 707), Yeet `MergedPreview.gitCapture` (`RRC`, exit 128 fallback,
450-460), Yeet `Status.runGitPaths` (`RRC`, 690-700), Yeet `Yeet.command.submitDetachedProofJob.git` (`RRC` with PATH
env, 763-772), Yeet `ProofShadow` (`SE`, `["status", "--porcelain=v1", "-z", "--untracked-files=all"]` 557-570),
`HeadInstallPreflight` (`RRC`: `worktree add --detach <path> HEAD`, `worktree remove --force`, `worktree prune`
115-163), `Settle` (`SE` diff 512), `PublishScope` (`RRC`: `rev-parse --abbrev-ref --symbolic-full-name @{u}` 845,
`show-ref --verify --quiet refs/remotes/<ref>` 909), `Worktree/Worktree.service` (GX adapters `runWorktreeGitCapture`
/ `runPreservationCommand` / `runPreservationProbe` 631-668 running `worktree remove [--force]`, `update-ref -d
refs/heads/<b> <head>`, `status --short`, `for-each-ref --format=... <ref>`, `worktree list --porcelain -z`,
`rev-parse --path-format=absolute --git-common-dir`, `status --porcelain --untracked-files=all
--ignore-submodules=none`, `diff --binary HEAD --`, `worktree prune`, `config --local merge.regenerate.<k> <v>`
303-2379), `Quality/Quality.command` (`SE`: `branch --show-current`, `rev-parse --is-shallow-repository`, `merge-base
origin/main HEAD`, the `--diff-filter=ACMR` pathspec diff, `ls-files` 992-3277), `Quality/internal/PackageVerify`
(`SE` runner 375-390, `rev-parse HEAD` 769), `Quality/ChangesetStatus` and `ChangesetGraph` (`SE` runners 427, 223),
`Quality/internal/CoverageRegression` (`SE` `rev-parse HEAD` 1304; GX resolve*), `CoverageArtifacts` (`SE` `rev-parse
--verify <ref>^{commit}` 125), `Quality/CatalogUsage` (`SE` `ls-files -z -- ...sources` 357), `Refs/Refs.service`
(`SE` runner 180-190: `status --porcelain --untracked-files=all`, `rev-parse HEAD`, `pull --ff-only origin <branch>`
330-336), `Research/Library/Library.inventory` (`SE` `-C <root> rev-parse HEAD` 762), `Research/internal/Daily`
(`SE` `diff --cached --quiet` 119), `Runners/Runners.service` (`SE`: `remote -v`, `branch -r --contains <rev>`,
`rev-parse HEAD` 264-309), `Ci/CiLane` (`SE`: `diff --name-only <base>...<head>` 1908, `branch --show-current` 2627),
`Ci/RouteCensus` (`RRC`/`RRCraw`: `merge-base origin/main <head>`, `merge-base --is-ancestor`, `fetch --quiet
--no-write-fetch-head origin <sha>`, `fetch --quiet origin +refs/pull/*/head:refs/remotes/pull/*`, and `sh -c "git
cat-file --batch-check"` 656-705), `internal/repo-run/ResidueReap` (`RRC`: `--no-optional-locks status --porcelain
--untracked-files=all --ignore-submodules=none` 577, `--no-optional-locks grep --quiet --perl-regexp -e <pat> --
...roots` 1872-1884, `--literal-pathspecs ls-files --error-unmatch -- <path>` 2119, `--no-optional-locks worktree list
--porcelain` 2142), `internal/repo-run/TmpfsReap` (`RRC`: `-C <path> status --porcelain --no-renames` 812, `-C <repo>
worktree remove --force <path>` 1053, `-C <repo> worktree prune` 1061), `internal/repo-run/GitWorktree` (`worktree
prune` 111, the R10 leftover), `Quality/internal/ResidueTerminalLaneLive` (`merge-base --is-ancestor` 131),
`Codex/Security.command.gitOutput` (`spawner.string(ChildProcess.make("git", ...))`, unbounded, 113-115: `remote
get-url origin`, `rev-parse HEAD`, `status --porcelain`), `Session/SessionLedger.service` (GX `runGitOutput`: `rev-parse
--show-toplevel`, `rev-parse --path-format=absolute --git-common-dir`, `rev-parse --abbrev-ref HEAD` 281-283).
Replacement exists in the kit for: `rev-parse HEAD`/`--verify` (`revParse`; the `^{commit}` peel and `--quiet` are
gaps), `--show-toplevel` (`repoRoot`), `--git-common-dir` (`commonDir`), `--abbrev-ref HEAD` (`currentBranch`),
`status --porcelain` (`status`, flags gap G7), `remote get-url` (`remoteUrl`), `merge-base` (`mergeBase[Option]`),
`diff --name-only base...head` (`changedFiles`), `worktree add/remove/list` (members exist), `ls-files -z` (`lsFiles`,
pathspec ok), `pull --ff-only` (`pull`), `fetch` (`fetch`), `branch -r --contains` (`forEachRef`? no: gap),
`for-each-ref --format=<x>` (`forEachRef` fixed format: gap), `remote -v` (`remoteUrl` per remote), `config --local`
(`configSet` with scope). GAPS: G6/G7, `isAncestor` (G9), `worktree prune`, `update-ref -d`, `show-ref --verify`,
`@{u}` upstream resolution, `git grep`, `ls-files --error-unmatch`, `--no-optional-locks`/`--literal-pathspecs`
global flags, `-C` (use `cwd`), `diff --binary`, `diff --cached --quiet`, `cat-file --batch-check`,
`fetch --no-write-fetch-head`/refspecs. Difficulty: S per wrapper where a member exists (Retire, Sweep reads,
SessionLedger, Codex Security, Runners `rev-parse`, CiLane, Library.inventory, Daily, PackageVerify, CoverageArtifacts,
CoverageRegression, CatalogUsage, Refs, Status.runGitPaths, MergedPreview, Yeet.command); M for ResidueReap/TmpfsReap/
Worktree.service (flag gaps); KEEP `git grep`, `ls-files --error-unmatch`, `cat-file --batch-check`, `diff --binary`,
`update-ref -d` CAS with reason "single-consumer plumbing outside the typed-introspection kit contract; stays on the
bounded repo-run capture (`runRepoCommandCapture`) which is itself kit-adjacent".

**#252 typed git wrappers (Codex Security, Session, others).** Covered in #112: `Codex/Security.command.ts:113`
(`gitOutput`, unbounded `spawner.string`), `Session/SessionLedger.service.ts:217` (GX adapter), `Runners.service`,
`Refs.service`, `Research/*`, `Quality/*`, `Ci/*`. Recommendation: migrate now where a `Git` member exists; the
Codex Security one is the only unbounded raw spawn in `R/commands` outside Reviewer and should go first (S).

### 2c. ScriptedSpawner rows (4)

See section 4. #125/#279 (repo-cli tests: 83 files with `ChildProcessSpawner.make(`, 57 with `makeHandle`, 65
`makeHandle` occurrences), #291 (`@beep/test-utils`: NO spawner exists at `packages/tooling/test-kit/test-utils/src`;
the row means "no shared double, adopt the kit's"), #300 (`packages/drivers/tailscale/test/tailscale.test.ts:47-91`).

### 2d. Other rows

**#281 `R/commands/Yeet/internal/GhOps.ts` (1257 lines).** Already kit-backed (`GitHubClient`, `GithubRest`,
`GraphqlBudget`, `readGithubReviewThreads`; `layerYeetGh` 557). The row's own text is about marker-delimited SECTION
SPLICERS (`spliceYeetInheritedRedsSection` 701, `recordInheritedRedsInPullRequestBody` 846) and names the `templates`
kit (`ManagedSection`), not gh/git. Recommendation: KEEP in this goal with reason "not a gh/git spawn; the splicer
consolidation belongs to a templates/ManagedSection follow-up, out of this goal's scope"; its gh identity path is the
target the Yeet sites migrate TO.

## 3. OFF-LIST HAND-ROLLED gh/git SPAWNS (repo-cli src and ai-metrics src)

Grouped by helper. Sites already in the table are marked (listed). Everything else is new to the acceptance line
"repo-cli and ai-metrics contain no hand-rolled gh or git spawn outside the kits".

Via `runRepoCommandCapture` (`RRC`, 512 KiB bound, `{exitCode, output, truncated}`):
- gh: `Yeet/internal/{Status, WatchMode, Merge, MonitorLoop, MonitorComments, Settle, PullRequest}` (listed),
  `Ci/LaneTimings`, `Ci/CiGovernance` (listed).
- git: `Yeet/internal/{Status.runGitPaths, Retire.gitOutput, Sweep.captureGit, MergedPreview.gitCapture,
  HeadInstallPreflight, PublishScope}` (115-163, 845-909), `Yeet/Yeet.command.ts:763-772` (detached job git
  coordinates with a PATH env), `internal/repo-run/ResidueReap.ts:577,1872,2119,2142`, `internal/repo-run/TmpfsReap.ts:
  812,1053,1061`, `internal/repo-run/GitWorktree.ts:111` (prune), `Quality/internal/ResidueTerminalLaneLive.ts:131`,
  `Ci/RouteCensus.ts:656-705`, `internal/github/GithubIdentity.ts:405` (`git remote get-url origin` via `RRCraw`) and
  `:347` (`gh auth token` via `RRCraw`).
Via `StepExec.runCaptured` / `runCapturedStreams` (`SE`, caller-chosen bound):
- gh: `Yeet/internal/MonitorLoop.ts:1022` (job logs with `--allow-escape-sequences`).
- git: `Knowledge/KnowledgeDoctor.service.ts` (12 call sites: `merge-base --is-ancestor`, `rev-parse
  --is-shallow-repository` x3, `log` removals, listed), `Worktree/Fleet.service.ts:483` (listed), `Quality/
  Quality.command.ts:992,1010,1331,1412,3276`, `Quality/internal/PackageVerify.ts:375-390`, `Quality/ChangesetStatus.ts:
  427`, `Quality/ChangesetGraph.ts:223`, `Quality/internal/CoverageRegression.ts:1304`, `Quality/internal/
  CoverageArtifacts.ts:125`, `Quality/CatalogUsage.ts:357`, `Refs/Refs.service.ts:180-190`, `Research/Library/
  Library.inventory.ts:762`, `Research/internal/Daily.ts:119`, `Runners/Runners.service.ts:264-309`, `Ci/CiLane.ts:1908,
  2627`, `Yeet/internal/{Settle.ts:512, ProofShadow.ts:557-570}`, `internal/repo-run/ChangedFiles.ts:43-58` (listed),
  `internal/repo-run/GitExec.ts:313,343,583` (listed; the GX runners themselves).
Via raw `ChildProcess.make` / `spawner.string` (no bound, no truncation signal):
- `Reviewer/ReviewerRuleset.ts:144` (`gh`, listed), `Reviewer/GitHubAppAuth.ts:55,66` (`op`/`ssh`/`op-doctor`, listed),
  `Codex/Security.command.ts:113-115` (`git`, 3 argv), `Accounts/AccountsSecretsLayout.service.ts:247` (`op item edit`,
  not gh/git; promotion map #124 groups it with the Reviewer spawns), `A/config-snapshot.ts:636-650,692-696,748-770`
  and `A/git-root-evidence.ts:158-212` (listed).
Via plan descriptors executed later by `RRC`: `Yeet/internal/Planner.ts` `RepoPlanStep{command:"gh"|"git"}` (205-840,
listed) run by `RepoRun.executor.executeRepoPlanStep` (256) and `Sweep.runCommandStep` (1432-1452).

Already on the kit (no action): `Skills/internal/MergeBase.ts`, `internal/repo-run/GitWorktree.ts` (except prune),
`Yeet/internal/ProvenanceFooter.ts` (`@beep/git`); `internal/github/{GithubRest, GithubGraphql, GraphqlBudget,
GithubIdentity (client half)}`, `Yeet/internal/GhOps.ts`, `Cache/Cache.workflow.github.ts` (`@beep/github`).

Count of distinct files with a hand-rolled gh or git spawn in `R/`: 44 (from the per-file sweep), of which 19 are in
the site list by name. ai-metrics: 2 files.

## 4. TEST SPAWNER SWEEP

Hand-rolled `ChildProcessSpawner` doubles found (definition sites, not users):

| File | Shape | Kit replaceable as-is? |
| --- | --- | --- |
| `packages/tooling/tool/cli/test/yeet-scripted-process.test.ts:138-183` | `handle(exitCode, output)` builds `makeHandle` (12 fields); `scriptedSpawner(replies, commandsRef)` matches a needle substring of `"<cmd> <args>"`, first match wins, unscripted exits 1 with `unscripted: <line>`, negative exit scripts `PlatformError.systemError({_tag:"NotFound"})`; records every line into a `Ref`. | Yes: `ScriptedSpawner.make((command, args) => ...)` returning `{stdout, exit}` or `ScriptedSpawner.notFound(cmd)`; the `Ref` of command lines becomes `spawner.spawns` (`SpawnRecord.command/args`). Needle-matching stays in the script. |
| repo-cli tests, 56 more files with `makeHandle` (65 occurrences) and 83 with `ChildProcessSpawner.make(`: e.g. `yeet-ready-gate.test.ts` (9 `make`), `shared-internals.test.ts` (7), `yeet-settle.test.ts`, `yeet-monitor-ready.test.ts`, `runners-bake.test.ts` (5 each), `yeet-pull-request-lifecycle.test.ts`, `quality-tasks.test.ts`, `ci-lane-timings.test.ts`, `AgentMessage.observation.test.ts` (4 each), `step-git-exec.test.ts`, `step-capture-lifecycle.test.ts`, `ci-rerun-runner-loss.test.ts`, `codex-security-dispatch.test.ts` (2 each), `test/fixtures/managed-observation-command.ts` (1, uses the real `NodeChildProcessSpawner.layer`). | Mostly the same 12-field `makeHandle` literal with a per-command `match`. | Yes for the standard-command cases. Watch three shapes: (a) tests that assert on `command.options.cwd`/`env` inside the fake (the kit script gets `(command, args)` only; assert via `spawner.spawns[i].cwd/env` instead), (b) tests that script a hanging process (`exitCode: Effect.never`) map to `hang: true`, (c) tests that need `all` to differ from `stdout` (StepExec `source:"all"|"merge"` captures) need a check that the kit's handle `all` is what StepExec reads; `ScriptCompletion` has `stdout`/`stderr` only. |
| `packages/tooling/library/ai-metrics/test/transcript-discovery.test.ts`, `git-root-evidence.test.ts` | inline `ChildProcessSpawner.make` fakes (1-2 each). | Yes. |
| `packages/tooling/test-kit/test-utils/src` (#291) | No spawner exists (rg over `src/` for `ChildProcessSpawner` is empty; only `test/Vitest.runtime.test.ts` uses `ExitCode`). | N/A: the row asks that NO second shared double be added; `@beep/commands` `ScriptedSpawner` is the shared one. Decision to record: do not add a re-export in test-utils (keeps the test-kit free of a drivers dependency), or add one line if repo-cli tests want a single import path. |
| `packages/drivers/tailscale/test/tailscale.test.ts:47-91` (#300) | `mockHandle({stdout, stderr, code})`, `neverFinishingMockHandle()` (exitCode `Effect.never`), `mockSpawnerLayer(handler(command, args, options))` dying on piped commands. | Yes: `ScriptCompletion{stdout, stderr, exit, hang}` covers both handles; the handler's `options` argument is unused for scripting here (confirm in the file). `Tailscale.reason-map.test.ts:7,76` already imports `ScriptedSpawner.notFound`. |
| `packages/drivers/git/test/fixtures.ts:29-65` (`scripted(byArgs)`) | Same `ScriptResult` shape as the kit (`{stdout, stderr, exit, hang} | PlatformError`), handler receives `(args, options)`. | Nearly: the git tests read `command.options` (cwd/env assertions on `GIT_SSH_COMMAND`, `GIT_TERMINAL_PROMPT`). Keep until the kit script can see options, or assert via `spawns[i].env`. Not in the site list; note only. |
| `packages/tooling/library/repo-workspaces/test/support/fakeProcess.ts:48` | `fakeProcess({act, reply})` ALREADY built on `ScriptedSpawner` (file imports it). | Precedent for the sweep; copy its pattern. |

Blocker for the sweep: `@beep/commands` is not in `packages/tooling/tool/cli/package.json` or ai-metrics; add it as a
devDependency in the first sweep PR (or dependency if `Run` is adopted for the `op`/`ssh` spawns in Reviewer).

## 5. PROPOSED WAVES

Precedent pattern (`goals/effected-promotion/ops/git-adoption-differential.ts`, header 1-22): freeze each pre-change
body verbatim as `old*` (from a named origin/main sha), build real scratch repositories per scenario, run old and new
on the same state, normalise outcomes to JSON, classify every difference as "same" | "classified" (an intended
divergence named in a SPEC Decision Log row with a witness scenario) | "unclassified", gate on zero unclassified, and
write `{tool, commit, git, scenarios, same, classified, unclassified, gates, rows[{site, scenario, verdict, old,
new}]}` (`research/git-adoption-differential-r10.json`: 37 scenarios, 34 same, 3 classified, 0 unclassified). For gh
sites the "scratch repository" is a `GitHubClient.layerFixture` recording replayed against both bodies, and the old
body runs against a `ScriptedSpawner` that answers the same JSON the fixture holds.

Kit gaps, named once:

- G1 gh-token client: `GitHubClient.layerFromGhCli({cwd})` (spawns `gh auth token` through `@beep/commands Run.text`
  with `redact`, fails typed when gh is absent or logged out). Source to lift: `R/internal/github/GithubIdentity.ts:
  252-270, 340-348`.
- G2 down-scoped App token: `TokenRequest.permissions?: Record<string, "read"|"write"|"admin">`, `repositories?:
  ReadonlyArray<string>` sent as the `access_tokens` body (`GitHubApp.ts:725`); assert the granted set with the existing
  `TokenPermissions`.
- G3 review threads: `ReviewThread` service (`list(prNumber)` paged, `reply(threadId, body)`, `resolve(threadId)`,
  `unresolve`) over `GitHubClient.graphql`, with the node schema from `GithubGraphql.ts:81-180` and the comments-page
  truncation warning from `GhCommand.collectTruncatableThreadPages`.
- G4 fail-closed parsers: `parseNameStatus`, `parseStatus`, `parseWorktreeList`, `parseLsTree`, `parseLsFiles` return
  `Result<..., string>` like `parseLog` (`parsers.ts:260`), and the service maps failure to `GitCommandError{kind:
  "malformed-output"}`; `WorktreeEntry` gains `prunable`.
- G5 rename score + pathspec: `nameStatus({findRenames?: number, pathspec?, diffFilter?})`.
- G6 bounded output: `GitCommand`/service option `maxOutputBytes` (default from `@beep/commands`
  `DEFAULT_MAX_OUTPUT_BYTES`) with a typed `GitCommandError{kind:"output-too-large"}`, implemented by routing
  `internal/run.ts runCollected` through `Run.collect` (one owner for bounding). Optional `timeout` override for the
  fixed 30 s.
- G7 pathspec + flags on the dirty-axis reads: `changedFiles/stagedChanges/unstagedChanges/untrackedFiles/status
  ({pathspec?, diffFilter?, noRenames?, untrackedFiles?: "all"|"normal", ignoreSubmodules?})`.
- G8 `log` name-status variant: `log({nameStatus: true, diffFilter?, findRenames?})` yielding per-path
  `{status, path, oldPath}` and the subject.
- G9 `Git.isAncestor(cwd, ancestor, descendant): Effect<boolean, GitCommandError | NotARepositoryError |
  UnknownRefError>` (exit 1 is `false`; exit 128 on an unknown object classifies to `UnknownRefError`).
- G10 small members: `worktreePrune`, `revParse({peel:"commit", quiet})`, `showRef`, `upstreamRef` (`@{u}`), `fetch
  ({prune})`, `remoteUrl({push})`, `log({reverse, bodies})`, `commit({allowEmpty, only, noVerify})`.

Waves (one owner switch per PR; kit feature PRs land with tests before the site PR that uses them):

| Wave | PR | Files touched | Kit features | Size | Parity evidence to record |
| --- | --- | --- | --- | --- | --- |
| W0 | K-isAncestor + K-small | `packages/drivers/git/src/{Git.ts, GitCommand.ts, internal/classification.ts}`, `test/Git.test.ts`, integration test | G9, G10 (`worktreePrune`, `revParse` peel/quiet) | S | Integration scenarios: ancestor, non-ancestor, unknown object, shallow clone |
| W0 | S-isAncestor | `R/commands/Knowledge/KnowledgeDoctor.service.ts:1535-1575`, `R/commands/Quality/internal/ResidueTerminalLaneLive.ts:131`, `R/commands/Ci/RouteCensus.ts:684`, `R/internal/repo-run/GitWorktree.ts:111`, `R/commands/Yeet/internal/HeadInstallPreflight.ts`, `R/internal/repo-run/TmpfsReap.ts:1061` | uses G9/G10 | S | Differential over scratch repos for the tri-state; `KnowledgeOperationalError` message unchanged on shallow |
| W1 | K-parsers + K-renames + K-bounds | `packages/drivers/git/src/internal/{parsers.ts, run.ts}`, `Git.models.ts`, `Git.errors.ts`, `GitCommand.ts`; adds `@beep/commands` dependency to `@beep/git` | G4, G5, G6 | M | Property tests from `GitExec.ts` fixtures (malformed NUL tables -> typed failure); bound witness (output > limit fails typed, no deadlock: keep the G5 pipe test in `Git.int.test.ts`) |
| W1 | S-GitExec-core | `R/internal/repo-run/GitExec.ts` (`readGitTree`, `readGitRenames`, `resolveGitCommit`, `resolveGitMergeBase`, `collect*Paths`, `currentBranch`), `R/commands/Yeet/internal/GitExec.ts`, `R/commands/Yeet/internal/ExpectationRewrite.ts:549`, Knowledge x2 | uses G4-G6, G10 | L | Frozen old bodies vs `Git` over scratch repos (renames at 50%, path with spaces/newlines, truncation); `yeet-*`, `knowledge-*` suites green |
| W2 | K-dirty-axes + K-log | `GitCommand.ts`, `Git.ts`, `parsers.ts`, `Git.models.ts` | G7, G8 | M | Flag matrix tests (`--diff-filter`, `--no-renames`, `-uall`, pathspec) |
| W2 | S-dirty-axes | `R/internal/repo-run/ChangedFiles.ts`, `R/commands/Quality/Quality.command.ts:992-1425,3276`, `R/commands/Yeet/internal/{Status.ts:690-720, Settle.ts:512, ProofShadow.ts:557}`, `R/internal/repo-run/ResidueReap.ts:577`, `R/internal/repo-run/TmpfsReap.ts:812`, `R/commands/Worktree/Worktree.service.ts:1578`, `R/commands/Knowledge/KnowledgeDoctor.grouping.ts` + service `pathRemovalsLive` | uses G7, G8 | M | Differential path lists; grouping parser vs `Git.log` name-status on a fixture history |
| W2 | S-one-liners | `R/commands/Yeet/internal/{Retire.ts, Sweep.ts, MergedPreview.ts, ReadyGate.ts (git half), PullRequest.ts (git half), PublishScope.ts, Yeet.command.ts}`, `R/commands/Session/SessionLedger.service.ts`, `R/commands/Codex/Security.command.ts`, `R/commands/Runners/Runners.service.ts`, `R/commands/Refs/Refs.service.ts`, `R/commands/Research/{Library/Library.inventory.ts, internal/Daily.ts}`, `R/commands/Quality/{internal/PackageVerify.ts, ChangesetStatus.ts, ChangesetGraph.ts, internal/CoverageRegression.ts, internal/CoverageArtifacts.ts, CatalogUsage.ts}`, `R/commands/Ci/CiLane.ts`, `R/commands/Worktree/{Worktree.schemas.ts, Fleet.service.ts (reads)}` | existing members + G10 | M (many files, each S); split by command group if review size demands | Per-wrapper old/new differential (exit code, trimmed stdout, error message text); suites green |
| W2 | S-ai-metrics | `A/config-snapshot.ts:630-770`, `packages/tooling/library/ai-metrics/package.json` (+`@beep/git`) | existing (`lsFiles`, `repoRoot`) + G6 | S | `config-snapshot-bounds.test.ts`, `config-snapshot-failures.test.ts` unchanged; record `git-root-evidence.ts` KEEP |
| W3 | K-gh-token + K-scoped-token | `packages/drivers/github/src/{GitHubClient.ts, GitHubApp.ts}` (+`@beep/commands` dep), tests with `ScriptedSpawner` | G1, G2 | M | `gh auth token` present/absent/logged-out scripts; `access_tokens` body and granted-permission assertion |
| W3 | S-Reviewer | `R/commands/Reviewer/{GitHubAppAuth.ts, ReviewerService.ts, ReviewerRuleset.ts}` | uses G1, G2; `Ruleset`, `CheckRun`, `PullRequest`, `PullRequestComment`, `Run.text` for `op`/`ssh` | M | `GitHubFixtures` replay of `reviewer-bootstrap.test.ts` and `reviewer-ruleset-workflow.test.ts`; token permission set equality |
| W3 | S-Ci | `R/commands/Ci/{LaneTimings.ts:861-900, CiGovernance.ts:233-260, CiRerunRunnerLoss.ts:349-364}` | uses G1 (or `layerFromConfig` under Actions); `Resilience` | M | Fixture replay; transient-retry decision table unchanged |
| W4 | K-review-threads | `packages/drivers/github/src/ReviewThread.ts` (new), barrel, tests | G3 | M | GraphQL fixture pages incl. a thread with `comments.pageInfo.hasNextPage` |
| W4 | S-Yeet-threads | `R/internal/github/GithubGraphql.ts` (delete local copy), `R/commands/Yeet/internal/{Status.ts, WatchMode.ts, MergeGate.ts, Reply.ts, closeout/GhCollect.ts, closeout/Gh.schemas.ts}`, `R/commands/Yeet/internal/GhOps.ts` (consume kit) | uses G3 | L | Thread counts / resolutions over fixtures equal across the five query copies; `yeet-reply-engine`, `yeet-merge-gate`, `yeet-status-chain`, `yeet-watch-mode` suites |
| W4 | S-Yeet-rest | `R/commands/Yeet/internal/{PullRequest.ts (gh half), Merge.ts, MonitorLoop.ts, MonitorComments.ts, Settle.ts:358, Retire.ts:496, Sweep.ts:781, ReadyGate.ts:577, SquashCommitlint.ts, Planner.ts gh steps}` onto `GithubRest`/`PullRequest`; then delete `GhCall.ts`, shrink `GhCommand.ts` | uses G1 | L (split by file) | Fixture replay per command; `gh`-specific behaviours recorded (`--paginate --slurp` equals `paginate`; `--match-head-commit` equals `mergePullRequest.sha`) |
| W5 | T-spawner-sweep | repo-cli tests (83 files, batches of ~15), `packages/tooling/library/ai-metrics/test/*`, `packages/drivers/tailscale/test/tailscale.test.ts`; `packages/tooling/tool/cli/package.json` devDependency `@beep/commands` | `ScriptedSpawner` as-is | L total, S per batch | Each batch: identical assertions, `spawns` replaces `Ref` recorders; note any test that needed `options` (cwd/env) visibility |
| W6 | Runtime edge | `R/` runtime wiring: provide `Git.layer` once at the CLI edge and drop the three `Effect.provideServiceEffect(Git, Git.make)` leaf provisions (`Skills/internal/MergeBase.ts`, `internal/repo-run/GitWorktree.ts`, `Yeet/internal/ProvenanceFooter.ts`) per W4-l | none | M | All suites green with `Git.layerTest` substitutable |

KEEP-with-reason rows (wording to paste into the ledger):

- #85 `Skills/Skills.command.ts`: "No gh or git spawn; GitHub tree reads use HttpClient for skills-lock. Row stale
  since R10."
- #84 `internal/github/GithubRest.ts`, #77 `GithubGraphql.ts` (until W4), #281 `GhOps.ts`: "repo-cli facade over
  `@beep/github`, not a hand-rolled spawn; retained as the migration target. The GhOps splicers belong to a templates
  follow-up."
- #76 `ReviewerRuleset.ts` (until W3): "Ruleset administration must run as the operator's gh login with repository
  administration; the kit has no gh-credential client yet (G1)."
- `A/git-root-evidence.ts` (#304 git half, partial): "Five-second bounded, `core.fsmonitor=false`, multi-value
  `rev-parse` evidence probe where every failure is an evidence kind, not an error; the kit's fixed 30 s timeout and
  typed errors would change the evidence model. Revisit when `@beep/git` accepts a per-call timeout."
- `Fleet.service.ts` scanner plumbing (`init --bare`, `cat-file -e`, `merge-tree`, scanner-env fetches),
  `ResidueReap.ts` `git grep` / `ls-files --error-unmatch` / `--no-optional-locks`, `Worktree.service.ts` `update-ref -d`
  CAS and `diff --binary`, `RouteCensus.ts` `sh -c "git cat-file --batch-check"`, `Knowledge.service.ts`
  `writeGitArchive`/`guardCloneLocalGitAttributes`, `Research/internal/Daily.ts` `diff --cached --quiet`:
  "Single-consumer git plumbing outside the typed-introspection contract of `@beep/git`; stays on the bounded repo-run
  capture (`runRepoCommandCapture`), which is the repo-cli child-process owner. Promote only when a second site needs
  the same member."
- `Reviewer/GitHubAppAuth.ts` `op`/`ssh`/`op-doctor` spawns and `Accounts/AccountsSecretsLayout.service.ts:247` `op
  item edit`: not gh/git; migrate onto `Run.text`/`Run.exitCode` with `redact` inside W3 S-Reviewer because the file is
  being rewritten anyway (promotion map #124), otherwise out of scope.

Open decisions to log in SPEC.md when P1 starts:

1. Whether G6 is implemented by making `@beep/git` depend on `@beep/commands` (`runCollected` -> `Run.collect`) or
   by a local bound; the former gives one bounding owner, the latter keeps the git kit dependency-free.
2. Whether `GitHubClient.layerFromGhCli` lives in `@beep/github` (needs `@beep/commands`) or stays a repo-cli
   `GithubIdentity` concern with the kit only exposing `layerFromToken`. The site list calls it a kit gap; the
   cheaper reading is "repo-cli already has it, keep it there and let every gh site take `GitHubClient` from
   `layerYeetGh`".
3. W6 runtime-edge provision versus keeping `Git.make` leaf provisions (W4-l names this goal as the one that lifts
   `Git` into callers' `R`).
