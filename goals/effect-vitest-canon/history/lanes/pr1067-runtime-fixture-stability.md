# PR #1067 runtime fixture stability

Hosted checks at b86269212e exposed short timer races in the concurrent identity
and tiny-timeout fixtures, plus repeated Vitest startup inside the trace parent.
The runner source remained consistent with the pinned rc.113 adapter. The exact
host scheduling trigger is unproven; these repairs do not claim live-timer
preemption under arbitrary workstation load.

The concurrent fixture uses the existing controlled-clock makeIt seam. It waits
until both registrations have logged and armed, advances alpha to its watchdog
deadline, checks that beta is still active, then advances beta. Names, native
timeouts of 180/240 ms and watchdog budgets of 155/215 ms remain. Exact diagnostic
assertions bind each name to its own budget and last log. A swapped-log negative
control fails the association assertion even though the old broad strings remain.

The trace parent uses one Vitest invocation with four isolated projects. Each
project retains its own CI and trace configuration, fixture path, observed cleanup
output and actual test status. Node and Bun both observe the expected four
configuration pairs; the trace-off case follows enabled cases without inheriting
their settings. All original trace assertions remain. Per-project exitCode views
encode the actual JSON test status; they are not four operating-system process
exits. The complete subprocess report is retained separately. No additional
parent time budget, global concurrency or runtime pool change was introduced.

The tiny-budget fixture retains the native 25 ms input and actual 12.5 ms watchdog
budget. It advances the existing controlled clock only after arming and checks
body finalization. Advancing only 12 ms is an expected negative control: the
TestHang assertion fails because the watchdog has not reached its boundary.
The separate live-watchdog test with a frozen body TestClock and the disabled
timeout tests remain in the full runtime suite. Root's follow-up prompt mistakenly
named a 24 ms budget; the implementation preserved the actual 12.5 ms contract,
and the correction is explicit in the retained evidence.

Both repair steps preserve every pre-existing assertion expression. The final
step preserves 141 parent assertions and 13 fixture assertions and adds one body
finalization assertion. Production instrumentation, property run floors, seeds,
coverage floors, dependency versions and global configuration are unchanged.

## Validation on the final source

- Node 22.22.3: all 52 registrations pass in 83.112 seconds.
- Node 24.20.0: all 52 registrations pass in 75.733 seconds.
- Bun 1.4.2: all 52 registrations pass in 37.640 seconds.
- Each suite records 42 ordinary passes, four expected failures, two skips and
  four todo registrations.
- Full test-utils package verification passes audit and docgen in 49.907 seconds.
- Focused Node 22 and Bun CI-mode cases, compiler and scoped lint pass.
- Root verified all 841 final handoff artifacts, all 40 package source/test inputs
  and 11 runtime/config inputs. Scoped temporary fixtures are removed.

The private evidence is retained under
`~/.cache/beep/effect-vitest-canon/pr1067-resume/tiny-budget-followthrough/`.
The preceding trace/concurrent repair has its own immutable 912-artifact handoff
under `b862-runtime-repair/`. Failed prototypes and negative controls remain
distinct from successful verification.

Final Node 22 scoped coverage with CI=true passes in 86.638 seconds. The normal
coverage ratchet compares the package successfully with unchanged baseline bytes;
L/S/B/F is 96.90/96.27/93.18/93.25. All 51 package/runtime inputs still match the
accepted terminal evidence. Hosted checks on the next published head remain a
separate gate.
