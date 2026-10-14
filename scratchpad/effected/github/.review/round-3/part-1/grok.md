I'll review this GitHub slice against the pinned upstream oracle and the round-2 inventory, and report only new findings. First I'm loading the binding decisions, port notes, and the files in scope.Round-2 left required defects in several of these files. I'll check whether this commit closed them, then read the binding decisions and the current sources against the pinned oracle.The recorded deviations cover the round-2 repairs. I'll read the implementations next and compare them with the pinned oracle for anything those repairs missed.I'll verify the two open defects and the remaining projector sites against the round-2 inventory and the ledger before writing findings.The rotation finalizer still takes the semaphore. I'll check Effect's scope-close order and whether a hung refresh can block cleanup.### grok-3-1
- file: scratchpad/effected/github/GitHubError.ts:473
- class: bug   severity: required
- standard: D9/D11; §14 upstream-bug; effect-first-development EF-31   evidence: `readThrowable` calls bare `String(error)` at line 464 for non-objects and at line 473 when an object’s `message` is not a string. `fromOctokit` runs that synchronously, and `internal/octokit.ts` `attempt` returns `Effect.fail(classify(error, now))` from an `Effect.fnUntraced` catch. Round-2 req-12 already probed the same coercion in the pinned oracle: `String({ toString: null })` throws `TypeError: No default value`. `String(Symbol())` throws as well. GraphQL now wraps this in `Result.try` (`GraphQL.ts:203`); the GitHubError deviation does not.
- failure: Classifying a throwable whose string conversion throws dies inside the catch callback. The caller gets a defect instead of a typed transport `GitHubError`, and the original cause is dropped.
- fix: Wrap both `String(error)` calls in `Result.try` with a stable fallback, as `describeThrowable` does. Keep `cause: error`. Add the `{ toString: null }` and `Symbol()` cases to `GitHubError.test.ts` and record `upstream-bug`.

### grok-3-2
- file: scratchpad/effected/github/GitHubApp.ts:854
- class: bug   severity: required
- standard: D9/D11; §14 bug in the recorded req-02 repair; effect-first-development EF-26   evidence: The finalizer is `revokeHeld.pipe(rotation.withPermits(1))`. `fresh` holds that single permit across `rotate` (`GitHubApp.ts:862-867`), and `rotate` leaves revoke, `app.token`, and `makeClientShape` inside `restore` (`:840-846`). Effect `scopeClose` (`packages/effect/src/internal/effect.ts:3939-3942`) marks the closing fiber uninterruptible and only runs finalizers. `uninterruptibleMask` (`effect.ts:4625-4636`) then uses `identity` as `restore`, so the permit wait cannot be interrupted. `Scope.close` does not interrupt a `forkChild`/`forkDaemon` holder. The upstream finalizer is `revokeHeld` with no semaphore (`GitHubApp.ts:552` in the pinned oracle). `GitHubApp.test.ts:311-318` interrupts the holder before `close`, so the stall is untested.
- failure: Closing the layer scope while another fiber is blocked in refresh waits forever on the permit, never revokes the owned token, and ignores interrupt of the closing fiber. A stalled mint or revoke is enough. Same-fiber interrupt of the holder still aborts HTTP and releases the permit.
- fix: Keep the permit only around the `Ref` updates. On scope close, interrupt the in-flight rotation fiber, wait for it to finish, then `revokeHeld`. `owned` is already set before the next interruptible section, so the acquired token stays revocable. Add a regression that calls `close` while refresh is blocked in `Effect.never` and asserts that `close` finishes and the token is revoked.

### grok-3-3
- file: scratchpad/effected/github/GitHubIssue.ts:499
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `commentOnce` still does `marker.matches(comment.body ?? "")` and `CommentRecord.make` (`:503`, `:515`). `CommentMarker.matches` calls `body.includes` (`PullRequestComment.ts:90-91`). `??` does not replace `{}`. Round-2 req-13 probed comment `body: {}` and got `hasFails=false`, `hasDies=true`. The repair added `recordOf` via `S.decodeEffect` for `PullRequestComment` only (`PullRequestComment.ts:268-274`). `CommentRecord` is `id: S.Int`, `body: S.String`, `url: S.String`.
- failure: One comment with `body: {}` dies on `.includes` before any typed `GitHubError`. A comment with `id: 1.5` or `html_url: null` dies later in `CommentRecord.make` with `Schema validation failed`. `commentOnce` advertises `GitHubError`.
- fix: Decode each comment with `S.decodeEffect(CommentRecord)` and `Effect.mapError` to `GitHubError.decode` before `marker.matches`, same as `recordOf`. Use the decoded `body` for the marker test.

### grok-3-4
- file: scratchpad/effected/github/GitHubIssue.ts:415
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `get` and `list` return `IssueInfo.make` on undecoded `client.request` / `client.paginate` payloads. `IssueInfo.number` is `S.Int` and `labels` is `S.Array(S.String)`. `labelNames` (`:402-403`) keeps `null` because it tests `name !== undefined`, and a `null` label reads `.name` and throws `TypeError`. `S.Class.make` throws synchronously; round-2 req-13 showed that throw becoming a defect inside `Effect.fn`. The oracle projector throws the same way. This path is not in the req-13 deviation.
- failure: `number: 1.5`, a label `{ name: null }`, or a `null` label turns `GitHubIssue.get` / `list` into a defect instead of `GitHubError.decode`.
- fix: Decode the projected fields with `S.decodeUnknownEffect(IssueInfo)` and map `SchemaError` to `GitHubError.decode` for that operation. Guard label entries before reading `name`.

### grok-3-5
- file: scratchpad/effected/github/CheckRun.ts:619
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `create` and `get` return `refOf`, which calls `CheckRunRef.make`. `CheckRunRef.id` is `S.Int` (`:289`). `numericId` is `Number(id)` (`internal/ids.ts:27`), so `1.5` stays `1.5`. `name` and `status` are `S.String`. The payload comes from `client.request`, not `requestDecoded`. req-13’s `id: 1.5` probe died the same way on `WorkflowRunStatus.make`. The oracle uses the same constructor.
- failure: A check-run payload with a fractional `id`, or a non-string `name` or `status`, dies in `CheckRun.create` / `get` instead of failing with `GitHubError`.
- fix: Decode `refOf` with `S.decodeEffect(CheckRunRef)` and map the error to `GitHubError.decode` for `CheckRun.create` or `CheckRun.get`.

### grok-3-6
- file: scratchpad/effected/github/GitHubRelease.ts:261
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `project` calls `ReleaseInfo.make` with `id: raw.id`. `ReleaseInfo.id` is `S.Int` (`:40`); `draft` and `prerelease` are `S.Boolean`. `getByTag`, `create`, `list`, and `update` feed it undecoded request or paginate data. `listAssets` (`:402`) maps `assetOf` (`:281`) over undecoded pages; `ReleaseAsset.id` and `size` are `S.Int`. `uploadAsset` is already `requestDecoded(AssetResponse)`. req-04 showed `S.Int` rejects `1.5` by throwing from schema construction.
- failure: A release `id` of `1.5`, a non-boolean `draft`, or an asset `size` of `1.5` dies inside `GitHubRelease.list` / `getByTag` / `listAssets` instead of `GitHubError.decode`.
- fix: Decode `project` through `ReleaseInfo` and `assetOf` through `ReleaseAsset` with `decodeEffect`, mapping failures to the operation’s `GitHubError.decode`. Leave the `uploadAsset` path on `AssetResponse`.

### grok-3-7
- file: scratchpad/effected/github/GitHubCommit.ts:364
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `summarize` calls `CommitSummary.make`. `authorLogin` is `S.optionalKey(S.String)`, and `O.fromUndefinedOr(null)` is `Some(null)`, so a null login is passed through (`:368`). `CommitComparison.make` (`:461`) assigns `ahead_by` / `behind_by` to `S.Int` and `status` to `S.Literals(["diverged", "ahead", "behind", "identical"])`. `fileOf` is already `decodeUnknownEffect`. The compare `files` traversal is safe; `commits.map(summarize)` is not. The oracle `CommitSummary.make` also receives a null login (`!== undefined`).
- failure: `{ author: { login: null } }` dies in `get` / `list`. `ahead_by: 1.5` or `status: "unknown"` dies in `compare` before `fileOf` runs. Both advertise `GitHubError`.
- fix: Decode `summarize` and the comparison record with `decodeEffect`, map `SchemaError` to `GitHubError.decode`, and keep `fileOf` for files.

### grok-3-8
- file: scratchpad/effected/github/GitHubApp.ts:717
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `installations` maps paginated `GET /app/installations` through `Installation.make`. `Installation.id` is `S.Int` and `account` is `S.optionalKey(S.String)` (`:422-426`). `numericId(1.5)` is `1.5`. `"login" in entry.account` then passes `login` through, including a non-string. `identity` (`:793`) calls `AppIdentity.make` with `name: app.name` (`S.String`) and `userId: numericId(...)` (`S.optionalKey(S.Int)`). `token` already uses `S.decodeEffect(InstallationToken)` (`:758`). These two constructors are outside that repair.
- failure: An installation `id` of `1.5`, a non-string `account.login`, an app `name` of `null`, or a bot `user.id` of `1.5` dies as a schema exception. The effects advertise `GitHubAppError`.
- fix: Decode both projections with `decodeEffect` and map `SchemaError` to `GitHubAppError.of` for `installation` or `identity`, matching `token`.

### grok-3-9
- file: scratchpad/effected/github/DeploymentEnvironment.ts:266
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3 and EF-31; §14 law:EF-3   evidence: `list` maps undecoded paginate entries with `DeploymentEnvironmentInfo.make({ name: environment.name })`. The schema is `S.Struct({ name: S.String })` (`:34-37`). `Struct.make` throws on a non-string `name`. The throw sits inside `Effect.fn`, so it becomes a defect. req-14 required the same boundary decode for other list projections whose fields were only typed as strings or numbers. The oracle constructor throws too.
- failure: An environment whose `name` is not a string makes `DeploymentEnvironment.list` die instead of returning `GitHubError.decode`.
- fix: Decode each entry with `S.decodeUnknownEffect(DeploymentEnvironmentInfo)` and map `SchemaError` to `GitHubError.decode("DeploymentEnvironment.list", ...)`.

REQUIRED: 9
BACKLOG: 0
