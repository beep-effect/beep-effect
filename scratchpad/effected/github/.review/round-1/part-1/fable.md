### fable-1-1
- file: scratchpad/effected/github/README.md:341
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 + section 14 (ledger entry first, README Port notes -> Deviations, cite the adjusted upstream test); 2026-10-09 ruling: one ledger plus README deviation entry per module per systemic class listing sites and adjusted upstream tests   evidence: PORT_LEDGER.json rows[19] (w2-github) has "deviations": [] and README says "### Deviations / None." while diff -u against the oracle shows five law-forced systemic classes with rewritten upstream tests: (1) tsgo lazyEffect (error, tsconfig.base.json:165): CodeScanningShape.languages (CodeScanning.ts:76) and DeploymentEnvironmentShape.list (DeploymentEnvironment.ts:46) (+ Ruleset.list, RepositoryVariable.list, RepositorySecurity.*) changed from `() => Effect` to `Effect`; makeTest doubles now die lazily via Effect.suspend(() => unstubbed(...)) instead of throwing on call; tests adjusted at CodeScanning.test.ts:73,87,90 and DeploymentEnvironment.test.ts:81,94 (landed in c4f461a6cc "chore: saving progress", no cause written). (2) D15 cast removal: GitHubFixtures.request/paginate became route-keyed Result maps (GitHubClient.ts:186,191), requestDecoded reads a new fixtures.requestDecoded table (:195,:501) instead of fixtures.request, and unstubbed:"empty" now fails notFound for request/requestDecoded (:485) where upstream served `{}`; tests adjusted at every Result.succeed(...) site, GitHubClient.test.ts:543-556 rewritten, fixtures.ts gained ~400 lines (repositoryFixture, pullFixture, environmentFixture); the README only mentions this in a stray paragraph at :347 outside the Deviations section. (3) Rest.Data<R> now maps `never` to "" (Rest.ts:194, commit 09852f99ab), a public type change justified only by a comment (an upstream-bug cause never recorded with evidence). (4) native-runtime/globalDateInEffect: CheckRun started_at/completed_at read DateTime.now (CheckRun.ts:374,392) instead of new Date().toISOString(); under TestClock both stamp 1970-01-01T00:00:00.000Z. (5) law 7 tagged errors: UnstubbedError/FixtureError/CommitFileDecodeError replace new Error in every file; GitHubCommit.fileOf (:233) throws CommitFileDecodeError where upstream threw the class constructor's SchemaError.
- failure: Round-2 seats, `audit ledger --verify` and the promotion grill see a module with zero deviations while five public-contract changes exist; nothing records which upstream tests were rewritten or why, so drift and sanctioned deviation are indistinguishable (the exact situation section 14 exists to prevent).
- fix: Add one `deviations` entry per class above to PORT_LEDGER.json rows[19] in the jsonl entry shape (test, upstreamBehaviour, labBehaviour, reason as `law:<rule>` or `upstream-bug:<evidence>`, sites) and mirror them under README "### Deviations", folding the :347 paragraph into the fixtures entry.

### fable-1-2
- file: scratchpad/effected/github/DeploymentEnvironment.ts:150
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 (behaviour-preserving; a different default or value is a deviation) and the 2026-10-09 ruling: lab changes no law, diagnostic or ruling forced are restored to the upstream shape   evidence: Upstream has a bare `yield* client.request("DELETE ...")` in DeploymentEnvironment.delete, GitHubApp.revoke and GitBranch.delete. Commit 7f67982f77 added `return` as the missingReturnYieldStar quick fix while Rest.Data<"DELETE ..."> was still `never` (the rule fires only for Effects that never succeed, docs/rules/missing-return-yield-star.md). Commit 09852f99ab then mapped `never` to "" in Rest.ts:194, so the diagnostic no longer applies and the three focus sites (DeploymentEnvironment.ts:150, GitHubApp.ts:495, GitBranch.ts:289; also GitTag.ts:248, Ruleset.ts:471, RepositoryVariable.ts:178,212,250,296, RepositorySecret.ts:284, PullRequestComment.ts:203 outside focus) now succeed with "" under shapes declared `Effect<void, ...>`. TS accepts Effect<""> for Effect<void> only through the `(_: never) => A` variance encoding's return-void special case, so tsgo cannot see it; no test pins the value.
- failure: `yield* environments.delete("prod")`, `yield* app.revoke(token)` and `yield* branches.delete(name)` evaluate to "" instead of undefined; any consumer that forwards, logs or compares the result of a `void` member observes a string, and GitHubApp.scopedToken / makeRotatingClient.revokeHeld now carry "" through their finalizers. The public `void` contract is false while every gate stays green.
- fix: Delete the `return` on the DELETE sites (restore upstream `yield* client.request(...)`); tsgo is silent because the success type is "", not `never`. Same one-token restore at the non-focus sites listed.

### fable-1-3
- file: scratchpad/effected/github/CheckRun.ts:18
- class: schema   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D5 (identity annotations on every schema, service and error) and step 4 ("annotations on fields and schemas")   evidence: CheckRun.ts:18 UnstubbedError, GitHubClient.ts:24 UnstubbedError and :28 FixtureError, GitHubCommit.ts:18 UnstubbedError and :22 CommitFileDecodeError are declared without the `$I.annote("...", { description })` third argument that the other 11 modules' UnstubbedError classes carry (e.g. ArtifactMetadata.ts:14-16); CommitFileDecodeError's `cause: S.Defect({ includeStack: true })` has no key description either.
- failure: Five error schemas in the module lack identifier/title/description annotations while their siblings have them; docgen and any annotation-driven tooling render them inconsistently.
- fix: Append the same `$I.annote("<Name>", { description: ... })` argument to the five classes and `.annotateKey({ description })` on CommitFileDecodeError.cause.

### fable-1-4
- file: scratchpad/effected/github/CheckRun.ts:423
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 22 (Effect.fn naming) and the module's own convention: every public member span is `<Service>.<member>`   evidence: `withCheckRun: Effect.fn("withCheckRun")(...)` while create/get/update/complete use "CheckRun.create" etc. Upstream had a plain generic arrow with no span; law 22 forced the Effect.fn wrap but the name is the lab's choice (GitTag.ts:203 `Effect.fn("reset")` has the same drift outside focus).
- failure: Trace consumers filtering spans by the `CheckRun.` prefix miss the bracket span; the bracket is the one member whose span most needs correlating with create/complete.
- fix: Rename to `Effect.fn("CheckRun.withCheckRun")` (and `"GitTag.reset"`).

### fable-1-5
- file: scratchpad/effected/github/GitHubCommit.ts:233
- class: effect-idiom   severity: backlog
- standard: .patterns/error-handling.md (typed failures in the error channel, never thrown); GitHubErrorKind "decode" is documented as "a response arrived but did not match the schema it was decoded against"   evidence: `fileOf` runs `S.decodeUnknownResult(CommitFile)` and `Result.getOrThrowWith(..., CommitFileDecodeError.make)` inside synchronous `.map(fileOf)` calls (GitHubCommit.ts:286,316, PullRequest.listFiles), so an unknown `status` from GitHub becomes a thrown defect. Behaviour matches upstream (CommitFile.make validates and throws per node_modules/effect/dist/Schema.js:9252 "Construction throws an Error ... on invalid input"), so routing it to GitHubError.decode would be a D9 deviation needing a `law:` cause; hence backlog, not required.
- failure: A GitHub payload with a status outside FileStatus kills the fiber with CommitFileDecodeError instead of failing typed as GitHubError { kind: "decode" }, bypassing every catchIf(GitHubError.hasKind(...)) a consumer wrote.
- fix: When ruled: make `fileOf` return `Effect<CommitFile, GitHubError>` via `S.decodeUnknownEffect(CommitFile)` mapped through `GitHubError.decode("GitHubCommit.changedFiles", ...)`, use `Effect.forEach` at the three call sites, delete CommitFileDecodeError, and record the deviation.

### fable-1-6
- file: scratchpad/effected/github/GitHubApp.ts:528
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: `normalizePermissions` guards with P.isObjectOrArray, then branches `P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw)` into a mutable `out` record. effect/Record `filter` has a refinement overload (node_modules/effect/dist/Record.d.ts:1093) that does the whole job: `P.isObjectOrArray(raw) ? R.filter(raw, P.isString) : {}`. The terse-effect gate passed, so this is advisory.
- failure: Nine lines and a type-argument-laden second branch where one helper call expresses the intent; the explicit generic on R.toEntries is the kind of annotation the next reader has to re-derive.
- fix: `const normalizePermissions = (raw: unknown): Record<string, string> => (P.isObjectOrArray(raw) ? R.filter(raw, P.isString) : {});`

### fable-1-7
- file: scratchpad/effected/github/CodeScanning.ts:149
- class: type-safety   severity: backlog
- standard: standards/effect-laws-v1.md law 4 (no assertions) read with D15: removing a cast must not replace it with an unchecked index signature; GitHubClient's own doc: "a mismatch between a route and its parameters is a compile error"   evidence: The body is assembled as `Record<string, unknown>` (:149-158) and spread into the typed route call (:160-164). The index signature satisfies Rest.Params without checking any body field, so CodeScanningSetup's `string`-typed query_suite/threat_model/runner_type (:34-38) flow into fields the route types as literal unions (@octokit/openapi-types code-scanning-default-setup-update: runner_type "standard"|"labeled", query_suite "default"|"extended"). Upstream's `as Rest.Params<...>` at least named the hole; the SETUP_KEYS + UnlistedSetupKey machinery (:120-134) exists only to guard it. DeploymentEnvironment.ts:304 `...config` is the same shape by design (open record).
- failure: `configure({ query_suite: "extendedd" })` compiles and reaches GitHub, which answers 422; the route table's parameter typing is silently bypassed for the whole body.
- fix: At S4 (public type change, record as D9 law:D15): type CodeScanningSetup as `Partial<Pick<Rest.Params<"PATCH /repos/{owner}/{repo}/code-scanning/default-setup">, "state" | "languages" | "query_suite" | "threat_model" | "runner_type" | "runner_label">>` and build the body with `O.getSomesStruct({ state: O.fromUndefinedOr(setup.state), languages: O.map(O.fromUndefinedOr(setup.languages), A.copy), ... })`, deleting SETUP_KEYS and UnlistedSetupKey.

### fable-1-8
- file: scratchpad/effected/github/GitHubClient.ts:230
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled **Example** and **Details**/**Gotchas** sections; never @example/@remarks); S2 not yet run by operator order   evidence: All 14 focus files keep `@remarks`, `@example` and `@public` carriers (e.g. ArtifactMetadata.ts:21-24, GitHubError.ts:213-225, CheckRun.ts:201-221). GitHubClient.ts is already half-converted: `**Details**` at :180 and :201 next to `@remarks` at :230, :254 and :324, so one file mixes both grammars.
- failure: docgen/JSDoc law breaks once S2's gate runs; the mixed file will need a second pass because the mechanical converter cannot tell converted from unconverted sections.
- fix: Carry out in S2 only: run the carrier conversion over the module and normalise GitHubClient.ts to one grammar; no edits before S2.

### fable-1-9
- file: scratchpad/test/github/GitHubClient.test.ts:759
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md and section 11.3 coverage (S3 not yet run)   evidence: (a) No test pins the success value of DeploymentEnvironment.delete / GitHubApp.revoke / GitBranch.delete, which is why fable-1-2 passed every gate. (b) The only `unstubbed: "empty"` test (:759) covers paginate; the new request/requestDecoded branch (GitHubClient.ts:485) and the new fixtures.requestDecoded table (:501) have no test. (c) GitHubCommit.fileOf with a status outside FileStatus (:233) is untested. (d) CheckRun.create's started_at under TestClock (CheckRun.ts:374) is untested.
- failure: The behaviours the port changed are exactly the ones with no oracle, so a later regression on any of them is invisible.
- fix: In S3 add canon `it.effect` cases: assert `isUndefined` on the three void members, one requestDecoded fixture round-trip plus an `"empty"` single-request notFound, one fileOf defect case, one `started_at` equals the TestClock instant.

### fable-1-10
- file: scratchpad/effected/github/GitHubError.ts:160
- class: docs   severity: backlog
- standard: D9 verbatim fidelity for oracle diffs (section 6 S0: identical to upstream apart from import specifiers); no gate formats the lab   evidence: Whole-file re-indentation from tabs to two spaces in CheckRun.ts, GitBranch.ts and GraphQL.ts; four-space islands inside tab files at GitHubError.ts:160-165 and :201-209, GitHubApp.ts:588-593 and :601-607, DeploymentEnvironment.ts:150-154; `yield*GitHubError...` with no space at GitHubContent.ts:433,436,443 and GitHubApp.ts:507.
- failure: `diff -u` against the oracle reports hundreds of whitespace-only hunks (CheckRun, GitBranch), hiding the real changes the round-2 seats and S2 must read.
- fix: One formatter pass pinned to upstream's tab style (biome or oxfmt) over scratchpad/effected/github before S2, so later diffs show only semantic changes.

REQUIRED: 2
BACKLOG: 8
