### sol-3-1

- file: scratchpad/effected/github/GitHubError.ts:473
- class: bug   severity: required
- standard: D9/D11 and §14 verified upstream bug; `standards/effect-first-development.md` EF-1/EF-31.   evidence: Read-only `bun --eval` probes called `GitHubError.fromOctokit("probe", input, 0)` with `{ toString: null }`, `Object.create(null)`, and `[Object.create(null)]`. All three threw `TypeError: No default value` in both the reviewed source and the pinned oracle. The unchecked coercions remain at lines 464 and 473. Round-2 req-12 repaired the corresponding GraphQL coercions, not these REST classifier sites.
- failure: A valid member of the classifier’s `unknown` input domain throws while translating a transport failure. Callers receive a defect instead of the advertised typed `GitHubError`, bypassing typed recovery and retry classification.
- fix: Protect both string coercions with a nonthrowing conversion and a stable fallback description, preserving successful coercions and the original cause. Add regressions for uncoercible object and array inputs to `GitHubError.test.ts`; record the verified upstream bug under §14.

### sol-3-2

- file: scratchpad/effected/github/CheckRun.ts:619
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3/EF-31; `standards/ARCHITECTURE.md` principle 5; D11 and §14 law-forced boundary decoding. The Effect reference `SCHEMA.md` constructor section states that `.make` throws on validation failure.   evidence: Read-only probes drove the real client through `scriptedFetch` with HTTP-200 payloads. Each of these returned `fails: false, dies: true, error: "Error: Schema validation failed"`:
  - `CheckRun.get`: `id: 1.5`, through `refOf` at `CheckRun.ts:619`.
  - `GitCommit.get`: `parents: [{ sha: null }]`, through `CommitRef.make` at `GitCommit.ts:383`.
  - `GitHubCommit.get`: `commit.message: 42`, through `summarize` at `GitHubCommit.ts:364`.
  - `GitHubIssue.get`: `number: 1.5`, through `project` at `GitHubIssue.ts:415`.
  - `GitHubRelease.getByTag`: `id: 1.5`, through `project` at `GitHubRelease.ts:260`.
  - `DeploymentEnvironment.list`: `environments: [{ name: 42 }]`, through `DeploymentEnvironmentInfo.make` at `DeploymentEnvironment.ts:266`.

  The pinned oracle reproduces the first five defects; its environment listing instead succeeds with the invalid `{ name: 42 }` result. These are separate sites from the commit-file, comment, workflow, tag, secret, variable, and ruleset projections repaired in previous rounds. The green gates do not establish the failure channel of these constructors.
- failure: Malformed HTTP responses escape resource APIs advertising `GitHubError` as defects. The same projectors also serve creation and listing paths; `GitHubRelease.listAssets` has the equivalent throwing `assetOf` projection at lines 280–281 and 402. Adding an owning schema to the environment result changed unchecked success into a synchronous throw without establishing a typed boundary.
- fix: Replace the throwing external projections with effectful schema decoding, mapping validation failures to operation-specific `GitHubError.decode`. Validate selected wire fields before unsafe nested reads, preserve existing defaults and output shapes, and use `Effect.forEach` for list projections. Apply this to every caller of the affected projectors and add malformed-response regressions in the existing resource suites.

### sol-3-3

- file: scratchpad/effected/github/GitHubApp.ts:793
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3/EF-31; D11 and §14 law-forced boundary decoding.   evidence: Read-only probes generated an ephemeral RSA key and used scripted HTTP responses without external requests. `GitHubApp.identity` with `{ slug: "app", name: 42 }` and `installations` with `[{ id: 1.5, account: { login: "acme" } }]` both returned `fails: false, dies: true` with `Schema validation failed`. A token response of HTTP-201 `null` returned a `TypeError` at `minted.token`, before the existing `InstallationToken` decoder. The pinned oracle reproduces all three failures. The corresponding unchecked sites are `Installation.make` at line 717, the token projection at lines 758–762, and `AppIdentity.make` at line 793; the recorded rotation repairs do not cover these response boundaries.
- failure: Malformed authentication responses bypass the documented `GitHubAppError` channel. Token decoding protects invalid projected fields but cannot handle an invalid outer payload because property access happens first.
- fix: Decode the selected response shapes before dereferencing them. Map installation, identity, and token validation failures to `GitHubAppError` with the existing operation kinds. Replace the throwing installation and identity projections with effectful decoders, retain valid defaults and ordering, and add the three malformed-response regressions.

### sol-3-4

- file: scratchpad/effected/github/GitBranch.ts:448
- class: type-safety   severity: required
- standard: `standards/effect-first-development.md` EF-3; `standards/ARCHITECTURE.md` principle 5; D11 and §14 law-forced boundary decoding.   evidence: A read-only real-client probe returned HTTP-200 `{ object: { sha: 42 } }`. `GitBranch.sha("main")` succeeded with `42`, and `shaOption("main")` succeeded with `Some(42)`. The methods promise `string` and `Option<string>`. `readRef` at lines 435–442 performs no decoding; its consumers copy `ref.object.sha` at lines 448 and 464.
- failure: A successful service result violates its public type. `exists` also reports true for this malformed response because it checks only whether `shaOption` returned `Some`.
- fix: Decode the selected `{ object: { sha: S.String } }` response shape inside `readRef`, mapping schema errors to `GitHubError.decode(operation, ...)`. Preserve notFound recovery and add wrong-type and missing-object regressions covering `sha`, `shaOption`, and `exists`.

### sol-3-5

- file: scratchpad/effected/github/GitHubContent.ts:186
- class: bug   severity: required
- standard: `standards/effect-first-development.md` EF-3/EF-31; D9/D11 and §14.   evidence: A read-only scripted HTTP-200 response `{ type: "file", encoding: "base64", content: null }` made `getFile` return `fails: false, dies: true` with a `TypeError` from `content.content.replace`. The pinned oracle reproduces the failure. Round-2 req-08 and the current coverage cases protect omitted/null **encoding**, while the base64-content branch remains unchecked.
- failure: A malformed file payload dies instead of returning a typed decode failure. `getFileOption` inherits the defect, so its typed error handling cannot recover either.
- fix: Validate the outer payload before field access and decode the base64 branch’s `content` as a string before calling `.replace`. Map validation errors to `GitHubError.decode`, preserving the existing directory, non-file, and unsupported-encoding rejection behavior. Add null, omitted, and wrong-type content regressions through both file APIs.

### sol-3-6

- file: scratchpad/effected/github/GitHubIssue.ts:179
- class: bug   severity: required
- standard: D9/D11 and §14 verified upstream bug; `GitHubIssueShape.isCrossReferencedBy` at lines 247–270 promises whether the requested PR has already been cross-referenced.   evidence: The query requests only `timelineItems(last: 50, ...)`, and its response schema contains no pagination metadata. A read-only two-page HTTP probe supplied 50 recent references to other PRs, `pageInfo: { hasPreviousPage: true, startCursor: "cursor-2" }`, and an earlier page containing the requested PR. Both the reviewed source and pinned oracle returned `false` after exactly one request.
- failure: Once an issue has more than 50 cross-reference events, an older matching PR is reported as absent. This is a false result for an ordinary valid timeline, with no documented 50-event limit on the method.
- fix: Include `pageInfo` in the query and schema, add a `before` cursor variable, and traverse previous pages until the requested PR is found or `hasPreviousPage` is false. Retain the `CROSS_REFERENCED_EVENT` filter and add a regression where the matching PR is on the preceding page.

REQUIRED: 6
BACKLOG: 0