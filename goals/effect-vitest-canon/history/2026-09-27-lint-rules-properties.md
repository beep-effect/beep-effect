# Lint rules property-oracle review

The four native schema-derived properties already migrated upstream remain
unchanged, including all arbitrary inputs, matchers, integer bounds and 50-run
floors. Their historical migration is credited to
`b1aa7e320cde926e7e80a98073ba8b0d517d7c8c`. All four pass 400 runs with seed 20260708.

The in-process compiler-rule test keeps all four original inputs and its exact
aggregate count. It now additionally decodes the report shape and checks the
identities of both reported callee nodes, so structurally identical runtime-input
callees cannot masquerade as the intended static-input reports. A controlled
wrong-node substitution preserves count two but fails the identity oracle.

The registry test now uses the existing shared JSONC decoder and a narrow schema
view of top-level and override plugin arrays. It resolves each actual plugin
entry against the checkout and compares it with the registered rule path. A
controlled comment-only plugin path fails this oracle despite retaining the old
substring witness. The shared schema dependency is declared explicitly, covering
this decoder and the pre-existing codec helper import. Generated dependency
metadata is synchronized. Both controls restore source byte-for-byte.

All 66 cases pass on Node and Bun, with stable source hashes and load/pressure
receipts. Single command observations are 17.151385 and 9.284690 seconds; no
causal speedup is claimed. Full audit (17.8 seconds) and docgen (2.4 seconds) pass.
