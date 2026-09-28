# AI metrics instrumented runner and clock isolation

All 28 test files obtain test registrations from `@beep/test-runner`; assertions
and peer utilities continue to use `@effect/vitest`. The workspace development
dependency, lockfile, two generated TypeScript references and generated Fallow
boundaries agree. The accompanying cache review records exactly eight new
runner dependency edges, preserving commands, configuration and qualification.

The installed Effect Vitest layer harness caches its TestEnv with the suite
context. A per-test scope therefore does not imply a per-test TestClock. The
OTLP retry case advances time by two seconds; it now owns a nested TestClock
layer while inheriting the platform adapters. Its original body, retry deadline,
sender calls and assertions remain intact.

A differential control places parent-clock witnesses before and after the real
OTLP case. The isolated version passes all three cases and leaves the parent
clock at zero. Removing only the nested clock layer passes the first two cases
but fails the final witness with a parent clock of 2,000 ms. Probe registrations
and the old variant were restored after the experiment.

The final package verification passes audit (13.8 s) and docgen (4.7 s). Root
Oxlint passes. The AST conservation audit preserves all 1,242 assertion
expressions, registrations, temporary-directory helpers and 68 dynamic service
provisions across 28 files. Earlier runner checks also pass cache policy,
Sherif and Fallow health/audit; existing cache source-digest review notices remain.
Owned inventory adjudication and final Node/Bun timing are separate remaining
steps, so these results do not claim package or goal closure.
