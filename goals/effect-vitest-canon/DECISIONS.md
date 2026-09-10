# Decisions

D1-D14 were locked with Benjamin on 2026-09-04. The following table preserves
the requested choices; rejected alternatives are summarized from that contract.

## 2. Locked decisions — do not relitigate, do not re-grill

| # | Decision |
| --- | --- |
| D1 | **Objective** = canonical idiom migration across every in-scope test file. Acceptance = zero remaining detector findings + every judgment finding fixed or ledgered. Per-package before/after test durations are recorded as evidence; lane speed is measured, never promised. |
| D2 | **Inventory artifacts** = one schema-validated JSONL finding row per (file, line, lens, rule) under `goals/<slug>/ops/inventory/<lens>/<package>.jsonl` plus one markdown digest per package. Never per-test-file markdown. |
| D3 | **Mechanical detectors first**; the four LLM lenses audit only the residue (judgment classes). |
| D4 | **Detector home** = new `beep lint effect-vitest` in repo-cli — the cheapest strict medium: ts-morph **syntax-only** project over the test globs (`skipAddingFilesFromTsConfig`, no type checker, no full-repo project), full scan every run (target ≤ 10 s), registered in the **cheap-gates** lane next to `schema-first`, committed baseline `standards/effect-vitest.inventory.jsonc`, ratchet fails on any new instance, exceptions require `reason`, and the baseline must be **empty** when the packet closes (zero tolerance from then on). |
| D5 | **Assertions inside `it.effect`**: Option / Result / Exit values are asserted with `@effect/vitest/utils` helpers (`assertSome`, `assertNone`, `assertSuccess`, `assertFailure`, `assertExitSuccess`, `assertExitFailure`, …); `expect` stays legal for plain values. Correct `08-testing.md` examples and soften `.patterns/testing-patterns.md` to match. |
| D6 | **Flakes**: root cause first (TestClock, event-driven waits, scope). `it.flakyTest` only for external nondeterminism (container start, network, OS timing), each with a `reason` row and a follow-up. Never a longer timeout as a fix. |
| D7 | **Observability** = an instrumented `it` in `@beep/test-utils` composed from public `@effect/vitest` API (`makeMethods`, tester wrapping): start/end/duration/outcome logs through a Logger layer gated by `BEEP_TEST_TRACE=1` or CI, plus a live-clock watchdog under the vitest timeout that fails naming the test and the last log line. `it.live` is reserved for tests that genuinely need the live clock or console. No `it.live` conversions for logging. |
| D8 | **MemoryFileSystem** enters as **P0.5**: port upstream `testLayer` into `@beep/test-utils`, run it against Node, Bun and Memory, promote `scratchpad/MemoryFileSystem` to `@beep/test-utils` only when green. Fold the `memfs` seed/fault/inspect facade on top only if P1 rows show codemod/generator tests need seeded volumes. Resource Authoritarian owns it. |
| D9 | **Scope** = `apps/**`, `packages/**`, `infra/**` test files (955) plus `**/test/**/*.ts` support modules for wrapper-definition findings. Excluded: `scratchpad/**` (lab; only the MemoryFileSystem test graduates with its module), `.claude/**`, `goals/**`, `explorations/**`, `docs/**`, `node_modules`. |
| D10 | **Harness** = Fable orchestrates; Codex `codex exec` lanes do heavy lifting; Grok headless does adversarial rounds and web research. Lens charters live in `goals/<slug>/ops/prompts/*.md` and are injected into lane prompts — **not** `.claude/agents` subagent files. |
| D11 | **Knowledge graph** = `standards/effect-vitest.primitives.jsonc`, one entry per export and README section, pinned to the rc.113 tag, decoded by an `S.Class` in the lint command, used for remediation hints, and the lint command **fails when the installed `@effect/vitest` version no longer matches the pin**. |
| D12 | **P2 lens order per package** = scope → assertions → property → flake → observability. |
| D13 | **PRs** = one per topological wave capped near 150 changed files; `foundation/modeling` and `tooling/tool` ship alone. Each PR carries package-verify proofs and before/after timings. |
| D14 | **Provide rule** = `it.layer` required for any scoped or effectful layer (`Layer.effect`, `Layer.scoped`, `Layer.unwrap`, `acquireRelease`, containers, filesystems, servers, every `withXyz` wrapper). Per-test `Effect.provide` allowed only for pure `Layer.succeed` / `Layer.mock` stubs. Unresolvable constructors go to the Resource lens for judgment. |


## Rejected alternatives

| Decision | Rejected alternative |
| --- | --- |
| D1 | Promises to fix Coverage Regression or a partial test sample. |
| D2 | One markdown report per test file. |
| D3 | LLM scans for mechanically detectable classes. |
| D4 | Regex-only enforcement, full typechecking, nonzero closeout baseline. |
| D5 | A blanket expect ban or hand-rolled data-type assertions. |
| D6 | Timeout increases or retries masking deterministic faults. |
| D7 | Converting tests to live mode merely for logging; private API coupling. |
| D8 | Promoting an unproven filesystem or continuing duplicate engines. |
| D9 | Counting scratchpad, stale worktrees or packet fixtures as migration scope. |
| D10 | Anthropic bulk/review lanes and permanent subagent definitions. |
| D11 | Unpinned HEAD anchors or an incomplete graph without version enforcement. |
| D12 | Property/flake remediation before resource structure stabilizes. |
| D13 | A single repository-wide migration PR. |
| D14 | Per-test rebuilds of effectful/scoped fixture layers. |

## Execution decisions, 2026-09-08

- The proposed slug is used for reversible setup while the once-only question is pending.
- Deletion of both scratchpad copies is pending explicit answer and green conformance.
- The actual orchestrator is Codex. Preserve requested Codex/Grok lane routing.
  Public attribution must remain truthful; do not claim Fable executed Codex work.
- The original branch is still the requested source, now at bf6014ae31. Use the
  live source HEAD; do not reset to the historical September 4 snapshot.
- Grok 1.0.13 does not list --no-auto-update. Omit the unsupported argument,
  preserve streaming-json and max-turns, and do not alter tool allowlists.
- Research filenames use the actual capture date, 2026-09-08.

## Operational routing precedence, 2026-09-08

- Benjamin's later AGENTS instructions require gpt-6-astra with explicit xhigh
  reasoning for all token-heavy Codex work. This supersedes the initial
  daybreak/medium example while preserving the requested Codex CLI and Grok
  assignments. Historical lane receipts remain unchanged.
- The unfinished filesystem reconnaissance session had no live process or tool
  handle on inspection. Resume the same session under Astra/xhigh, preserve the
  original raw log and stale status as evidence, and do not claim an exit code
  that was not captured.

## Exception ledger

The D14 conformance exception is reserved for per-test provision of the layer
under test. It must be encoded with a reason when the conformance suite is ported.
No migration exceptions have been granted. The narrow P0F-R1-010 review waiver
is recorded in the dated disposition below; all other current review rows remain
under validation or repair.

## Grounding interpretation, 2026-09-08

- Reports describe upstream patterns; they do not override D14. Grounding 2's
  inferred option of routine per-test MemoryFileSystem provision is rejected
  for migration. Use it.layer and scoped inner resources, with only the named
  conformance-subject exception to per-test provision.
- The pinned conformance suite deliberately closes some inner scopes before
  asserting resource removal. Preserve those observable lifecycle assertions
  during the port. The runner's outer scope cannot replace an early inner close.
- D7 uses the public TestContext.task timeout at execution time. It must retain
  disabled timeout semantics and fire before the test timeout when enabled.
  Hook acquisition remains separately bounded by the layer hook timeout.
- Timing summaries must define their derivation. Vitest 4.1.11 JSON has no root
  totalMs, and concurrent test durations cannot be summed into elapsed time.
  Preserve the raw report; record process elapsed time separately from reporter
  file/test timings. P1 will encode the selected reporter-derived total explicitly.

- Grounding 4 identifies a D7 sketch hazard: TestClock.withLive assumes a test
  clock. Use it in effect/default layer environments; use a live sleep for
  it.live and excludeTestServices blocks. Preserve these modes in wrapper tests.
- EV004 must distinguish the redundant whole-body wrapper from an intentional
  shorter resource lifetime. Record the latter for Resource judgment; do not
  delete early-release assertions. The conformance helper contains concrete
  examples to preserve.

## D14 compiler integration, 2026-09-08

The existing D14 conformance-subject exception requires direct per-test
Effect.provide(layer) in FileSystemConformance.ts. The installed tsgo 0.39.1
rule has no entrypoint/test recognition and reports all 21 calls; its official
local directive is the supported entrypoint mechanism. Root applies the user's
explicit conformance exception through one exact file-and-rule policy allowance:
FileSystemConformance.ts may use strictEffectProvide:skip-file, with its resource
lifetime reason. No other rule, path, global severity or policy profile is exempt.
The Quality collector and tests must enforce that boundary. This implements the
existing exception, does not waive assertions/typing/package proof, and does not
authorize source test-layer provision elsewhere. No directive is added until the
conformance source writer exits.


## 2026-09-08 — copy-contract correction follows original D8 authorization

Original D8 requires the pinned FileSystem conformance suite to pass on Memory
before promotion; P0.5 requires the upstream testLayer port with its assertions
preserved. The surviving lab engine intentionally diverges on the error path
for overwrite-disabled copy, but its implementation comment does not supersede
that user contract. Correcting the error metadata and the equally precise
regression expectation implements D8. It does not delete a test, weaken an
assertion, amend conformance, or require a new waiver.

Root's earlier additional source-versus-destination question was an unnecessary
approval gate. It is withdrawn on the original instruction's authority, not on
an inferred answer or elapsed time. The prepared two-file source-path proposal
is now authorized for the bounded source lane. Its 21 conformance cases, all
17 existing Memory regressions, and the 12 pre-refactor characterization cases
must pass on actual Node and Bun before promotion. Scratchpad deletion and all
merge decisions remain reserved for Benjamin as originally required.

## 2026-09-09 — scoped filesystem export acceptance

Root accepts the read-only boundary qualification in
history/lanes/p05-boundary-qualification.md. Existing workspace aliases bypass
null deep-export blocks, but the binding architecture permits transitional
wildcards and defines the explicit facade as the canonical public contract.
The repo-cli-specific test-alias prescription does not require a global alias,
law or Vitest rewrite before D8. This is scope qualification, not a waiver.

The isolated retained-module control passed all 64 resolver observations and
eight null-removal controls on actual Node and Bun with exact source/publish
maps. All 16 retained dist files match their source artifacts. Of 73 captured
inputs, only package.json changed concurrently: the source lane added exactly
the four authorized Memory facade/null entries. This is control-boundary
evidence only; it does not prove the new Memory implementation or its build.

Final Memory acceptance still requires exact source/publish facade and null
entries, the curated make/layer surface, canonically generated aliases, public
imports in every new consumer, isolated source and built/publish resolution
and execution proof, all 50 promoted Node/Bun cases, and mandatory package
verification. Do not claim that workspace aliases enforce private imports.
Any actual new external private import must be corrected locally. No global
configuration change, scratchpad deletion, phase advance or merge is authorized
by this finding. Root owns final integration and publication.


## 2026-09-09 — derived Memory facade alias

The integrated tsgo rules check requires generated Vitest alias data to equal
canonical root compilerOptions.paths. The public MemoryFileSystem subpath was
already authorized by D8 and its canonical root path was generated. Root
projected that one missing mapping into vitest.aliases.generated.json, preserving
all 810 existing mappings and their targets. The focused tsgo rules check passes.
The projection preserved JSONC comments; an adjacent unchanged array reflowed.

This is the derived public-subpath wiring required by the scoped export decision
above. It changes no Vitest TypeScript configuration, resolver implementation,
timeout, property floor or diagnostic severity, and does not authorize a global
configuration change. Existing workspace wildcard privacy limitations remain
explicit. The exact before/candidate hashes and one-entry semantic comparison
are retained in the private alias-projection receipt.

## 2026-09-09 — start the filesystem PR before queued local proof

Benjamin explicitly authorized starting the PR early instead of waiting on the
verification queue. Root stopped only the owned queued verification, preserved
its log and exit status, refreshed the base, and used the canonical Yeet
start-PR-early publication flow with PR creation and monitoring enabled. The
flow retains full local proof and hosted closeout. This authorizes early
publication; the existing phase gates and Benjamin's merge authority remain.


## 2026-09-09 — preserve pinned copy collision outcomes during PR remediation

Actual Node/Bun controls and the pinned shared implementation show that an
existing-destination copy with overwrite false may succeed while preserving
contents. The FileSystem interface does not require an AlreadyExists error for
that operation. Requiring failure rejects both canonical platform layers, so
Root withdraws that initial review interpretation. Preserve the original
conditional error-detail and unconditional content assertions. Strengthen the
same case with an absent-destination copy/content check to reject an actually
incorrect always-no-op implementation. No platform patch or contract change is
authorized by this finding. All three conformance subjects must remain green.


## 2026-09-09 — publish addressed review fixes without the full queue wait

Benjamin explicitly directed: "if fixes are in for the issues (check all issues
are addressed locally first). just push instead of waiting on queue". Root will
refresh all PR threads and failures, finish local remediation proof, and use
Yeet fast publication with hosted monitoring on the existing PR. This accepts
replacing the local full pre-push wait for this update; it does not waive
review findings, required hosted checks, or authorize merging.

A fresh review snapshot found five additional Codex comments, alongside the two
Greptile threads. All seven must be validated and locally addressed before that
publication. The Vercel-only rate-limit thread is already answered and resolved.


## 2026-09-09 — conditional adoption of promoted coverage identities

Independent read-only review in history/lanes/p05-pr1047-coverage-provenance-review.md
confirms the existing comparator supports reviewed workspace identities for new
source, while retaining base floors for surviving files. The packet's extra
permission boundary concerns untouched packages; test-utils is the package this
PR promotes into. Root may use its scoped canonical writer after final meaningful
tests and numeric/identity review. This is a conditional integration decision,
not acceptance of the initial red coverage or authorization for lane writers.

Before and after regeneration, preserve all 133 other package rows, all global
policy fields, all 11 existing file identities, every existing percentage floor
and each existing file's uncovered counts. Review exactly three new identities
(core, facade and conformance helper), quantify their remaining gaps, and verify
the target row equals the fresh measurement. New source can increase package
uncovered totals; do not describe that as preserving an unchanged package count
budget. Run the normal scoped ratchet afterward and retain hosted/base-pinned
proof. No coverage policy, exemption, source exclusion or existing floor changes.

The sole tighter surviving-file measurement in the initial local run, SqlTest.ts,
exactly matches the already completed hosted job's four percentages. Root retains
that comparison privately and will check it again against the writer output.


## 2026-09-09 — P0f round 1 remediation dispositions

The initial eleven Grok findings are recorded in
history/2026-09-09-adversarial-round-1.jsonl, with per-row disposition and proof
in history/2026-09-09-adversarial-round-1-closure.md. P0F-R1-001 through 009 are
assigned for detector validation and repair; P0F-R1-010 is assigned for an exact
collection-semantics assessment. No speculative proposed fix is accepted solely
because it appears in a review, and no waiver is granted by this assignment.

P0F-R1-011 is confirmed and its fix is applied: the detailed P0c gate follows the
live scope schema with dated census evidence, and SPEC's active invocation omits
the unsupported Grok flag. Grok 1.0.24 was verified on this date. Active Codex
routing/permission examples now agree with the existing execution decision and
Benjamin's later instructions. D1-D14 and every ratification gate are unchanged.
Final packet validation remains pending until the active CLI writer finishes.

The first report's partial sample reads do not satisfy the full-body review
contract. Root requires the same Grok round to finish the remaining input spans;
this continuation is not round 2 and grants no gate exception. Source repairs
can proceed against the initial findings because the reviewer uses immutable
inputs. Round 2 waits for completed coverage and closure of every round 1 row.


### Round 1 additional findings, 2026-09-09

Full-body completion added P0F-R1-012 (same-file helper attribution, major) and
P0F-R1-013 (two missing graph remediation edges, minor). Both receive validation
and repair follow-up after the active detector writer hands back the shared
files. EV004's existing distinction between a redundant whole-test scope and an
intentional inner resource scope remains binding; helper reachability alone is
not permission to remove every scope. No waiver is granted for either finding.


## 2026-09-09 — P0F-R1-010 reference-identity waiver

Waive the proposed requirement to replace TestExecutionState.propertyRuns with
an Effect map. AGENTS prefers Effect helpers; the skill's native-collection
prohibition is scoped to domain logic. This table is private JavaScript runner
registration bookkeeping whose contract is object-reference identity. Pinned
rc.112 and installed collection probes each pass twelve comparisons and show
that distinct empty objects merge in Effect HashMap/MutableHashMap. Reference
proxies or global reference markers are available but add identity machinery
solely to replace a collection already matching the required semantics.

This waiver applies only to that execution-local table. Preserve distinct
registrations, aggregation across generated trials, per-execution lifetime and
concurrent isolation; do not generalize it to domain data or global state.
The new overlapping-registration regression passes on Node 24.20.0 and Bun
1.4.2, and Root's primary-pin Bun 1.4.1 rerun also passes with exact source hashes.
No executable source behavior or existing assertion was weakened. Full package
integration remains a separate prerequisite before round 2.

See history/lanes/p0f-round1-runner.md and
history/2026-09-09-p0f-runner-validation.md for the source anchors, preservation,
focused proof and the 22 qualified private-fixture compiler diagnostics.


## 2026-09-09 — round 1 partial proposed-fix dispositions

Root accepts the initial detector lane's narrow recommendations for portions of
P0F-R1-003, P0F-R1-004 and P0F-R1-007. These decisions apply to review claims and
proposed suppressions, not inventory exceptions or permission to skip repairs.
The confirmed gaps have implementation fixes with 83 focused tests, compiler
and lint passing; combined package proof remains pending.

- **R1-003:** waive the assertion that a cheap in-memory Layer.unwrap judgment
  is itself a proven false positive. D14 explicitly includes effectful/unwrap
  construction and sends unresolved constructors to Resource judgment. A
  judgment row asks for inspection; it does not assert an expensive allocation
  or demand a larger timeout. Missing imported/property/unknown-layer coverage
  is confirmed and repaired. The pure succeed/mock negative remains covered.
- **R1-004:** reject and narrowly waive the proposed callback-wide withLive
  suppression. A live wrapper around a different expression does not drive a
  direct test-clock sleep. Exempt the actual wrapped wait; classify uncertain
  fork/cancellation subjects for judgment without claiming syntax establishes
  cancellation target, timing or execution order. Remove count-only recurs from
  timed schedules. The first handoff retains explicit sibling-wait, sequential
  adjustment, curried callback and interrupted-subject counterexamples.
- **R1-007:** waive the claim that any Effect.sleep or OS-related mention proves
  a need for it.live. D7 reserves live mode for tests that need real time or
  console behavior; a sleep can instead be driven with TestClock. An opaque
  external integration remains a judgment for the flake lens. The confirmed
  fnUntraced/modifier/curry callback extraction gap is repaired using the shared
  harness index. No opaque integration is automatically migrated by this rule.

The evidence and regression anchors are in history/lanes/p0f-round1-detectors.md
and the sealed first-handoff archive. These bounded dispositions must be
revisited at P0g ratification, or sooner when a concrete counterexample shows
an incorrect mechanical/judgment distinction. D1-D14, severity rules, baseline
policy and scope exclusions are unchanged. The findings remain open for final
integration evidence; these partial waivers alone do not close round 1.


## 2026-09-09 — AST identity caches during performance repair

Root accepts native WeakMap for the detector's private AST-node identity caches
within one immutable per-file analysis context. These memoize third-party
syntax-node objects; they are not domain data collections. AGENTS prefers Effect
helpers, and the Effect-first native-collection restriction is scoped to domain
logic. Name-to-declaration tables remain Effect MutableHashMap with string keys.
The measured Effect-map candidate preserved output but took 42.75s because its
AST object keys incurred structural work; the identity-cache candidate took
22.81s. Both runs remain evidence, and neither passes D4.

The boundary is exact: no process-global cache, no cross-file or cross-run
reuse, and a fresh import/analysis context after a SourceFile edit. Preserve
lexical shadows, distinct nodes, misses and all finding payloads. Final tests
and independent full-scan proof must validate the optimized implementation.
This decision does not generalize the runner's R1-010 waiver to other data
structures, and it changes no domain/schema, severity, scope or timing rule.


## 2026-09-09 — deterministic watchdog test access after package failure

Root accepts the read-only attribution of the aggregate property-deadline test
failure. The original trigger remains unproven: the retained stack strongly
supports Vitest's outer timeout path, but lost error/abort details cannot establish
callback order. The confirmed sample/arming gap will be corrected independently.
This is not an environment waiver or a relaxation of D1-D14.

Use the existing private instrumentation/runtime factories with an explicit
watchdog timing dependency: production remains bound to its captured live clock,
while a source-only test constructor may supply a controlled clock. Package-local
tests access that constructor through `@beep/test-utils/test/Vitest`, following
the existing source-only `src/test/*.test-kit.ts` convention. Its explicit source
export maps to `packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts`; the publish export is null. Preserve
`./internal/*: null`, the root barrel and the public Vitest API. Root ran the
architecture command before authorizing this role file.

The controlled aggregate-property fixture must exercise the real registration,
fast-check generation and shrinking, the same absolute logical deadline, scopes,
last-log and one-lifecycle behavior. Keep all original test names and behavioral
assertions, the 180ms timeout, seed and fcRuns floors. Control the fixture's
logical trial delay as well as the watchdog clock; do not fabricate failures or
monkey-patch platform clocks. Existing real-clock watchdog/finalizer integration
cases remain. Production TestEnv/TestClock behavior and logging policy are fixed;
there is no production environment switch or new public timing option.

Read the remaining absolute duration when the watchdog is armed, after setup;
expired budgets fail immediately and never reset on subsequent trials or shrinking.
Capture public Vitest raw errors and abort evidence in test-only artifacts so a
stack-only JSON reporter cannot hide which failure occurred. The correction and
controlled regression must pass focused Node/Bun and full package verification
before acceptance. A cooperative watchdog cannot preempt arbitrary event-loop
starvation; no unconditional preemptive scheduling guarantee is inferred from D7.

## 2026-09-09 — close alternate published paths to the watchdog test seam

The deadline lane's final export audit found that blocking only the named
`@beep/test-utils/test/Vitest` publish export still lets the package's broader `./*` mapping
resolve `@beep/test-utils/test/Vitest.test-kit`. That contradicts the already chosen source-only
test seam. The repair must add `./test/*: null` to the publish export map, retaining
the explicit named null entry and the existing internal guards. The same scoped
source guard may block alternate role-name imports while leaving the exact
authorized `@beep/test-utils/test/Vitest` source entry usable. Existing schema and repo-cli
package manifests establish this convention.

This is completion of the authorized publication boundary, not a waiver or a
new public API. Prove both the named and filename-derived published imports fail
under isolated Node and Bun consumers, while the exact source test entry remains
usable. Workspace aliases are separate development routing and must not be
presented as enforcement of Node package export restrictions. Apply the manifest
repair only after the active writer stops and main is reconciled; retain all
earlier diagnostic and failed package evidence.

## 2026-09-09 — pause implementation and publish an early draft

Benjamin requested that current progress be saved and a PR opened while the
broader goal pauses. Publish the current foundation as a draft with its completed
proofs and pending inventory/review gates stated explicitly. This changes the
publication timing only: P0f is incomplete, P0g ratification and merge remain
Benjamin's decisions, and P1/P2 cannot begin under the early-draft authorization.
Resume further implementation only on Benjamin's request.


## 2026-09-09 — conditional runner coverage identity adoption for PR #1067

Root reviewed the complete normal scoped test-utils coverage result and the
source-level residuals in history/lanes/pr1067-runner-coverage-remediation.md.
All 14 surviving file rows are numerically identical to the current baseline
under the canonical zero-total normalization. The five new source identities
are Vitest.ts, Vitest.errors.ts, internal/VitestRuntime.ts,
internal/VitestInstrumentation.ts and test/Vitest.test-kit.ts. Four are fully
covered. The instrumentation remainder is five defensive branch alternatives,
two functions, three lines and four statements; the report names each path and
distinguishes unrealistic-but-representable budgets from unreachable Proxy
behavior. No private invalid execution state, disabled assertion, source
exclusion or artificial direct call is accepted to inflate those measurements.

Root conditionally accepts these five new identities through the scoped
canonical writer. Before and after writing, verify all existing file rows,
all existing percentage floors, global policy fields and every unrelated
package row. Package percentages rise to L/S/B/F96.41/95.74/93.30/91.75. The
package uncovered counts increase by exactly the new instrumentation remainder;
this is an explicit new-source budget, not an unchanged count-budget claim.
The normal scoped ratchet and base-pinned hosted comparison must pass after
the write. No whole-repository baseline rewrite is authorized. The CLI's new
identities require their own complete scoped measurements and review.


## Active release amendment, 2026-09-10

Benjamin required waiting for PR #1060 to land and then merging main and repairing
its breaking Effect upgrade. That integration is complete. D11 now pins
@effect/vitest 4.0.0-rc.113 and effect 4.0.0-rc.113 to
d3b837aee836f35d625d55205f7d6e61305fc198. The version guard remains fail-closed.
This supersedes rc.112 for current implementation and proof, while historical
reports keep their original source identity. Native Arbitrary replaces the
FastCheck bridge; existing run floors, seeds, assertions and lifecycle guarantees
remain required. All other decisions and phase gates remain in force.


## Inherited test-stack compatibility boundary, 2026-09-10

Root retains the versions installed by #1060: Effect and @effect/vitest rc.113
with Vitest 4.1.11. The adapter declares Vitest >=5 <6, while the installed and
currently published Storybook Vitest addon 10.6.0 declares Vitest 3/4. Updating
that stack would expand the integration task and may require global test-config
changes reserved for Benjamin. The optional scope question has no answer; its
silence does not authorize that expansion.

Current runner suites and the shared Memory/Node/Bun filesystem conformance
suite pass under Node 24.20.0 and Bun 1.4.2, and full test-utils package audit and
docgen pass. These are compatibility observations for the exercised behavior,
not a claim that the declared peer range is satisfied or all combinations are
supported. Final package, coverage and hosted checks remain required. This
bounded retention decision permits PR closeout on main's existing stack; the
separate upgrade question does not waive a test failure or reduce a floor.

## 2026-09-10: Native runtime adapter boundaries

The strict native-runtime command also gates warnings. Root retains the
reviewed runtime primitives in three exact file/kind allowlist entries: weak
TestContext and ordered property-registration identity maps in instrumentation;
weak ts-morph node caches in the scanner; and own-method assignment onto the
callable Vitest registration adapter. These operations implement vendor object
identity, lifetime and callable-object semantics. Effect value collections do
not supply weak keys, and replacing the callable with a Record changes its API.

All other rule behavior and prior allowlist entries remain unchanged. The
existing package codegen must regenerate the snapshot; allowlist integrity and
the full native-runtime command must pass. Runner and scanner behavior remain
covered by their existing identity, ordering and lifecycle regressions.

## 2026-09-10: Honor the canonical Node child-worker configuration

Hosted coverage uses Node 22.22.3. Its canonical shared configuration supplies
the Float16Array feature flag to forked workers, while the regression harness
forced a threads pool. The exact Node 22 constructor rejects that flag with
ERR_WORKER_INVALID_EXEC_ARGV before any tests execute. The failure also occurs
without inherited Vitest worker identity variables.

Root authorizes the child fixture launcher to honor the canonical Node pool
choice, retaining Bun's explicit threads setting where needed. Keep the shared
configuration, feature flag, timeouts, assertions, fixtures and production
runner unchanged. Require the existing real fixture to demonstrate failure
before the correction and successful execution after it; prove the full runner
on Node 22, Node 24 and Bun, then scoped coverage on the hosted Node version.
