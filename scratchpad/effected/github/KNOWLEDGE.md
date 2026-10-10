# github — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/github/CLAUDE.md -->
# CLAUDE.md — @effected/github

Typed GitHub REST and GraphQL over octokit's core request surface, with App
auth, one resource service per GitHub noun, and the configuration-write half.
**Integrated tier** — it owns the octokit runtime so nothing downstream has to.

Durable knowledge lives in the bundle, not here. Start at
`okf/modules/github.md` and load the child a task needs:

- `okf/modules/github.md` — Load when: starting any work here. Tier and
  dependency table, why `@octokit/rest` / `@octokit/auth-app` are absent and
  the crypto pair is confined, the measured bundle-reachability invariant,
  module topology, the per-call `Repo` coordinate, Actions decoupling, the
  test harnesses and the fixture client's contract.
- `okf/interfaces/github-rest-client.md` — Load when: adding or changing a
  REST call, the route table, `requestDecoded`, `repositoryPatch`, resource
  id narrowing, or pagination.
- `okf/interfaces/github-errors-and-retry.md` — Load when: touching the
  error taxonomy, classification or the retry policy.
- `okf/interfaces/github-app-auth.md` — Load when: working on GitHub App
  auth, the token lifecycle, bot identity and signoff, or the
  Actions-runtime seam.
- `okf/interfaces/github-resources.md` — Load when: changing a resource
  service, an upsert, a projection, a normalising write, the
  configuration-write six or the check-run bracket.
- `okf/interfaces/github-graphql.md` — Load when: adding a typed GraphQL
  document or changing response decoding.
- `okf/gotchas/branch-reset-closes-pull-request.md` — Load when: composing
  `GitBranch.upsert` with `GitCommit.commitFiles`.
- `okf/gotchas/repaired-fixtures-go-green-on-impossible-state.md` — Load
  when: a source change moves a call to a new route and the fixture suites
  die with `no fixture for`.
- `okf/decisions/github-owns-octokit-runtime.md`,
  `okf/decisions/github-compat-re-export-droppable.md` — Load when: adding a
  dependency, or touching the six-name `@effected/github-references`
  re-export in `src/index.ts`.
- `okf/modules/github-references.md` — Load when: the task is the
  issue-reference grammar itself; it lives in `packages/github-references`.

## Operating rules

- `pnpm build --filter @effected/github`; never run `savvy.build.ts`
  directly. `savvy.build.ts` suppresses only the synthesized `_base` schema
  class warnings — never widen it.
- Tests: `@effect/vitest`, `it.effect`, `assert.*` — never `expect`; in
  `__test__/`, run root-relative with `--coverage.enabled=false` for a
  subset. Tests drive the real client through octokit's `fetch` option
  (`__test__/fixtures.ts`); every service ships `makeTest` / `layerTest`.
- Read `__test__/reachability.test.ts` before adding any import between
  `src/` modules or any dependency: it pins the import graph the bundle's
  reachability table describes, that every `src/` module is re-exported from
  `src/index.ts`, and that `RepositorySecret` alone reaches the crypto pair.
- Import `blakejs` as a default import only, and keep `internal/crypto.ts`
  imported by `RepositorySecret` and nothing else.
- Wrap a `static readonly layer` factory in an arrow; classify status codes
  only in `GitHubError.fromOctokit`; narrow ids only through
  `internal/ids.ts`; paginate every list read.


---
<!-- okf/modules/github.md -->
---
type: Module
title: "@effected/github"
description: The kit's typed GitHub REST and GraphQL API layer, owning the octokit runtime.
status: stable
kind: package
resource: ../../packages/github
tags: [bundle, architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: acf1afc161d550b734b64ea4682399759e0b4fb9282f314d05725a19294c03b6
---

# @effected/github

`@effected/github` is the kit's typed GitHub API layer: one client over
GitHub's REST and GraphQL endpoints, plus the resource services that turn raw
endpoints into domain operations. It owns the octokit runtime so that
[`@effected/github-actions`](github-actions.md) and the consumer repositories
never take an octokit edge themselves.

Three properties define the package:

1. **Nothing is `unknown`.** octokit ships a complete, generated, types-only
   description of every GitHub endpoint. `client.request("GET
   /repos/{owner}/{repo}", { owner, repo })` types both the parameters and the
   returned data from the route literal alone — see
   [the REST client interface](../interfaces/github-rest-client.md).
2. **A light consumer cannot reach a heavy engine.** The client, the repo
   coordinate and most resource services import only octokit core and its
   paginator; the JWT signer and the sealed-box crypto pair are each confined
   to one module. See [Bundle reachability](#bundle-reachability).
3. **Errors are sized to what consumers read**: a reason string, a status, an
   operation name and a structural `kind` — see
   [errors and retry](../interfaces/github-errors-and-retry.md).

Scope is closed by the consumer repositories, not by GitHub's API. An endpoint
earns a resource method when a consumer needs it typed; everything else is
reachable through the typed request surface without a cast, so "not modelled"
never means "not usable".

The contract lives in five child interfaces:

- [The typed REST surface](../interfaces/github-rest-client.md) — the
  route-is-the-key mechanism, the client shape, the escape hatch for routes
  outside the generated map, and the pagination model.
- [Errors and resilience](../interfaces/github-errors-and-retry.md) — one
  classification step, the structural `kind`, and the single retry policy
  driven by GitHub's own headers.
- [App authentication](../interfaces/github-app-auth.md) — the JWT engine,
  the token lifecycle, and the seam `@effected/github-actions` builds its
  bridge on.
- [The resource services](../interfaces/github-resources.md) — what each
  resource owns: upserts, say-once semantics, projections, the
  configuration-write half, the check-run bracket, byte budgeting, the
  permission comparator, and attestation metadata.
- [GraphQL](../interfaces/github-graphql.md) — typed documents and which of
  them this package owns.

See also [why `github` owns the octokit runtime](../decisions/github-owns-octokit-runtime.md).

## Tier and dependencies

**Integrated tier**, per [the tier taxonomy](../glossary/library-tier.md) —
it owns the octokit runtime, which is the whole reason the package exists:
interpreting GitHub's API is a concern that should exist once, typed, in a
package named for it.

| Dependency | Why |
| --- | --- |
| `@octokit/core` | the `Octokit` class: a route-keyed, fully typed `request`, plus `graphql` |
| `@octokit/plugin-paginate-rest` | the composable paginator over a bare core instance, plus the type that statically rejects paginating a non-paginating route |
| `@octokit/types` | the generated endpoint map; ships no JavaScript — types only |
| `universal-github-app-jwt` | signs the App JWT; zero dependencies |
| `tweetnacl` + `blakejs` | the libsodium sealed box GitHub's secrets API requires, reachable only from `RepositorySecret` |
| `@effected/semver` (`workspace:^`) | semver-aware tag selection; pure tier, so the edge is free |
| `@effected/github-references` (`workspace:^`) | the compat re-export of six issue-reference names — see [`github-references`](github-references.md) |

**The crypto pair is not a free-hand choice, and `node:crypto` is not an
alternative.** A sealed box is `crypto_box` under an ephemeral keypair with a
nonce derived as `blake2b(ephemeral_pk ‖ recipient_pk, 24)`
(`packages/github/src/internal/crypto.ts`); Node ships neither X25519
`crypto_box` nor blake2b, so the choice was these two leaves or a full
libsodium build. Treat a third non-octokit dependency added here as a fresh
decision, not a free ride on this one. `blakejs`'s `blake2b` must be imported
as a default import: Node's `cjs-module-lexer` detects `blake2b` as a named
export and not its nine siblings, so a named import works for one function
and throws for its neighbour at runtime after a clean build
(`packages/github/src/internal/crypto.ts:5-13`).

`@octokit/rest` and `@octokit/auth-app` are deliberately absent and must not
be reintroduced. `@octokit/rest` bundles a request-log plugin this package
would immediately silence, plus megabytes of generated types duplicating
`@octokit/types`. `@octokit/auth-app` re-exports an OAuth user-auth factory,
making hundreds of kilobytes of OAuth app, user and device-flow machinery
reachable from a package that only ever mints installation tokens; what is
actually needed — an RS256-signed App JWT plus one typed token-endpoint
route — comes from `universal-github-app-jwt` directly, the same
zero-dependency leaf `@octokit/auth-app` itself depends on.

## Bundle reachability

The tree-shakability invariant is measured:

| A consumer that imports… | links | does **not** link |
| --- | --- | --- |
| the client, the repo coordinate, the route vocabulary, any resource service but `RepositorySecret` | octokit core and the paginator | the JWT signer, the crypto pair |
| the App service or its client layer | the above plus the JWT signer | the crypto pair |
| `RepositorySecret` | the above plus `tweetnacl` and `blakejs` | the JWT signer |
| the pure classes | nothing but `effect` | all octokit |

Three mechanisms carry it:

1. **Module-per-layer-variant.** The token and config client layers live in
   `GitHubClient.ts`, which imports only octokit core and the paginator; the
   App-authenticated client layer lives in `GitHubApp.ts`, the only module
   importing the JWT signer.
2. **No namespace object, anywhere** — see
   [no barrel re-exports](../conventions/no-barrel-re-exports.md). The entry
   point re-exports by name only, so referencing one member never retains
   every member's whole module graph.
3. **The pure surface is genuinely pure.** The permission comparator, bot
   identity, the repo reference, the comment marker, the check-run output
   budgeter and the retry policy are schema classes in modules importing
   nothing but `effect`. The closing-reference grammar is the case that
   moved out entirely — see [`github-references`](github-references.md) —
   because hosting a pure vendor rule "in the kit" turned out not to mean
   "in this package": keeping it here cost nothing to `github`'s own
   consumers and cost the octokit-free ones the whole client tree. `github`
   keeps a six-name compat re-export and nothing else.

This invariant gets a test rather than a promise:
`packages/github/__test__/reachability.test.ts` walks the runtime import
graph of `src` statically (type-only imports skipped, since they are erased),
asserting the token-only client does not reach the JWT signer and that the
App module does, and that `RepositorySecret` reaches the crypto pair while no
other resource service does. It constrains the import graph, not the
resolver graph: the claim is "no edge exists, so a tree-shaking bundler can
drop it," not "it is absent from any particular consumer's bundle."

## Module topology

Module-per-concept, no barrels, `src/index.ts` re-exports only. `src/` holds
the route vocabulary and the client, the App module, the repo coordinate,
resilience, GraphQL, one module per resource service, and the pure permission
comparator; `src/internal/` holds the octokit factory, the pagination
engine, the crypto leaf, the id funnel and header parsing.

Repository settings live on `GitHubRepository`, not in a service of their
own, because the endpoint a settings service would want is one
`GitHubRepository` already owns — module-per-*concept* deciding it, not a
size judgement. A candidate settings module once collided with the
`RepositorySettings` type alias the entry point already exported, silently,
because `tsc`, the bundler and API Extractor all accept a name collision when
a valid export by that name already exists.
`packages/github/__test__/reachability.test.ts` now asserts every module in
`src/` is re-exported from the entry point, which is the only check that
could have caught it, since nearly every per-module test file imports its
module path directly rather than through the entry point.

## The repo coordinate

Every resource method takes `Repo` in its `R` and no method takes owner and
repo arguments (`packages/github/src/Repo.ts`), which is what makes a
resource call a single expression and what makes a scoped override work:

```ts
yield* Effect.forEach(targets, (target) => syncOneRepo.pipe(Repo.provide(target)), { concurrency: 4 });
```

**Resolving `Repo` per call rather than once at layer construction is
load-bearing.** If a resource resolved both the client and the repository at
construction, a scoped override would silently do nothing, because the
resource would already hold the repository it was built with. The client
stays resolved at construction; the coordinate is read per call. The general
rule this refines: resolve a dependency once when it is stable, per call
when varying it is the point.

**The scope of a method follows the API, never the consumer's call
pattern.** An org-scoped route still sources its org from `Repo.owner` when
the org *is* the repository's owner; only a method needing an org that is
not the repository's owner takes an explicit argument. `Repo` is also a
deliberate exception to "no non-effectful members on a service shape": its
entire shape is one immutable value class, `Layer.succeed` is the correct
double for it, and the exception holds only while the shape is entirely one
value with no methods.

## Actions decoupling

Three places where GitHub-Actions-runtime knowledge could leak into this
layer, and what keeps it out instead:

| Leak avoided | Replacement |
| --- | --- |
| rerouting octokit's request log into a workflow command | octokit's log is silenced, and the client logs its own retries with `Effect.logDebug`; `@effected/github-actions` maps Effect logs onto workflow commands through a `Logger` |
| reading the repository slug from the environment | [the repo coordinate](#the-repo-coordinate), with the env-driven layer variant named for what it does |
| reading the token from the environment | the config-provider client layer, over a redacted config |

There is no token masking here (that is an Actions output command), no state
persistence (an installation token is merely encodable so
`@effected/github-actions` can persist it), and no workflow-command import of
any kind. This package reads no environment variable except through a
`Config` in a layer variant named for being env-driven, and is otherwise
runnable anywhere.

## Shared vocabulary

- **One canonical semver model.** `@effected/semver` is pure tier, so the
  edge is free, and returning a real semver value is what lets a consumer
  compare tags without re-parsing.
- **The repo reference, pull-request info, installation tokens, check-run
  output and release data are canonical here**, and
  `@effected/github-actions` consumes rather than duplicates them.
- **A digest is a small deliberate duplication.** An attestation subject
  digest and a lockfile integrity hash are different concepts wearing
  similar clothes, and taking a dependency edge across a seam to share a
  branded string is not worth it; this package declares its own.
- **The release-tag format authority stays in `@effected/workspaces`.** This
  package's tag-name-to-version extraction is a parsing convention, not the
  tag-format authority.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`; tests in
`__test__/`. There is no `./testing` subpath.

- Every service ships `makeTest(overrides?)` and `layerTest(overrides?)`,
  with unstubbed members dying loudly and naming themselves.
- Tests drive the real client through octokit's documented `fetch` option
  (`packages/github/__test__/fixtures.ts`), not a double of this package's
  own service, so classification, header capture, retry and
  link-following pagination are all genuinely exercised. A hand-built
  response has an empty URL, and octokit's paginator constructs a URL from
  it for any payload carrying a total count, so the harness must define
  that property or the failure gets classified as a transport fault
  instead. octokit percent-encodes path parameters, so assertions run
  against the recorded decoded path rather than the URL.
- One recorded-fixture client double (`GitHubClient.layerFixture`) exists
  and reimplements nothing: it pages recorded arrays through the same
  pagination engine the live layer uses and records the page requests it
  issued (`RecordedCall`, carrying `kind` and params), which is what makes
  truncation testable and what makes normalising writes testable.
- An unstubbed fixture route dies naming the route (`unstubbed: "die"`, the
  default); a recorded `GitHubError` value is how a suite stubs a 404, a 422
  or a rate limit deliberately. A missing fixture is test wiring, not a
  domain outcome, and a typed failure is only loud in code that does not
  catch — a consumer catching `GitHubError` per resource turns a missing
  stub into a different execution path whose failures name no fixture.
  `"fail"` restores the typed not-found and `"empty"` serves an empty value
  for a suite whose subject is decisions rather than endpoints; `graphql`
  ignores the setting and always dies, since no empty payload decodes
  against a document's schema. `fixtures.requested` records every call as a
  `RecordedCall` — `kind`, `route` (the document name for `graphql`), the
  params it was made with, and `perPage` for a paginated read — so a suite
  can assert what a method *sent*, which is the question a normalising
  write turns on.
- Repairing fixtures after a route moves is where a false green gets
  manufactured — see
  [repaired fixtures go green on an impossible state](../gotchas/repaired-fixtures-go-green-on-impossible-state.md).
- Pure classes get pure tests, with no layer at all; the byte budgeter gets
  a property test over multi-byte and four-byte code points.
- A pagination-forwarding test exists per paginating method.
- The App suite generates a real RSA key and signs for real.
- Mutating the edges — the page bound, the byte budget, the already-exists
  classification, the retry predicate — is expected to turn the suite red.

Run subset suites root-relative with coverage disabled.

## Observability and build

Named spans on every public fallible boundary, with stable identifiers only
in annotations — the route, the coordinate, the resulting status, the page
count, the failure kind — and never a token, a private key, a request or
response body, or GraphQL variables (which routinely carry node ids and
comment bodies). Retries log at debug, one line per retry, and that is the
only logging in the package. There are no metrics: the spans are there for a
consumer to derive counters from, at whatever cardinality the consumer
chooses.

Build through `pnpm build --filter @effected/github`. Naming third-party
generic types on a public signature is fine — API Extractor resolves a
declared dependency's types as externals — so the only suppressed build
entries are the synthesized schema-class bases. A `static readonly layer`
must wrap its factory in an arrow or it throws an access-before-initialization
error at import time while typechecking clean
(`packages/github/src/GitHubClient.ts`).

## See also

- [`github-references`](github-references.md) — the extracted issue-reference
  grammar and the compat re-export back into this package.
- [why `github` owns the octokit runtime](../decisions/github-owns-octokit-runtime.md)
- [the GraphQL schema is not owned here](../limitations/github-graphql-schema-not-owned.md)
- [branch reset closes an open pull request](../gotchas/branch-reset-closes-pull-request.md)
- [repaired fixtures go green on an impossible state](../gotchas/repaired-fixtures-go-green-on-impossible-state.md)
- [the compat re-export is droppable](../decisions/github-compat-re-export-droppable.md)
- [the github-split program](../glossary/github-split.md)
- [the tier taxonomy](../glossary/library-tier.md)


---
<!-- okf/interfaces/github-rest-client.md -->
---
type: Interface
title: "@effected/github REST client"
description: The route-keyed REST client, its escape hatch, and the pagination model over octokit.
status: stable
kind: api
resource: ../../packages/github/src/Rest.ts
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 7c0d5ffdea01896739e02244ae40a8bfda26bb5113e844ce1fa2939d44afb403
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:33.163Z
---

# @effected/github REST client

The typed REST surface is how a request is spelled, typed and paginated: the
route vocabulary in `Rest.ts` over octokit's generated endpoint map, the
client that keys both parameters and response data off a route literal, the
decoding escape hatch for routes the generated map does not carry, and the
one pagination engine every list read runs through. It owns wire mechanics
only — which endpoints earn a domain method, and how their responses project
into kit values, is [the resource services](github-resources.md); how a
failed request is classified and retried is
[errors and resilience](github-errors-and-retry.md). Package-wide framing is
in [the `github` module](../modules/github.md).

## The route is the key

`client.request("GET /repos/{owner}/{repo}", { owner, repo })` types both the
parameters and the returned data from the route literal alone
(`packages/github/src/Rest.ts`). There is no operation string, no callback
and no type parameter to invent, and no cast — a typed route makes the
projection from response to domain model a checked mapping rather than a
cast, where an operation-string surface costs a cast at every projection.

Two narrowings against octokit's own surface are deliberate:

- **The parameter type intersects a three-field `RequestExtras` record, not
  octokit's own request parameters.** octokit's own type carries an index
  signature that would silently accept every typo. The three kept fields are
  `headers` (an asset content type, a pinned API version), `mediaType`
  (raw content reads) and `baseUrl` (the upload host) — the ones evidence
  proves are needed. Everything else a caller might reach for is a real
  parameter and is already typed.
- **The element type of a paginating route is derived here**, because the
  paginator plugin's own helper — which handles the array-versus-`{
  total_count, items }` split — is not exported. This is what makes a
  paginated read return domain values rather than `unknown[]`.

There is no `operation: string` parameter: the route names the endpoint and
the span carries it.

### `repositoryPatch` owns the cast consumers were writing

`RepositoryPatch` is octokit's generated parameter type, and octokit spells
an optional field as `has_issues?: boolean` — not `has_issues?: boolean |
undefined`. Under `exactOptionalPropertyTypes` (on in this repo's tsconfig
base), a `Partial<T>` assembled from a consumer's own settings schema does
not assign to `RepositoryPatch` at all, so every consumer applying "only
what the user configured" was writing the same `as`.

`RepositoryPatchDraft` is a shape with every field optional and explicitly
`undefined`-able, and `repositoryPatch(draft)` narrows it by dropping keys
whose value is `undefined` — `PATCH` reads an absent field as "leave it
alone," while an explicit `null` or `undefined` is a value. A key-by-key loop
still defeats TypeScript's correlation between two indexed accesses over a
union key, so this residual limitation is recorded rather than fixed: build
the draft as a literal where possible.

### Resource ids come off the wire as `number | bigint`

`@octokit/types` v17 widened every GitHub resource id to `number | bigint`,
future-proofing the generated map against ids past 2^53. The public surface
stays `id: number`: REST payloads arrive through `JSON.parse`, which never
yields a bigint, so the union is a claim about a future that has not
happened. One internal leaf, `packages/github/src/internal/ids.ts`, narrows
it, and every response-mapping site that reads an id goes through it — the
check-run ref, the comment record, the App identity's user id, the
issue-comment writes. A new mapping site adds a call to that funnel, never a
cast. If GitHub ever crosses 2^53, the coercion is not the fix: the `id:
number` fields on the record classes would need redesigning, and the funnel
is where that would show up.

## The escape hatch is from the route table, never from typing

A route GitHub does not document in its OpenAPI schema, or one whose live
shape differs from it, goes through a decoding request that takes a
**mandatory** schema. Two real cases: release-asset upload (omitted by
octokit's generator because it takes a raw binary body on the upload host)
and the attestation reads (a pinned API version, so the live contract
differs from the description).

A hand-written route owns its query parameters in the template. Outside the
generated map, nothing tells octokit that a given parameter is a query
parameter, so a parameter it cannot place is silently dropped — the live
symptom was a rejection on every asset upload, from a call whose arguments
all looked right. The template must spell them, and in two forms rather than
one: an "optional" parameter in an RFC 6570 template is not optional in the
way a caller assumes, since an absent value still expands to a dangling
separator. The general lesson: the typed route table does more work than
routing, and every parameter-placement decision the generated map makes for
free must be made by hand on a route that is not in it — with a dropped
value, not a type error, as the failure mode.

## The client shape

See `packages/github/src/GitHubClient.ts`. One request member, one
decoding-request member, a collected and a streaming paginate, a GraphQL
member, and an effect-valued rate-limit snapshot. Every member is an
`Effect`, a `Stream`, or a function returning one — including the snapshot,
which is an effect-valued property — so the whole shape stays mock-optional
and stubbable from a partial record.

Layer variants: from an explicit token, and from the ambient config
provider. The config variant reads a redacted token and fails with
`ConfigError` — an honest "no token is configured" rather than a
wire-failure type. The layer is then testable by providing a provider, is
not Actions-coupled, and lets a consumer let the config error sit in the
layer's error channel instead of writing a comment justifying an `orDie`.
The App-authenticated variant lives in
[the App module](github-app-auth.md#where-the-app-client-layer-lives), for
reachability reasons.

## Pagination

Three hazards shape the model: a list read that hard-codes its page size
gives the caller no control, a list read that does not paginate silently
truncates (a pull request with more than a page of comments loses its
sticky-comment marker), and a test double that ignores page options makes
truncation structurally untestable.

Four rules:

1. **Every paginating method takes page options and forwards them.** No
   method hard-codes them, and a test drives each list method through a
   counting fixture and asserts the page requests it issued.
2. **The page size is validated, not clamped.** A caller asking for more
   than GitHub's ceiling has a bug — GitHub silently caps and the caller's
   arithmetic is then wrong. Failing typed at the boundary is the intended
   input-hardening posture.
3. **Both a collected and a streaming form share one engine.** The collected
   form is the stream run to completion, and the page bound is applied
   inside the iterator adapter so the traversal stops issuing requests
   rather than filtering after the fact.
4. **A non-paginating route is a compile error**, which an
   operation-string-plus-callback surface could never express.

The engine is octokit's own iterator, not a hand-rolled link walk: its cursor
advances only on success, so wrapping it in the retry re-requests a failed
page rather than skipping it, and it already carries a compare endpoint's
continuation, the search-shaped payload normalization, and the
empty-repository conflict case that would otherwise have been reimplemented.
The page bound and header capture stay on this package's side.

There is exactly one pagination implementation
(`packages/github/src/internal/paginate.ts`), and the seam that keeps it
that way is a page source. One resource pages by file at a fixed size on a
route octokit does not list as paginating (its payload is an object, not an
array), so it constructs pages itself and hands them to the same engine. The
fixture client double in [the `github` module's testing
section](../modules/github.md#testing) feeds the same engine from recorded
arrays, so it cannot drift from the live behaviour.

One documented GitHub constraint stays documented rather than papered over: a
single commit's file list pages by file while a comparison pages by commit,
so a one-commit comparison is permanently truncated at the file cap. One
resource still filters client-side after fetching, because GitHub has no
server-side ref-prefix filter for it, with a short-circuit on the common case
so the full walk is rarely paid.


---
<!-- okf/interfaces/github-errors-and-retry.md -->
---
type: Interface
title: "@effected/github errors and retry"
description: Four error classes, one classification step, and one retry policy driven by GitHub's own headers.
status: stable
kind: api
resource: ../../packages/github/src/GitHubError.ts
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-24T18:10:58Z
  body_sha256: f472634e381f3ce86f0de3a977df375c9f3b2f3fd1fa5701c6064b0a98ad56e9
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:34.761Z
---

# @effected/github errors and retry

Four error classes, one classification step and one retry policy cover
everything that can fail on the wire: an error for REST, one for GraphQL,
one for App authentication and one raised by the pure permission
comparator, each carrying the structural `kind` every recovery routes on.
Classification happens at a single boundary mapper, and the retry schedule
reads GitHub's own rate-limit headers. Resilience is a package-wide
property rather than a property of any one transport:
[the REST client](github-rest-client.md) raises most of what is classified
here and [the resource services](github-resources.md) consume the
discriminant; package-wide framing is in
[the `github` module](../modules/github.md).

## Four errors, and classification happens once

The package declares one error for the REST surface, one for GraphQL, one
for App authentication and one raised by the pure permission comparator
(`packages/github/src/GitHubError.ts` and its siblings). Classification
happens in exactly one place, the boundary mapper that turns an unknown
octokit throwable into a classified error (`GitHubError.fromOctokit`);
nothing else in the package inspects a status code or a message.

The load-bearing field is `kind`: not-found, already-exists, rejected,
unauthorized, rate-limited, transport, decode
(`packages/github/src/GitHubError.ts:53`). It is what replaces every string
sniff, and the sizing follows what consumers actually read — a reason
string, a status, an operation name and a tag — so nothing beyond those is
mandatory. `operation` names the resource method or the raw route; `reason`
is the human-readable field consumers interpolate; the rest are optional
with ergonomic statics filling them from the value the mapper already has.

- **`retryable` is derived, not stored** — the kind already carries it —
  while a server-advised delay survives as an optional field because the
  retry schedule reads it off the error.
- **"Already exists" is first-class on both channels**, REST and GraphQL. It
  closes a consumer that lowercased a message and grepped it for two
  words — and the upsert operations make even that unnecessary.
- **A 422's validation entries ride on the error, not only in its kind.**
  GitHub documents six `errors[].code` values; only `already_exists` gets
  a kind of its own, and it is read from the code first because some
  endpoints (creating a release for a tag that has one) send no message
  at all. The other five classify as rejected and stay inspectable through
  the `validation` field and `hasValidationCode`. `missing` is deliberately
  not `notFound`: it names a resource the request referred to, not the one
  it acted on, and routing it there would let a not-found recovery swallow
  a bad argument.
- **A schema failure never escapes.** The decoding request and the GraphQL
  member normalize a decode failure into the decode kind with the schema
  error carried structurally.
- **Statics cover every hand-construction site**, so a consumer test that
  used to build an error by hand is a one-liner.

The GraphQL error keeps a structured errors list, because it is the one
structured field a consumer reads and because GraphQL genuinely returns a
list, and its operation field names the document rather than a literal
string standing in for every call. The App error's `kind` distinguishes
JWT, token, revoke, identity and installation failures — the JWT arm
exists because the JWT signer converts a PKCS#1 private key (which is what
GitHub hands you) to PKCS#8 only under the Node export condition, so on
another runtime a PKCS#1 key fails explicitly rather than as a wrapped
defect.

## One retry policy, driven by GitHub's own headers

There is one retry policy and no rate-limit subsystem. Several policies —
one of which inevitably lacks a predicate and retries permission denials —
stack on each other unpredictably, and a rate-limit gate resolved through
an optional-service lookup would degrade the whole feature silently when
nobody provides it.

- **The policy is wired once, in the client layer**, so every resource
  inherits it and no resource retries on its own.
- **Only transport and rate-limited failures retry.** There is no path on
  which a permission denial is retried.
- **A server-advised delay wins over the computed backoff**, unless it
  exceeds a ceiling — in which case the error is re-failed rather than
  slept through, because a long rate-limit reset must surface as a failure
  rather than a hang. Otherwise, full jitter over an exponential bound.
- **The schedule is built with the metadata-carrying step constructor**,
  whose step receives the failure being retried — the native construct for
  "the delay depends on the failure", so no hand-rolled recursive retry
  loop is needed.

Resilience imports no error class at all: it declares a structural shape —
retryable, plus an optional advised delay — so one policy serves both the
REST and the GraphQL error, and every policy decision is testable against a
two-field literal.

**Rate-limit headers stay, as an observable value rather than a shared
cell.** The client parses them off every response into a ref held inside
the layer's own closure, surfaced as one effect-valued member on the client
shape: mockable from a partial record, observable in tests, impossible to
forget to provide and impossible to desynchronize from the client that
writes it.

**No proactive throttling.** A gate would duplicate what the reactive path
handles correctly: GitHub answers an exhausted budget with a status plus
reset headers, which classifies as rate-limited and gets the server-advised
delay. A consumer that wants to pace itself has the snapshot and can build
a gate.

**No dependency edge to `@effected/commands`' retry vocabulary.** That
module classifies a subprocess failure over a subprocess transport; this
one classifies an HTTP failure over HTTP. What the two packages share is a
convention — each owns "which of my failures are transient", exposes it,
and lets the caller compose the retry.


---
<!-- okf/interfaces/github-app-auth.md -->
---
type: Interface
title: "@effected/github App authentication"
description: The App JWT, installation-token lifecycle, and the seam the GitHub Actions runtime bridges on.
status: stable
kind: api
resource: ../../packages/github/src/GitHubApp.ts
tags: [bundle, security]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 6c7a6bc94313aeb951a2966f407c75e82b477932643878e71e5eb277057b633a
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:25.629Z
---

# @effected/github App authentication

App authentication is the third way to get a client: an RS256 App JWT signed
by a zero-dependency leaf, installation tokens minted through the same typed
route table as every other call, and a lifecycle that enriches, expires,
re-mints and revokes them. Bot identity and the DCO signoff trailer it
renders come with it, because they are projections of the same token.
Package-wide framing — including why the OAuth-carrying auth package was
dropped — is in [the `github` module](../modules/github.md).

It is split into its own module because it owns the one dependency a
token-only consumer must not link: the JWT signer. That reachability
constraint, not style, decides which module carries the App-authenticated
client layer. It also carries the seam `@effected/github-actions` builds its
phase-oriented token bridge on: what belongs here is the token and its
lifecycle, while the bridge that persists one across a phase boundary stays
Actions-side.

## Where the App client layer lives

The house convention is a `layer` static on the service class, with variants
as suffixed statics. That convention and the reachability invariant collide
exactly once: the client has three constructors, one of which needs the JWT
signer, and statics on one class must share one module. Putting the
App-authenticated client layer on the client class would make every
token-only consumer's import reach the signer.

Resolution: the module that owns the heavy edge owns the layer.
`packages/github/src/GitHubApp.ts` exports both its own service layer and a
client layer — a `layer`-family static producing another service's layer.
The naming rule that generalizes: a cross-service layer static belongs to
the module that owns the dependency the layer needs, not to the module that
declares the service, because a static cannot cross a module boundary and a
heavy dependency must not.

## The token lifecycle

The service mints an installation token, mints one scoped to an `Effect`
`Scope` with best-effort revocation on close, revokes explicitly, enriches
with the App's identity, and lists installations. The token itself is a
schema class with a JSON-encodable encoded form — the redacted value
encodes to the raw string and the expiry to an ISO string — which is
precisely what lets `@effected/github-actions` persist it across a phase
boundary.

Five deliberate shapes:

- **Expiry is enforced, not merely persisted.** An expiry that is stored and
  read nowhere means a long-running phase outliving the roughly one-hour
  token simply starts failing with an unauthorized status and no
  explanation. The token can answer whether it is expired, the App client
  layer re-mints inside a small skew window, and an unauthorized response on
  a minted token retries once after a forced re-mint — the one place the
  client's general retry policy is not sufficient, because the fix is not
  "wait" but "get a new token".
- **Bot identity is not on the service shape.** A synchronous member on a
  service forces every mock to a full implementation, so it is a pure class
  with statics instead — one for an App's identity, one for the well-known
  Actions bot — plus an instance projection off the token. It is not
  wrapped in `Effect.succeed`.
- **Installation discovery is environment-free and not hand-paged.** It
  matches installations against the repo coordinate when one is provided or
  an explicit owner — never a repository slug read from the environment,
  which would be env-coupled auth inside the auth layer — and it walks the
  installations endpoint through the client's real paginator instead of a
  link-header regex.
- **Identity keeps its documented quirk.** The bot-user lookup rejects an
  App JWT, so it bears the installation token when one is supplied and
  otherwise runs unauthenticated at GitHub's anonymous rate limit. That is
  GitHub's behaviour, not a defect, and it surfaces as an identity-kind
  failure rather than a silent degrade.
- **Revocation stays best-effort and keeps its exact authorization scheme**,
  which GitHub is specific about.

## Signoff is part of identity

Bot identity renders the DCO trailer, from the type that owns the data.
Commits created through the Git Data API bypass the porcelain's own signoff,
so no tooling adds the trailer, and a hand-built one that is subtly wrong —
casing, spacing, brackets — fails late as a red compliance check on someone
else's pull request. Whether a missing identity falls back to the
well-known Actions bot stays the caller's policy: that is a decision about
attribution, not about formatting.

## The seam the Actions runtime needs

The phase-oriented bridge — provision in `pre`, persist, mask, dispose in
`post` — stays out of this package; it is Actions-shaped by construction.
What this package owes it is a surface it can build on without reaching
inside, documented per exported member:

| The Actions runtime needs | This package provides |
| --- | --- |
| mint a token in `pre` | the token member |
| mint with automatic revocation | the scoped token member |
| enrich with bot identity | the identity member |
| persist across the process boundary | the token's JSON-encodable encoded form |
| rebuild a client in `main` from a persisted token | the token client layer |
| revoke in `post` | the revoke member |
| render a committer identity | the pure identity class |

Two things this package deliberately does not do, both because they are the
caller's concern: masking (a runner output command) and persistence (the
runner's state file stores plaintext by GitHub's protocol, which a redacted
value cannot survive by design).

**The two packages' option shapes are not a shared field set, and reading
them as one is a live trap.** This package's token request carries only an
installation id or an owner beside the credentials — no scope field, because
this package never verifies permissions itself. Scope verification lives one
level up, in the Actions bridge, whose options require the credentials
explicitly and name the scope-check field for what it *requires*; the word
"permissions" is reserved for what the token reports GitHub actually
*granted*.


---
<!-- okf/interfaces/github-resources.md -->
---
type: Interface
title: "@effected/github resource services"
description: One context service per GitHub noun, turning typed endpoints into domain operations.
status: stable
kind: api
resource: ../../packages/github/src
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: e72ce1e0638fe863ba7d5cbd7fc4666935e9a3629dcf0c9f56817d7b42c7223a
---

# @effected/github resource services

The resource services are the package's domain half: one context service per
GitHub noun a consumer needs typed — repositories, git objects, issues and
pull requests, releases, check runs, and the configuration surfaces a fleet
writes — each turning a set of endpoints into an operation stated once. The
module names in `packages/github/src/` are the authority on which nouns
exist; an endpoint earns a resource method when a consumer needs it typed,
and everything else stays reachable through the typed request surface.

Every resource is a context service whose layer requires only the client and
whose methods each require [the repo coordinate](../modules/github.md#the-repo-coordinate),
so a scoped repository override is real rather than decorative. Every member
is an effect or a stream, every service ships a die-loudly test double, and
no resource retries — [the client owns that](github-errors-and-retry.md#one-retry-policy-driven-by-githubs-own-headers).
The mechanics they stand on — the route-keyed request, the escape hatch, and
the pagination engine — belong to [the REST client](github-rest-client.md);
package-wide framing is in [the `github` module](../modules/github.md).

## Upserts exist so consumers stop writing TOCTOU dances

Without a structured "already exists" discriminant, a consumer distinguishes
"someone else created it" from a real failure with a check-then-create-then-fetch
preamble — up to four round trips for one intent — or by string-matching the
message. `GitBranch.upsert` and `GitTag.upsert` are the answer: create, and
on an already-exists failure force-update. One round trip in the common
case, two in the raced one, and the recovery still resets rather than
inheriting a branch a concurrent creator rooted elsewhere. Prefer the upsert
over catching the discriminant yourself.

Absence is not an error: an existence check degrades a not-found to `false`,
and the option-returning read variants degrade it to none.

## Say-once is a different idempotence from say-again

`GitHubIssue.commentOnce` posts a marked comment once, and never edits it:
find the marker, or create it. The guarantee is idempotence across
sequential invocations — a re-run workflow, the motivating case — not mutual
exclusion across concurrent ones. It is the counterpart to
`PullRequestComment.upsert`, not a variant of it: an upsert edits in place,
which is right for a status comment that must converge on the current truth,
while a one-time announcement — "this shipped in release X" on the issue it
closed — must never be rewritten, since an edit either restates a fact that
was true when it was said, or re-notifies everyone watching.

The marker is the existence check, appended to the body in exactly the
spelling `upsert` uses, so a comment either member writes stays findable by
the other. `isCrossReferencedBy` is the obvious wrong guess: an issue
reached through `linkedIssues` is cross-referenced by construction, from the
moment the pull request named it, so the check is `true` before anything has
been said — only the marker answers "have I commented yet?". The lookup
paginates, for the same reason every list read on this package does: a
first-page-only check on a busy issue finds no marker and announces again.

The remaining race is named rather than implied away: GitHub offers no
conditional create, so two runs that both miss the marker both post. The
window is a page read wide and the failure is one duplicate comment,
documented on the member rather than papered over — a caller who needs
mutual exclusion must serialize externally. The result value is a
`CommentOnceResult` carrying `wrote` and the comment either way, so a caller
can report "already announced" without a second read.

## The hazard that costs production data

Never spell a rebase as an upsert to the target head followed by a commit.
Each call is correct and each is documented; the hazard is in their
sequence. Resetting a release branch to its base makes an open pull request
from that branch have an empty diff, and GitHub auto-closes a pull request
in that state — see
[branch reset closes an open pull request](../gotchas/branch-reset-closes-pull-request.md).

The correct spelling is one operation with no observable intermediate state:
read the target commit for its tree, create a tree on it, create a commit
with the target as parent, then upsert once to the finished sha. The branch
never rests on the bare target head, so no pull request is ever momentarily
empty. No API changed to fix this: the members needed to compose it
correctly already existed. What was missing was the warning, so both
members' documentation carries it.

## Projections that replace consumer code

- **A commit read returning its tree sha.** Consumers reach for a commit
  purely to get a tree for the Git Data API; the projection drops a whole
  client requirement out of the consumer's function signature.
- **Repository settings as a faithful projection plus narrow accessors.**
  Consumers hit the same endpoint for different subsets — the full settings
  block, the default branch, the node id — so both the full projection and
  narrow accessors exist. All of it lives on `GitHubRepository`, which
  already owns the route.
- **Semver-aware tag selection.** Returning tag strings forces a consumer
  into an effect per parse and per comparison to find its latest release.
  Here parsing and comparison are the sync primitives `@effected/semver`
  already exports, so the whole selection is one pass over the page stream
  with no effect round trips. The tag-name-to-version convention is
  documented and pluggable — the default strips a leading `v` and takes the
  substring after the last `@` — with an override for anything else, and
  prereleases excluded unless asked for.
- **Associated pull requests, named for what they answer.** A method a
  consumer cannot find gets a cast instead, which is a discoverability
  failure as much as a typing one.

## Shapes corrected against the domain rather than against fixtures

- **A file list answers with typed entries, not paths** — path and status,
  plus line counts and any pre-rename path, the same projection the
  commit-diff read returns, because GitHub answers both endpoints with the
  same wire shape.
- **Head and base shas are required fields.** GitHub always reports both.
  Whether a pull request has merged is likewise a fact GitHub always
  reports, so it is a real option rather than an optional key, and the
  projection constructs that option rather than decoding one.
- **A commit summary carries its parents**, required — empty for a root
  commit, two or more for a merge — so "which commit did this come from"
  never needs a raw route.
- **A content read keeps all three of its guards**: reject a directory
  listing, reject a non-file type, and reject any encoding other than
  base64, because an over-size file comes back with a different encoding
  and decoding it as base64 yields silent garbage.
- **A sticky-comment marker is a pure class**, not a hardcoded vendor
  string and not a layer parameter, so it carries no branding and is
  testable without a client.
- **Auto-merge is an explicit method**, not an option that fired a mutation
  from a tap after create or update, which is how a failure could surface
  from a call that had already succeeded.
- **A poll-to-completion loop has no sentinel error.** The loop repeats with
  a predicate over the success value and a genuine timeout fails as an
  ordinary rejected error, rather than encoding "not done yet" as an error
  value.

## The configuration-write half

Secrets, variables, rulesets, deployment environments, security features and
CodeQL default setup write a repository's configuration, repeatedly, across
a fleet — a different kind of surface from the read-and-report services.

- **A repository-scoped write must never be able to reach an organization's
  object.** `GET /repos/{owner}/{repo}/rulesets` returns rulesets inherited
  from the organization alongside the repository's own, indistinguishable
  without `source_type`. `upsert` filters on `source_type` before matching:
  when a listing mixes scopes, the scope discriminant is not an optional
  field of the projection, it is the projection's reason for existing.
- **A truncated list read is worse than a failed one, because it looks
  complete.** Secrets, variables, rulesets, environments and the workflow
  listing all paginate: a cleanup policy deleting undeclared resources
  seeing a subset, or a ruleset upsert's existence check missing an existing
  ruleset past page one and creating a duplicate instead of updating, are
  both wrong decisions rather than missing data.
- **A normaliser must also accept the form its own parameter type
  declares.** `GitHubRepository.updateSettings` wraps a bare `"enabled"` in
  `security_and_analysis` into the `{ status }` form GitHub requires, and
  drops merge keys whose owning strategy is being disabled — but it must
  also pass the already-typed `{ status: "enabled" }` form through
  untouched, since `RepositoryPatch` is GitHub's own parameter type and a
  normaliser that only recognized the bare form silently discarded that
  block while the request still returned 200.
- **A write reports what it sent, not what it was asked for.**
  `GitHubRepository.applySettings` returns `AppliedSettings` — the REST and
  GraphQL keys that actually went out, in the caller's own names — which
  diverge from the input exactly when preparation drops a field GitHub
  would reject.
- **Secret writes carry the sealed box, and it is not optional.** GitHub's
  secrets API accepts only libsodium sealed-box ciphertext.
  `packages/github/src/internal/crypto.ts` carries the algorithm's own trap:
  both the concatenation order and the 24-byte nonce length are fixed by
  libsodium, and getting either wrong produces a box GitHub accepts and
  cannot decrypt.
- **A workflow listing belongs on the service that already owns the route
  family.** `WorkflowDispatch.list` reports GitHub's state string without
  interpreting it — whether a disabled workflow counts is a server-side
  rule this package cannot test — and a repository with no workflows
  answers with an empty array, so absence stays distinguishable from being
  unable to ask.

## The check-run bracket concludes on every exit

A bracket built from a success tap and an error tap fires on success and on
a typed failure only. An interrupted run and a defect both leave the check
run in progress forever, and GitHub never reaps such a run, so it blocks
branch protection until a human deletes it by hand.

The bracket is therefore an exit-aware finalizer, running uninterruptibly,
which is what lets the concluding request survive the very interrupt that
triggered it. The defaults: success on success, failure on a typed failure
or a defect, and cancelled on an interrupt only. Only the success path keeps
the error channel, because failing to record a success is a real failure
the caller should see, whereas on the other paths the completing call is
ignored — neither an interrupt nor an existing failure should be replaced by
whatever went wrong while reporting it.

The callback receives a conclude handle as a second parameter rather than
returning an outcome the bracket maps, so a findings-derived verdict — a
strict-warnings input escalating a neutral conclusion — can be recorded
without entangling the verdict with the callback's own return value, and
without needing a separate mechanism for the failure and interrupt paths
that have no return value at all. The handle stores the verdict in a ref and
the finalizer writes it exactly once, on whichever path the callback leaves
by — the last verdict wins, and the handle's error channel is `never`.

## Byte budgeting is a pure method

GitHub caps a check-run summary at a byte count, not a character count, and
rejects the request when it is exceeded. Emoji and box-drawing characters
cost several bytes each, so a character-count check passes while the
request fails. That logic lives as a pure method on the output value class,
testable with no client at all. Stripping one trailing replacement
character after slicing the byte buffer is not enough — a split four-byte
code point can produce more than one — so the trim runs until the tail is
clean; a property test asserts the result is valid UTF-8 within budget for
arbitrary input.

## The permission comparator is not a service

It is a pure ordinal comparator over a record the caller already holds,
with zero octokit and zero requirements: a pure class with a comparison
method and two assertion effects. Wrapped in a service, a comparator would
need a whole-behaviour test double reimplementing the entire ranking; as a
pure class it needs none. There is no "warn on over-permission" member: the
comparison returns the extras and the caller decides what to log.

## Attestation and artifact metadata

Attestation upload and listing are the REST half of a three-way split —
signing and SBOM assembly are `@effected/sbom`'s, and the mint-sign-build-attest
pipeline is consumer composition. Two behaviours are deliberate: the pinned
API version, which is why this surface uses the decoding request with an
owned schema rather than a generated response type, and two distinct
statuses both meaning "no attestations", degraded to an empty list.

Artifact metadata's endpoint is org-scoped rather than repository-scoped,
and the organization is nonetheless resolved from the repo coordinate's
owner like every other resource, rather than taken as a positional
argument — the scoped override covers the cross-org case exactly as it
covers the cross-repository one.

## One internal projection stays internal

The raw wire shape a file list decodes from is exported from its own
module — shared between the two endpoints that answer with it — but
deliberately not from the entry point, because it is octokit's vocabulary
rather than this package's. The typed entry is the public type; the raw
shape is how it gets built.


---
<!-- okf/interfaces/github-graphql.md -->
---
type: Interface
title: "@effected/github GraphQL"
description: Typed GraphQL documents over the same client, errors and spans as REST.
status: stable
kind: api
resource: ../../packages/github/src/GraphQL.ts
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4a4078d818f8b1d1b40996be486e736553d05de937695128b9d846a1cbf8c674
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:30.132Z
---

# @effected/github GraphQL

GraphQL is the package's second transport: a `GraphQLDocument`
(`packages/github/src/GraphQL.ts`) carrying a name, the document text and a
response schema, executed through the same client, the same
[error taxonomy](github-errors-and-retry.md) and the same span conventions
as a REST call. There is no separate GraphQL service. Package-wide framing
is in [the `github` module](../modules/github.md).

What differs from [the REST surface](github-rest-client.md) is ownership:
REST routes come from a generated map describing all of GitHub, while every
GraphQL document here is one the kit chose to write — see
[the ownership limitation](../limitations/github-graphql-schema-not-owned.md).

## Typed documents, decoded responses

A document is built from a name, the document text and a response schema;
the variables type is stated separately, with an optional encoder onto the
wire object. The constructor is curried: TypeScript takes explicit type
arguments all-or-nothing, so a single call would force the caller to spell
out the decoded type too, and the encoder exists so the variables type is
genuinely load-bearing rather than structurally interchangeable. The client
encodes the variables, posts the document and decodes the response through
the schema, so a GraphQL result is a domain value rather than an `unknown`
the caller casts, and a decode failure becomes
[the decode kind](github-errors-and-retry.md#four-errors-and-classification-happens-once)
with the schema error carried structurally.

The name is not decoration: it names the span and the error's operation
field, rather than a literal `"graphql"` standing in for every call.

There is no separate GraphQL service. The only thing one could do beyond the
typed document is error shaping — parsing another error's message string
looking for an errors array — and with a typed error carrying that array
structurally there is nothing left for it to do.

## Ownership: the mechanism is ours, the schema may not be

The rule that sorts documents between the kit and its consumers:

- **A document whose subject is a GitHub primitive this package already
  models is owned here** — linked issues, cross-reference timeline probes,
  creating a branch linked to an issue (which has no REST equivalent, and is
  the clearest case for owning a document at all), and enabling or disabling
  auto-merge behind
  [the resource method](github-resources.md#shapes-corrected-against-the-domain-rather-than-against-fixtures).
- **A document that merely happens to be spelled in GraphQL has no place
  here.** A consumer that does over GraphQL what a REST resource method
  already does reached for it only because it happened to hold a node id;
  the resource method is the answer.
- **A document whose subject is a domain no other consumer touches stays
  with that consumer.** Project boards are one repository's domain, not the
  kit's; that consumer constructs its own typed document value, gaining
  typed variables, a decoded response and the structural already-exists
  discriminant in place of a message sniff. The document type is the
  mechanism, owned here; a domain schema is content, owned by whoever has
  the domain.

Where two spellings of one owned document exist, the strict superset wins
and the resource method exposes its extra filter rather than shipping two
documents.


---
<!-- okf/gotchas/branch-reset-closes-pull-request.md -->
---
type: Gotcha
title: Resetting a branch to its pull request's base closes that pull request
description: GitBranch.upsert's reset path makes a branch's head equal its pull request's base, and GitHub auto-closes any pull request whose diff goes empty as a result — even when a follow-up commit was already planned to re-add content.
status: stable
resource: ../../packages/github/src/GitBranch.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 6375701b67552d797f3d5698eb9228f5fab97bbe52f925a93ebe5b8a51498403
---

# Resetting a branch to its pull request's base closes that pull request

## What a reader sees

Code calls `GitBranch.upsert(branch, targetHead)` to reset an existing
branch to a target commit — say, back to `main`'s current head — intending
to follow it a few seconds later with a new commit that re-adds content.
The reset call succeeds. Shortly after, the branch's open pull request
shows as closed, with no error reported anywhere in the calling code.

## What they would wrongly conclude

That the pull request closed for an unrelated reason, or that something
external interfered, since the reset call itself reported success and the
plan to re-add content immediately afterward seemed to make the closure
window irrelevant.

## What is actually true

A reset is observable, and GitHub's own pull-request lifecycle reacts to
it. `upsert(branch, targetHead)` resets rather than inheriting a branch a
concurrent creator rooted somewhere else — the correct recovery semantics
for a race — but when that reset target equals the pull request's base,
the branch's head becomes equal to its base, and GitHub auto-closes any
pull request whose diff is empty at that moment. This happened in
practice: a consumer ran `upsert(releaseBranch, mainHead)` intending to
re-add content with a commit roughly three seconds later, and GitHub
closed the open release pull request inside that window while the overall
run still reported success — the closure landed silently in a gap between
two calls that each succeeded individually.

## The check

Treat any `GitBranch.upsert` call whose target head could equal an open
pull request's base as capable of closing that pull request, regardless
of how quickly a follow-up commit is planned. Where the branch must stay
open across a reset-then-recommit sequence, reopen the pull request
explicitly after the follow-up commit lands, or restructure the sequence
so the branch's diff against its base is never empty at any point GitHub
observes it.[^git-branch]

[^git-branch]: `packages/github/src/GitBranch.ts:50-70` — the `upsert`
    doc comment states the reset-then-auto-close mechanism and the
    ~3-second race window a real consumer hit.


---
<!-- okf/gotchas/repaired-fixtures-go-green-on-impossible-state.md -->
---
type: Gotcha
title: A mechanically repaired fixture set goes green while describing a state GitHub cannot produce
description: When a source change moves a call to a new route, stubbing that route with whatever makes the suite pass can leave two fixtures disagreeing about the same object, so the test asserts a request sequence the real API would reject.
status: stable
resource: ../../packages/github/src/GitHubClient.ts
stale_after: "2027-03-21T00:00:00Z"
tags:
  - testing
  - github
sources:
  - id: github-client-fixtures
    resource: ../../packages/github/src/GitHubClient.ts
  - id: github-client-test
    resource: ../../packages/github/__test__/GitHubClient.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: e2ed083690c46ea68f49aa50e77b7a504ac67fc05eb650cef9bec5c70f81095a
---

# A mechanically repaired fixture set goes green while describing a state GitHub cannot produce

## What a reader sees

A source change moves a resource method's call from one route to another —
a listing read becomes a by-name read, say. Every suite that stubbed the old
route through `GitHubClient.layerFixture` now dies with `no fixture for`
naming the new route, because an unstubbed route defaults to `unstubbed:
"die"`[^github-client-fixtures]. The cheapest repair is one edit: stub the
new route with whatever value turns the suite green — a `notFound` for every
fixture set, or an empty value through `unstubbed: "empty"` — and the run
passes.

## What they will wrongly conclude

That the suite still pins the behaviour it pinned before, because every
assertion passes and nothing in the output changed except the fixture table.

## What is actually true

A fixture set is a claim about the world, and a mechanical repair edits the
claim without anyone reading it. The die-default exists to make the *first*
half of the repair loud[^github-client-test]; nothing makes the second half
loud, because each fixture on its own is plausible. The failure shape: one
fixture says the object is present in the listing, the newly added fixture
says the same object 404s by name — a state the API cannot be in — so the
code under test takes its create branch and the suite asserts a `POST` for
an object that exists, which the real API rejects with a 422. The test is
green and the assertion is a lie.

The tell is two fixtures disagreeing about the same object. It is invisible
unless you look for it, so after repairing fixtures ask whether the stubs
describe a state GitHub could actually be in, not merely whether the
assertions pass. Prefer a recorded `GitHubError` value over `"fail"` or
`"empty"` for a deliberate failure — it says which route fails and why,
where absence says only "unwired" — and read every fixture that names the
same object together before calling the repair done.

The same trap applies to any recorded-response double, but this package's
fixture client is where it manufactures a green: the double reimplements no
behaviour, so its only way to lie is through the table it is handed. See
[the `github` module's testing section](../modules/github.md#testing) for the
fixture client's contract.

[^github-client-fixtures]: `packages/github/src/GitHubClient.ts` — the `GitHubFixtures.unstubbed` modes and the reason `"die"` is the default.
[^github-client-test]: `packages/github/__test__/GitHubClient.test.ts` — pins that an unstubbed route dies by default and that a recorded failure is distinguishable from a call never made.


---
<!-- okf/decisions/github-owns-octokit-runtime.md -->
---
type: Decision
title: "@effected/github owns the octokit runtime"
description: Why the octokit client and the sealed-box crypto pair live in @effected/github rather than being pushed to consumers.
status: draft
tags: [architecture, bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: d32bbeffe27fba2baa13cb663ebc969cc76f092958dfd60071224f361db4f301
---

# @effected/github owns the octokit runtime

## Context

A predecessor put octokit, an OAuth arm, an SBOM library and a signing stack
behind one entry point. One consumer responded by shipping a hand-written
bundler ignore list for XML libraries it never invoked, evidence that the
package's dependency shape was leaking cost onto consumers that did not want
most of it. Interpreting GitHub's REST and GraphQL API is nonetheless a
concern every consumer of the kit needs, typed, at least once.

## Decision

`@effected/github` carries the octokit runtime — `@octokit/core`,
`@octokit/plugin-paginate-rest`, `@octokit/types` — plus the two
non-octokit runtime dependencies a sealed box requires: `tweetnacl` and
`blakejs`. A sealed box is `crypto_box` under an ephemeral keypair with a
nonce derived as `blake2b(ephemeral_pk ‖ recipient_pk, 24)`
(`packages/github/src/internal/crypto.ts`); Node ships neither X25519
`crypto_box` nor blake2b, so the alternative was a full libsodium build, not
`node:crypto`. `universal-github-app-jwt` signs the App JWT and is the same
zero-dependency leaf the official GitHub auth package uses internally.

This makes `@effected/github` integrated tier by the kit's dependency
policy: it owns a heavy runtime rather than merely consuming one. That is
accepted rather than fought, because the alternative — pushing octokit
itself, or a hand-rolled REST client, onto every consumer — is exactly the
duplication a kit exists to end.

The tier does not move when the crypto pair is added on top of the octokit
edge, because the package is already integrated and nothing depends on it
but `@effected/github-actions`, itself integrated. A third non-octokit
runtime dependency added here must be treated as a fresh decision rather
than a free ride on this one.

## Alternatives rejected

- **Push octokit to every consumer directly.** This is what a predecessor's
  design effectively forced by exposing an untyped operation-string surface;
  every consumer re-derived its own typing and its own client wiring.
- **`@octokit/rest`, for convenience.** It bundles a request-log plugin this
  package immediately silences and duplicates `@octokit/types` at
  megabyte cost, for zero typing benefit over the bare core client.
- **`@octokit/auth-app`, for App authentication.** It re-exports an OAuth
  user-auth factory, making hundreds of kilobytes of OAuth app, user and
  device-flow machinery reachable from a package that only ever mints
  installation tokens.
- **A full libsodium build**, in place of `tweetnacl` + `blakejs`, for the
  sealed box. Rejected as unnecessary weight for the single algorithm
  actually needed.

## Consequences

`@effected/github` must maintain the bundle-reachability invariant that
keeps the JWT signer and the crypto pair confined to the modules that
actually need them (`GitHubApp.ts`, `RepositorySecret.ts`), so that a
token-only REST consumer never pays for either — see
[bundle reachability](../modules/github.md#bundle-reachability). A
consumer that wants none of octokit at all — only the pure permission
comparator, or the extracted issue-reference grammar — reaches for the
pure surfaces or for [`@effected/github-references`](../modules/github-references.md)
instead.


---
<!-- okf/decisions/github-compat-re-export-droppable.md -->
---
type: Decision
title: "github's github-references compat re-export is droppable, not breaking"
description: Why the six-name re-export in @effected/github exists, and why removing it later is not a breaking change for the consumer that already adopted the new home.
status: draft
tags: [bundle, compat]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: ea48fe796670ea49cf425419dfea3f8ff02fbb1ec93f5962fb86e29d533f7117
---

# github's github-references compat re-export is droppable, not breaking

## Context

When the issue-reference grammar moved from `@effected/github` into
`@effected/github-references` (see
[the extraction decision](github-references-extracted-for-install-weight.md)),
consumers that had already adopted the grammar from its old home would
otherwise fail to compile the moment `github` stopped exporting those
names.

## Decision

`@effected/github`'s entry point re-exports exactly the six names the
grammar was extracted from it under: `CLOSING_KEYWORDS`, `ClosingKeyword`,
`IssueReference`, `harvestIssueReferences`, `BareLineReference`,
`parseBareLineReference`. Nothing else moves back: the closing-list dialect
(`parseClosingList`, `parseReferenceList`) and the companion surfaces
(`harvestReferenceLists`, the per-line helpers, `keywordFamily`,
`collectReferenceLists`) are deliberately not re-exported, so the compat
surface cannot widen by accident.

`packages/github/__test__/IssueReferencesCompat.test.ts` exercises the
value exports through the entry point and annotates values with the type
exports, so compiling the suite is itself the assertion that the promise
holds — a future bump that drops the re-export deletes that suite
deliberately, which is the point: the surface cannot lapse silently.

## Alternatives rejected

- **Keep the full grammar re-exported from `github` indefinitely.** This
  would make `github` carry the whole grammar's surface forever, defeating
  the reachability goal the extraction exists to serve.
- **Drop the re-export immediately at extraction.** This would break every
  consumer that had adopted the grammar in its old home with no migration
  window.

## Consequences

Removing the re-export at a later `github` release is **not** a breaking
change for a consumer that has migrated to importing
`@effected/github-references` directly — it is a breaking change only for a
consumer still importing those six names through `@effected/github`, and
that consumer's fix is a one-line import-path change. The re-export is
explicitly a migration affordance rather than a permanent surface, and
widening it beyond the original six names is treated as a design decision
each time it comes up, not a default.


---
<!-- okf/modules/github-references.md -->
---
type: Module
title: "@effected/github-references"
description: GitHub's issue-reference grammar as pure functions, extracted from @effected/github.
status: stable
kind: package
resource: ../../packages/github-references
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 989d8c3e20ed123dca6c742568404bc04f1c71371f0a89a6e0dc2dfd9565bd7f
---

# @effected/github-references

`@effected/github-references` is GitHub's issue-reference grammar as pure
functions: the nine closing keywords, a separate non-closing reference set,
and three dialects that read them. Strings in, values out — no service, no
layer, no client. `packages/github-references/src/` is three modules: the
two prose-and-line dialects (`IssueReferences.ts`), the list dialect with
its inline form (`ClosingList.ts`) and the keyword-family projection
(`KeywordFamily.ts`).

It is a package rather than a corner of [`@effected/github`](github.md)
because the grammar and the GitHub client have opposite dependency costs.
Pure-but-GitHub-shaped vendor rules belong in the kit rather than in a
consumer, but that rule says nothing about *which* kit package hosts them:
hosting the grammar beside the client cost `github`'s own consumers nothing
and cost an octokit-free consumer the whole client tree for a few lines of
pure string work — see
[the extraction decision](../decisions/github-references-extracted-for-install-weight.md).
The test before hosting the next pure vendor rule is not "does a client
already link here" but "can the consumers most likely to re-derive it
actually reach it".

## Tier and dependencies

**Pure tier**, per [the tier taxonomy](../glossary/library-tier.md). `effect`
is the only peer; zero regular dependencies, no services, no layers, no `R`
anywhere, `"sideEffects": false`. The inline and bare-line dialects are regex
and string work; everything in `ClosingList.ts` is a regex-free character
scan.

The dependency arrow points at this package: `@effected/github` takes it as
a regular `workspace:^` dependency, for one reason only — see
[the compat re-export](#the-github-compat-re-export).

## Naming

`@effected/github-references`, directory `packages/github-references`. The
short form `github-refs` was rejected on two counts: inside the GitHub
domain "refs" is already git-refs vocabulary (`refs/heads/...`), so the
short name would name the wrong thing, and house style is unabbreviated.

## The three dialects

One regex for all three is the tempting simplification, and it is wrong in
a way nobody would notice: accepting the colon inline would harvest
references GitHub will not link, so a pipeline would report an issue as
closing when merging the pull request actually leaves it open. The dialects
differ because their producers differ — prose is written by humans for
GitHub's scanner, a generated region is written by tooling for humans — and
that is the rule to apply if a fourth dialect appears.

- **Inline-in-prose** (`harvestIssueReferences`, `src/IssueReferences.ts`)
  scans running text — `"fixes #12 and closes #13"` — with mandatory
  whitespace and no colon, because that is the spelling GitHub's own
  scanner honours when it decides what a pull request closes. Each hit
  carries offsets; a digit run outside the safe-integer range is skipped
  rather than parsed, since rounding it silently yields a different,
  existing issue number.
- **Bare-line** (`parseBareLineReference`, `src/IssueReferences.ts`) takes
  the whole trimmed line as the reference — `"Closes: #12"` — with an
  optional colon, because a generated references region writes one
  reference per line and the colon reads better there. It deliberately
  carries no offsets: the line *is* the reference, so an offset would be a
  constant restated.
- **The closing-list dialect** (`src/ClosingList.ts`) reads one whole line
  naming several issues — `Closes #247, #248 and #251` — through two entry
  points over one engine: `parseClosingList(line)` answers a `ClosingList`
  (closing keywords only), and `parseReferenceList(line)` answers a
  `ReferenceList`, the superset that also accepts the non-closing
  `REFERENCE_KEYWORDS` (`ref`, `refs`, `references`), because GitHub's
  linker links `Refs #N` without closing it. `closing` is the
  discriminator, and `parseClosingList` is the closing-only view of the
  same engine rather than a second parser — a commitlint rule needs the
  strict closing view, a changesets harvester needs the categorized
  superset, and a consumer that fused the two would either link nothing for
  `Refs` or claim `Refs` closes something.

### Grammar

A whole-line dialect, the bare-line posture rather than the prose one —
after trimming, the entire line must be `<keyword>[:] <ref-list>`:

- Keyword is case-insensitive, and the result carries the canonical
  lowercase form.
- The colon is optional, as in bare-line.
- Whitespace is `[ \t]` only, so embedded newlines cannot smuggle a second
  line into a single parse.
- List items are `#<digits>`, separated by `,`, by `and`, or by the Oxford
  `, and`. At least one item is required, and `#` is mandatory.
- Trailing prose rejects the line — a whole-line dialect that ignored a
  tail would report a partial reading of a line it did not actually
  understand.
- Duplicates are preserved; deduplication is the caller's business.
- Any item whose digits exceed `Number.MAX_SAFE_INTEGER` rejects the whole
  line — the deliberate contrast with `harvestIssueReferences`, which
  skips an unsafe match in prose, because in prose the surrounding text is
  not a claim about the skipped number, while a list line's partial
  reading would misrepresent it as referencing fewer issues than it does.

The head pattern is derived from the two keyword constants rather than
spelled a second time, so a keyword added to either set cannot drift from
the grammar that reads it, and `closing` is membership in
`CLOSING_KEYWORDS`, tested once against a widened set so no call site
casts.

## Drift settlements

Downstream hand-rolled copies of this grammar disagreed with each other.
The kit is the place that settles the disagreement, and each settlement is
a ruling, not an average:

| Question | Settlement |
| --- | --- |
| Keyword set | The canonical nine GitHub documents; narrower downstream variants converge upward. |
| Bare `closes: 123` | Rejected — `#` is mandatory, since GitHub requires it for a same-repo closing reference. |
| The `Refs` category | A separate, non-closing keyword set, surfaced through `parseReferenceList` with `closing: false`. |
| ReDoS posture | A single left-to-right character scan — `ClosingList.ts` contains no regular expressions at all, so worst-case time is linear by construction and no input truncation is needed. |

One accepted behaviour delta, agreed downstream in advance: the kit's
`[ \t]+` separator is tighter than a `\s+` some downstream copies used — a
whole-line dialect whose separator class contains newlines is not really a
whole-line dialect. The inline harvester keeps that separator class
unchanged and admits the wider `\s` set in exactly one place, the
keyword-to-first-item gap, where the inline posture requires it.

## The companion surfaces

Four surfaces sit beside the dialects, all additive, none reopening a
ruling above and none part of the compat re-export:

- **`harvestReferenceLists(text)`** (`src/ClosingList.ts`) — the closing-list
  grammar worn inline (`Closes #123, Fixes #456` on one line), a gap
  neither original dialect covered on its own. Results are
  `HarvestedReferenceList` — a `ReferenceList` widened with `start`/`end`
  offsets. Word boundaries hold on both sides of the keyword; the
  keyword-to-first-item gap admits any whitespace including newlines, while
  list continuation keeps `[ \t]` only, so a list cannot cross a newline;
  an unsafe item anywhere skips the entire candidate rather than yielding a
  partial list; and the `and` separator stays lowercase-only in prose, so
  `closes #1 AND #2` harvests only `#1` — loosening it is a grammar change,
  not a local tweak.
- **`parseBareLines`, `parseClosingLists`, `parseReferenceLists`** — the
  per-line application every call site was writing as a `split("\n")` plus
  an `Option`-collect loop. No line numbers, deliberately: most consumers
  only aggregate the references, and a consumer that needs positions keeps
  its own split loop.
- **`keywordFamily(keyword)`** (`src/KeywordFamily.ts`) — the
  close/fix/resolve/ref projection consumers were spelling as
  `keyword.startsWith("fix")`, replaced by an explicit total `Record` keyed
  by every keyword, so a keyword added to either set without a family entry
  is a compile error rather than a silent miscategorization.
- **`collectReferenceLists(text)`** — the per-line composition of the
  whole-line and inline postures, for a text that mixes generated trailer
  lines with human prose. Per line, `parseReferenceList` is tried first —
  colon-tolerant, the line dialect's posture — and only a line that is not
  a whole-line list falls through to `harvestReferenceLists` on that same
  line. A line that matches whole-line never also gets harvested, so a
  colon-less trailer line, valid under both readings, contributes its list
  exactly once.

## Out of scope, recorded

- **Cross-repo and full-URL references.** Neither dialect's consumers emit
  them, and guessing their shape would freeze an API nobody has driven.
- **Issue-state classification.** Issue state is not grammar; a second
  consumer should drive it, and the first will likely want it from the
  client rather than from a parser.
- **A `@changesets/get-github-info` replacement.** That is API-tier work —
  it queries GitHub — so it belongs to `@effected/github` if anywhere,
  never to a pure grammar package.

## The github compat re-export

`@effected/github` re-exports exactly the six names the grammar was
extracted from it under — `CLOSING_KEYWORDS`, `ClosingKeyword`,
`IssueReference`, `harvestIssueReferences`, `BareLineReference`,
`parseBareLineReference` — so consumers that adopted the grammar in its
old home keep compiling. That re-export is the only reason `github` depends
on this package — see
[the compat re-export decision](../decisions/github-compat-re-export-droppable.md).
Two riders: it is droppable at a later `github` bump, once consumers import
from the new home, and the closing-list surfaces and the companion
surfaces above are deliberately not re-exported from `github`, so the
compat surface cannot widen by accident.

The promise is a test, not a comment:
`packages/github/__test__/IssueReferencesCompat.test.ts` exercises the
value exports through the entry point and annotates values with the type
exports, so compiling is the assertion for the types.

## Testing

`@effect/vitest`, `assert.*` — never `expect`; tests in `__test__/`, one
file per module. The suite carries the drift settlements as executable
rulings rather than as prose: keyword casing and canonicalization, the
optional colon, each separator form including the Oxford comma, mandatory
`#`, trailing-prose rejection, duplicate preservation and the whole-line
rejection on an unsafe digit run sitting beside `harvestIssueReferences`'s
skip-in-prose behavior for contrast. A hostility case pins the ReDoS
posture — a pathological long line parses in linear time and is neither
truncated nor hung on. The companion surfaces pin their own rules the same
way, including `keywordFamily` asserted exhaustively over every keyword
rather than sampled, and `collectReferenceLists`'s once-per-posture
preference, including a colon-less line proven to contribute once rather
than twice.
