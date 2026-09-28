# Shared-domain assertion checkpoint

Replaced 104 Boolean/None expectations with the installed canonical helpers:
64 assertTrue, 30 assertFalse and 10 assertNone. Original predicate operands,
schema-declared equivalence functions and assertion labels remain intact. Nine
calls use equivalent pipe forms required by the Effect diagnostics. Removed
three imports made unused by the migration.

The nine-file token comparison permits only those recorded replacements and
import changes. All remaining body tokens match the preceding scope checkpoint,
including test names, property domains, floors, deadlines and independent
expected values. StaticProbes is unchanged. The unknown-valued negative
Annotated equivalence probe retains its original toBe(false): assertFalse
requires a Boolean and no unsafe cast or coercion is introduced.

Package audit and docgen pass in 6.6 and 3.9 seconds. Configured Node and Bun
both pass all 62 cases with stable source hashes, in 3.771 and 1.617 seconds.
Receipts include workstation load and pressure; these are unnormalized timings.
The targeted residual scan finds only the explained unknown-valued false probe.
Property, flake, runner and final inventory reconciliation work remain.
