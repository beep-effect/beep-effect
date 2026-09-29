# Desktop final unit cohort

At source `f6d489870fc17cc070fec0992439feced4b857bf`, the configured Desktop
unit cohort passed on Node and Bun with 241 tests, zero failures and zero skipped
tests in each runtime. Integration tests were explicitly excluded and require
their separate receipts; exclusion is not a passing or skipped integration.

Every file/title pair from the current-before 239-test cohort remains. Two cases
were added: confirmation-subscription cleanup on interruption and HTTP rejection
of missing/wrong bearer tokens before acceptance of the active token. This
registration comparison complements, rather than replaces, the individual
assertion-preservation and behavior-control receipts.

| Runtime | Current-before seconds | Current-after seconds | Tests before / after |
| --- | ---: | ---: | ---: |
| Node 24.20.0 | 13.9464 | 11.5916 | 239 / 241 |
| Bun 1.4.2 | 8.4297 | 6.9285 | 239 / 241 |

Durations measure whole commands and must not be added to overlapping reporter
intervals. Both runtimes used the same package unit selection, with Bun selected
through `bunx --bun`. Source hashes were unchanged during both runs.

These are observed run costs, not a causal speedup estimate. The full Yeet proof
was running concurrently. The after-run one-minute host load changed from 12.81
to 15.78 for Node and 15.78 to 24.93 for Bun. CPU pressure avg10 began at 0.14% and
0.83%, respectively. Baseline runs had different host load, cache history and
source; no numerical load correction or benchmark-confidence claim is made.
Memory and IO pressure, resource limits and runtime versions are retained in
the private per-runtime context receipts.

Final unit execution does not establish full package quality, real Anthropic
availability, native browser geometry, or full goal acceptance.

A subsequent lint repair at `2a732ff497992257fda8a2d534de614f30d796ef`
hoisted three codec compilations in two tests. All five affected cases passed
on both Node and Bun, and full Desktop package audit and docgen passed. The
whole-cohort durations above remain attributed to the earlier source; the
focused rerun does not replace that timing provenance.

At `ed7b494e14fb5b2e5890e1f790276ba9a9d95f63`, the subsequent native
permission-restoration change passed all nine affected integration cases on
each runtime and full Desktop package audit and docgen. This separate
integration proof does not change the unit-cohort timing provenance above.
