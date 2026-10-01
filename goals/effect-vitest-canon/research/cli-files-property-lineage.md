# Files-command property lineage reconciliation

Twenty-six historical CLI EV001 rows refer to the schema round-trip property's
nested runSync calls. They were already migrated upstream in
`b1aa7e320cde926e7e80a98073ba8b0d517d7c8c`, before the current runtime-boundary
batch. Every historical evidence string matches one unique original expression
in that commit's parent. Its migrated property matches the current source after
whitespace normalization. These are proven prior fixes, not inferred from
absence in today's detector.

The migration uses it.effect.prop with the same nine arbitrary inputs and
fcRuns(25), yielding each codec operation and preserving the round-trip
comparisons. Commit ed7b494e14 subsequently selected the instrumented test
runner import. No test source changes are made by this reconciliation.

The current files-command suite passes 105 cases on Node (7.226 seconds) and
Bun (4.823 seconds), with zero failures/skips and stable source during each run.
A full CLI proof ran concurrently; load/pressure receipts are retained, and the
durations are not a causal performance comparison. The preceding full package
proof covers this unchanged property; a fresh full CLI proof is in progress.

The CLI ledger contains 1,083 fixed, 7 exception and 2,367 open records after
this reconciliation. Ninety-five live files-command runtime boundaries remain;
their prepared draft is not applied and receives no completion credit here.
Private receipts: cli-files-property-lineage.json, cli-files-runtime-before-*,
and cli-runtime-top-four-audit.json.
