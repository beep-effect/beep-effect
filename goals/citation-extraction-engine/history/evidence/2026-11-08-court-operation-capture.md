# Preserve court lookup's installed operation in safety failures

Court lookup already captures the trusted operation and Clock through the existing
Effect timing adapter. Inspection found inconsistent composition: Unicode was
installed as cleaning with a copied extraction deadline, while source-size and
nested-deadline errors hardcoded extract. Shared budget failures also carried the
budget primitive's extraction label. Thus an installed clean/resolve/annotate
lookup could refuse safely but report the wrong operation.

The new operation-label regression fails against the previous implementation
before the fix. The correction passes the captured operation explicitly to the
existing Unicode service, uses it for local source/deadline failures, and reuses
Effect.catchTag with the existing timing.failSafety adapter for shared safety
failures. The lowercase helper retains its existing copied minimum deadline.
No clock, timer, admission or allocation framework is added; no limit, callback,
normalization algorithm, table order, schema, expected court or source value changes.

All eight court lookup tests pass after the fix. They include all 17,156 frozen
exact/prefix and raw native normalization observations (8.59 seconds), table/digest
corruption, exact allocation and captured parent capacity, malformed source storage,
expansion refusal and the prior captured-clock control. New controls cover source
and allocation refusals for clean, extract, resolve and annotate, with a later
caller selecting extract. A second control triggers each installed 997-millisecond
stage deadline using the existing manual Clock while the caller substitutes a
nonfiring Clock and a different operation. Every refusal retains the installed
operation and actual deadline field, without partial output.

Focused command, from packages/law-practice/server:
bunx --bun vitest run test/CitationCourtLookup.test.ts --reporter=json --outputFile=../../../.beep/court-operation-results.json.

Server lint/types, repository-wide lint:oxlint and Fallow new-only pass with zero
introduced findings. Default extraction retains the same effective minimum
execution duration and successful lookup semantics. The prior full 29-example
Bun/Node public replay remains historical proof on 60a888cef31; it was not rerun
wholesale after this narrow safety correction. Its changed CourtLookup dependency
is requalified by the complete independent lookup corpus and operation controls,
and that compositional evidence is attached when refreshing the exact leaf hash.
Hosted exact-head public-engine acceptance remains pending.

No canonical event, source capability, representation law or fidelity question is
promoted by this target safety correction. Totals remain 182 complete canonical
events, zero nonterminal bindings and 15,316 rows without completion proof.
Exhaustive source/donor reconciliation, remaining workflows and retained protocols,
native identity/deployment proof, whole-engine safety/scaling and lifecycle
acceptance remain open.
