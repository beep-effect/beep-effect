# Contradiction integration fixtures use public layers

The four contradiction QA seed cases now have independent one-test public layer
fixtures. Each fixture retains its original temporary-directory prefix, marker
files, opt-in environment, and service composition. PGlite still uses its fresh
in-process layer and the btree_gist extension; migration still runs before the
test body. The tests retain their serial outer suite and original assertions.

The merged sidecar contract case builds RuntimeTest in its public fixture layer,
with the original scoped ontology workspace and configuration. Its RPC client
stays in test scope and still invokes the complete DesktopRpcs group.

Both suites retain real filesystem adapters: the seed cases exercise file
creation, preservation, and source conflicts, while the contract fixture supplies
a temporary workspace to the production runtime. Memory substitution would
change the boundary under test and is not part of this migration.

The first seed run failed three cases because Layer.provide supplied the fixture
configuration only to layer construction. Layer.provideMerge also exposes that
same provider to the body where the seed operation executes; all five cases then
passed under Node and Bun. No assertion was changed to accommodate the failure.
AST comparison preserves five test titles and 49 assertion call expressions,
including nested assertion expressions.

A temporary runtime probe required four distinct PostgresDrizzle service objects
and verified that all four temporary roots no longer existed after the fixture
suites finalized. All four seed cases passed with the probe; it was then removed.
The two existing EV005 result-outcome entries were reanchored in the baseline and
ledger because moving their containing generators changed the syntax identity.
Their expressions and assertions are preserved, and their open review status is
retained. This batch does not claim those outcome reviews are complete.

Final package verification passed audit and docgen. Schema-first and strict
packet validation passed. The final Effect/Vitest ratchet reported zero new
findings, 214 resolved against the retained baseline, and 4,787 live findings.
The census records the final files. Full hosted proof and final ledger/timing
reconciliation remain separate completion gates.
