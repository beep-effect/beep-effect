# CLI runtime and resource migration proof

Source commit `0a7f1510c38d9eba03c64a1803fc559a5971ebaf` replaces 95 files-command runtime calls with
instrumented Effect tests, including four table-driven registrations. The
native filesystem and HTTP services belong to a public it.layer fixture.
Temporary directories use makeTempDirectoryScoped; cwd acquisition registers
its restoration afterward, so scope finalization restores cwd before deletion.
Each ordinary case receives a fresh console through TestConsole.make and
provideServiceEffect, preserving isolation without rebuilding a resource layer.

Seven anonymous scenario layers own the remaining FilesCommandServiceLive
constructions. Five build that service against the same injected filesystem
objects as before. This matters because the service captures its construction
context: sharing a native instance would bypass the tested faults. Setup runs
in the fixture, while the operation and every assertion remain in the test's
verification Effect. Anonymous harness blocks retain the original test names
and close their scenario scope after the last owned case. Fresh console layers
belong to those harness blocks. The fixture service uses a deterministic key
and concrete PlatformError/FlattenMediaSummary error channels; unexpected
success still fails the existing Effect.flip expectations.

## Preserved behavior and focused evidence

All 469 assertion call trees match the original traversal order, normalizing
only formatting and redundant parentheses. Matcher polarity, payload operands,
error checks, rollback counters and filesystem preservation checks are unchanged.
All 105 file/fullName registrations have identical multiplicities in the four
before/after Node/Bun runs, with zero failures/skips and stable source per run.

| Runtime | Before | After | Tests per run |
| --- | ---: | ---: | ---: |
| Node | 7.226 s | 8.680 s | 105 |
| Bun | 4.823 s | 5.323 s | 105 |

Load averages, pressure, runtime versions and source hashes are recorded. The
before cohort overlapped a full package proof. These observations do not prove
a performance regression or improvement. Actual generated test diagnostics are
empty with exit code zero; Biome and diff checks pass.

Extracted copies of the actual scoped cwd fixture pass controls under both
runtimes for success, typed failure, interruption and acquisition failure while
changing cwd. Every control restores cwd and removes the allocated directory.
Separate controls prove fresh console capture between cases. These controls
support lifecycle behavior; installed-suite evidence is the 105-case execution.

## Detector and ledger

The first runtime-only draft exposed 93 additional wrapper calls and seven
provider findings. They were repaired through fixture ownership rather than
added to the baseline. Final source comparison removes 95 EV001 boundaries and
two EV003 wrapper definitions, with no other finding-group drift and no baseline
anchor edits. The root ratchet passes: 1,217 files, 3,624 findings, zero introduced
and 1,393 resolved. One shorter environment wrapper and the native platform
provenance judgment remain outside this batch and receive no completion credit.

Ninety-three runtime ledger rows match exact occurrences; two have exact
expression lineage after the prior canonical Boolean assertion migration.
Both removed wrapper definitions match exact historical occurrences. Seven
newly visible provider rows are recorded as fixed by the same source commit.
The CLI ledger now contains 1,187 fixed, 7 exception and 2,270 open records
(3,464 total). The earlier 26 property-boundary fixes retain their upstream
provenance in cli-files-property-lineage.md.

Full CLI package verification for source commit 0a7f1510c3 passed: audit
705.1 seconds and docgen 19.6 seconds. Source remained unchanged during the
proof; intervening edits updated packet documentation only. No hosted readiness or goal completion
is claimed. Private receipts use cli-files-runtime, cli-files-resource,
cli-files-scenario, cli-files-assertion-preservation and cli-files-shifted-lineage.
