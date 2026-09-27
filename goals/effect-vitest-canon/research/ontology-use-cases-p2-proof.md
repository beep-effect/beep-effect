# Ontology use-cases canonical test closeout

Source commit: `fd21be26a9`. All 19 saved actions are adjudicated across eight
files. Twelve public layer registrations replace private layer-build/scope
wrappers or add an explicit acquisition timeout. Each has a 30-second acquisition
limit; all original test-body limits remain, including the 120-second browser
bundle and SHACL scenarios.

Two reasoner cases retain the domain-native implementation. Five SPARQL cases
keep separate captured-query state, reset for each execution, and the original
scripted query services. Four validation fixtures retain two real SHACL engine
cases and two case-local scripted SHACL cases. Pure FileStore/TurtleCodec ports
remain pure; the existing export writes map still has one clearing writer.
Nine nested generators exposed by wrapper removal flatten without losing a
yield, returned result or assertion. The import-graph test still bundles through
esbuild with browser conditions and no tree shaking, writes a scoped disk bundle,
and evaluates it through a file URL. Its graph exclusions and public export
checks remain; this is not browser or worker-thread execution.

All 120 original assertions remain, with 32 public helper conversions. Nineteen
native laws preserve their source schemas, codec/equivalence predicates, and
floors of 10 or 25. The sixteen schema-parity names and discard multipliers
(default 100, batch command 10,000, batch result 50,000) remain unchanged.
Session laws keep their separate 100-per-run discard budgets. Two formerly
grouped session laws now register independently, adding one test. Three aggregate
Passed assertions retire. Every one of the nineteen independently inverted
predicates fails with native replay seed 20260708 and a shrunk counterexample.

Full package audit and docgen pass at 400 trials with seed 20260708 (12.9 and 3.4
seconds). Root Oxlint, Sherif, attributed Fallow health/audit, cache-policy and
schema-first checks pass, as does the post-commit changeset check. Test-runner
integration adds nine reviewed dependency edges across fourteen owned cache
nodes without qualification promotion or changes to unrelated nodes.

| Configured suite | Before | After | Outcomes |
| --- | ---: | ---: | --- |
| Node Vitest | 4.772 s | 4.873 s | 60 before, 61 after; zero skipped |
| Bun Vitest | 2.818 s | 1.867 s | 60 before, 61 after; zero skipped |

Both phases preserve stable source hashes. Public contexts record load,
CPU/memory/IO pressure, runtime versions and process limits. The baseline overlaps
an early publisher; after observations overlap package and root-policy checks.
These are contextual observations, not a causal benchmark.

One detector exception retains NodeServices because native filesystem resolution
and module evaluation are the test subjects. MemoryFS would replace that
boundary. Reconciliation preserves 683 unrelated ledger hashes and unrelated
root/census objects byte-for-byte. The saved worklist now contains 21 packages
and 1,082 actions. Final goal-wide proof remains open.
