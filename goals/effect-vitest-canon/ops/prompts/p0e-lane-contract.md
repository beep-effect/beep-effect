# P0e instrumented tester lane contract

P0a-P0d are complete. Read history/2026-09-08-p0d-verification.md, SPEC sections
0, D5-D7/D10/D14, P0e, 6.4, and the pinned graph before implementation.
Continue the same Codex CLI session with explicit medium effort and
gpt-daybreak-blue-latest. This is a new phase and a new report, not permission
to change the completed detector or graph.

You are not alone. The orchestrator owns packet docs and charters, decisions,
all git/inbox-waiver/publication operations, package verification, and final
acceptance. No other source lane is active. Never run git commands or spawn
agents. Create history/lanes/p0e-instrumented-it.md within the first actions and
append as you work; final response is only that report's absolute path.
Do not modify any path outside the ownership map or acknowledge/waive quality
inbox failures. Report such blockers to the orchestrator and continue permitted
independent work. Do not start P0.5 or adopt the runner in other test packages.

## Owned implementation surface

- packages/tooling/test-kit/test-utils/src/Vitest.ts, the requested public subpath.
- Supporting Vitest.errors.ts / Vitest.schemas.ts / internal/Vitest*.ts only if
  justified by the existing package topology and the architecture command.
- packages/tooling/test-kit/test-utils/test/Vitest*.test.ts and narrowly scoped
  local fixtures under test/fixtures/vitest-instrumentation/**.
- Your report: goals/effect-vitest-canon/history/lanes/p0e-instrumented-it.md.

The package already exposes ./* through its existing export map. Do not
unconditionally export a Vitest-runtime-dependent module from the root barrel
or modify package.json/lockfiles/configuration without a concrete ownership
request and reuse analysis. No MemoryFileSystem, existing tests, lint command,
graph, generated baseline/census, shared config/timeouts, property floors or
coverage baselines are yours to change.

Read applicable AGENTS and load schema-first, Effect-first and JSDoc laws before
touching models/services/exports. Announce relevant skill use in your report.
Run the architecture command before new role files. Search live source and
barrels for existing tagged errors, logging, test-context, configuration and
wrapper helpers before adding anything. Use schema-owned invariants, typed
errors, Effect helper modules, explicit service composition and @beep source
aliases in tests. Keep exports documented with titled Example sections and
supported public subpaths. Preserve the original test-utils API.

## Required behavior

Design and implement the instrumented it from PUBLIC @effect/vitest APIs,
including makeMethods/tester wrapping as appropriate. Do not import upstream
private internals or copy their runner implementation. Inspect exact rc.112
source and installed Vitest 4.1.11 types/runtime for the public integration seam.

Preserve callable plain it and the full supported effect/live tester surface:
call, skip, skipIf, runIf, only, each, fails and prop. Preserve overloads,
generic requirements, user TestContext, supplied test options, property input
shapes, seed/numRuns floors, conditional registration and expected-failure
behavior. Top-level and nested it.layer must hand their callback an
instrumented MethodsNonLive while preserving once-per-block layer construction,
per-test inner scopes, nested memo-map sharing, hook options and TestEnv.
Do not invent live methods or excluded options on nested MethodsNonLive.

Wrap effectful test bodies with a live-clock watchdog below the actual resolved
Vitest task timeout. Use public TestContext task identity and timeout evidence;
account for 0/Infinity-disabled timeouts and distinguish hook timeout from test
timeout. A registration-name or fixed 5000ms fallback is not enough for each or
property cases whose concrete names/options differ. The pinned each callback
gets ONLY its case, while prop gets generated values plus TestContext: do not
invent a second each argument. Find a supported public seam to obtain correct
context for all variants. Log any API ambiguity and your source-backed solution
early, before building acceptance fixtures.

The watchdog must run without advancing or replacing the test's TestClock and
must not require an absent TestClock under live or excludeTestServices. The
pinned TestClock.withLive assumes an installed TestClock; explicitly provided
TestClock remains a valid environment. Use public Clock/Effect composition to
cover both modes. Fail with a schema-first named TestHang carrying the actual
test name and last observed log line. Race/interrupt the loser and preserve
normal body errors, interruption, finalizers and scope ownership. Account for
concurrent tests so logs or identities cannot bleed between them. Do not change
global timeouts or add retry wrappers.

Record start/end/duration/outcome using Effect.log + annotations and a Logger
layer, enabled only by BEEP_TEST_TRACE=1 or CI. Keep logging decisions and last
log state local to the running test; preserve TestEnv/TestConsole and user logger
behavior. Logging alone never justifies live. Document duration as diagnostic;
P1/P2 timing evidence still comes from the JSON reporter. Handle logs on failure
and watchdog failure, not just success. Preserve defects and interruption
rather than converting every outcome to generic failure.

The complete intended behavior is required; do not ship only a happy-path
effect wrapper, a watchdog helper without real registration integration, or a
surface that omits each/prop/layer/conditional methods because it is easier to
typecheck.

## Meaningful evidence

Prove actual public runner integration on BOTH Bun-native Vitest and Node
Vitest. Use the package test script for the Bun proof; this means bun run test,
not Bun's separate bun test runner. Use a Node Vitest invocation for the other
proof and record the actual runtime executable/version. Run from package cwd;
any checked-in fixtures and compiler examples must use stable module/repository
roots, never assume root process.cwd().

Cover success/failure/defect/interruption, live watchdog with frozen TestClock,
live and excludeTestServices environments, cleanup/loser cancellation, real
resolved timeout and concrete names, trace gating and last-log capture,
concurrency isolation, each/prop, callable/plain and conditional methods, and
named/unnamed/nested layer behavior. Keep tests meaningful; don't register only
or expected-hanging fixtures in the normal suite so they accidentally suppress
or fail unrelated tests. Use isolated fixtures/subprocesses or existing public
test-registration harnesses where the failing-run outcome is the subject.
No broad test weakening, snapshots of implementation shape, or config changes.

Validate compile-time generic/API compatibility as well as runtime behavior.
Run focused tests, direct Effect compiler, changed-file Biome and package docgen.
The orchestrator runs full package-verify @beep/test-utils after source handoff.
Do not run a concurrent broad package audit, root build/check/coverage or scanner
writer. Keep all prior source and graph hashes outside your scope intact.

Record a short design/seam note and proposed file roles EARLY, with pinned
anchors, before large implementation. Ask for a concrete ownership extension
in your report only if needed; do not silently extend scope. After handoff
the orchestrator will review and validate the charters' worked examples too.
