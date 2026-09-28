# Dock property and immutability proof

The DockSnapshot and AnchoredBox laws now use native `it.prop` with their
original schema-derived generators. Snapshot encoding/decoding still compares
the decoded workspace with the original workspace; the anchored-box law still
uses its original Option codec chain and `Equal.equals`. No independent domain
or failure path was removed. The original snapshot floor is 24; the previously
implicit anchored-box default is now explicit at 100. The existing `@beep/fc-runs`
helper allows environment sweeps to raise either floor and preserve a replay seed.

AST conservation preserves all 76 non-wrapper assertion expressions in the two
files. The property callbacks differ only by removing their redundant `return
true`. The one additional assertion checks immutability against a JSON encoding
captured before invoking the rejected transition. It uses the existing workspace
codec and the original state object. Original rejection and equality assertions
remain. A temporary post-rejection in-place revision mutation fails the new
snapshot oracle while the original alias comparison and rejection assertions
pass. Both control variants were restored.

Full package verification passes audit (7.8 s) and docgen (3.5 s). A 400-run
sweep with seed 20260708 passes all 37 tests across DockEngine and Floating,
with zero failures or skips. Independently inverting each of the two codec laws
produces exactly one failed test with a shrunk input and replay seed. All
negative-control source edits were restored.

Capture-completion/failure evidence, fixed-yield removal, runner instrumentation,
after timings and final inventory reconciliation remain pending. This proof
does not claim the Dock batch or the consolidated goal is complete.
