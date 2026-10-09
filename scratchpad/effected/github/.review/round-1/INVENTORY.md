# github — round-1 merged inventory

Read **9 reports + 3 adjacent briefs** across parts 1–3; **82 input findings accounted for**. Merged counts: **34 required · 15 backlog · 5 codemod · 3 rejected · 7 groups**.

Review SHA: `3fa5876691901fccf3d1cd29e9324564df134b56`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. Github source/tests have no diff from the review SHA on `@lab/effected` (inventory-time HEAD `a8a7f89a303b878f475b9d23d5be5cbbbd17c88b`). Probe outputs are seat evidence, not reruns. Qualified `seats:` ids disambiguate repeated ids; compound inputs can contribute distinct claims to multiple dispositions.

Applied the complete operator revision/rulings/grilling block, D1–D20, §§12.4–12.5 and §14. S2/S3 findings stay deferred; record-only forced changes are central codemod work. Allowlist: **0 github entries, hence 0 `allow-*` findings**; `github-actions` is a separate module.

## Required

`required.json` assigns each required id and every source/test path once; groups have at most five source files. Bundled seat reports are split only for independent concrete implementations in different ownership components; all reports for each implementation are deduplicated. Cross-file decoding and encryption fixes own every affected source file.

Existing mixed `resources.test.ts` / `resources2.test.ts` belong only to g1. g5 adds prospective `GitTag.test.ts`, `PullRequestComment.test.ts` and `WorkflowDispatch.test.ts`; g7 adds `transport.test.ts`; g3 adds the one authorized `deliberatelyInvalid.ts`. These are future fix surfaces, not files created by this inventory. Shared `fixtures.ts` and `harness.ts` are read-only for all groups. Groups supply site/test evidence for central bookkeeping and never edit the ledger, README Port notes, manifests, lockfiles or repo configs.

### req-01 — Serialize installation-token refresh and retain ownership of every replacement.
- file: scratchpad/effected/github/GitHubApp.ts:558
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `GitHubApp.clientLayer` token ownership and scope cleanup.
- evidence: A read-only `bun -e` probe supplied synthetic credentials and an in-memory HTTP transport, then ran two concurrent requests with an expired held token. It produced `minted: 3` and revocations `[synthetic_1, synthetic_1, synthetic_3]`. The pinned oracle contains the same unsynchronized `Ref.get → rotate → Ref.set` sequence. The existing rotation test exercises one request at a time.
- failure: Both requests observe the expired token and independently rotate. One replacement overwrites the other in `held`; scope cleanup revokes only the final replacement. The overwritten installation token remains valid after the layer closes. Rotation also performs duplicate revocation and mint requests.
- fix: Use one semaphore permit around freshness checking and rotation; re-read held state inside the permit. Concurrent callers must share one replacement token, and scope cleanup must revoke it. Add the concurrent-expiry regression using the recording transport. Supply the upstream-bug evidence and test path to central deviation bookkeeping; this group edits no ledger or Port notes.
- seats: part-1/sol.md#codex-1-1
- group: g2

### req-02 — Protect synchronous withCheckRun callback construction with the exit handler.
- file: scratchpad/effected/github/CheckRun.ts:434
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `CheckRunShape.withCheckRun` promises that every exit, including defects, concludes the run.
- evidence: A read-only probe invoked `withCheckRun("test", "sha", () => { throw new Error("callback defect"); })` over a recording client. The exit was a defect, and the complete call recording was `["POST /repos/{owner}/{repo}/check-runs"]`; no concluding PATCH occurred. The pinned oracle evaluates `use` before attaching `onExit` in the same way. The existing defect test returns `Effect.die(...)`, which does not exercise this case.
- failure: A synchronous exception while constructing the callback’s Effect bypasses the finalizer. The created check run remains `in_progress` and can continue blocking branch protection.
- fix: Attach the existing exit handler to Effect.suspend(() => use(run.id, conclude)). Attempt conclusion on a synchronous callback defect and retain that original defect. Add a regression asserting the concluding PATCH. Supply the verified upstream-bug evidence for central recording.
- seats: part-1/sol.md#codex-1-2
- group: g1

### req-03 — Restore undefined results for branch deletion, environment deletion and app-token revocation.
- file: scratchpad/effected/github/GitBranch.ts:289
- class: bug   severity: required
- standard: D9, behavior preservation; the declared `Effect<void, ...>` resource contracts.
- evidence: Read-only probes drove the real Octokit request path with scripted HTTP 204 responses. `GitBranch.delete`, `DeploymentEnvironment.delete`, and `GitHubApp.revoke` each returned `{ value: "", isUndefined: false }`. In the pinned oracle, their generators yield the request and then fall through, returning `undefined`. The corresponding changed sites are `DeploymentEnvironment.ts:150` and `GitHubApp.ts:495`. Fable attributes the return insertion to missingReturnYieldStar while the success type was never; after the Rest.Data correction that diagnostic no longer applies. The existing tests check outgoing requests without pinning success values.
- failure: Returning the terminal request leaks Octokit’s bodyless-response representation into APIs that previously returned `undefined`. TypeScript’s assignability to `void` allows this observable divergence to pass the compiler.
- fix: Restore the oracle generators that yield the request and fall through, or apply Effect.asVoid before a terminal return. Fix GitBranch.delete (:289), DeploymentEnvironment.delete (:150) and GitHubApp.revoke (:495); assert successful results are undefined with HTTP 204. The missingReturnYieldStar diagnostic no longer justifies leaking the body after Rest.Data became a successful empty-string type.
- seats: part-1/sol.md#codex-1-3, part-1/fable.md#fable-1-2, part-1/fable.md#fable-1-9
- group: g2

### req-04 — Decode external commit files through the typed GitHubError channel at all three call sites.
- file: scratchpad/effected/github/GitHubCommit.ts:234
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3; `standards/schema-first-development-prompt.md`, “Effect owns fallibility and runtime boundaries.” External decoding failures must enter the boundary’s typed error channel.; .patterns/error-handling.md. This cited law supplies the section-14 cause even though upstream also defects.
- evidence: A read-only probe returned HTTP 200 with a file containing `status: "future_status"`, then called `changedFiles`. The result was `Exit.Failure` with `Cause.hasFails = false` and `Cause.hasDies = true`; the defect was `CommitFileDecodeError`. `compare` also reaches this throwing helper through `comparison.files.map(fileOf)`. Fable identifies a third consumer, PullRequest.listFiles, in addition to GitHubCommit.compare (:286) and changedFiles (:316).
- failure: Unexpected external file data throws through `Result.getOrThrowWith` inside an Effect mapping callback. Callers handling the advertised `GitHubError` channel cannot recover from this decode failure.
- fix: Make external file decoding effectful with S.decodeUnknownEffect(CommitFile), mapping schema errors to GitHubError.decode with the calling operation. Replace synchronous map(fileOf) in compare, changedFiles and PullRequest.listFiles with effectful traversal. Keep rejecting invalid statuses, keep successful field/order semantics, remove any now-unused CommitFileDecodeError, and add failure-channel regressions. Central recording must cite the EF-3/error-boundary law and adjusted tests.
- seats: part-1/sol.md#codex-1-4, part-1/fable.md#fable-1-5, part-1/fable.md#fable-1-9
- group: g1

### req-05 — Preserve complete U+FFFD characters when truncating UTF-8 check-run output.
- file: scratchpad/effected/github/CheckRun.ts:113
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `CheckRunOutput.truncated` byte-prefix fidelity.
- evidence: A read-only probe constructed `prefix = "a".repeat(budget - 3) + "\uFFFD"`, where `budget = LIMIT_BYTES - byteLength(NOTICE) = 65475`, and appended 100 ASCII characters to force truncation. The prefix itself occupied exactly 65475 bytes, but the output discarded its complete U+FFFD character: actual prefix length `65472`, expected `65473`. The pinned oracle contains the same loop.
- failure: The loop treats every trailing replacement character as evidence of a split UTF-8 sequence. It therefore removes legitimate U+FFFD characters already present in the input, even when they fit completely within the byte budget.
- fix: Find a valid UTF-8 byte boundary before decoding the budgeted prefix; remove only an incomplete trailing sequence, never a complete U+FFFD already in the input. Add complete-U+FFFD and split-sequence regressions while preserving the notice and byte limit. Supply the verified upstream-bug receipt for central recording.
- seats: part-1/sol.md#codex-1-5
- group: g1

### req-06 — Use LiteralKit for the seven named literal domains owned by the commit/check/pull-request group.
- file: scratchpad/effected/github/CheckRun.ts:23; scratchpad/effected/github/CheckRun.ts:34; scratchpad/effected/github/GitCommit.ts:22; scratchpad/effected/github/GitHubCommit.ts:64; scratchpad/effected/github/GitHubError.ts:21,54; scratchpad/effected/github/PullRequest.ts:24
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b; D5’s full beep-native kit requirement.
- evidence: Named, reused, annotation-bearing CheckConclusion, AnnotationLevel, FileMode, FileStatus, GitHubErrorKind, GitHubValidationCode and MergeMethod use S.Literals. Sol cites law 19 / EF-12b; Fable shows that lint:schema-first is absent from the lab gate and that LiteralKit retains pipe and literals consumers. This is a demonstrated contextual gate gap, not a request to rerun an enforced syntax check.
- failure: Named reusable domains violate law 19 and D5 even though the limited green law commands do not enforce the contextual schema-modeling requirement.
- fix: Replace these seven named S.Literals domains with LiteralKit from @beep/schema; retain literals, annotations, type/value exports and all literals consumers. Derive merge-option types from MergeMethod, retaining the off case for setAutoMerge. Keep anonymous inline wire unions as S.Literals. PermissionLevel is the separate concrete domain in req-19.
- seats: part-1/sol.md#codex-1-6, part-1/grok.md#grok-1-3, part-2/sol.md#sol-1-8, part-2/fable.md#fable-1-4
- group: g1

### req-07 — Give CodeScanningSetup and DeploymentEnvironmentInfo owning runtime schemas.
- file: scratchpad/effected/github/CodeScanning.ts:28
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-12b. Plain interfaces are reserved for service contracts, ports, overloads, and genuinely type-level machinery.
- evidence: `CodeScanningSetup` is a named pure configuration payload defined solely as an interface. `DeploymentEnvironmentInfo` in `DeploymentEnvironment.ts:21` is likewise a named pure result model, with list results constructed as unchecked `{ name: environment.name }` objects at line 143.
- failure: These data models have no owning runtime schema from which validation, guards, or generators can be derived. They remain exceptions to the required schema-first modeling contract despite the green S1 syntax and type gates.
- fix: Define identity-annotated boundary schemas with derived same-name types for both shapes. Retain upstream structural fields, open string input types and optional-key omission semantics; use the environment schema at construction/decoding. A struct can preserve plain-object results. Do not combine this with the optional stricter route-domain proposal in backlog-06.
- seats: part-1/sol.md#codex-1-7
- group: g2

### req-08 — Complete tagged-error identity and field annotations in CheckRun, GitHubCommit and PullRequest.
- file: scratchpad/effected/github/CheckRun.ts:18; scratchpad/effected/github/GitHubCommit.ts:18,22; scratchpad/effected/github/PullRequest.ts:19
- class: schema   severity: required
- standard: Operator identity step 4; D5; .patterns/error-handling.md identity-backed S.TaggedError pattern.
- evidence: CheckRun.UnstubbedError, GitHubCommit.UnstubbedError / CommitFileDecodeError and PullRequest.UnstubbedError omit the third $I.annote argument. CommitFileDecodeError.cause lacks a key description. The corresponding sibling classes carry the required identity annotations. This is missing runtime schema metadata, not merely an S2 JSDoc carrier issue.
- failure: These concrete tagged-error schemas do not meet the completed identity-step invariant.
- fix: Add the owning $I.annote class annotations and descriptive annotateKey metadata for retained error fields. req-04 may remove CommitFileDecodeError; do not recreate it merely to annotate it. Keep the lawful tagged-error representation. The distinct GitHubClient/GitHubRepository copies are owned by req-09.
- seats: part-1/fable.md#fable-1-3, part-2/fable.md#fable-1-9
- group: g1

### req-09 — Complete tagged-error identity and field annotations in GitHubClient and GitHubRepository.
- file: scratchpad/effected/github/GitHubClient.ts:24,28; scratchpad/effected/github/GitHubRepository.ts:19
- class: schema   severity: required
- standard: operator step 4 (every schema takes its identity from the IdentityComposer, with annotations on fields and schemas); .patterns/error-handling.md (S.TaggedError pattern always carries `$I.annote(...)`)
- evidence: GitHubClient.UnstubbedError / FixtureError and GitHubRepository.UnstubbedError omit the third $I.annote argument; message fields lack descriptive key annotations. Fable contrasts these with already annotated sibling error classes.
- failure: The retained error schemas lack the identity/field metadata required by operator step 4 and D5.
- fix: Add $I.annote metadata and descriptive annotateKey annotations to the retained UnstubbedError / FixtureError schemas. Keep their tagged-error behavior. Record-only requests about the original native-error replacements belong to codemod-01.
- seats: part-2/fable.md#fable-1-8, part-1/fable.md#fable-1-3
- group: g3

### req-10 — Restore GitHubRepository.settings and ownerType child spans.
- file: scratchpad/effected/github/GitHubRepository.ts:413
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9; standards/effect-first-development.md’s observability requirements.
- evidence: The oracle constructs `settings` and `ownerType` with named `Effect.fn` calls. The port replaces them with bare `Effect.gen` values. A controlled request reading `Effect.currentSpan` observed `["GitHubRepository.settings","GitHubRepository.ownerType"]` in the oracle and `["caller","caller"]` in the port.
- failure: Both operations lose their resource spans, and their annotations attach to the surrounding caller span. This is an observable tracing regression beyond the syntactic change needed to remove the function IIFEs.
- fix: Retain the lawful effect-valued generators and pipe them through Effect.withSpan("GitHubRepository.settings") and Effect.withSpan("GitHubRepository.ownerType"). Add a span regression proving coordinate annotations attach to these resource spans; derived defaultBranch/nodeId must retain settings tracing.
- seats: part-2/sol.md#sol-1-7, part-2/grok.md#grok-1-1, part-2/fable.md#fable-1-2
- group: g3

### req-11 — Restore undefined results for secret/variable/ruleset deletes and security setters.
- file: scratchpad/effected/github/RepositorySecret.ts:221,284; scratchpad/effected/github/RepositoryVariable.ts:212,296; scratchpad/effected/github/RepositorySecurity.ts:144,170,196; scratchpad/effected/github/Ruleset.ts:471
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11; the pinned oracle’s resource methods discard successful transport payloads.
- evidence: Sol probes observe empty-string success for the port and undefined for the oracle; Grok traces each bodyless OpenAPI route and each added terminal return. The independent implementations here are secret deletes (repository/environment), variable deletes (repository/environment), all three enable/disable security setters, and ruleset deletion. PUT secret writers and already-asVoid variable PATCH writers are not defective.
- failure: Each of these independent void resource methods leaks an empty-string HTTP response instead of its upstream undefined result.
- fix: Discard each affected transport result: restore the oracle bare yield and fall-through, or return the request after Effect.asVoid. Assert undefined success for each delete and both branches of each security setter in the existing module-local suites. Do not change request routes or successful wire bodies.
- seats: part-2/sol.md#sol-1-1, part-2/grok.md#grok-1-2, part-2/grok.md#grok-1-3, part-2/grok.md#grok-1-4, part-2/grok.md#grok-1-7, part-1/fable.md#fable-1-2
- group: g4

### req-12 — Restore undefined results for tag and pull-request-comment deletion.
- file: scratchpad/effected/github/GitTag.ts:248; scratchpad/effected/github/PullRequestComment.ts:203
- class: bug   severity: required
- standard: D9, section 14
- evidence: Grok cites the added return yield at both bodyless DELETE routes, their declared Effect<void> contracts, and the oracle fall-through behavior. Sol measures tag-delete success as empty string in the port and undefined in the oracle.
- failure: Both independent public deletion implementations expose the bodyless response string rather than undefined.
- fix: Restore bare request yields followed by generator completion, or apply Effect.asVoid before returning. Add focused HTTP-204 success-value regressions in the two named new suites; existing mixed resource suites are owned exclusively by g1.
- seats: part-2/grok.md#grok-1-5, part-2/grok.md#grok-1-6, part-2/sol.md#sol-1-1, part-1/fable.md#fable-1-2
- group: g5

### req-13 — Restore the upstream open RulesetPayload contract and rewritten upstream test inputs.
- file: scratchpad/effected/github/Ruleset.ts:281
- class: bug   severity: required
- standard: D9; section 14; later operator ruling: unforced lab divergence is restored with the upstream test lines it rewrote. D5 permits schema-backed preservation of the original open shape.
- evidence: Upstream `RulesetPayload` is an interface whose `target` and `enforcement` are `string` and whose `conditions`, `rules`, and `bypass_actors` are optional `unknown`, with the remark that the rule vocabulary is passed through because pinning it would date the package (oracle `Ruleset.ts:30-49`). `upsert` takes that interface. The port's `RulesetPayload` is a closed `S.Struct`: three-literal `target` and `enforcement`, `RulesetConditions` with only `ref_name`, and `rules` as `S.toTaggedUnion("type")` over a fixed variant list (`Ruleset.ts:107-291`). `upsert` still forwards the object (`:430`) and does not decode it, so the break is the parameter type. `index.ts:152` exports the schema value; upstream exports `type RulesetPayload` only (oracle `index.ts:152`). README Port notes list no deviation and no added export. Fable cites Ruleset.test.ts:28 changing the upstream input to RulesetPayload.make. Schema-first requires a schema, but does not force this narrower vocabulary.
- failure: A payload upstream accepted — a `string` target, a future rule `type`, a partial `pull_request` parameter object, or push-ruleset `conditions` beyond `ref_name` — is rejected at the `upsert` boundary.
- fix: Restore upstream target/enforcement string fields and optional unknown conditions/rules/bypass_actors in an identity-annotated schema-backed boundary. Restore the upstream test payload expressions that were replaced by narrowed RulesetPayload.make calls. Preserve pass-through behavior for future vocabulary, partial parameters and non-ref_name conditions without casts. Keep any useful closed Octokit helper outside the public upsert contract; do not introduce a required closed-vocabulary drift alarm. The existing added value export remains a centrally recorded D2 addition.
- seats: part-2/grok.md#grok-1-8, part-2/fable.md#fable-1-11
- group: g4

### req-14 — Return typed failures for decoded secret keys whose length is not 32 bytes.
- file: scratchpad/effected/github/internal/crypto.ts:71
- class: bug   severity: required
- standard: crypto.ts:54-55 and RepositorySecret.ts:169-175 contract (malformed key = typed Result, never a throw); D9 §14 upstream-bug cause; D11 (bug)
- evidence: Read-only probe from scratchpad: `bun -e` importing encryptSecret and calling it with Buffer.alloc(31,1)/alloc(33,1)/"" base64 keys printed `31-byte key THREW: Error: bad public key size`, `empty key THREW: Error: bad public key size`, `33-byte key THREW: RangeError: Range consisting of offset and length are out of bounds`; only `bad base64 failure:EncodingError` was typed. The code decodes with Base64.decode and hands the bytes straight to nonceInput.set(publicKeyBytes, 32) and nacl.box without checking publicKeyBytes.length === PUBLIC_KEY_BYTES. Upstream crypto.ts is byte-identical here apart from the dual wrapper (diff -w), so this is an upstream bug.
- failure: A GitHub public-key endpoint answering a well-formed base64 string of the wrong length (or an empty string) makes `encryptSecret` throw synchronously; inside `RepositorySecret.set`/`setForEnvironment` the throw escapes `seal` and the generator, so the effect dies with a defect instead of failing with the documented `GitHubError.decode(route, ...)`; `Effect.catchTag`/retry classification never sees it.
- fix: Use Result.flatMap after Base64.decode to check PUBLIC_KEY_BYTES before nonce construction or nacl.box. Return an EncodingError failure for empty/short/oversized decoded keys, retain the existing valid-key algorithm, and update the RepositorySecret sealing failure message to cover key shape. Add 0/31/33-byte Result-failure and service typed-error regressions. Supply the verified upstream-bug evidence for central recording.
- seats: part-2/fable.md#fable-1-1, part-2/sol.md#sol-1-2
- group: g4

### req-15 — Use own-property permission reads and preserve prototype-name permission keys.
- file: scratchpad/effected/github/TokenPermissions.ts:142
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and section 14; `TokenPermissions.compare` promises to compare permissions actually granted and required.
- evidence: In both the port and pinned oracle, `TokenPermissions.fromGitHub({}).compare({ toString: "read" })` returns `{"missing":[],"extra":[]}`. Likewise, `TokenPermissions.fromGitHub({ constructor: "read" }).compare({})` reports no extra permission.
- failure: Indexed reads at lines 142 and 154 consult inherited object properties. A prototype property can therefore masquerade as a granted or required permission; its undefined rank makes both comparison branches false. `assertSufficient` and `assertExact` can incorrectly succeed.
- fix: Use R.get / R.has for both granted and required maps; build permission records with R.fromEntries so __proto__, constructor and toString remain ordinary own keys. Preserve ranks and arbitrary permission names. Add missing/extra regressions for prototype names and verify assertSufficient/assertExact fail correctly. Supply the verified upstream-bug receipt for central recording.
- seats: part-2/sol.md#sol-1-3
- group: g6

### req-16 — Match and retain the requested workflow_dispatch run, including numeric workflow IDs.
- file: scratchpad/effected/github/WorkflowDispatch.ts:280
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and section 14; `dispatchAndWait` promises the run created by the requested workflow dispatch.
- evidence: Read-only probes against both implementations showed `dispatchAndWait("ci.yml", "main")` returning completed run `99` whose path was `.github/workflows/release-ci.yml` and event was `push`. The recorded query used the repository-wide runs endpoint with only `created` and `branch`. A separate probe for workflow `"123"` timed out despite receiving a completed run with `workflow_id: 123` and path `.github/workflows/ci.yml`.
- failure: Suffix matching accepts another workflow’s filename and does not distinguish dispatch runs from other events. It also cannot match a numeric workflow ID against a filename. Polling can return an unrelated result or reject a successfully completed requested workflow.
- fix: Use the workflow-specific runs route with workflow_id: workflow and event: "workflow_dispatch", retaining creation-time/ref constraints. Select one matching run and poll that run ID until completion. Add numeric-ID, suffix-collision and unrelated-event regressions in the new owned WorkflowDispatch.test.ts suite. Supply the verified upstream-bug receipt for central recording.
- seats: part-2/sol.md#sol-1-4
- group: g5

### req-17 — Enforce a real polling deadline and handle zero polling intervals.
- file: scratchpad/effected/github/WorkflowDispatch.ts:264
- class: bug   severity: required
- standard: standards/effect-first-development.md’s explicit timeout/error-boundary requirements; EFFECTED_PORT_GOAL.md D9, D11 and section 14.
- evidence: With `interval: Duration.zero`, `timeout: Duration.millis(1)`, and an in-memory paginator returning no runs, the calculation produces `attempts = Infinity`. A read-only probe required an external 80 ms timeout to stop it: `None`, approximately 86 ms elapsed, seven polls. The oracle contains the same calculation.
- failure: An accepted zero interval turns a finite timeout into an unbounded polling loop. More generally, the attempt count does not bound elapsed time spent inside requests.
- fix: Validate a positive polling interval and wrap the polling operation in an Effect deadline/timeout mapped to the existing typed 408 error. Specify the invalid-interval failure with a typed error, and bound time spent inside requests as well as sleeps. Add zero-interval and blocked-request deadline regressions. Supply the verified upstream-bug evidence for central recording.
- seats: part-2/sol.md#sol-1-5
- group: g5

### req-18 — Distribute Rest.Data over route unions before interpreting bodyless responses.
- file: scratchpad/effected/github/Rest.ts:70
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; the route-keyed request contract must describe every possible successful payload.; the explicit route-union proof shows a type-contract gap despite the green compiler gate.
- evidence: The new conditional evaluates the combined data type rather than distributing over `R`. For a union of a repository GET route and a bodyless DELETE route, `Repository | never` collapses to `Repository`, so the conditional omits `""`. An in-memory TypeScript proof of the identical type expression rejected the empty-string case with `TS2322: Type 'string' is not assignable to type '{ id: number; }'`.
- failure: A request made with a union-valued route can return `""` at runtime while its declared success type contains only the GET response object. Code can access object fields without handling the bodyless result.
- fix: Use R extends Route ? ([Endpoints[R]["response"]["data"]] extends [never] ? "" : Endpoints[R]["response"]["data"]) : never. Add a type regression for a union of one bodyful GET and one bodyless DELETE, preserving both possible successful payloads.
- seats: part-2/sol.md#sol-1-6
- group: g3

### req-19 — Make PermissionLevel a LiteralKit and derive its membership guard.
- file: scratchpad/effected/github/TokenPermissions.ts:13
- class: schema   severity: required
- standard: AGENTS.md Code Laws (named LiteralKit domains; "derived S.is(...) guards ... over ad-hoc predicate helpers"); D5; Sol confirms that the four green law lanes do not enforce this contextual schema-modeling requirement.
- evidence: `export const PermissionLevel = S.Literals(["read", "write", "admin"]).pipe($I.annoteSchema(...))` with `export type PermissionLevel = (typeof PermissionLevel.literals)[number]` (line 16) is a named exported domain referenced by PermissionGap, ExtraPermission, TokenPermissions.granted and RANK. `fromGitHub` (line 132) re-derives membership by hand: `if (level === "read" || level === "write" || level === "admin")`. LiteralKit keeps `.literals` (LiteralKit.schema.ts:356) and S.Literals' `.pipe`, so the public type alias is unaffected.
- failure: Same hand-rolled-union smell as fable-1-4, plus a predicate chain that silently drifts if a level is ever added to the domain (the chain is not derived from the schema).
- fix: Construct PermissionLevel with LiteralKit, retain identity annotations and the read/write/admin values, and derive the type and membership guard from the owning schema. Replace the manual membership chain in fromGitHub with S.is(PermissionLevel) / the derived kit guard. Coordinate its record construction with req-15.
- seats: part-2/fable.md#fable-1-5, part-2/sol.md#sol-1-8
- group: g6

### req-20 — Derive the repository status-object guard from an owning schema.
- file: scratchpad/effected/github/GitHubRepository.ts:151
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; schema-first-development guidance requiring named domain constraints and schema-derived guards.
- evidence: `isStatusObject` manually defines the accepted `{ status: "enabled" | "disabled" }` shape through property checks and literal comparisons. No schema owns this named constraint.
- failure: The normalizer’s accepted status-object shape exists only in a handwritten guard, so its type, validation and reusable schema behavior cannot derive from one model.
- fix: Define an identity-annotated status-object boundary schema and derive isStatusObject with S.is. Preserve enabled/disabled membership and the current excess-property behavior. Add acceptance/rejection checks in the existing repository suite; any unavoidable law-forced acceptance change is supplied for central deviation recording.
- seats: part-2/sol.md#sol-1-9
- group: g3

### req-21 — Use IdentityComposer metadata for retained Ruleset schemas and fields.
- file: scratchpad/effected/github/Ruleset.ts:288
- class: schema   severity: required
- standard: D5 ("$ScratchpadId identity annotations on every exported schema"); operator step 4 ("Every schema ... takes its identity from the @beep/identity IdentityComposer, with annotations on fields and schemas"); .patterns/error-handling.md IdentityComposer usage
- evidence: `export const RulesetPayload = S.Struct({...}).annotate({ identifier: "RulesetPayload", description: ... })` (lines 281-291) bypasses `$I` although `const $I = $ScratchpadId.create("effected/github/Ruleset")` exists at line 11 and every other exported schema in the module uses `$I`X`` / `$I.annote` / `$I.annoteSchema`. Its six keys carry no `annotateKey` description, unlike every other schema field in the focus files. The nine internal sub-schemas (lines 38-125: RuleDismissalActor ... RulePatternParameters) and RulesetRule (line 127) likewise use raw `.annotate({ identifier })`.
- failure: The only schema added by the port is the one without a composed identity: its `identifier`/`title` do not carry the `effected/github/Ruleset` path, so docgen/identity tooling and error messages name it differently from its siblings, and the step-4 invariant (every schema identity from the composer) is false for this module.
- fix: Apply $I.annoteSchema to RulesetPayload and every retained named supporting schema, and add descriptive key annotations. req-13 restores the public open shape and may remove narrow supporting schemas; annotate survivors only. This fixes the schema metadata itself; recording identity-derived JSON Schema keys is central codemod work.
- seats: part-2/fable.md#fable-1-3, part-2/sol.md#sol-1-10
- group: g4

### req-22 — Give SecretInfo, VariableInfo and RulesetInfo owning schemas with derived types.
- file: scratchpad/effected/github/RepositorySecret.ts:41; scratchpad/effected/github/RepositoryVariable.ts:28; scratchpad/effected/github/Ruleset.ts:29
- class: schema   severity: required
- standard: schema-first-development/references/repo-laws.md, “Use Schema for pure data models”; EFFECTED_PORT_GOAL.md D5.
- evidence: Sol identifies exported pure-data interfaces VariableInfo, SecretInfo and RulesetInfo; Fable independently lists the same models and distinguishes them from service/port/option-bag carve-outs. Their runtime constraints do not have owning schemas.
- failure: These three independent return models have only erased TypeScript declarations instead of the schema-owned models required by D5.
- fix: Introduce identity-annotated schema-backed same-name declarations and derived type exports for these three pure data models. Preserve the existing plain-object result shape, field optionality and output semantics; boundary structs avoid unnecessary prototype changes. Add schema/result compatibility cases to the existing owned suites.
- seats: part-2/sol.md#sol-1-11, part-2/fable.md#fable-1-14
- group: g4

### req-23 — Pass the GraphQL document decoder directly instead of wrapping it.
- file: scratchpad/effected/github/GraphQL.ts:254
- class: law   severity: required
- standard: AGENTS.md Code Laws: "Prefer the tersest equivalent helper form when behavior is unchanged: direct helper refs over trivial lambdas"
- evidence: `(raw) => decode(raw)` where `const decode = S.decodeUnknownEffect(options.response)` (line 249) already has the field's type `(input: unknown, options?) => Effect<A, SchemaError>`; the constructor parameter is `(raw: unknown) => Effect.Effect<A, S.SchemaError>`, to which `decode` is assignable (extra optional parameter). The terse-effect gate only rewrites constant thunks (packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:118-136 thunkUndefined/thunkEmptyStr/...), so it cannot flag a passthrough lambda. Upstream has the same lambda; behaviour is unchanged by the fix (D9 safe).
- failure: A Code Law violation the gate cannot see; one extra closure per document for no behaviour.
- fix: Pass the existing decode helper directly into new GraphQLDocument, preserving the other constructor arguments and variable encoder. Fable supplies assignability evidence and the concrete terse-effect gate limitation, so this is a demonstrated missed Code Law shape.
- seats: part-2/fable.md#fable-1-6
- group: g3

### req-24 — Use Effect.succeed directly for successful secret sealing.
- file: scratchpad/effected/github/RepositorySecret.ts:179
- class: law   severity: required
- standard: AGENTS.md Code Laws: "direct helper refs over trivial lambdas"
- evidence: `onSuccess: (sealed) => Effect.succeed(sealed)` inside `Result.match(encryptSecret(...), {...})`; `Effect.succeed` is `<A>(value: A) => Effect<A>` and is directly assignable. Same gate gap as fable-1-6 (TerseEffect.ts handles constant thunks only). Note the `(client) => make(client)` lambdas at RepositorySecret.ts:146 and siblings are NOT in scope: upstream's comment at lines 139-142 explains the TDZ reason, so behaviour would change.
- failure: Code Law violation invisible to the laws gate.
- fix: Replace onSuccess: (sealed) => Effect.succeed(sealed) with onSuccess: Effect.succeed. Keep deferred make(client) lambdas whose upstream TDZ rationale is documented. Fable cites the direct-reference law and the constant-thunk-only gate gap.
- seats: part-2/fable.md#fable-1-7
- group: g4

### req-25 — Restore the upstream updateSettings test path using deliberatelyInvalid.
- file: scratchpad/test/github/GitHubRepository.test.ts:117
- class: test   severity: required
- standard: EFFECTED_PORT_GOAL §11.1 ("No test deleted, renamed, skipped, or weakened"); operator ruling 2026-10-09 ("Deliberate wrong-input casts in tests go through one deliberatelyInvalid<T> helper per module (scratchpad/test/<m>/deliberatelyInvalid.ts)"); D9
- evidence: Upstream __test__/GitHubRepository.test.ts:111-120 (inside describe "GitHubRepository.updateSettings") calls `r.updateSettings({ security_and_analysis: { secret_scanning: "enabled", delegated_bypass_reviewers: [{ reviewer_id: 7 }] } } as never)`. Lab line 117, still inside `describe("GitHubRepository.updateSettings")` (line 70), now calls `r.applySettings({...})` instead. `ls scratchpad/test/github | grep -i deliberately` finds nothing while scratchpad/test/github-actions/deliberatelyInvalid.ts exists. Not a canon/coverage item (S3): it is an S1 no-weakening rule the passing-tests gate cannot detect.
- failure: The upstream assertion that `updateSettings`' own path (`preparePatch({ ...patch })` spread at GitHubRepository.ts:432) folds `security_and_analysis` is no longer exercised for `updateSettings`; the describe block's name no longer matches its subject; the retarget is an unrecorded deviation from the oracle suite.
- fix: Create the one authorized module helper deliberatelyInvalid<T>(value: unknown): T => value as T at scratchpad/test/github/deliberatelyInvalid.ts. Restore the upstream call to r.updateSettings(deliberatelyInvalid<RepositoryPatch>({ security_and_analysis: ... })) and its original input/assertions; retain an applySettings variant only as an additional test under its proper describe. No shared fixtures or external module helpers are edited.
- seats: part-2/fable.md#fable-1-10, part-2/fable.md#fable-1-11
- group: g3

### req-26 — Give UpsertedPullRequest an owning return-model schema.
- file: scratchpad/effected/github/PullRequest.ts:76
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md Pattern 1 ("A TypeScript interface disappears at runtime") versus its carve-out at line 347 (service/port interfaces stay); D5 (@beep/schema kits where an equivalent exists); D9
- evidence: Fable identifies UpsertedPullRequest as an exported pure-data return interface. It is not a service/port/overload contract; schema-first guidance applies. The cited upstream deepStrictEqual expectations demonstrate why the fix must preserve plain-object representation.
- failure: The pure return model has no runtime schema from which validation and a later D10 arbitrary can derive.
- fix: Introduce an identity-annotated schema-backed UpsertedPullRequest declaration with a same-name derived type. Preserve field types, optionality and plain-object returns, using a boundary struct rather than an unnecessary class-prototype change. Verify existing upsert results in the owned resource suite.
- seats: part-2/fable.md#fable-1-14
- group: g1

### req-27 — Give AppliedSettings an owning return-model schema.
- file: scratchpad/effected/github/GitHubRepository.ts:285
- class: schema   severity: required
- standard: schema-first-development/references/repo-laws.md, “Use Schema for pure data models”; EFFECTED_PORT_GOAL.md D5.
- evidence: Sol and Fable identify AppliedSettings as an exported pure-data interface independently declared from any owning schema.
- failure: The return model lacks the schema-owned data definition required by D5.
- fix: Introduce an identity-annotated schema-backed AppliedSettings declaration with a same-name derived type. Preserve structural fields, optionality and plain-object returns, using a boundary struct where class construction would change behavior. Verify result compatibility in GitHubRepository.test.ts.
- seats: part-2/sol.md#sol-1-11, part-2/fable.md#fable-1-14
- group: g3

### req-28 — Give WorkflowInfo an owning return-model schema.
- file: scratchpad/effected/github/WorkflowDispatch.ts:55
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md Pattern 1 ("A TypeScript interface disappears at runtime") versus its carve-out at line 347 (service/port interfaces stay); D5 (@beep/schema kits where an equivalent exists); D9
- evidence: Fable identifies WorkflowInfo as an exported pure-data return interface at line 55, distinct from the PollOptions compatibility bag.
- failure: This pure result model has no owning runtime schema as required by D5.
- fix: Introduce an identity-annotated schema-backed WorkflowInfo declaration and same-name derived type while retaining plain-object list results and field optionality. Verify list-result compatibility in the new owned WorkflowDispatch.test.ts suite; coordinate with req-16/req-17.
- seats: part-2/fable.md#fable-1-14
- group: g5

### req-29 — Remove the Octokit request<string> implicit-any narrowing.
- file: scratchpad/effected/github/internal/octokit.ts:152
- class: type-safety   severity: required
- standard: D15 (unsafe type assertion includes any `any`), D11 (unsafe type assertion is required); @octokit/types 18.0.0 RequestInterface
- evidence: node_modules/@octokit/types/dist-types/RequestInterface.d.ts declares `<R extends Route>(route: EndpointKeys | R, options?) : R extends EndpointKeys ? Promise<Endpoints[R]["response"]> : Promise<OctokitResponse<any>>` with `Route = string`. `octokit.request<string>(route, withSignal(params, signal))` therefore has type `Promise<OctokitResponse<any>>`, and the annotation `Promise<OctokitResponse<A>>` holds only because `any` is assignable to `A`. The oracle (src/internal/octokit.ts:147) spelled the same narrowing as `as Promise<OctokitResponse<A>>`; the port removed the token, not the narrowing. D15's scan counts `as`/`!`/`<T>expr`/`any` tokens, so `parity` reports 0 while the program's types still carry `any` at this site (`rg -n 'request<string>' scratchpad/effected/github/internal/octokit.ts`). The sibling `pageSource` (line 165) is sound by contrast: plugin-paginate-rest's `<T, R extends Route>` overload infers `T = A` from the annotation and never produces `any`.
- failure: `transport.request<X>(op, route, params)` compiles for any `X` and `response.data` is whatever GitHub returned regardless of `X`; `GitHubClient.request` (`Rest.Data<R>`) and `requestDecoded` (`unknown`) lean on this as the package's one trust point, yet nothing records it (README Port notes: "Deviations: None") and the gate can no longer see it.
- fix: Use Octokit's free-response-type options overload instead of request<string>: derive route options with a schema/kit-owned RequestMethod guard, preserving Octokit route parsing, defaults and option precedence, then call octokit.request<A>({ ...routeOptions(route), ...withSignal(params, signal) }). Add typed boundary / route-compatibility regressions. Do not retain an any-based trust site merely by recording it; D15 has no such waiver.
- seats: part-3/fable.md#fable-1-1
- group: g7

### req-30 — Remove the array-to-record user-defined narrowing in thrown-header handling.
- file: scratchpad/effected/github/internal/octokit.ts:219
- class: type-safety   severity: required
- standard: D15/D11 (unverified narrowing); standards/effect-laws-v1.md law 17 (derive guards from schemas and built-ins, not ad-hoc predicate helpers); AGENTS.md Code Laws (prefer derived `S.is(...)` guards over ad-hoc predicate helpers)
- evidence: `const isRecord = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value)`. `P.isObjectOrArray` is `typeof input === "object" && input !== null` (node_modules/effect/dist/Predicate.js:687) and narrows to `{ [x: PropertyKey]: unknown } | Array<unknown>` (Predicate.d.ts:1138); the hand-written predicate re-labels that as `Record<string, unknown>`, which `Array<unknown>` is not (no string index signature). It is the oracle's `as Record<string, unknown>` (src/internal/octokit.ts:210) rewritten as a user-defined type guard the D15 token scan cannot see. effect 4.0.2 exposes no `P.isRecord` (`rg isRecord node_modules/effect/dist/Predicate.d.ts` returns nothing).
- failure: An array-shaped `error.response.headers` passes the guard typed as a record and reaches `readRateLimitHeaders`; harmless today only because `headerNumber` reads keys an array never has, which is exactly the unverified narrowing D15 forbids.
- fix: Delete the hand-written isRecord predicate. Narrow with P.isObjectOrArray(headers) and an explicit !A.isArray(headers) check, or an owning schema-derived record guard, before calling the record header reader. Preserve valid Octokit object headers and add malformed-header regressions. If excluding malformed array headers changes acceptance, cite law 17 as the section-14 cause; do not rely on the claim that arrays can never carry custom header properties.
- seats: part-3/fable.md#fable-1-2
- group: g7

### req-31 — Use the schema-backed error idiom for TransportFailure.
- file: scratchpad/effected/github/internal/octokit.ts:65
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 (extend `S.TaggedError` from `effect/Schema` for typed errors); .patterns/error-handling.md (S.TaggedError pattern); D5 (errors per error-handling.md); tsgo `preferSchemaTaggedError` is not enabled in tsconfig.base.json, so no gate covers it; its named-error carrier is not covered by the enabled green diagnostic set.
- evidence: `class TransportFailure extends Data.TaggedError("TransportFailure")<{ readonly error: unknown }> {}` is the only `Data.TaggedError` in the module (`rg -n 'Data\.TaggedError' scratchpad/effected/github` gives one hit); every other error (`GitHubError`, `GitHubGraphQLError`, `GitHubAppError`, every `UnstubbedError`) is `S.TaggedError<X>($I\`X\`)(...)`. The class exists only to satisfy `unknownInEffectCatch` for the two-argument `Effect.tryPromise` at line 127 and is unwrapped one combinator later.
- failure: A law-7 carrier that is neither schema-backed nor identity-annotated, and a second error idiom inside one module.
- fix: Replace Data.TaggedError with an identity-annotated S.TaggedError carrying the original thrown value as S.Defect(), or remove the private carrier using the one-argument Effect.tryPromise UnknownError cause while preserving classification and header recording. Prefer the schema-backed carrier if removing it exposes another diagnostic. Remove unused imports and verify classified error payloads remain unchanged.
- seats: part-3/fable.md#fable-1-3
- group: g7

### req-32 — Replace the two explicit-generic succeed(none()) forms missed by tsgo.
- file: scratchpad/effected/github/internal/octokit.ts:171
- class: effect-idiom   severity: required
- standard: tsgo `preferSucceedSomeOrNone` (tsconfig.base.json:193 at `error`); standards/effect-laws-v1.md law 21 (tersest equivalent helper form)
- evidence: Lines 171 and 181 read `Effect.succeed(O.none<ReadonlyArray<A>>())`. The rule is at error and the gate is green at 3fa5876691, so the gate missed this shape; GitBranch.ts:252 (`Effect.succeed(O.none<string>())` under the plain `effect/Option` alias) also passes, which pins the miss to the explicit type-argument form rather than the `@beep/utils/Option` alias. `Effect.succeedNone: Effect<Option<never>>` (node_modules/effect/dist/Effect.d.ts:1473) is assignable to `Effect<Option<ReadonlyArray<A>>, GitHubError>` in both positions (the ternary at 169-187 and the `flatMap` return at 181).
- failure: The idiom the gate is configured to reject survives in two places.
- fix: Replace both Effect.succeed(O.none<ReadonlyArray<A>>()) occurrences at :171 and :181 with Effect.succeedNone, preserving the pagination completion branches and declared result types.
- seats: part-3/fable.md#fable-1-4
- group: g7

### req-33 — Forward the current attempt AbortSignal into each pagination request.
- file: scratchpad/effected/github/internal/octokit.ts:175
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, verified by a cancellation probe); the transport’s cancellation contract at lines 118–121.
- evidence: A read-only `bun --eval` probe started a paginated request through a pending fake fetch, waited until fetch began, then interrupted the fiber. The fetch received no signal and observed no abort: `{"mode":"pagination","hasSignal":false,"aborts":0}`. Running the pinned oracle source through in-memory TypeScript transpilation produced the same result. The ordinary REST request served as a control: `{"mode":"request","hasSignal":true,"aborted":true,"aborts":1}`. The installed pagination iterator calls its request method with `{ method, url, headers }`, discarding per-request options passed to the iterator factory.
- failure: Interrupting a fiber while a page is being fetched stops the Effect consumer but leaves the HTTP request running. The discarded signal also prevents cancellation from stopping the underlying iterator’s eventual cursor advancement. Fable independently spots the ignored signal. Its documentation-only fallback is superseded by Sol's verified upstream-bug evidence, which satisfies D9/section 14.
- fix: Give the Octokit iterator a request-method wrapper injecting the current attempt AbortSignal; receive that signal in the attempt callback and forward it to the wrapper. Preserve iterator normalization, continuation and request options. Factory params.request alone is insufficient because the installed iterator discards it. Add interrupt-during-pending-page regression proving the fetch receives a signal and aborts; supply the verified upstream-bug evidence for central recording.
- seats: part-3/sol.md#sol-1-1, part-3/fable.md#fable-1-8
- group: g7

### req-34 — Forward AbortSignal into GraphQL requests.
- file: scratchpad/effected/github/internal/octokit.ts:196
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, verified by a cancellation probe); the transport’s cancellation contract at lines 118–121.
- evidence: The same read-only probe interrupted a GraphQL fiber after its fake fetch began. Both the port and the pinned oracle produced `{"mode":"graphql","hasSignal":false,"aborts":0}`. The callback passed to `attempt` ignores its signal and invokes `octokit.graphql(document, variables)` without request cancellation options.
- failure: Interrupting a GraphQL operation leaves its HTTP request running. For a mutation, the remote operation can consequently complete after the caller has canceled the Effect. Fable independently identifies the ignored signal; the measured contract failure justifies a required upstream-bug repair.
- fix: Receive the signal in the attempt callback and call octokit.graphql(document, withSignal(variables, signal)), preserving other request options. Add interrupt-during-pending-GraphQL regression proving the fetch aborts. Supply the verified upstream-bug evidence for central recording; updating explanatory docs waits for S2.
- seats: part-3/sol.md#sol-1-2, part-3/fable.md#fable-1-8
- group: g7

## Backlog

### backlog-01 — Perform the deferred module-wide JSDoc carrier and export-documentation conversion.
- file: scratchpad/effected/github/GitHubClient.ts:254; scratchpad/effected/github/GraphQL.ts:27; scratchpad/effected/github/Ruleset.ts:281; scratchpad/effected/github/internal/octokit.ts:15,98; scratchpad/effected/github/internal/paginate.ts:7,26
- class: jsdoc   severity: backlog
- standard: Operator S2 deferral; section 10; .patterns/jsdoc-documentation.md; D4.
- evidence: All three parts retain upstream @remarks/@example carriers and lack canonical export metadata/titled Examples. RulesetPayload is partially converted, imports ./Ruleset.ts in its example and drops upstream teaching rationale. The internal transport/pagination blocks lack metadata and examples; their single-use, byte/order and abort-related teaching prose must survive.
- failure: S2 has not run; the current docs do not yet meet its grammar/metadata bar. No documentation work is dispatched in this round-1 required wave.
- fix: During S2 convert carriers to Details/Gotchas and titled Example sections, add category/since metadata and compiling examples, retain teaching prose, normalize partially converted blocks and document the restored open ruleset contract. Reflect the completed cancellation fixes when updating the transport prose; do not keep a obsolete no-abort guarantee.
- seats: part-1/sol.md#codex-1-9, part-1/fable.md#fable-1-8, part-2/sol.md#sol-1-12, part-2/fable.md#fable-1-17, part-3/grok.md#grok-1-1, part-3/grok.md#grok-1-2, part-3/sol.md#sol-1-3, part-3/sol.md#sol-1-4

### backlog-02 — Migrate Effect-container assertions to the public test utilities during S3.
- file: scratchpad/test/github/GitBranch.test.ts:177; scratchpad/test/github/GitHubClient.test.ts:660,672; scratchpad/test/github/resources2.test.ts:335; scratchpad/test/github/crypto.test.ts:111
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, assertions by value; deferred S3 canon migration.
- evidence: Predicate-only Option/Exit/Result assertions remain, including O.isNone, Exit.isFailure and Result.isFailure. Sol identifies omitted cause/payload assertions; these are inherited test-canon forms.
- failure: These tests retain predicate assertions on Effect containers instead of the required public assertion helpers. Failure assertions also omit the explicit expected cause or payload required by the canon.
- fix: During S3 use the public Option/Result/Exit assertion helpers and assert expected payloads/causes while retaining upstream behavior assertions. Immediate bug regression tests remain owned by their required groups.
- seats: part-1/sol.md#codex-1-10, part-2/sol.md#sol-1-15

### backlog-03 — Migrate effectful test-layer provision and remove its broad diagnostic suppressions during S3.
- file: scratchpad/test/github/RepositorySecurity.test.ts:1
- class: tsgo   severity: backlog
- standard: Deferred S3 vitest-canon D14; section 11.2; tsgo strictEffectProvide / multipleEffectProvide.
- evidence: Fable identifies strictEffectProvide skip-file directives in 13 test files and multipleEffectProvide in seven, plus asyncFunction skips in fixtures.ts/crypto.test.ts. Sol identifies resource drive helpers providing Layer.effect / effectful transport layers per test in resources.test.ts and resources2.test.ts.
- failure: The current test-canon structure relies on broad suppressions and hides later violations. S3 has not run, so this test-lifecycle migration is backlog.
- fix: At S3 move effectful/scoped resource and transport ownership to it.layer or the canon-approved layer factory and remove the now-unnecessary directives. Keep only specifically justified real-async fixture exceptions; narrowing any remaining suppressions stays in the S3 migration. No repo compiler configuration edits are assigned.
- seats: part-2/fable.md#fable-1-16, part-1/sol.md#codex-1-11, part-2/sol.md#sol-1-15

### backlog-04 — Qualify the new CheckRun.withCheckRun and GitTag.reset span names.
- file: scratchpad/effected/github/CheckRun.ts:423; scratchpad/effected/github/GitTag.ts:203
- class: effect-idiom   severity: backlog
- standard: D11: module naming consistency without a mandatory standard is advisory.
- evidence: The newly added spans are named withCheckRun and reset while sibling spans use service.member. Upstream had no spans at these sites; no cited binding law mandates this exact prefix.
- failure: Trace consumers filtering spans by the `CheckRun.` prefix miss the bracket span; the bracket is the one member whose span most needs correlating with create/complete.
- fix: Optionally rename the spans to CheckRun.withCheckRun and GitTag.reset. This is distinct from req-10, which restores pre-existing upstream spans.
- seats: part-1/fable.md#fable-1-4, part-2/fable.md#fable-1-12

### backlog-05 — Simplify normalizePermissions with Record.filter.
- file: scratchpad/effected/github/GitHubApp.ts:528
- class: effect-idiom   severity: backlog
- standard: D11 advisory cleanup; the cited terse law/gate is green and the report establishes no required enumerated-shape gap or measured regression.
- evidence: `normalizePermissions` guards with P.isObjectOrArray, then branches `P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw)` into a mutable `out` record. effect/Record `filter` has a refinement overload (node_modules/effect/dist/Record.d.ts:1093) that does the whole job: `P.isObjectOrArray(raw) ? R.filter(raw, P.isString) : {}`. The terse-effect gate passed, so this is advisory.
- failure: Nine lines and a type-argument-laden second branch where one helper call expresses the intent; the explicit generic on R.toEntries is the kind of annotation the next reader has to re-derive.
- fix: Optionally replace the explicit loop/branch with P.isObjectOrArray(raw) ? R.filter(raw, P.isString) : {}, retaining accepted values and own-key behavior.
- seats: part-1/fable.md#fable-1-6

### backlog-06 — Consider narrowing CodeScanningSetup to installed route-literal domains.
- file: scratchpad/effected/github/CodeScanning.ts:149
- class: type-safety   severity: backlog
- standard: D9 / section 14; D11. An index-signature pass-through is not itself a D15 assertion, and an API restriction needs a forcing law or verified bug.
- evidence: CodeScanningSetup has upstream string fields; the port uses a Record<string, unknown> body spread, so a misspelled query_suite reaches GitHub and can receive 422. The report proposes narrowing fields to the installed Octokit literals, but supplies no proof that retaining the upstream open string contract violates D15.
- failure: The proposal changes the accepted public TypeScript inputs beyond the schema-ownership repair required by req-07.
- fix: Consider precise route-field schemas only with a concrete law/upstream-bug cause and preserved compatibility; otherwise retain upstream string acceptance while implementing req-07. Do not silently combine this restriction with the required schema migration.
- seats: part-1/fable.md#fable-1-7

### backlog-07 — Add deferred tests for fixture-empty/requestDecoded behavior and TestClock timestamps.
- file: scratchpad/test/github/GitHubClient.test.ts:759; scratchpad/effected/github/CheckRun.ts:374
- class: test   severity: backlog
- standard: Operator S3 coverage/property deferral; section 11.3.
- evidence: The empty-fixture test covers pagination only; the request/requestDecoded notFound branches and new decoded-fixture bucket lack focused coverage. CheckRun.started_at under TestClock is also untested. The void-result and invalid-commit-status portions of this seat are attached to req-03/req-04 rather than counted here again.
- failure: These law-forced new paths still need the deferred coverage pass.
- fix: During S3 add requestDecoded fixture round-trip, empty single-request notFound, and started_at equals TestClock-instant assertions. Preserve the lawful Result fixtures and clock abstraction; do not restore forbidden casts/native Date.
- seats: part-1/fable.md#fable-1-9

### backlog-08 — Reduce whitespace-only oracle diff noise.
- file: scratchpad/effected/github/GitHubError.ts:160
- class: docs   severity: backlog
- standard: D11 advisory formatting/readability; no demonstrated runtime failure or required gate gap.
- evidence: Whole-file re-indentation from tabs to two spaces in CheckRun.ts, GitBranch.ts and GraphQL.ts; four-space islands inside tab files at GitHubError.ts:160-165 and :201-209, GitHubApp.ts:588-593 and :601-607, DeploymentEnvironment.ts:150-154; `yield*GitHubError...` with no space at GitHubContent.ts:433,436,443 and GitHubApp.ts:507.
- failure: `diff -u` against the oracle reports hundreds of whitespace-only hunks (CheckRun, GitBranch), hiding the real changes the round-2 seats and S2 must read.
- fix: During the documentation/edit pass, consider one formatter pass preserving the upstream tab style and removing mixed indentation. No formatter or repo configuration changes are assigned.
- seats: part-1/fable.md#fable-1-10

### backlog-09 — Record the verified bodyless Rest.Data correction and its fixture/test provenance centrally.
- file: scratchpad/effected/github/Rest.ts:70; scratchpad/effected/PORT_LEDGER.json:w2-github; scratchpad/effected/github/README.md:339
- class: law   severity: backlog
- standard: D9 / section 14; reason: outside the port's write surface.
- evidence: The module records no deviations for Rest.Data never-to-empty-string normalization. The reviewed HTTP-204 probes establish that the transport really succeeds with an empty string; req-18 repairs the introduced route-union hole. This is upstream type-contract provenance rather than permission to retain an arbitrary unforced change.
- failure: The upstream-bug provenance for this module-specific correction is missing from the central ledger and Port notes.
- fix: Central bookkeeping must cite the HTTP-204 evidence, the public type correction, bodyless Result fixtures and adjusted Rest/GitHubClient tests. No required group edits PORT_LEDGER.json or README Port notes.
- seats: part-1/fable.md#fable-1-1, part-2/fable.md#fable-1-11

### backlog-10 — Name the third-party replacement candidates in the central dependency backlog.
- file: scratchpad/effected/PORT_LEDGER.json:w2-github; scratchpad/effected/github/README.md:343
- class: docs   severity: backlog
- standard: D3 / section 13; reason: outside the port's write surface.
- evidence: The github newDeps replacement fields are null and its README Dependency backlog says None despite six retained dependencies. Section 13 names HttpClient/http-api plus Stream for Octokit and Effect crypto / drivers homes for the JWT/crypto libraries.
- failure: The central dependency inventory omits the required candidate names.
- fix: Fill the central backlog/newDeps candidates for @octokit/core, @octokit/plugin-paginate-rest, @octokit/types, universal-github-app-jwt, tweetnacl and blakejs; mirror centrally generated Port notes. Retain the runtime dependencies under D3; do not edit package.json or bun.lock.
- seats: part-2/grok.md#grok-1-9, part-2/fable.md#fable-1-11

### backlog-11 — Establish the deferred exported-schema property floor.
- file: scratchpad/test/github/Rest.test.ts:6
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and section 11.4; S3 deferral in the review brief.
- evidence: The PageOptions suite contains example-based construction/decoding tests but no `Arbitrary.schema(PageOptions)` encode/decode property. The focused Resilience and TokenPermissions suites likewise lack the required schema round-trip properties and `fcRuns` floor.
- failure: The required property floor has not been established for these exported schemas; example tests do not prove round-trip behavior across their generated domains.
- fix: During S3 add Arbitrary.schema encode/decode properties with Effect equality, it.effect.prop and fcRuns for PageOptions, Resilience, TokenPermissions and every other exported schema/codec, retaining examples and oracle suites.
- seats: part-2/sol.md#sol-1-14

### backlog-12 — Consider consolidating per-resource UnstubbedError helpers.
- file: scratchpad/effected/github/Ruleset.ts:14
- class: effect-idiom   severity: backlog
- standard: D11 advisory consolidation; no measured performance regression or binding rule requires one shared implementation.
- evidence: `rg -n "class UnstubbedError" scratchpad/effected/github` lists 22 identical per-file definitions (one per resource) each paired with a per-file `unstubbed(member)` thrower differing only in the service name in the message; two copies already drifted (fable-1-8/9 lack `$I.annote`).
- failure: Twenty-two tagged-error classes with the same `_tag` and shape but different identities; drift already observed; every future change (message shape, annotations) must be applied 22 times.
- fix: Consider a shared internal helper only as later consolidation with preserved message/identity/defect semantics and a scoped migration. The required metadata repairs fix concrete omitted annotations; they do not authorize a module-wide error-identity redesign.
- seats: part-2/fable.md#fable-1-15

### backlog-13 — Combine adjacent single-key getSomesStruct calls.
- file: scratchpad/effected/github/PullRequest.ts:348; scratchpad/effected/github/Ruleset.ts:428; scratchpad/effected/github/internal/octokit.ts:91
- class: effect-idiom   severity: backlog
- standard: D11 advisory terse cleanup, outside the specific enforced wrapper/flow/thunk forms.
- evidence: PullRequest/Ruleset parameter objects and transport construction spread multiple single-key getSomesStruct results even though one multi-key call drops the same None fields. The seats identify no enumerated gate gap or measured regression.
- failure: The extra calls/spreads add source noise; no behavior failure is demonstrated.
- fix: Optionally collapse each adjacent group into one multi-key getSomesStruct call while preserving omission, order-sensitive spreads and current parameter precedence.
- seats: part-2/fable.md#fable-1-18, part-3/fable.md#fable-1-6

### backlog-14 — Simplify the withSignal request-options predicate.
- file: scratchpad/effected/github/internal/octokit.ts:206
- class: effect-idiom   severity: backlog
- standard: D11 advisory equivalent-predicate cleanup; no concrete required gate gap.
- evidence: `P.isObjectKeyword(params.request) && !P.isFunction(params.request)`: `isObjectKeyword` is `typeof x === "object" && x !== null || isFunction(x)` (node_modules/effect/dist/Predicate.js:782-784), so the conjunction reduces to `typeof x === "object" && x !== null`, which is `P.isObjectOrArray` (Predicate.js:687-689) and is the oracle's own test (src/internal/octokit.ts:200). Outside the shapes the `terse-effect` law checker names, hence backlog.
- failure: None at runtime; two guards spell one, and the narrowing is `object` rather than the spreadable record/array union.
- fix: Optionally use P.isObjectOrArray(params.request) in place of isObjectKeyword plus the function exclusion, preserving the oracle predicate and existing request options.
- seats: part-3/fable.md#fable-1-5

### backlog-15 — Consider using constVoid for SILENT_LOG callbacks.
- file: scratchpad/effected/github/internal/octokit.ts:67
- class: effect-idiom   severity: backlog
- standard: D11 advisory thunk cleanup: the helper is not already in scope, and no measured regression or demonstrated green-gate miss is supplied.
- evidence: `SILENT_LOG` is four `() => {}` lambdas; `constVoid: LazyArg<void>` (node_modules/effect/dist/Function.d.ts:496) is assignable to each of octokit's `log.*` members.
- failure: None.
- fix: Optionally import constVoid from effect/Function and reuse it for the four silent logger callbacks after confirming their signatures; this does not justify an additional required performance finding.
- seats: part-3/fable.md#fable-1-7

## Handled by the deviation codemod

### codemod-01 — Record the lawful tagged-error replacements per module and systemic class.
- file: scratchpad/effected/github/GitHubClient.ts:245,474,486,516; scratchpad/effected/github/GitHubCommit.ts:22,233; scratchpad/effected/github/README.md:341
- class: law   severity: backlog
- standard: Later operator recording ruling; law 7; D9. Per-module, per-class deviation codemod owns ledger and README Port notes.
- evidence: Native test-double / fixture errors became UnstubbedError and FixtureError; CommitFileDecodeError replaced a native/schema-constructor error. The README and ledger still report no deviations. The tagged-error replacement itself is law-forced; only missing records belong here.
- failure: The lawful error-representation changes and adjusted upstream tests lack central provenance.
- fix: Generate one github tagged-errors deviation entry listing actual surviving sites and adjusted tests after req-04/req-31. Keep lawful typed errors; do not restore native Error. Missing annotations and typed-channel defects remain required as req-08/req-09/req-04/req-31.
- seats: part-1/fable.md#fable-1-1, part-2/grok.md#grok-1-9, part-2/fable.md#fable-1-11

### codemod-02 — Record the native-runtime replacements, including clock and collection representation changes.
- file: scratchpad/effected/github/CheckRun.ts:374,392; scratchpad/effected/github/README.md:341
- class: law   severity: backlog
- standard: Later operator per-module native-runtime deviation ruling; D5; D9.
- evidence: CheckRun timestamps now use DateTime.now instead of native Date and follow TestClock. Sol also identifies a public HashSet representation change among the focused github contracts. These findings ask for recording the law-forced replacements, not proof that the replacements themselves are wrong.
- failure: Central records omit the native-runtime class sites and adjusted upstream tests.
- fix: Have the per-module native-runtime codemod enumerate actual github clock/collection sites and adjusted tests, preserving promised order where applicable. There are zero github allowlist entries; do not assign the allowlist config or invent allow-* removals for github-actions.
- seats: part-1/fable.md#fable-1-1, part-2/sol.md#sol-1-13

### codemod-03 — Inventory the added RulesetPayload value export centrally.
- file: scratchpad/effected/github/index.ts:152; scratchpad/effected/github/README.md:335
- class: docs   severity: backlog
- standard: D2; later operator ruling: added exports go to exportsAdded through central bookkeeping.
- evidence: The oracle exports RulesetPayload as a type; the port also exports a same-name schema value, while Added exports / exportsAdded remain empty.
- failure: The permitted superset value export is absent from the added-export inventory.
- fix: Generate the exportsAdded entry and corresponding Port notes centrally. Keep the upstream type export and permitted value addition; fix its overly narrow shape separately under req-13 and metadata under req-21.
- seats: part-2/sol.md#sol-1-13, part-2/grok.md#grok-1-8, part-2/fable.md#fable-1-11

### codemod-04 — Record the diagnostic-forced effect-valued member migration as one systemic class.
- file: scratchpad/effected/github/CodeScanning.ts:76; scratchpad/effected/github/DeploymentEnvironment.ts:46; scratchpad/effected/github/RepositorySecurity.ts:25,30,35; scratchpad/effected/github/RepositoryVariable.ts:70; scratchpad/effected/github/Ruleset.ts:314
- class: docs   severity: backlog
- standard: Operator recording ruling for law/diagnostic-forced classes; lazyEffect TS377091; D9. Record-only, outside all required fix groups.
- evidence: The cited zero-argument upstream methods became Effect values, and their upstream test calls lost parentheses to satisfy lazyEffect. Test doubles now defer corresponding defects. The reports ask only to record this forced API migration.
- failure: The central deviation inventory does not explain the lawful call-shape changes.
- fix: Central per-module/per-class bookkeeping must list effect-valued members, diagnostic cause and adjusted test calls; retain the lawful values. req-10 separately restores spans lost by an excessive effectFnIife remediation.
- seats: part-1/grok.md#grok-1-2, part-1/sol.md#codex-1-8, part-1/fable.md#fable-1-1, part-2/grok.md#grok-1-9, part-2/fable.md#fable-1-11, part-2/sol.md#sol-1-13

### codemod-05 — Record the D15-forced fixture transport representation as one systemic class.
- file: scratchpad/effected/github/GitHubClient.ts:186,191,195,485,501; scratchpad/test/github/GitHubClient.test.ts:543,759
- class: docs   severity: backlog
- standard: Operator recording ruling for law-forced classes; D15; D9. Record-only; ledger and Port notes are central write surfaces.
- evidence: The oracle used {} as A and raw fixture payload/error casts. The lawful port uses route-keyed Result fixtures, a separate decoded-raw bucket and notFound for empty single requests, while pagination stays empty. Grok's only proposed fix is a law:D15 deviation record; no implementation repair is proposed.
- failure: The forced fixture API/error differences and adjusted upstream Result fixtures are not centrally recorded.
- fix: Generate one github D15-fixtures class record with affected request/paginate/requestDecoded sites, the empty policy, adjusted upstream tests and actual fixture changes. Retain cast-free Result fixtures. Deferred missing coverage remains backlog-07.
- seats: part-1/grok.md#grok-1-1, part-1/fable.md#fable-1-1, part-2/fable.md#fable-1-11

## Rejected

### rejected-01 — Restore native test-double and fixture Error instances.
- file: scratchpad/effected/github/GitHubClient.ts:245
- class: bug   severity: backlog
- standard: D9, section 14
- evidence: Oracle `GitHubClient.ts:222-226` is `throw new Error(<same message>)`, and missing-fixture deaths are `Effect.die(new Error(...))` / `Stream.die(new Error(...))` (`GitHubClient.ts:456,470,500`). The port throws `UnstubbedError.make` (`GitHubClient.ts:245-248`; the same class is declared in each reviewed service file) and dies with `FixtureError.make` (`GitHubClient.ts:474,486,516`). `Cause.YieldableError` extends `Error`, and the message strings match. No law in the green gate set forces this replacement (`prefer-schema-tagged-error` is off this diagnostic).
- failure: A missing `makeTest` member and a missing fixture defect carry `_tag` `UnstubbedError` or `FixtureError`. The message, the synchronous throw, and the defect channel match upstream. `instanceof Error` still holds.
- fix: Restore `throw new Error` and `Effect.die(new Error(...))` / `Stream.die(new Error(...))` with the current message strings. There is no `law:<id>` cause to record instead.
- seats: part-1/grok.md#grok-1-4
- rejection: Contradicts law 7 and the operator's tagged-error recording ruling: the replacement is forced; recording belongs to codemod-01.

### rejected-02 — Restore a throwing native/schema-constructor defect for invalid commit-file statuses.
- file: scratchpad/effected/github/GitHubCommit.ts:233
- class: bug   severity: backlog
- standard: D9, D15, section 14
- evidence: Oracle `GitHubCommit.ts:215-222` builds the file with `CommitFile.make`, casting `status`. `SchemaParser.make` throws a plain `Error` whose message is `Schema validation failed`. The port decodes with `S.decodeUnknownResult` and throws `CommitFileDecodeError` (`GitHubCommit.ts:22-25,233-242`) with that same message and `cause: error.issue`. D15 forbids the `as CommitFile["status"]` cast. No test in either tree feeds `fileOf` an unknown status. Known `FileStatus` literals decode to the same `CommitFile`.
- failure: An invalid `status` throws `CommitFileDecodeError` (`_tag` set, `YieldableError` subclass) where upstream throws a plain `Error`. Valid compare statuses succeed with the same fields.
- fix: Throw via `S.decodeUnknownSync(CommitFile)(...)` so the defect is the schema constructor's `Error`. Keep the cast out.
- seats: part-1/grok.md#grok-1-5
- rejection: Contradicts the forced tagged-error idiom and the cited typed external-boundary law; req-04 fixes the actual failure-channel defect, rather than restoring a native throw.

### rejected-03 — Keep the narrowed RulesetPayload vocabulary and add a compile-time drift alarm.
- file: scratchpad/effected/github/Ruleset.ts:127
- class: schema   severity: backlog
- standard: upstream Ruleset.ts rationale ("GitHub's rule vocabulary is large, versioned and expanding, and pinning it here would date the package"); Rest.ts:80-83 (plugin pins trailing @octokit/types is a known drift source)
- evidence: `RulesetRule` hand-pins 23 rule variants "supported by the installed Octokit parameters". The spread of `body` into `client.request("PUT/POST ...")` (lines 434-447) proves schema ⊆ Octokit at compile time, but nothing proves Octokit ⊆ schema: when `@octokit/types` adds a rule type, `RulesetPayload` silently rejects it at decode time with no compile error.
- failure: A bumped @octokit/types adds a rule the schema cannot express; callers decoding real GitHub configuration get a SchemaError for a rule GitHub accepts, which is the exact dating failure upstream designed around.
- fix: Add a compile-time drift alarm next to the schema or in Ruleset.test.ts: `type OctokitRuleType = NonNullable<Rest.Params<"POST /repos/{owner}/{repo}/rulesets">["rules"]>[number]["type"]; const rulesCoverOctokit: [Exclude<OctokitRuleType, RulesetPayload.Type["rules"] extends ReadonlyArray<infer R> | undefined ? R extends { type: infer T } ? T : never : never>] extends [never] ? true : never = true;` and cite it in the deviation record from fable-1-11 (c).
- seats: part-2/fable.md#fable-1-13
- rejection: Contradicts the later restore-unforced-divergence ruling: req-13 restores the upstream open payload; a drift alarm retaining the closed public contract does not fix that defect.
