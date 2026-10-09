### sol-1-1
- file: scratchpad/effected/github/GitTag.ts:248
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11; the pinned oracle’s resource methods discard successful transport payloads.   evidence: Read-only probes with a request returning `""` produced `tag delete success ""` and `setter success ""` in the port, while the oracle produced `undefined` for both operations. The same introduced `return yield* client.request(...)` pattern occurs at PullRequestComment.ts:203, RepositorySecret.ts:221 and :284, RepositoryVariable.ts:212 and :296, RepositorySecurity.ts:144, :170 and :196, and Ruleset.ts:471.
- failure: These methods advertise `Effect<void, …>` but now expose the response body as their success value. Their runtime results diverge from upstream and from sibling write methods that still discard the response.
- fix: Apply `Effect.asVoid` to each affected request before returning it, preserving the definitive generator exit and the upstream `undefined` result.

### sol-1-2
- file: scratchpad/effected/github/internal/crypto.ts:71
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-1; EFFECTED_PORT_GOAL.md D9 and section 14’s verified-upstream-bug exception.   evidence: Read-only probes showed `encryptSecret("AA==", "test")` throws `bad public key size`; an empty encoded key does likewise, and a base64 value decoding to 33 bytes throws an out-of-bounds error. The pinned oracle also throws for `"AA=="`. The existing test covers invalid base64 syntax, which does not exercise invalid decoded key lengths.
- failure: Base64 decoding can succeed with a key whose length is not 32 bytes. The subsequent operations throw inside `Result.map`, bypassing the declared `Result` failure channel. Through `RepositorySecret.set` or `setForEnvironment`, this becomes a defect instead of the promised typed `GitHubError`.
- fix: Validate the decoded public key’s length before performing encryption and return an `EncodingError` failure when it is not 32 bytes. Adjust the caller’s failure reason to cover invalid key shape, add short/oversized-key regressions, and record the upstream-bug deviation under section 14.

### sol-1-3
- file: scratchpad/effected/github/TokenPermissions.ts:142
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and section 14; `TokenPermissions.compare` promises to compare permissions actually granted and required.   evidence: In both the port and pinned oracle, `TokenPermissions.fromGitHub({}).compare({ toString: "read" })` returns `{"missing":[],"extra":[]}`. Likewise, `TokenPermissions.fromGitHub({ constructor: "read" }).compare({})` reports no extra permission.
- failure: Indexed reads at lines 142 and 154 consult inherited object properties. A prototype property can therefore masquerade as a granted or required permission; its undefined rank makes both comparison branches false. `assertSufficient` and `assertExact` can incorrectly succeed.
- fix: Read both maps through own-property-aware `R.get`/`R.has` operations. Preserve arbitrary permission names during construction with `R.fromEntries`. Add prototype-name regressions and record the verified upstream-bug deviation.

### sol-1-4
- file: scratchpad/effected/github/WorkflowDispatch.ts:280
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and section 14; `dispatchAndWait` promises the run created by the requested workflow dispatch.   evidence: Read-only probes against both implementations showed `dispatchAndWait("ci.yml", "main")` returning completed run `99` whose path was `.github/workflows/release-ci.yml` and event was `push`. The recorded query used the repository-wide runs endpoint with only `created` and `branch`. A separate probe for workflow `"123"` timed out despite receiving a completed run with `workflow_id: 123` and path `.github/workflows/ci.yml`.
- failure: Suffix matching accepts another workflow’s filename and does not distinguish dispatch runs from other events. It also cannot match a numeric workflow ID against a filename. Polling can return an unrelated result or reject a successfully completed requested workflow.
- fix: Query the workflow-specific runs endpoint using `workflow_id: workflow` and filter for `event: "workflow_dispatch"`, retaining the creation-time/ref constraints. Select the matching run once and poll that run ID thereafter. Add unrelated-event, suffix-collision and numeric-ID regressions, and record the upstream-bug deviation.

### sol-1-5
- file: scratchpad/effected/github/WorkflowDispatch.ts:264
- class: bug   severity: required
- standard: standards/effect-first-development.md’s explicit timeout/error-boundary requirements; EFFECTED_PORT_GOAL.md D9, D11 and section 14.   evidence: With `interval: Duration.zero`, `timeout: Duration.millis(1)`, and an in-memory paginator returning no runs, the calculation produces `attempts = Infinity`. A read-only probe required an external 80 ms timeout to stop it: `None`, approximately 86 ms elapsed, seven polls. The oracle contains the same calculation.
- failure: An accepted zero interval turns a finite timeout into an unbounded polling loop. More generally, the attempt count does not bound elapsed time spent inside requests.
- fix: Validate that the polling interval is positive and enforce the polling deadline with an Effect timeout that maps expiry to the existing typed 408 error. Add the zero-interval/deadline regression and record the verified upstream-bug deviation.

### sol-1-6
- file: scratchpad/effected/github/Rest.ts:70
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; the route-keyed request contract must describe every possible successful payload.   evidence: The new conditional evaluates the combined data type rather than distributing over `R`. For a union of a repository GET route and a bodyless DELETE route, `Repository | never` collapses to `Repository`, so the conditional omits `""`. An in-memory TypeScript proof of the identical type expression rejected the empty-string case with `TS2322: Type 'string' is not assignable to type '{ id: number; }'`.
- failure: A request made with a union-valued route can return `""` at runtime while its declared success type contains only the GET response object. Code can access object fields without handling the bodyless result.
- fix: Distribute over the route first: `R extends Route ? ([Endpoints[R]["response"]["data"]] extends [never] ? "" : Endpoints[R]["response"]["data"]) : never`. Add a type regression covering a mixed bodyless/bodyful route union.

### sol-1-7
- file: scratchpad/effected/github/GitHubRepository.ts:413
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9; standards/effect-first-development.md’s observability requirements.   evidence: The oracle constructs `settings` and `ownerType` with named `Effect.fn` calls. The port replaces them with bare `Effect.gen` values. A controlled request reading `Effect.currentSpan` observed `["GitHubRepository.settings","GitHubRepository.ownerType"]` in the oracle and `["caller","caller"]` in the port.
- failure: Both operations lose their resource spans, and their annotations attach to the surrounding caller span. This is an observable tracing regression beyond the syntactic change needed to remove the function IIFEs.
- fix: Keep the effect-valued members and restore their names with `Effect.withSpan("GitHubRepository.settings")` and `Effect.withSpan("GitHubRepository.ownerType")`.

### sol-1-8
- file: scratchpad/effected/github/TokenPermissions.ts:13
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; EFFECTED_PORT_GOAL.md D5.   evidence: `PermissionLevel` is a named, reused, annotation-bearing literal domain built with `S.Literals`. `MergeMethod` at PullRequest.ts:24 uses the same pattern. These are named schema declarations, rather than anonymous inline field unions.
- failure: The declarations do not meet the required `LiteralKit` contract and omit its derived keyed predicates/matching surface. The four green law lanes do not enforce this schema-modeling requirement.
- fix: Construct both named domains with `LiteralKit`, retaining their existing literals, identity annotations and type exports.

### sol-1-9
- file: scratchpad/effected/github/GitHubRepository.ts:151
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; schema-first-development guidance requiring named domain constraints and schema-derived guards.   evidence: `isStatusObject` manually defines the accepted `{ status: "enabled" | "disabled" }` shape through property checks and literal comparisons. No schema owns this named constraint.
- failure: The normalizer’s accepted status-object shape exists only in a handwritten guard, so its type, validation and reusable schema behavior cannot derive from one model.
- fix: Define the status-object boundary schema and derive this guard with `S.is`. Preserve the current excess-property behavior; record any law-forced acceptance change under section 14.

### sol-1-10
- file: scratchpad/effected/github/Ruleset.ts:288
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and the operator’s identity step; schema-first-development guidance on IdentityComposer annotations.   evidence: The exported `RulesetPayload` uses the raw identifier `"RulesetPayload"` instead of the file’s `$I`. Its fields lack identity-backed field annotations. The named supporting schemas beginning with `RuleDismissalActor` at line 38 likewise use raw identifiers.
- failure: This newly introduced schema family bypasses the required package/path identity and annotation convention, despite identity being a completed prerequisite for this review round.
- fix: Apply `$I.annote`/`$I.annoteSchema` to the exported and named supporting schemas and annotate their fields, preserving the existing wire types and validation behavior.

### sol-1-11
- file: scratchpad/effected/github/RepositoryVariable.ts:28
- class: schema   severity: required
- standard: schema-first-development/references/repo-laws.md, “Use Schema for pure data models”; EFFECTED_PORT_GOAL.md D5.   evidence: `VariableInfo` remains an exported pure-data interface. The same condition occurs for `SecretInfo` in RepositorySecret.ts:41, `RulesetInfo` in Ruleset.ts:29, and `AppliedSettings` in GitHubRepository.ts:285. These declarations contain data fields rather than service operations.
- failure: These public data models have no runtime schema from which decoding, guards, equivalence and arbitraries can derive. Their shapes remain independently declared TypeScript interfaces.
- fix: Introduce schema-backed declarations with same-name derived type exports. Preserve the existing structural wire/result shapes and optionality; use boundary structs where class construction would introduce an unnecessary behavior change.

### sol-1-12
- file: scratchpad/effected/github/GraphQL.ts:27
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md hard requirements and carrier policy; EFFECTED_PORT_GOAL.md section 10; S2 deferral in the review brief.   evidence: The focused files retain `@remarks` and `@example` carriers. For example, `GitHubGraphQLError` retains `@remarks` and lacks a value-level Example, canonical category and `@since 0.0.0`; comparable omissions remain across the focused public declarations.
- failure: The current API documentation does not meet the required section grammar or export documentation rubric.
- fix: During S2, convert the carriers, retain the upstream teaching prose, add titled compiling Examples for value exports, and add canonical categories and `@since` tags.

### sol-1-13
- file: scratchpad/effected/github/RepositorySecurity.ts:25
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D2, D9 and section 14; documentation findings are backlog under the review brief.   evidence: The port changes security readers from zero-argument functions to effect values; Ruleset and RepositoryVariable also change `list` to a value. Other focused changes include the public HashSet representation and the new runtime `RulesetPayload` export. README Port notes still say `Added exports: None` and `Deviations: None`; the github ledger row has empty `exportsAdded` and `deviations`.
- failure: The provenance surfaces do not explain the law-forced API changes or inventory the added runtime export, so consumers and later reviewers cannot reconcile the port with the oracle.
- fix: Add the grouped law/diagnostic deviation records with affected sites and adjusted tests, and inventory the `RulesetPayload` value export. Keep these records distinct from the behavioral bugs above.

### sol-1-14
- file: scratchpad/test/github/Rest.test.ts:6
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and section 11.4; S3 deferral in the review brief.   evidence: The PageOptions suite contains example-based construction/decoding tests but no `Arbitrary.schema(PageOptions)` encode/decode property. The focused Resilience and TokenPermissions suites likewise lack the required schema round-trip properties and `fcRuns` floor.
- failure: The required property floor has not been established for these exported schemas; example tests do not prove round-trip behavior across their generated domains.
- fix: During S3, add `it.effect.prop` round-trip properties using `Arbitrary.schema`, Effect equality and `fcRuns`, retaining the existing example tests.

### sol-1-15
- file: scratchpad/test/github/crypto.test.ts:111
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md, “Choose assertions by value”; EFFECTED_PORT_GOAL.md section 11.2; S3 deferral in the review brief.   evidence: The malformed-base64 test checks `Result.isFailure(sealed)` as a boolean instead of asserting the failure variant and payload through `@effect/vitest/utils`. Focused resource suites also retain repeated per-test provision of effectful resource layers rather than `it.layer`.
- failure: The tests retain the pre-S3 assertion and layer-lifecycle forms, leaving failure payloads unchecked and effectful layer ownership outside the requested canon.
- fix: During S3, use the public Result assertion helpers with expected payloads and move effectful/scoped resource-layer setup into `it.layer`.

REQUIRED: 11
BACKLOG: 4