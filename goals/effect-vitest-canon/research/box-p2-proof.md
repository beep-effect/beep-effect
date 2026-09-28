# Box remediation proof

The standing production authorization covers the reproduced generator defect.
The installed SDK adds `chunkedUploads.getCachedUploadPart`, whose four arguments
contain neither cancellation form. The old renderer nevertheless declares
`signal`; generation succeeds but the strict source check fails with TS6133.
The renderer now derives its callback bindings from the actual SDK parameters,
including an empty parameter list. Existing cancellation-capable methods retain
signal forwarding. The two generated files are regenerated from the installed
SDK, and a new public service test checks all four cache arguments and an absent
cache result. Generation and source, test and script checks pass.

The public `it.layer` registrations now carry explicit 10-second fixture hook
budgets. The live provider registration preserves its existing 30-second hook
budget and credential gate. Three constructor checks use the native scoped
harness. The configuration-failure case keeps acquisition inside its assertion
boundary with the canonical scoped helper, so expected failure cannot escape into
a suite hook. Two per-case readable fixtures also keep local scoped provision.

The original finite event and invalid-payload cases remain. Two new controlled
readables never emit EOF: early take and interruption must close them and remove
readable, end and error listeners. The interrupted fiber is awaited and its
failure is asserted. Both cases fail when readable destruction is disabled in
the production adapter; the control source is restored. The existing fake now
allows an original callback to remove its once wrapper, matching the listener
identity contract. No production stream-cleanup change was necessary.

Six schema laws use separate native property registrations with their original
arbitraries, 25-case floors, exact re-encoding assertions and Equal-or-schema-
equivalence predicate. The BoxError reconstruction and custom upload arbitrary
remain. All six independently inverted laws fail with seed 20260708 and reported
shrinking. All 104 original assertions and 33 static test registrations survive;
two aggregate Passed-tag checks are replaced by the six native registrations.
Original fixture initializers and body deadlines are preserved.

All three test files use the instrumented public runner. Trace-disabled and
trace-enabled deliberate-failure probes pass and are removed. Generated project
references and Fallow edges reflect the single runner development dependency.
The cache review covers 16 owned nodes and updates 11 dependency lists; commands,
configuration, qualification state and unrelated nodes remain unchanged.

Full package verification at the 400-case floor and seed 20260708 passes:
audit 11.9 seconds and docgen 4.6 seconds. A preceding locationless declaration
compiler failure reproduced with both old and new generated sources under Bun;
an explicit Node build and the full canonical retry passed. This is an attributed
runtime-sensitive failure, not evidence of a generated-schema repair. All six
root policy checks pass.

Unit timings contain 31 baseline and 40 final passing tests, zero skips and
stable source hashes: Node 4.270 to 4.221 seconds, Bun 2.217 to 1.667 seconds.
These observations record workstation load and pressure and do not establish a
causal speedup. The integration gate passes without a live token; no live Box
request is claimed. The fresh machine scan has three explicit scoped-provision
judgments. Inventory reconciliation and public timing publication remain pending;
this source proof is not consolidated PR or goal acceptance.
