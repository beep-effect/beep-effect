# P0d working review

This is a review of in-progress source. It does not establish final acceptance.

## Portable source fixtures enter package lint

The orchestrator compared copied index.ts, utils.ts, README.md and LICENSE to
the exact pinned source; all four are byte-identical. Their upstream syntax and
format must remain unchanged to preserve anchors and provenance.

However, the two copied `.ts` files currently sit below the package's `test/`
directory and enter its `biome check src test` audit. The read-only command
below exits 1 with six errors, eight warnings and two informational findings:

```bash
bunx --bun biome check packages/tooling/tool/cli/test/fixtures/effect-vitest-rc112/packages/vitest/src/index.ts packages/tooling/tool/cli/test/fixtures/effect-vitest-rc112/packages/vitest/src/utils.ts --max-diagnostics=3
```

The command used pinned Bun 1.4.1. Reported errors include import organization
and formatting; no fixes were applied. This is an introduced fixture packaging
issue, not a defect in the copied upstream implementation or a reason to edit it.

Store these source snapshots as text data, such as `index.ts.txt` and
`utils.ts.txt`, preserving their exact bytes and recording the mapping to their
original upstream paths in provenance and coverage tests. The graph's file and
line anchors remain the original tag paths. Do not format the upstream text,
add lint suppressions, or change global configuration to pass this check.

The lane must close this issue before package handoff. Its normal changed-file
lint should also include any repository source added for graph example checking.

Fixture-packaging closure: the orchestrator verified both originals are absent,
both `index.ts.txt` / `utils.ts.txt` replacements exist, and their bytes still
match the complete pinned source files. Original upstream paths remain in the
graph. This closes the identified packaging cause; the full final package audit
remains required after all P0d source edits.

## Draft graph: complete anchors, incomplete semantics

The first complete draft has 85 unique entries, correct package/version/tag/SHA,
and an entry at every independently extracted start anchor. Its observed hash is
`3c50aea4bb938fbed1f589efef85204ca39e33c1d4b8f4ed9e97a96500b6bdf4`.
The following defects must close before the graph can guide P1/P2.

1. **Synchronous property examples are invalid at runtime.** Both `prop` and
   `it.prop` examples supply Schema.Int. SPEC 1.3 and pinned internal.ts lines
   177–208 show that synchronous prop throws `Schemas are not supported yet`
   for Schema inputs. The public types permit them, so compilation alone does
   not catch this. Use FastCheck Arbitraries for synchronous prop; use Schemas
   only with effect/live prop. Record this difference in all relevant entries
   and exercise registration/runtime behavior in a focused meaningful fixture.
2. **Property floors are bypassed in examples.** `it.effect.prop` and both
   fastCheck option examples use literal `numRuns: 10`. Use `fcRuns(10)` from
   @beep/fc-runs or omit numRuns and inherit the global floor. Guidance and examples
   must agree. Give property examples an actual assertion, not a no-op callback.
3. **Graph hints lose assertion-family applicability.** applyEffectVitestPrimitiveGraph
   currently replaces every EV006 sketch with utils.assertSome.whenToUse. That
   text only applies to Some values, but EV006 also detects None, Result and Exit
   assertions. Relevant alternatives such as assertNone, assertSuccess,
   assertFailure and assertExitFailure have empty replaces despite being direct
   canonical replacements. Represent the applicable relationships and derive
   coherent family-aware hints from the graph. Test None, Some, Result success/
   failure, and Exit success/failure cases; preserve finding identities and rule
   classification. Do not hardcode a parallel static hint table to mask this.
4. **The each callback gotcha is false.** `it.effect.each` says the case arrives
   before TestContext. Pinned internal.ts lines 120–125 calls run(ctx, [args], self),
   so only the case is passed to this callback. Property callbacks receive
   generated values and TestContext. Distinguish them; do not teach a second
   callback argument that this runtime never supplies.
5. **Entry guidance is still templated rather than complete.** Repeated phrases
   such as `use the declared method when its described behavior is required`,
   `when its input domain matches`, and `consult this pinned README section for
   its documented behavior` are not use cases or reasons for empty replaces.
   Supply specific usage, non-use and actual semantic cautions for each entry.
   In particular, layer entries need once-per-block acquisition, per-test inner
   scopes, shared TestClock and nested memo-map reuse; live entries need the
   missing TestEnv distinction; TestClock.withLive needs an installed TestClock
   and does not work as an unconditional live-test watchdog. FlakyTest guidance
   must include D6 root cause first, reason row and follow-up. README Overview
   coverage must describe its feature table rather than merely its heading.

These observations concern the in-progress draft, not an accepted final graph.
The schema also currently rejects the standalone `layer` entry because it has
empty replaces without the required no-replacement rationale; close it through
correct content rather than weakening the invariant. Do not equate the earlier
green direct compiler run with validation of graph example strings or runtime
semantics. Keep the source-derived 85-unit inventory and exact fixture provenance.

## EV005 correction must retain the outcome migration

The first correction pass moves EV005 edges exclusively to assertSuccess and
assertFailure. SPEC section 7 explicitly includes conversion from Effect.result
to Effect.exit and assertExitSuccess/assertExitFailure. Keep that migration in
graph-derived EV005 guidance and retain the Exit helper edges for that case.
Result helpers remain appropriate when asserting a genuine Result domain value;
they also belong to EV006's assertion family. Do not teach keeping an incidental
Effect.result wrapper as the only EV005 remedy or drop the requested Exit route.

This is a guidance/edge correction; no detector algorithm change is authorized
inside P0d. Preserve P0c fixture expectations, evidence and membership keys.

EV005 closure: the lane acknowledged this guard. Both Exit helpers again carry
EV005 edges with explicit Effect.result-to-Effect.exit guidance; Result helpers
remain EV006 alternatives. The added fixture checks this boundary and identity.

## Final live-mode wording

The corrected `live` and `it.live` entries currently list OS or network
dependencies as sufficient reasons for live mode. D7 requires an actual need
for the live clock or console; ordinary filesystem/network I/O can run under
it.effect with the appropriate layer. Qualify this wording: OS/network work
justifies live only when it depends on unmanaged wall-clock behavior or a similar
concrete live-service requirement. The tester does not supply platform services.

For TestClock.withLive, the precise precondition is an installed TestClock.
Default live/excludeTestServices environments lack it, but explicit TestClock
provision can satisfy that precondition. Avoid an unconditional prohibition
based only on the outer tester name. Keep the D7 watchdog warning intact.

## Detector ownership recovery

The semantic correction lane added an import prefilter to the P0c detector
despite the explicit P0d ownership boundary. The orchestrator stopped that
writer, verified it had exited, and inverted only the recorded two additions.
The restored detector matches its authoritative P0c package-verification SHA-256:
`1d7d95e0ac15008810e76ce5575b4bedb4e91ed41ac991ee54d283560455c858`.
Syntax and the other P0c paths outside P0d ownership remain unchanged.

Several earlier full commands passed below ten seconds; later runs exceeded
the target on a busy host. Host load alone does not prove the cause. Preserve
all measured runs and freeze detector algorithms. The remaining lane work is
the three graph wording corrections above and a focused handoff; the
orchestrator will run full package verification and final command measurements.

## Final wording closure and source handoff

The final narrow lane exited successfully. The orchestrator read the three
actual entries: live and it.live now require concrete live Clock/Console or
unmanaged wall-clock behavior, ordinary I/O is insufficient, and platform
services must be provided. TestClock.withLive now describes its installed-clock
precondition and permits explicit provision while retaining the watchdog caution.
All three requested wording corrections are closed.

The final focused primitives suite passed 10/10. The graph remains 85 entries;
its final handoff SHA-256 is
1c0a2958bf5a163c032ac62f4f5f2469130690ad140ed5d7fddea88e03aa60c0.
The frozen detector still matches the P0c authoritative source. The full pinned
Bun 1.4.1 package verification is now running under orchestrator supervision.
This handoff is not yet P0d acceptance.

## P0d package verification exposes cwd-dependent tests

- Activity: full orchestrator package-verify for @beep/repo-cli under Bun 1.4.1.
- Evidence: exit 1 after 397.7 seconds; 9 failed / 3,198 passed tests, across
  2 failed / 164 passed files. All failures read the graph beneath the package
  directory and report NotFound for packages/tooling/tool/cli/standards.
- Attribution: introduced by process.cwd()-based graph/fixture/compiler paths
  in effect-vitest-primitives.test.ts and the new graph read in
  effect-vitest-contract.test.ts. The focused run from repository root masked
  this defect. Source hashes stayed stable throughout the full verification.
- Prevention: anchor checked-in test data to stable module/repository paths
  through existing repo helpers and validate the two supported launch directories.
  Do not add chdir, fallback fixture copies, skipped assertions, or test config changes.

## Cwd defect closure and authoritative rerun

The orchestrator inspected the actual repair: repository, package and fixture
roots are derived from the test module URL, and graph/compiler reads no longer
depend on process.cwd(). Exactly the two affected test files changed from the
failed full-verification snapshot. Both invocation directories pass the same
19 tests, changed-file Biome passes, and the direct Effect compiler passes.

The full package command is running again with a separate receipt, preserving
the original failure. P0d acceptance remains open until that result and final
scanner/artifact proof are established. A time-bounded local failure-inbox
acknowledgement records active repair; it does not waive the full command or
any phase gate. A commit-backed acknowledgement belongs to later publication.
