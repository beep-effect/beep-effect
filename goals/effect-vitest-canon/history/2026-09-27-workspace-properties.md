# Workspace property phase and flake review

Register all 15 existing domain schemas and 12 use-case schemas as separately
named native effect properties. Schema-derived generation, encode/decode
round-trip equivalence, the 10/5 run floors and existing 25/50-run properties
remain. Codec failures now fail through the effect property adapter instead of
collapsing to a Passed tag. All fixed examples and branch-history assertions
are retained. Both changed packages pass audit and docgen.

Property-file runs from package directories pass with 400 runs and seed
20260708 (25 Domain and 18 Use Cases tests). Temporary inverted-equivalence
oracles fail with the selected schema in each test name; original sources are
restored byte-for-byte. These are oracle discrimination controls, not production
mutation tests. The root-directory no-test invocation is excluded from proof.

No resource, timing, polling or retry changes are needed for these pure codec
and table metadata cases. The saved flake inventories contain no findings;
retain those reviews without inventing sleeps, retries or teardown work.
