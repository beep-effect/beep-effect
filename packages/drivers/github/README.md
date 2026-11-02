# @beep/github

Typed GitHub REST and GraphQL for [Effect](https://effect.website) v4. `client.request("GET /repos/{owner}/{repo}", { owner, repo })` types both the parameters and the returned `data` from the route literal alone — no `operation: string`, no callback, no cast. One `GitHubError` covers every REST failure with a `kind` you branch on instead of grepping a message, one pagination engine backs every paginating route and `client.request`'s `Stream` form, and a set of resource services (`GitBranch`, `GitTag`, `CheckRun`, `PullRequest`, `PullRequestComment`, `GitHubRelease`, `Attestation`) turn multi-call dances — "does this branch already exist?", "conclude this check run no matter how the program exits" — into one call. A second tier writes the configuration half: secrets, variables, rulesets, deployment environments, the security toggles and CodeQL default setup. `GitHubApp` mints and revokes installation tokens for App auth.

## Why @beep/github

Hand-rolled octokit wrappers tend to converge on the same shape: a `rest<T>(operation: string, fn: (octokit) => Promise<{ data: T }>)` helper where `T` is whatever the caller wrote and nothing connects it to the endpoint. This package's route-keyed `request` closes that gap — `@octokit/types` already generates a map from GitHub's own OpenAPI description, and `@octokit/core`'s `request` already consumes it, so there was no reason to reinvent either.

The error model gets the same treatment. `GitHubError.kind` is a literal union (`notFound`, `alreadyExists`, `rejected`, `unauthorized`, `rateLimited`, `transport`, `decode`) produced by one classification step, `GitHubError.fromOctokit`, instead of one hand-written mapper per resource. `kind: "alreadyExists"` is what makes `GitBranch.upsert` and `GitTag.upsert` a single round trip in the common case, rather than a create-then-catch-then-check-then-reset dance repeated at every call site that needs it.

This package also owns the octokit runtime so nothing downstream has to. `@octokit/rest` and `@octokit/auth-app` are deliberately absent — the rest wrapper is a request-logging plugin plus 1.4 MB of duplicate endpoint types, and `auth-app` drags in `createOAuthUserAuth`, roughly 492 KB of OAuth machinery this package never calls. GitHub App JWTs are signed by `universal-github-app-jwt` instead, the same zero-dependency signer `@octokit/auth-app` itself uses. A consumer that only authenticates with a token it already holds never links the JWT signer at all: the App-authenticated layer lives in its own module (`GitHubApp`), and nothing here is gathered into a namespace object that would defeat that split.

The package is ESM-only (`"type": "module"`), so import it from an ES module. Every symbol is exported by name from a leaf module (`@beep/github/GitHubClient`, `@beep/github/GitBranch`, ...); there is no namespace object, so a bundler drops what a consumer does not use.

## Quick start

```ts
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo, RepoRef } from "@beep/github/Repo";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const client = yield* GitHubClient;
  const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "effect-ts", repo: "effect" });
  return repo.default_branch; // string — typed from the route literal, no cast
});

const ClientLayer = GitHubClient.layerFromConfig(); // reads GITHUB_TOKEN through the ambient ConfigProvider
const RepoLayer = Repo.layer(RepoRef.make({ owner: "effect-ts", repo: "effect" }));

Effect.runPromise(program.pipe(Effect.provide(ClientLayer), Effect.provide(RepoLayer))).then(console.log);
// the repository's default branch name, e.g. "main"
```

`Repo` carries the `{ owner, repo }` coordinate in `R` rather than as a per-call argument, so every resource method below reads as a single expression. A program acting on more than one repository uses `Repo.provide(otherRef)` around the part that needs it.

## Resource services

Each resource is a service over `GitHubClient`, with its own `layer`, `makeTest` and `layerTest`. `GitBranch.upsert` is the case that motivated the whole set:

```ts
import { GitBranch } from "@beep/github/GitBranch";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const branches = yield* GitBranch;
  return yield* branches.upsert("release/1.2", "abc123");
});
// Effect<"created" | "reset", GitHubError, GitBranch | Repo>
// one round trip in the common case, two in the raced one — never four
```

`CheckRun.withCheckRun` runs a program inside a check run and concludes it on every exit path — success, typed failure, defect or interrupt — so a run never gets stuck `in_progress`:

```ts
import { CheckRun } from "@beep/github/CheckRun";
import * as Effect from "effect/Effect";

declare const lint: () => Effect.Effect<ReadonlyArray<string>>;
declare const deriveConclusion: (findings: ReadonlyArray<string>) => "success" | "neutral" | "failure";

const program = Effect.gen(function* () {
  const check = yield* CheckRun;
  return yield* check.withCheckRun("lint", "abc123", (_id, conclude) =>
    Effect.gen(function* () {
      const findings = yield* lint();
      yield* conclude(deriveConclusion(findings));
      return findings;
    }),
  );
});
```

`GitTag.latestSemver` walks tags and picks the newest version-shaped one in a single pass, over `@beep/semver`'s synchronous comparator — no round trip per candidate. `PullRequest.upsert` and `PullRequestComment.upsert` (a marker-tagged sticky comment) follow the same one-call-one-intent shape.

## Review threads

`ReviewThread` is the GraphQL-only pull-request surface: REST review comments carry no `isResolved`, so the thread list, the reply and the resolve/unresolve mutations all go through `GitHubClient.graphql`. `list(pullNumber)` walks every page of `reviewThreads(first: 100)` and reads one `comments(first: 100)` page per thread. A thread with more comments than that comes back with `commentsTruncated: true` and is named in one warning per page; its `newestComment` is read separately (`comments(last: 1)`), so the merge-gate rule still sees who spoke last. `listByNodeId` is the same read for callers that already hold the pull request's node id and have no `Repo` in scope.

```ts
import { outstanding, ReviewThread } from "@beep/github/ReviewThread";
import * as Effect from "effect/Effect";

const answerAndGate = (pullNumber: number) =>
  Effect.gen(function* () {
    const threads = yield* ReviewThread;
    const read = yield* threads.list(pullNumber);
    for (const thread of read.threads) {
      if (!thread.isResolved && !thread.isOutdated) {
        yield* threads.reply(thread.id, "Fixed in the latest push.");
        yield* threads.resolve(thread.id);
      }
    }
    return outstanding(yield* threads.list(pullNumber));
  });
// Effect<number, GitHubGraphQLError, ReviewThread | Repo>
```

`outstanding` is the merge-gate count: an unresolved thread always counts, and a resolved one counts only when the pull request author resolved it and a human other than the author has commented since (a bot's later comment is an acknowledgement, not a follow-up). `reply` refuses a blank body before any request is made.

## Issues and closing references

`GitHubIssue` covers issues: read, list, create, close, comment, and the GraphQL side that answers which issues a pull request closes. `commentOnce` is the create-or-skip counterpart to `PullRequestComment.upsert` — it posts a marked comment and never edits one, which is what you want for an announcement that would read as a rewrite of history if it changed after the fact:

```ts
import { GitHubIssue } from "@beep/github/GitHubIssue";
import { CommentMarker } from "@beep/github/PullRequestComment";
import * as Effect from "effect/Effect";

const marker = CommentMarker.make({ namespace: "release-bot", key: "shipped" });

const program = Effect.gen(function* () {
  const issues = yield* GitHubIssue;
  return yield* issues.commentOnce(1873, marker, "Shipped in the release just published.");
});
// CommentOnceResult — `wrote: true` when this call posted the comment,
// `wrote: false` when the marker was already there and nothing was sent.
// `comment` is the marked comment either way.
```

The existence check pages the issue's comments to the end and matches the marker in `upsert`'s exact spelling, so a comment either member writes stays findable by the other. It is a look-before-write: two runs racing on the same issue can both see no marker and both post, so treat the marker as the record rather than the check as a lock.

Whether a run should comment at all usually turns on which issues a pull request closes, and that is a grammar rather than an API call. That grammar lives in `@beep/github-references`, a pure package with no octokit behind it. Upstream re-exported its two dialects from this package for compatibility; the promotion dropped that re-export, so import them from `@beep/github-references`:

```ts
import { harvestIssueReferences, parseBareLineReference } from "@beep/github-references/IssueReferences";

console.log(harvestIssueReferences("Fixes #12 and closes #13."));
// [ { issueNumber: 12, keyword: "fixes", start: 0, end: 9 },
//   { issueNumber: 13, keyword: "closes", start: 14, end: 24 } ]

console.log(parseBareLineReference("Closes: #12"));
// Option.some({ issueNumber: 12, keyword: "closes" })

console.log(parseBareLineReference("closes #12 for real"));
// Option.none() — the bare-line dialect takes the whole line or nothing
```

`harvestIssueReferences` reads the **inline-in-prose** dialect: one of the nine closing keywords (`CLOSING_KEYWORDS`) followed by whitespace and `#<number>`, anywhere in the text, no colon — the spelling GitHub itself scans a pull request body for. Duplicates come back as written, because whether `fixes #1, fixes #1` means one intent or two is the caller's question. `parseBareLineReference` reads the **bare-line** dialect, where the whole trimmed line is the reference and the colon is optional — the shape a generated references block writes, one per line. Cross-repo (`owner/repo#12`) and full-URL references are out of scope.

`@beep/github-references` also carries a third dialect, the closing list (`Closes #247, #248 and #251`).

## Repository configuration

Six services cover the half of a repository that is policy rather than content: `RepositorySecret`, `RepositoryVariable`, `Ruleset`, `DeploymentEnvironment`, `RepositorySecurity` and `CodeScanning`. They are shaped for a program applying the same configuration across a fleet, so every list read paginates to the end and a truncated page never becomes a wrong decision.

Secrets carry the libsodium sealed box GitHub's API requires, which is why the value is a `Redacted<string>` rather than a plain one:

```ts
import { RepositorySecret } from "@beep/github/RepositorySecret";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

declare const token: string;

const program = Effect.gen(function* () {
  const secrets = yield* RepositorySecret;
  yield* secrets.set("NPM_TOKEN", Redacted.make(token)); // the "actions" store by default
  yield* secrets.setForEnvironment("production", "DEPLOY_KEY", Redacted.make(token));
  return yield* secrets.list("dependabot");
});
// ReadonlyArray<SecretInfo> — names only. GitHub returns a secret's value from no endpoint,
// so a diff against desired state detects a deleted secret and never an edited one.
```

`actions`, `dependabot` and `codespaces` are three stores on the same repository, each with its own public key, and the `scope` argument picks between them. The encryption lives in one module that only `RepositorySecret` imports, so a consumer that never writes a secret never links the crypto pair. `RepositoryVariable` mirrors the same six methods for the values that are not secret, where `set` lists first because GitHub splits create and update across two routes.

`Ruleset.upsert` matches an existing ruleset by name **and** `source_type`. That second field is why the projection carries it: `GET /repos/{owner}/{repo}/rulesets` returns the rulesets a repository inherits from its organization alongside its own, and matching on name alone would let a repository-scoped write `PUT` the organization's ruleset id — rewriting policy for every repository that organization owns. `Ruleset.teamId` and `Ruleset.roleId` resolve the numeric ids a bypass actor needs, scoped to the organization in `Repo`.

The rest follow their endpoints' own grain. `DeploymentEnvironment.upsert` is a plain `PUT` because GitHub's route is idempotent, and its `delete` takes the environment's secrets and variables with it, which fixes the order of any cleanup pass. `RepositorySecurity` reads and writes the three toggles GitHub keeps off the repository endpoint: vulnerability alerts, automated security fixes and private vulnerability reporting. `CodeScanning.configure` applies a CodeQL default setup and returns as soon as GitHub accepts it — the endpoint answers `202` and configures asynchronously, and nothing here polls — while `CodeScanning.languages` reports what GitHub detects in the repository, which is what you filter a configured language list against before calling `configure`.

`GitHubRepository` owns the repository's own settings. `updateSettings` is the faithfully typed `PATCH`; `applySettings` is the applicator above it, taking an open map, routing each key to whichever API can actually set it, and reporting what went out:

```ts
import { GitHubRepository } from "@beep/github/GitHubRepository";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const repository = yield* GitHubRepository;
  return yield* repository.applySettings({
    has_issues: true,
    has_sponsorships: false, // GraphQL-only: costs one extra read for the node id
    security_and_analysis: { secret_scanning: "enabled" },
  });
});
// AppliedSettings — { rest: [...], graphql: [...] }, in the caller's own key names.
// The two lists agree with the input right up until preparation drops a field
// GitHub would reject, which is what a person reading a dry run is checking for.
```

`updateSettings` takes octokit's own generated params, and those spell an optional field as `has_issues?: boolean` rather than `has_issues?: boolean | undefined` — so under `exactOptionalPropertyTypes` a `Partial<T>` built from your own settings schema does not assign to it at all. `repositoryPatch` is the supported way out, and it exists so the answer is never a cast:

```ts
import { repositoryPatch } from "@beep/github/GitHubRepository";

declare const config: { has_issues?: boolean | undefined; description?: string | undefined };

const patch = repositoryPatch({ has_issues: config.has_issues, description: config.description });
// a RepositoryPatch carrying only the fields that were actually set
```

Dropping the key is what the wire needs: `PATCH` reads an absent field as "leave it alone", while an explicit `null` is a value. `RepositoryPatchDraft` is the input type — the same fields, each allowed to be an explicit `undefined`. Build the draft as an object literal where you can: a key-by-key loop defeats TypeScript's correlation between two indexed accesses, which no helper can repair.

`security_and_analysis` accepts both the bare `"enabled"` a human writes in a config file and the `{ status: "enabled" }` GitHub's own parameter type declares. A map touching neither GraphQL-only setting never reads the node id, so the common case stays one request. `ownerType` answers `"User"` or `"Organization"` for the repository in `Repo`, which is how a shared settings template drops the fields GitHub accepts only on an organization-owned repository before applying itself to a personal one.

## GitHub App authentication

`GitHubApp.clientLayer` builds a `GitHubClient` authenticated as an app installation. The token is minted on build, re-minted a minute before it expires, and revoked on release — best effort — so a workflow does not leave live credentials behind:

```ts
import { GitHubApp } from "@beep/github/GitHubApp";
import * as Redacted from "effect/Redacted";

// bind once — layers memoize by reference
const AppClient = GitHubApp.clientLayer({
  appId: "123456",
  privateKey: Redacted.make(process.env.GITHUB_APP_PRIVATE_KEY as string),
  owner: "effect-ts",
});
// Layer<GitHubClient, GitHubAppError> — provide it wherever a GitHubClient is needed
```

`refreshSkew` in the options moves the re-mint earlier (`GitHubApp.clientLayer(request, { refreshSkew: Duration.minutes(5) })`), and refreshes are serialized behind one permit: concurrent requests that find the token spent mint one replacement and share it.

### Down-scoped installation tokens

An installation token holds everything the installation was granted unless the request narrows it. `TokenRequest.permissions`, `repositories` and `repositoryIds` become the JSON body of `POST /app/installations/{id}/access_tokens`, spelled as GitHub spells them (`repository_ids`); a request that sets none of them sends no body at all. Repositories go by name without owner or by id, never both — a request naming both fails with `GitHubAppError { kind: "request" }` before a JWT is signed, as does an owner-qualified name or a malformed permission key (anything but lowercase snake_case). Well-formed names are accepted even when GitHub has not published them, so the schema keeps working as GitHub adds permissions; GitHub itself rejects a name it does not know when the token is minted:

```ts
import { assertPermissions, GitHubApp } from "@beep/github/GitHubApp";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const required = { checks: "write", pull_requests: "write", contents: "read", metadata: "read" } as const;

const reviewerToken = Effect.gen(function* () {
  const app = yield* GitHubApp;
  const token = yield* app.token({
    appId: "123456",
    privateKey: Redacted.make(process.env.GITHUB_APP_PRIVATE_KEY as string),
    installationId: 42,
    repositories: ["beep-effect"],
    permissions: required,
  });
  // GitHub intersects the request with the installation's grant; fail closed on a shortfall.
  return yield* assertPermissions(token, required);
});
```

`assertPermissions(token, required)` reads `InstallationToken.permissions` through `TokenPermissions.fromGitHub` and fails with `TokenPermissionError { kind: "insufficient" }` unless every required permission is held at least at the level asked for; it passes the token through on success so it composes after `token`. Use `TokenPermissions.assertExact` when a broader grant is also a misconfiguration. `scopedToken` and `clientLayer` take the same request shape, so the down-scope applies to a scope-bound token and to every token the client layer mints and re-mints; the layer itself does not check the grant, so a program that must fail closed asserts once through `token` before building it.

Only `GitHubApp` and its statics import the JWT signer — a consumer authenticating with a plain token never reaches it.

## Errors

`GitHubError` covers REST, `GitHubGraphQLError` covers GraphQL, `GitHubAppError` covers app authentication, and `TokenPermissions` produces its own `TokenPermissionError` — four kinds, not one per resource:

```ts
import { GitHubError } from "@beep/github/GitHubError";
import * as Effect from "effect/Effect";

declare const upsertBranch: Effect.Effect<"created" | "reset", GitHubError>;

const program = upsertBranch.pipe(
  Effect.catchIf(GitHubError.hasKind("rateLimited"), (error) => Effect.logWarning(`retry after ${error.retryAfterMillis}ms`)),
);
```

A 422 also carries GitHub's validation entries as `validation`, each a `GitHubValidationEntry` with the `resource`, `field`, `code` and `message` GitHub sent. Only `already_exists` gets a `kind` of its own; for the other documented codes (`GitHubValidationCode`), branch with `hasValidationCode` rather than reading `reason`:

```ts
import { GitHubError } from "@beep/github/GitHubError";
import * as Effect from "effect/Effect";

declare const createRelease: Effect.Effect<void, GitHubError>;

const program = createRelease.pipe(
  Effect.catchIf(GitHubError.hasValidationCode("missing_field", "invalid"), (error) =>
    Effect.logError(`bad release parameters: ${error.validation?.map((entry) => entry.field).join(", ")}`),
  ),
);
```

Retrying is handled once, in the client: `RetryPolicy.default` retries a `transport` or `rateLimited` failure with full-jitter backoff, honoring GitHub's `retry-after` header up to a configurable ceiling. `RetryPolicy.none` disables it. A `notFound`, `rejected` or `unauthorized` failure never retries — it cannot change its mind between attempts.

## Testing

Every resource ships `makeTest(overrides?)` and `layerTest(overrides?)`: stub the members a test exercises, and every other member dies naming itself, so a test proves it touches nothing it did not stub:

```ts
import { GitBranch, type GitBranchShape } from "@beep/github/GitBranch";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";

const upsert: GitBranchShape["upsert"] = dual(2, (_name: string, _sha: string) => Effect.succeed("created"));

const TestBranches = GitBranch.layerTest({
  upsert,
});
```

`GitHubClient.layerFixture(fixtures)` is the one recorded-response double that pages for real: it builds a `PageSource` over the recorded array and hands it to the same pagination engine the live client uses, so a truncation path behaves identically under test and in production. Three things about its contract are worth knowing before you write against it:

```ts
import { GitHubClient, GitHubFixtures } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import * as Result from "effect/Result";

const fixtures = GitHubFixtures.make({
  request: {
    "GET /repos/{owner}/{repo}/languages": Result.succeed({ TypeScript: 12000 }),
    // A recorded Result failure answers this route with a typed error.
    "PATCH /repos/{owner}/{repo}": Result.fail(GitHubError.notFound("updateSettings", "repo")),
  },
  paginate: {
    "GET /repos/{owner}/{repo}/rulesets": Result.succeed([
      { id: 1, name: "main", enforcement: "active", source_type: "Repository", source: "effect-ts/effect" },
    ]),
  },
  requested: [], // filled in as the test runs
});

const TestClient = GitHubClient.layerFixture(fixtures);
// A route with no entry above DIES naming itself, rather than failing typed.
```

- **An unstubbed route dies by default.** A missing fixture is test wiring rather than a domain outcome, and a typed failure is only loud in code that does not catch — a program handling `GitHubError` per resource turns a missing stub into a different execution path, and the assertions then fail for reasons that name no fixture. `unstubbed: "fail"` fails the route with a typed not-found instead, and `"empty"` returns no items for pagination but a typed not-found for a missing single request.
- **A recorded `Result.fail(GitHubError)` is the response.** That is how a suite stubs a 404, a 422 or a rate limit deliberately. Leaning on a route's absence says only "unwired"; a recorded error says which route fails and why.
- **`fixtures.requested` records every call.** Each `RecordedCall` carries the `kind` of surface used, the `route` (the document name for `graphql`), the `params` the call was made with, and `perPage` for a paginated read. Params are what let a test assert what a method *sent*, which is the question any normalising write turns on.

## Features

- `GitHubClient` — the typed transport: `request`, `requestDecoded` (a mandatory-schema escape hatch for routes outside the generated map), `paginate` / `paginateStream`, `graphql`, and `rateLimit` (observation only — nothing here throttles on your behalf).
- `Repo` / `RepoRef` — the `{ owner, repo }` coordinate, resolved per call through `R`, with `Repo.provide` for multi-repository programs.
- `GitHubRepository` — the repository's settings as GitHub's own generated type, plus `defaultBranch`, `nodeId`, `ownerType` for gating organization-only fields, and `applySettings` reporting the keys it actually sent.
- `repositoryPatch` / `RepositoryPatchDraft` — build an `updateSettings` patch from fields that may be `undefined`, under `exactOptionalPropertyTypes`, without a cast.
- `GitHubError` / `GitHubGraphQLError` — one error per transport, `kind`-routed with `hasKind` for `Effect.catchIf`; a REST 422's validation entries ride on `validation`, matched with `hasValidationCode`.
- `RetryPolicy` — the client's one retry policy: full-jitter backoff, server-advised delays honored up to a ceiling.
- `GitHubApp` — App JWT signing, installation token minting/revocation, app and installation identity, and `clientLayer` for an App-authenticated `GitHubClient`.
- `GitBranch` / `GitTag` — Git Database API refs, with `upsert` collapsing the create-or-reset dance to one call and `GitTag.latestSemver` picking the newest version-shaped tag in one pass.
- `CheckRun` — `withCheckRun` concludes on every exit path; `CheckRunOutput.truncated()` cuts rendered output to GitHub's byte limits.
- `PullRequest` / `PullRequestComment` — upserts for both, `listFiles` answering with the same full `CommitFile` records a commit read returns, `headSha`/`baseSha` on `PullRequestInfo`, plus `CommentMarker` for finding a sticky comment again.
- `ReviewThread` — pull request review threads over GraphQL: every page of threads with their first 100 comments and a `commentsTruncated` flag, `reply`, `resolve` and `unresolve`, plus `outstanding`, the merge-gate count.
- `GitHubIssue` — issues and their comments, including `commentOnce` for a marked comment that is posted exactly once and never edited, and `linkedIssues` for what a pull request closes.
- `GitHubRelease` — releases and asset uploads, including the one route (`uploadAsset`, with the endpoint's optional display label) outside GitHub's generated endpoint map.
- `RepositorySecret` / `RepositoryVariable` — repository and environment secrets and variables, with the sealed-box encryption GitHub's secrets API demands kept in one module nothing else imports.
- `Ruleset` / `DeploymentEnvironment` / `RepositorySecurity` / `CodeScanning` — the rest of the configuration tier: rulesets matched by name and scope, idempotent environment writes, the three security toggles GitHub keeps off the repository endpoint, and CodeQL default setup with the language detection that gates it.
- `WorkflowDispatch` — fire a `workflow_dispatch` event, `list` the repository's workflows with the state string GitHub reports, or dispatch and wait for the run it created.
- `BotIdentity` — the author and committer a bot commits as, with `signoff` rendering the DCO trailer that a commit made through the Git Data API never gets from `git commit -s`.
- `Attestation` — upload and list attestations against a subject digest; building and signing the bundle is outside this package.
- `TokenPermissions` — a pure comparator between granted and required permissions, reaching nothing but `effect`.

## Importers

`@beep/github` is the workspace's GitHub API client; no other live source talks to `api.github.com` or links octokit. It is a driver, so the capability two-importer gate does not apply, but its consumers are:

- `@beep/repo-cli`: the `internal/github` REST, GraphQL and identity modules, and the Yeet `GhOps` pull-request operations.
- The lab `github-actions` port (`GitHubToken`, and `CheckState`'s structural test), transitional until that module is promoted.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/github

# from packages/drivers/github
bun run check
bun run test
```

The suites run sequentially (`vitest.config.ts`): several share per-file fixture state written for the lab's sequential runner.

## Provenance

`@beep/github` is ported from upstream `@effected/github` 0.15.1
(MIT, C. Spencer Beggs) at commit `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. It was carried through
the effected port and promoted into this workspace package by `goals/effected-promotion` (wave 2b).
The package [LICENSE](./LICENSE) carries both the beep-effect and the upstream copyright notices.
[KNOWLEDGE.md](./KNOWLEDGE.md) holds the upstream knowledge bundle verbatim; its relative links
point into the upstream checkout. The port reviews and the lab's canon exceptions are archived under
`goals/effected-promotion/history/`.

Promotion changes, beyond the lab port recorded below:

- The compatibility re-export of six `@beep/github-references` names (`CLOSING_KEYWORDS`, `ClosingKeyword`, `IssueReference`, `harvestIssueReferences`, `BareLineReference`, `parseBareLineReference`) is dropped, along with its test; import them from `@beep/github-references`. The test-only `readHeaderString` alias is dropped too; its property test imports `headerString` from `@beep/github/internal/headers`.
- The sealed-box nonce is `blake2b(input, { dkLen: 24 })` from `@noble/hashes` (already in the workspace catalog) instead of `blakejs`, which removes the dependency and its Bun/Node CommonJS interop workaround. The blakejs interop tests are replaced by BLAKE2b-192 known-answer tests. `tweetnacl` stays.
- `CodeScanningSetup`'s `state`, `query_suite`, `threat_model`, `runner_type` and `runner_label` are exact optional keys (`S.optionalKey`, EF-40): omit a key instead of passing `undefined` (`CodeScanning.test.ts` pins the rejection; `goals/exact-optional-keys`).

## Port notes

### Attribution

- Upstream package: `@effected/github` 0.15.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (beep-effect notice plus the verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Native sets, Object helpers and Date timestamps become HashSet, Record and DateTime, with Effect-clock check timestamps and a public HashSet field set. (packages/drivers/github/test/GitHubRepository.test.ts; packages/drivers/github/test/GitHubClient.test.ts; packages/drivers/github/test/resources2.test.ts; module suite packages/drivers/github/test/**)
- **tagged-errors** — Native stub/fixture errors and raw transport failures acquire schema-tagged carriers while retaining messages and original classified causes. (packages/drivers/github/test/GitHubClient.test.ts:557; packages/drivers/github/test/GitHubClient.test.ts:646; packages/drivers/github/test/transport.test.ts:93; module suite packages/drivers/github/test/**)
- **schema-first** — Erased models and handwritten domains gain schemas, LiteralKit and JSON codecs, preserving open plain-object contracts while the status guard rejects arrays. (packages/drivers/github/test/CodeScanning.test.ts:112; packages/drivers/github/test/GitHubRepository.test.ts:334; packages/drivers/github/test/Ruleset.test.ts:233; packages/drivers/github/test/resources2.test.ts:635; module suite packages/drivers/github/test/**)
- **numeric-domains** — RulesetInfo and WorkflowInfo gain finite-number validation for their formerly type-only numeric IDs. (packages/drivers/github/test/Ruleset.test.ts:246; packages/drivers/github/test/WorkflowDispatch.test.ts:196; module suite packages/drivers/github/test/**)
- **type-safety** — Cast-based fixtures and transport boundaries become route-typed Results and safe narrowing, with notFound for empty single requests and no snapshots from thrown header arrays. (packages/drivers/github/test/GitHubClient.test.ts:631; packages/drivers/github/test/GitHubClient.test.ts:759; packages/drivers/github/test/Ruleset.test.ts:205; packages/drivers/github/test/GitHubRepository.test.ts:159; packages/drivers/github/test/transport.test.ts:84)
- **tsgo-diagnostics** — Tsgo diagnostics force Effect-valued read members, dual helper overloads and schema make/decoding forms, with adjusted suite call shapes. (module suite packages/drivers/github/test/**)
- **effect-first** — Effect-native functions, helpers and scoped layer composition replace wrappers, and malformed commit files become typed operation-specific decode failures. (packages/drivers/github/test/resources.test.ts:446; packages/drivers/github/test/resources.test.ts:463; packages/drivers/github/test/resources2.test.ts:589; packages/drivers/github/test/GitHubRepository.test.ts:39; module suite packages/drivers/github/test/**)
- **effect-imports** — Root Effect barrel imports become per-module effect/* imports throughout source, tests and examples. (module suite packages/drivers/github/test/**)
- **identity-annotations** — Local schema names and upstream service keys become composed @beep/identity identifiers with owning schema and field metadata. (module suite packages/drivers/github/test/**)
- **test-environment** — Manifest reads and workflow fixtures target the lab layout and the repaired endpoints while preserving their original assertions. (packages/drivers/github/test/reachability.test.ts:176; packages/drivers/github/test/reachability.test.ts:227; packages/drivers/github/test/resources2.test.ts:1076; packages/drivers/github/test/resources2.test.ts:1105)
- **reachability** — Reachability follows lab source paths, .ts exports and the per-module Effect/Beep import graph while retaining dependency and side-effect checks. (packages/drivers/github/test/reachability.test.ts:29; packages/drivers/github/test/reachability.test.ts:164; packages/drivers/github/test/reachability.test.ts:168; packages/drivers/github/test/reachability.test.ts:222)
- **upstream-bug** — Concurrent token refresh shares one replacement and cleans up every minted token instead of overwriting and leaking a replacement. (packages/drivers/github/test/GitHubApp.test.ts:352)
- **upstream-bug** — Synchronous check-run callback defects now trigger conclusion and retain the original defect instead of leaving the run in progress. (packages/drivers/github/test/resources2.test.ts:343)
- **upstream-bug** — UTF-8 truncation preserves complete replacement characters instead of mistaking them for split sequences. (packages/drivers/github/test/resources2.test.ts:74; packages/drivers/github/test/resources2.test.ts:82)
- **upstream-bug** — Invalid decoded public-key lengths produce typed encoding/decode failures instead of synchronous encryption defects. (packages/drivers/github/test/crypto.test.ts:134; packages/drivers/github/test/RepositorySecret.test.ts:189; packages/drivers/github/test/RepositorySecret.test.ts:206)
- **upstream-bug** — Permission construction preserves __proto__ as an own grant instead of dropping it. (packages/drivers/github/test/TokenPermissions.test.ts:26)
- **upstream-bug** — Missing permission checks reject inherited prototype properties instead of accepting them as grants. (packages/drivers/github/test/TokenPermissions.test.ts:40; packages/drivers/github/test/TokenPermissions.test.ts:73)
- **upstream-bug** — Exact permission checks report surplus prototype-name grants instead of treating inherited properties as requirements. (packages/drivers/github/test/TokenPermissions.test.ts:51; packages/drivers/github/test/TokenPermissions.test.ts:89)
- **upstream-bug** — Numeric workflow IDs discover completed runs through their workflow endpoint instead of timing out on filename matching. (packages/drivers/github/test/WorkflowDispatch.test.ts:70)
- **upstream-bug** — Workflow discovery excludes filename suffix collisions by querying the requested workflow directly. (packages/drivers/github/test/WorkflowDispatch.test.ts:80)
- **upstream-bug** — Workflow waiting filters for workflow_dispatch instead of accepting unrelated push runs. (packages/drivers/github/test/WorkflowDispatch.test.ts:91)
- **upstream-bug** — Workflow polling follows the first selected run ID instead of repeating discovery on every poll. (packages/drivers/github/test/WorkflowDispatch.test.ts:100)
- **upstream-bug** — Zero polling intervals fail before dispatch instead of producing an infinite polling budget. (packages/drivers/github/test/WorkflowDispatch.test.ts:121)
- **upstream-bug** — Workflow waiting enforces an elapsed deadline across requests and sleeps instead of relying on a poll count. (packages/drivers/github/test/WorkflowDispatch.test.ts:134; packages/drivers/github/test/WorkflowDispatch.test.ts:157; packages/drivers/github/test/WorkflowDispatch.test.ts:179)
- **upstream-bug** — Pagination preserves per-request fetch and redirect options that the upstream iterator dropped. (packages/drivers/github/test/transport.test.ts:114)
- **upstream-bug** — Interrupted pagination aborts the pending fetch instead of leaving it running. (packages/drivers/github/test/transport.test.ts:176 (pagination case))
- **upstream-bug** — Interrupted GraphQL requests abort the pending fetch instead of leaving it running. (packages/drivers/github/test/transport.test.ts:176 (graphql case))
- **upstream-bug** — Bodyless Rest.Data routes expose their actual empty-string success type while resource void methods retain undefined results. (packages/drivers/github/test/Rest.test.ts:9; packages/drivers/github/test/GitHubApp.test.ts:177; packages/drivers/github/test/GitTag.test.ts:8)
- **upstream-bug** — Lab drops invalid numeric HTTP statuses and returns a typed transport error where upstream throws during error construction. (packages/drivers/github/test/GitHubError.test.ts:54)
- **upstream-bug** — Lab recognizes duplicate-resource prose before display truncation where upstream can misclassify the same long message. (packages/drivers/github/test/GitHubError.test.ts:65)
- **upstream-bug** — Lab saturates oversized retry delays and preserves typed rate-limit failures where upstream can construct unsafe or infinite milliseconds and defect. (packages/drivers/github/test/internal/headers.coverage.test.ts:15; packages/drivers/github/test/transport.test.ts:92)
- **upstream-bug** — Lab supplies a stable GraphQL description for failed string coercion where upstream throws TypeError. (packages/drivers/github/test/GraphQL.coverage.test.ts:148)
- **upstream-bug** — Lab refreshes rate-limit snapshots from top-level GraphQL failure headers where upstream reads only nested response headers. (packages/drivers/github/test/transport.test.ts:123; packages/drivers/github/test/internal/octokit.coverage.test.ts:21)
- **upstream-bug** — Lab rejects slash-containing repository coordinates where upstream accepts colliding, unparseable slugs. (packages/drivers/github/test/Repo.coverage.test.ts:15; packages/drivers/github/test/Repo.property.test.ts:21)
- **type-safety** — Lab excludes arrays at newly repaired record boundaries where upstream casts accept them, changing malformed-array classification. (packages/drivers/github/test/GitHubError.test.ts:23; packages/drivers/github/test/GraphQL.coverage.test.ts:25; packages/drivers/github/test/internal/octokit.coverage.test.ts:21)
- **effect-first** — Lab decodes the newly repaired external projections into typed failures and preserves interruptible token refresh with explicit ownership, while upstream uses throwing or unchecked projections and lacks serialized ownership. (packages/drivers/github/test/GitHubApp.test.ts:304; packages/drivers/github/test/PullRequestComment.test.ts:27; packages/drivers/github/test/WorkflowDispatch.test.ts:214; packages/drivers/github/test/GitTag.test.ts:28; packages/drivers/github/test/RepositoryVariable.test.ts:241; packages/drivers/github/test/RepositorySecret.test.ts:238; packages/drivers/github/test/Ruleset.test.ts:266)
- **upstream-bug** — The lab returns a typed transport error with preserved cause for uncoercible REST throwables where upstream unchecked conversion throws (packages/drivers/github/test/GitHubError.test.ts:23)
- **upstream-bug** — The lab returns typed decode failures for malformed content payloads where upstream property access or base64 string processing defects (packages/drivers/github/test/GitHubContent.coverage.test.ts:10)
- **upstream-bug** — The lab follows preceding cross-reference pages until a match or exhaustion where upstream searches only the latest 50 events (packages/drivers/github/test/GitHubIssue.coverage.test.ts:213)
- **upstream-bug** — The lab preserves own __proto__ permission grants during GitHubApp normalization where upstream inherited-setter assignment loses them (packages/drivers/github/test/GitHubApp.test.ts:131)
- **upstream-bug** — The lab ignores invalid rate-limit snapshots while retaining payloads, typed errors and prior metadata where upstream snapshot construction defects (packages/drivers/github/test/transport.test.ts:205; packages/drivers/github/test/internal/octokit.coverage.test.ts:12)
- **upstream-bug** — The lab upsert creation and reset paths address the same once-normalized tag where upstream creation normalizes twice (packages/drivers/github/test/GitTag.test.ts:113)
- **upstream-bug** — The lab skips undefined settings with no writes or applied-key reports where upstream sends unnecessary requests and reports omitted values as applied (packages/drivers/github/test/GitHubRepository.test.ts:362)
- **effect-first** — The lab validates newly touched external responses into typed errors instead of upstream unchecked projections, and repairs prior lab rotation cleanup by interrupting active work and owning observed credentials before decoding (packages/drivers/github/test/**; GitHubApp.test.ts:441,469,503; GitBranch.test.ts:164; GitTag.test.ts:73)

### Dependency backlog

None.

Fixture successes must contain complete response values for their route. Use `Result.succeed("")` for a bodyless response, matching Octokit's runtime. Raw payloads for `requestDecoded` belong in `fixtures.requestDecoded`; the supplied schema checks them, while GraphQL continues to use `fixtures.graphql`.

## License

[MIT](LICENSE)
