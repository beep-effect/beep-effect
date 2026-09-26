# Proof-job wave deadline repair

This tooling-only follow-up addresses a hosted flake observed on PRs #1277
and #1279. It is not a complete repo-cli lens audit or package acceptance.

The wave tests used a 60 ms operation deadline for both intentional timeouts
and successful reads of already-persisted state. Coverage instrumentation and
filesystem scheduling could make the latter lose that race. After merging main, positive waits use awaitReturn with O.none() and finish
when the wave or settlement is observed, under the existing 30-second package
Vitest deadline. Negative waits use main's waitTimesOut helper with
timeoutMs: O.some(1_000), driven deterministically by TestClock.adjust. All waits
retain 1 ms polling. No production or global timeout change occurs.

All existing checks remain: pull-request isolation, matching row IDs, live
inbox rows, returned-row persistence, duplicate suppression, head changes,
settled result, and acknowledgement of only the proof-job row.

## Focused evidence

Run from packages/tooling/tool/cli with the existing package configuration:

```sh
node ../../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts test/proof-job.test.ts -t 'job wait wave return'
bun ../../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts test/proof-job.test.ts -t 'job wait wave return'
node ../../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts test/proof-job.test.ts -t 'job wait wave return' --coverage
```

| Runtime | Before | After | Result |
| --- | ---: | ---: | --- |
| Node | 7.90 s | 4.62 s | Four passed in each run |
| Bun | 4.73 s | 2.68 s | Four passed in each run |
| Node with coverage | Not captured | 20.92 s | Four passed |

The name filter excludes the other 81 tests in this file. The uninstrumented
baseline did not reproduce the hosted failure. Durations include startup and
come from a shared workstation under concurrent load; they do not establish
a controlled performance improvement. These timings predate the merge with main.
The four focused Node cases pass again after that merge. The prior full package
proof passed; fresh post-merge package verification is running and must be read
separately from these focused results.

The completed Drizzle full proof also has coverage gaps in Inbox, InboxView,
Remediation, and WatchStream. This repair does not claim to resolve them or
to establish hosted merge readiness. No coverage baseline is changed.
