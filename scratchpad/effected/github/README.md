# github (lab port of @effected/github)

[![npm](https://img.shields.io/npm/v/@effected%2Fgithub?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/github)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Typed GitHub REST and GraphQL for [Effect](https://effect.website) v4. `client.request("GET /repos/{owner}/{repo}", { owner, repo })` types both the parameters and the returned `data` from the route literal alone — no `operation: string`, no callback, no cast. One `GitHubError` covers every REST failure with a `kind` you branch on instead of grepping a message, one pagination engine backs every paginating route and `client.request`'s `Stream` form, and a set of resource services (`GitBranch`, `GitTag`, `CheckRun`, `PullRequest`, `PullRequestComment`, `GitHubRelease`, `Attestation`) turn multi-call dances — "does this branch already exist?", "conclude this check run no matter how the program exits" — into one call. A second tier writes the configuration half: secrets, variables, rulesets, deployment environments, the security toggles and CodeQL default setup. `GitHubApp` mints and revokes installation tokens for App auth.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/github

Hand-rolled octokit wrappers tend to converge on the same shape: a `rest<T>(operation: string, fn: (octokit) => Promise<{ data: T }>)` helper where `T` is whatever the caller wrote and nothing connects it to the endpoint. This package's route-keyed `request` closes that gap — `@octokit/types` already generates a map from GitHub's own OpenAPI description, and `@octokit/core`'s `request` already consumes it, so there was no reason to reinvent either.

The error model gets the same treatment. `GitHubError.kind` is a literal union (`notFound`, `alreadyExists`, `rejected`, `unauthorized`, `rateLimited`, `transport`, `decode`) produced by one classification step, `GitHubError.fromOctokit`, instead of one hand-written mapper per resource. `kind: "alreadyExists"` is what makes `GitBranch.upsert` and `GitTag.upsert` a single round trip in the common case, rather than a create-then-catch-then-check-then-reset dance repeated at every call site that needs it.

This package also owns the octokit runtime so nothing downstream has to. `@octokit/rest` and `@octokit/auth-app` are deliberately absent — the rest wrapper is a request-logging plugin plus 1.4 MB of duplicate endpoint types, and `auth-app` drags in `createOAuthUserAuth`, roughly 492 KB of OAuth machinery this package never calls. GitHub App JWTs are signed by `universal-github-app-jwt` instead, the same zero-dependency signer `@octokit/auth-app` itself uses. A consumer that only authenticates with a token it already holds never links the JWT signer at all: the App-authenticated layer lives in its own module (`GitHubApp`), and nothing here is gathered into a namespace object that would defeat that split.

## Install

```bash
npm install @effected/github effect
```

```bash
pnpm add @effected/github effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

```ts
import { GitHubClient, Repo, RepoRef } from "@effected/github";
import { Effect } from "effect";

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
import { GitBranch, GitHubClient, Repo } from "@effected/github";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const branches = yield* GitBranch;
  return yield* branches.upsert("release/1.2", "abc123");
});
// Effect<"created" | "reset", GitHubError, GitBranch | Repo>
// one round trip in the common case, two in the raced one — never four
```

`CheckRun.withCheckRun` runs a program inside a check run and concludes it on every exit path — success, typed failure, defect or interrupt — so a run never gets stuck `in_progress`:

```ts
import { CheckRun } from "@effected/github";
import { Effect } from "effect";

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

`GitTag.latestSemver` walks tags and picks the newest version-shaped one in a single pass, over `@effected/semver`'s synchronous comparator — no round trip per candidate. `PullRequest.upsert` and `PullRequestComment.upsert` (a marker-tagged sticky comment) follow the same one-call-one-intent shape.

## Issues and closing references

`GitHubIssue` covers issues: read, list, create, close, comment, and the GraphQL side that answers which issues a pull request closes. `commentOnce` is the create-or-skip counterpart to `PullRequestComment.upsert` — it posts a marked comment and never edits one, which is what you want for an announcement that would read as a rewrite of history if it changed after the fact:

```ts
import { CommentMarker, GitHubIssue } from "@effected/github";
import { Effect } from "effect";

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

Whether a run should comment at all usually turns on which issues a pull request closes, and that is a grammar rather than an API call. That grammar now lives in [`@effected/github-references`](https://www.npmjs.com/package/@effected/github-references), a pure package with no octokit behind it; this package re-exports the two dialects it used to own so existing code keeps compiling:

```ts
import { harvestIssueReferences, parseBareLineReference } from "@effected/github";

console.log(harvestIssueReferences("Fixes #12 and closes #13."));
// [ { issueNumber: 12, keyword: "fixes", start: 0, end: 9 },
//   { issueNumber: 13, keyword: "closes", start: 14, end: 24 } ]

console.log(parseBareLineReference("Closes: #12"));
// Option.some({ issueNumber: 12, keyword: "closes" })

console.log(parseBareLineReference("closes #12 for real"));
// Option.none() — the bare-line dialect takes the whole line or nothing
```

`harvestIssueReferences` reads the **inline-in-prose** dialect: one of the nine closing keywords (`CLOSING_KEYWORDS`) followed by whitespace and `#<number>`, anywhere in the text, no colon — the spelling GitHub itself scans a pull request body for. Duplicates come back as written, because whether `fixes #1, fixes #1` means one intent or two is the caller's question. `parseBareLineReference` reads the **bare-line** dialect, where the whole trimmed line is the reference and the colon is optional — the shape a generated references block writes, one per line. Cross-repo (`owner/repo#12`) and full-URL references are out of scope.

The re-export covers exactly six names — `CLOSING_KEYWORDS`, `ClosingKeyword`, `IssueReference`, `harvestIssueReferences`, `BareLineReference`, `parseBareLineReference` — and may be dropped at a later release. Import from `@effected/github-references` directly for new code; it also carries a third dialect this package does not re-export, the closing list (`Closes #247, #248 and #251`).

## Repository configuration

Six services cover the half of a repository that is policy rather than content: `RepositorySecret`, `RepositoryVariable`, `Ruleset`, `DeploymentEnvironment`, `RepositorySecurity` and `CodeScanning`. They are shaped for a program applying the same configuration across a fleet, so every list read paginates to the end and a truncated page never becomes a wrong decision.

Secrets carry the libsodium sealed box GitHub's API requires, which is why the value is a `Redacted<string>` rather than a plain one:

```ts
import { RepositorySecret } from "@effected/github";
import { Effect, Redacted } from "effect";

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
import { GitHubRepository } from "@effected/github";
import { Effect } from "effect";

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
import { repositoryPatch } from "@effected/github";

declare const config: { has_issues?: boolean | undefined; description?: string | undefined };

const patch = repositoryPatch({ has_issues: config.has_issues, description: config.description });
// a RepositoryPatch carrying only the fields that were actually set
```

Dropping the key is what the wire needs: `PATCH` reads an absent field as "leave it alone", while an explicit `null` is a value. `RepositoryPatchDraft` is the input type — the same fields, each allowed to be an explicit `undefined`. Build the draft as an object literal where you can: a key-by-key loop defeats TypeScript's correlation between two indexed accesses, which no helper can repair.

`security_and_analysis` accepts both the bare `"enabled"` a human writes in a config file and the `{ status: "enabled" }` GitHub's own parameter type declares. A map touching neither GraphQL-only setting never reads the node id, so the common case stays one request. `ownerType` answers `"User"` or `"Organization"` for the repository in `Repo`, which is how a shared settings template drops the fields GitHub accepts only on an organization-owned repository before applying itself to a personal one.

## GitHub App authentication

`GitHubApp.clientLayer` builds a `GitHubClient` authenticated as an app installation. The token is minted on build, re-minted a minute before it expires, and revoked on release — best effort — so a workflow does not leave live credentials behind:

```ts
import { GitHubApp } from "@effected/github";
import { Redacted } from "effect";

// bind once — layers memoize by reference
const AppClient = GitHubApp.clientLayer({
  appId: "123456",
  privateKey: Redacted.make(process.env.GITHUB_APP_PRIVATE_KEY as string),
  owner: "effect-ts",
});
// Layer<GitHubClient, GitHubAppError> — provide it wherever a GitHubClient is needed
```

Only `GitHubApp` and its statics import the JWT signer — a consumer authenticating with a plain token never reaches it.

## Errors

`GitHubError` covers REST, `GitHubGraphQLError` covers GraphQL, `GitHubAppError` covers app authentication, and `TokenPermissions` produces its own `TokenPermissionError` — four kinds, not one per resource:

```ts
import { GitHubError } from "@effected/github";
import { Effect } from "effect";

declare const upsertBranch: Effect.Effect<"created" | "reset", GitHubError>;

const program = upsertBranch.pipe(
  Effect.catchIf(GitHubError.hasKind("rateLimited"), (error) => Effect.logWarning(`retry after ${error.retryAfterMillis}ms`)),
);
```

A 422 also carries GitHub's validation entries as `validation`, each a `GitHubValidationEntry` with the `resource`, `field`, `code` and `message` GitHub sent. Only `already_exists` gets a `kind` of its own; for the other documented codes (`GitHubValidationCode`), branch with `hasValidationCode` rather than reading `reason`:

```ts
import { GitHubError } from "@effected/github";
import { Effect } from "effect";

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
import { GitBranch } from "@effected/github";
import { Effect } from "effect";

const TestBranches = GitBranch.layerTest({
  upsert: () => Effect.succeed("created"),
});
```

`GitHubClient.layerFixture(fixtures)` is the one recorded-response double that pages for real: it builds a `PageSource` over the recorded array and hands it to the same pagination engine the live client uses, so a truncation path behaves identically under test and in production. Three things about its contract are worth knowing before you write against it:

```ts
import { GitHubClient, GitHubError } from "@effected/github";

const fixtures = {
  request: {
    "GET /repos/{owner}/{repo}": { default_branch: "main" },
    // A recorded GitHubError *is* the response: this route fails with it.
    "PATCH /repos/{owner}/{repo}": GitHubError.notFound("updateSettings", "repo"),
  },
  paginate: { "GET /repos/{owner}/{repo}/rulesets": [{ id: 1, name: "main", source_type: "Repository" }] },
  requested: [], // filled in as the test runs
};

const TestClient = GitHubClient.layerFixture(fixtures);
// A route with no entry above DIES naming itself, rather than failing typed.
```

- **An unstubbed route dies by default.** A missing fixture is test wiring rather than a domain outcome, and a typed failure is only loud in code that does not catch — a program handling `GitHubError` per resource turns a missing stub into a different execution path, and the assertions then fail for reasons that name no fixture. `unstubbed: "fail"` fails the route with a typed not-found instead, and `"empty"` serves an empty value for a suite whose subject is decisions rather than endpoints.
- **A recorded `GitHubError` value is the response.** That is how a suite stubs a 404, a 422 or a rate limit deliberately. Leaning on a route's absence says only "unwired"; a recorded error says which route fails and why.
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
- `GitHubIssue` — issues and their comments, including `commentOnce` for a marked comment that is posted exactly once and never edited, and `linkedIssues` for what a pull request closes.
- `harvestIssueReferences` / `parseBareLineReference` — a compatibility re-export of the two closing-reference dialects that moved to `@effected/github-references`, with `CLOSING_KEYWORDS` and their result types.
- `GitHubRelease` — releases and asset uploads, including the one route (`uploadAsset`, with the endpoint's optional display label) outside GitHub's generated endpoint map.
- `RepositorySecret` / `RepositoryVariable` — repository and environment secrets and variables, with the sealed-box encryption GitHub's secrets API demands kept in one module nothing else imports.
- `Ruleset` / `DeploymentEnvironment` / `RepositorySecurity` / `CodeScanning` — the rest of the configuration tier: rulesets matched by name and scope, idempotent environment writes, the three security toggles GitHub keeps off the repository endpoint, and CodeQL default setup with the language detection that gates it.
- `WorkflowDispatch` — fire a `workflow_dispatch` event, `list` the repository's workflows with the state string GitHub reports, or dispatch and wait for the run it created.
- `BotIdentity` — the author and committer a bot commits as, with `signoff` rendering the DCO trailer that a commit made through the Git Data API never gets from `git commit -s`.
- `Attestation` — upload and list attestations against a subject digest; building and signing the bundle is `@effected/sbom`'s job.
- `TokenPermissions` — a pure comparator between granted and required permissions, reaching nothing but `effect`.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/github` 0.15.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
