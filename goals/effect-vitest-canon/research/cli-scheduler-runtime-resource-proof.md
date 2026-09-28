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
runtime lineage matched 93 of 97 ledger rows; those 93 are marked fixed by
source commit a1de26d035. The other four require separate upstream-history
reconciliation and remain open. Historical provider, property and live-test
judgments still need row-level reconciliation; this proof does not silently
close those rows. The CLI ledger has 3,473 unique schema-valid rows: 1,449 fixed,
12 exceptions and 2,012 open. Full package verification is running for source
a1de26d035; its terminal result is not yet available.
