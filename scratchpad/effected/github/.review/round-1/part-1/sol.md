### codex-1-1

- file: scratchpad/effected/github/GitHubApp.ts:558
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `GitHubApp.clientLayer` token ownership and scope cleanup.   evidence: A read-only `bun -e` probe supplied synthetic credentials and an in-memory HTTP transport, then ran two concurrent requests with an expired held token. It produced `minted: 3` and revocations `[synthetic_1, synthetic_1, synthetic_3]`. The pinned oracle contains the same unsynchronized `Ref.get → rotate → Ref.set` sequence. The existing rotation test exercises one request at a time.
- failure: Both requests observe the expired token and independently rotate. One replacement overwrites the other in `held`; scope cleanup revokes only the final replacement. The overwritten installation token remains valid after the layer closes. Rotation also performs duplicate revocation and mint requests.
- fix: Serialize freshness checking and rotation with one semaphore permit, and re-read the held token inside the permit before deciding to mint. Add a concurrent-refresh regression proving that callers share one replacement and that scope cleanup revokes it. Record the verified upstream-bug deviation under section 14.

### codex-1-2

- file: scratchpad/effected/github/CheckRun.ts:434
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `CheckRunShape.withCheckRun` promises that every exit, including defects, concludes the run.   evidence: A read-only probe invoked `withCheckRun("test", "sha", () => { throw new Error("callback defect"); })` over a recording client. The exit was a defect, and the complete call recording was `["POST /repos/{owner}/{repo}/check-runs"]`; no concluding PATCH occurred. The pinned oracle evaluates `use` before attaching `onExit` in the same way. The existing defect test returns `Effect.die(...)`, which does not exercise this case.
- failure: A synchronous exception while constructing the callback’s Effect bypasses the finalizer. The created check run remains `in_progress` and can continue blocking branch protection.
- fix: Attach the exit handler to `Effect.suspend(() => use(run.id, conclude))`, so callback evaluation occurs inside the protected Effect. Retain the original defect after attempting the conclusion. Add the synchronous-callback regression and record the upstream-bug deviation.

### codex-1-3

- file: scratchpad/effected/github/GitBranch.ts:289
- class: bug   severity: required
- standard: D9, behavior preservation; the declared `Effect<void, ...>` resource contracts.   evidence: Read-only probes drove the real Octokit request path with scripted HTTP 204 responses. `GitBranch.delete`, `DeploymentEnvironment.delete`, and `GitHubApp.revoke` each returned `{ value: "", isUndefined: false }`. In the pinned oracle, their generators yield the request and then fall through, returning `undefined`. The corresponding changed sites are `DeploymentEnvironment.ts:150` and `GitHubApp.ts:495`.
- failure: Returning the terminal request leaks Octokit’s bodyless-response representation into APIs that previously returned `undefined`. TypeScript’s assignability to `void` allows this observable divergence to pass the compiler.
- fix: Discard the request result explicitly with `Effect.asVoid` at all three sites, preserving `return yield*` where desired. Assert the returned value as well as the outgoing request.

### codex-1-4

- file: scratchpad/effected/github/GitHubCommit.ts:234
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3; `standards/schema-first-development-prompt.md`, “Effect owns fallibility and runtime boundaries.” External decoding failures must enter the boundary’s typed error channel.   evidence: A read-only probe returned HTTP 200 with a file containing `status: "future_status"`, then called `changedFiles`. The result was `Exit.Failure` with `Cause.hasFails = false` and `Cause.hasDies = true`; the defect was `CommitFileDecodeError`. `compare` also reaches this throwing helper through `comparison.files.map(fileOf)`.
- failure: Unexpected external file data throws through `Result.getOrThrowWith` inside an Effect mapping callback. Callers handling the advertised `GitHubError` channel cannot recover from this decode failure.
- fix: Use effectful file decoding in `compare` and `changedFiles`, mapping schema errors to `GitHubError.decode`. Reserve any retained synchronous helper for trusted programmer-input paths. Preserve rejection of invalid statuses and record the law-required failure-channel deviation under section 14.

### codex-1-5

- file: scratchpad/effected/github/CheckRun.ts:113
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `CheckRunOutput.truncated` byte-prefix fidelity.   evidence: A read-only probe constructed `prefix = "a".repeat(budget - 3) + "\uFFFD"`, where `budget = LIMIT_BYTES - byteLength(NOTICE) = 65475`, and appended 100 ASCII characters to force truncation. The prefix itself occupied exactly 65475 bytes, but the output discarded its complete U+FFFD character: actual prefix length `65472`, expected `65473`. The pinned oracle contains the same loop.
- failure: The loop treats every trailing replacement character as evidence of a split UTF-8 sequence. It therefore removes legitimate U+FFFD characters already present in the input, even when they fit completely within the byte budget.
- fix: Determine the cut from UTF-8 byte boundaries before decoding, removing only an incomplete trailing sequence. Add a regression that distinguishes a complete encoded U+FFFD from a decoder-generated replacement, and record the upstream-bug deviation.

### codex-1-6

- file: scratchpad/effected/github/CheckRun.ts:23
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b; D5’s full beep-native kit requirement.   evidence: Named, reused, annotation-bearing literal domains still use `S.Literals`: `CheckConclusion` at line 23, `AnnotationLevel` at line 34, `FileMode` in `GitCommit.ts:22`, `FileStatus` in `GitHubCommit.ts:64`, and `GitHubErrorKind` / `GitHubValidationCode` in `GitHubError.ts:21` / `:54`. These are explicit source instances of the contextual modeling rule; the four green S1 law commands do not establish compliance with EF-12b.
- failure: The named domains retain the constructor that the standard reserves for anonymous inline unions, leaving the required kit migration incomplete.
- fix: Replace these named `S.Literals` constructions with `LiteralKit`, retaining their literal members, annotations, and existing `.literals` consumers. Anonymous inline wire unions can remain `S.Literals`.

### codex-1-7

- file: scratchpad/effected/github/CodeScanning.ts:28
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-12b. Plain interfaces are reserved for service contracts, ports, overloads, and genuinely type-level machinery.   evidence: `CodeScanningSetup` is a named pure configuration payload defined solely as an interface. `DeploymentEnvironmentInfo` in `DeploymentEnvironment.ts:21` is likewise a named pure result model, with list results constructed as unchecked `{ name: environment.name }` objects at line 143.
- failure: These data models have no owning runtime schema from which validation, guards, or generators can be derived. They remain exceptions to the required schema-first modeling contract despite the green S1 syntax and type gates.
- fix: Define schemas for these two data shapes and derive their TypeScript types from them. Preserve the existing structural field types and configuration omission semantics; construct or decode environment results through the owning schema.

### codex-1-8

- file: scratchpad/effected/github/CodeScanning.ts:76
- class: docs   severity: backlog
- standard: D9 and section 14, behavior-deviation recording; `effect-tsgo/docs/rules/lazy-effect.md` (`lazyEffect`, TS377091).   evidence: The pinned API exposes `languages: () => Effect<...>`; the port exposes an Effect value. `DeploymentEnvironment.list` changes similarly at `DeploymentEnvironment.ts:46`, and its upstream test calls were rewritten accordingly. The module’s Port notes still say `Deviations: None`, and its ledger deviation list is empty.
- failure: These law-driven API changes are not recorded as deviations. A consumer porting the upstream calls cannot discover from the required record why `languages()` and `list()` no longer work.
- fix: Record both changes with cause `law:lazyEffect`, cite the adjusted upstream tests, and describe the call migration in Port notes and the ledger. Retain the lawful Effect-valued members. This documentation work remains backlog under the operator’s stage order.

### codex-1-9

- file: scratchpad/effected/github/GitHubClient.ts:254
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; S2 documentation conversion.   evidence: The `GitHubClient` export still has `@remarks` at line 254, `@example` at line 265, and no canonical `@category` or `@since 0.0.0`. The same legacy carriers and missing export tags occur throughout the focused resource files.
- failure: The carried documentation has not yet been converted to the required section grammar and export metadata.
- fix: During S2, preserve the substantive prose and examples while converting carriers to `**Details**` and titled `**Example** (...)` sections, adding canonical categories and `@since 0.0.0`, and validating examples through docgen.

### codex-1-10

- file: scratchpad/test/github/GitBranch.test.ts:177
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, assertions by value; deferred S3 canon migration.   evidence: The Option result is asserted with `assert.isTrue(O.isNone(value))`. Similar container assertions occur in focused tests, including `GitHubClient.test.ts:660` / `:672` using `Exit.isFailure`, and `resources2.test.ts:335` using `Exit.isFailure`.
- failure: These tests retain predicate assertions on Effect containers instead of the required public assertion helpers. Failure assertions also omit the explicit expected cause or payload required by the canon.
- fix: During S3, use `assertNone`, `assertSome`, and the appropriate Exit assertion helpers from `@effect/vitest/utils`, retaining assertions on the relevant payload or defect.

### codex-1-11

- file: scratchpad/test/github/resources2.test.ts:39
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; deferred S3 canon migration.   evidence: The shared `drive` helper provides `service.layer.pipe(Layer.provideMerge(base))` inside each test. The focused resource layers are `Layer.effect` layers, and `harness` supplies an effectful `GitHubClient.layerFromToken`. `resources.test.ts:38` repeats this pattern.
- failure: Effectful layer construction remains behind per-test `Effect.provide` helpers rather than the required `it.layer` test structure.
- fix: During S3, move effectful resource and transport layer provision into `it.layer` suites or the appropriate canon-approved layer factory, preserving each test’s scripted transport and recording.

REQUIRED: 7
BACKLOG: 4