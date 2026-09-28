# Scheduler runtime and resource migration

The scheduler suite replaces 93 runPromise boundaries and the capacity
property's runSync/checkEffect boundary with public it.effect and
it.effect.prop registrations. The property retains its finite input domain,
all capacity assertions and its existing fcRuns budget. Independent controls
on Node and Bun confirm that assertion failures propagate through the public
property runner, reporting counterexample zero for an intentionally invalid
assertion. The prior outer Passed-status assertion is the only excluded tree
in the 521-tree assertion conservation audit.

One serial it.layer fixture owns the existing platform and command services.
Seven nested native fixtures preserve their original Crypto/MemoryStats service
choices. Every fixture has an explicit five-second hook timeout. The 99
withAdmissionTempRoot uses now acquire a scoped temporary root and provide the
same per-case runtime directory, MemoryStats value and run-scope configuration.
Refs and overrides remain local. Extracting the actual temporary-root constructor
proves native cleanup after success, failure and interruption on Node and Bun.

The former runPromise cases retain live time where native admission, journal,
reap, command or retry operations require it. Explicit deterministic-time cases
retain their original advances and deadlines. All five cases that mutate the
clock now own nested TestClock.layer fixtures. Actual-suite probes observe each
clock as distinct and initially zero, and check the parent before and after
all original tests. Both runtimes pass 135/135 cases including those two probes.
The initial probe failed with parent time 1000 ms because a setTime-only case
had been missed; its isolation repair makes that same witness pass. The probes
were removed after validation. Five EV015 judgment rows are recorded as reasoned
exceptions with this evidence, without adding open baseline findings.

The first applied draft failed collection because it.live is unavailable inside
a layer callback. The repaired registrations use it.effect with live time around
the original operation. A later diagnostic run was stopped after source review
identified missing transitive journal retry clocks. Those failed/interrupted
runs are archived separately. The original 133-case suite subsequently passed
on both runtimes, with identical registration multiplicities and no skipped
cases. Final uninstrumented timings are 21.501 seconds on Node and 18.694 on
Bun, compared with 23.258 and 19.603 before. All four runs preserve the same
133 full test names and multiplicities, with stable source hashes. Workstation
load and pressure are recorded; these figures are not a causal speed claim.

The root ratchet passes across 1,217 files with 3,355 live findings, zero
introduced and 1,667 resolved. The batch removes 115 prior live findings and
adds five evidenced clock judgments, a net reduction of 110. Full CLI package
verification remains pending.

Native filesystem decisions, withProcessPath and the existing retry-loop
judgment remain open. The disappearance of a wrapper detector row after moving
registrations inside the fixture does not prove that helper canonical. Historical
runtime lineage matched 93 rows to source commit a1de26d035. All 19 remaining
runtime/provider/property/live-test rows now have exact historical line/evidence
matches. Thirteen correspond to this batch. Six were already fixed upstream:

- Journal property runSync/checkEffect: b1aa7e320c, PR #1200.
- Same-checkout contention and busy-origin tests: 678cf4198, PR #1146.
- Live scope telemetry test: 5201b02fe5, PR #1268.
- Scope-reap test expanded to scope/service table cases: 8a99d4aac9, PR #1143.

The complete public harness registrations from those upstream commits match the
pre-batch source after whitespace normalization. The scope-reap diff retains
all original assertions and adds the service-unit case. These are verified
upstream closures, not work attributed to the current migration.

Eight additional pre-batch provider/live-test findings are recorded as fixed,
covering the seven extra native providers and the table-driven live case. No
historical scheduler runtime, provider, property or live-test row remains open.
The CLI ledger has 3,481 unique schema-valid rows: 1,476 fixed, 12 exceptions
and 1,993 open. Full package verification is running for source a1de26d035;
its terminal result is not yet available.
