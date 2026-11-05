# Native controlled cleaner wiring and live registry inspection

The controlled replay now has an explicit unit/hosted partition accounting for
all 51 source scenes exactly once. The existing 40-scene unit replay still
matches 42 runs and 104 exact callback/iterator/hash/equality/dispatch events.
A further unit test uses the actual builtin-function handle as a registry key,
matching its one run and four callback observations without invoking HTML.

The remaining hosted test selects eleven scenes (including the separately
unit-proved function-key scene): actual builtin functions, callable text keys,
lazy/generator/reused-generator traversal, removal from live steps, reentrant
cleaning, native hash/equality dispatch and native resource exhaustion. The
independent host adapter receives no expected outputs. Native process access
is an explicit injected capability; ordinary unit fixtures retain a forbidden
spawner. No environment skip can green the hosted qualification.

Hosted acceptance requires eleven scenes, twelve runs, 59 exact selected target
events, one approved safety divergence and ten spawned/independently confirmed
child exits. The source has 61 selected events: the two callback observations
after the resource-truncated source success are deliberately absent in the
target. The existing approval in ops/html-safety-exception.json authorizes this
resource failure without partial output; no later callback runs. This is not a
new divergence. The resource error must have the exact safety tag/operation/
limit, not an arbitrary failure. Other source outputs and identity relations
remain exact. The native qualification is wired and type-checked, not claimed
passed: it has not run locally and is pending hosted CI.

CleanerRegistry.read adds bounded insertion-order inspection of actual issued
key/value handles and the owner's builtin-function classification. The tuple
schema preserves live identities and is not a persistence or request model.
Inspection uses captured serialization/Clock/work limits, rejects closed
ownership, invokes no hash/equality hooks and emits no partial list on failure.
Tests verify original insertion-key identity after equivalent-key replacement,
actual value ownership, builtin metadata, detached result-list lifetime, work
exhaustion and closed-owner rejection.

Every controlled replay now checks the final ordered registry snapshot against
the sealed source observations. This closes the previously unverified final
snapshot dimension for the 41 locally executed scenes; hosted scenes remain
pending. Complete builtin/parser diagnostics and canonical all-family parity
remain separate obligations.

All five focused suites pass 21 tests in 4.04 seconds. Server source/test type
checking, focused Oxlint and native-runtime checks pass. Canonical schema
catalog/profile writers ran. Native execution stays hosted. No source fixture,
oracle producer, count/deadline ceiling, semantic waiver or completion row was
changed to obtain these results.
