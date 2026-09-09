# P0f runner handoff and focused validation

Status: focused proof accepted; full package integration remains pending.

The runner lane is terminal 0 and joined. Root verified its five final source /
test hashes and the retained Node 24.20.0 and Bun 1.4.2 receipts. Root then ran
the same two suites under the primary proposal's actual Bun 1.4.1 pin, with
Bun 1.4.1 first in the child PATH. That run passed in 37.62 seconds: two files,
28 passing tests, one existing expected failure, two existing skips and four
existing todos. Before/after hashes remain identical. This is focused proof,
not full package verification or a zero-skip claim.

The new public regression protects concurrent same-title/same-callback property
registrations. Existing assertions, fixture modes, watchdog budgets, TestEnv,
logging and modifier behavior remain intact. AST preservation shows no executable
change in either source module; Layer.ts changed only JSDoc and instrumentation
adds one reference-identity comment. The test harness also corrects its inherited
unknown error type and indexed map callback without reducing assertions.

P0F-R1-010 is waived only as a proposed mandatory native-Map replacement. Root
read AGENTS.md:36 and the Effect-first skill's domain-logic collection rule.
The execution-local JavaScript registration table needs reference-key equality.
The exact rc.112 and installed probes show that Effect maps merge distinct empty
object keys; both references pass twelve comparisons, twenty-four total. A proxy
or global reference marker could change those semantics, but adds identity
machinery to replace an existing collection that already satisfies the contract.
The waiver is confined to TestExecutionState.propertyRuns and preserves distinct
registrations, aggregation across trials, per-execution lifetime and concurrency
isolation. No domain-data or global native-collection exemption is granted.

P0F-R1-001's documentation portion is corrected: per-test provideScopedLayer
examples use pure stubs, allocating/effectful fixtures use it.layer, and inner
scopes remain available for assertion-local resources. The helper runtime is
unchanged. The detector portion of R1-001 remains open in its own lane.

The wider private compiler probe still reports 22 inherited harness/fixture
diagnostics; it deliberately compiles the text fixture as TypeScript beyond the
normal package inputs. Source-only and literal-example checks pass. The lane's
before-image probe and final table retain exact attribution. These diagnostics
are not described as a green compiler run. Root will use the actual package
checks to establish integration acceptance and repair any blocking result.

Private receipts: p0f-round1-runner/ and p0f-round1-runner-bun141-root-status.json
under the goal cache. Source/report hashes are retained in the lane handoff and
these receipts. No package-wide command runs while the CLI writer is editing.
