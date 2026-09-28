# Oxigraph canonical test closeout

Source commit: `1405f989c93eb694f0f292043dde44bce9fd9c69`.

All four saved actions are adjudicated. The custom scoped Layer.build wrapper
and body-level provision become a native fixture with a 30-second startup budget.
Two Boolean helper conversions preserve operands and polarity. All six original
assertions and three registrations remain; production source is unchanged.

The module seam wraps the real Oxigraph module through importOriginal. Counters
observe engine import, store construction and quad population. A snapshot taken
at module evaluation proves no eager loading without depending on test order.
Both original SELECT queries and their exact result/profile/row checks remain.
They construct and populate one store. A genuinely different dataset constructs
a second store and the original query returns zero rows, detecting stale reuse.

Three independent controls disable cache reuse, import the engine eagerly, or
construct a store eagerly. Each passes the original case and fails the new case.
The controls restore exact production and test bytes. Real WASM executes queries
in both the original and strengthened tests; no fake query result is substituted.
The direct Vitest vi import is retained for hoisted module interception.

Full package audit passes in 6.0 seconds and docgen in 2.8 seconds. Oxlint,
Sherif, attributed Fallow health/audit, cache policy and range changeset checks
pass. The runner dependency adds seven owned cache edges across twelve reviewed
nodes without promoting cache qualification. The initial async mock factory
failed the Effect diagnostic; the factory now uses the established importOriginal
promise boundary and the complete package verification passes.

Both runtimes pass all three tests before and after, without skips and with
stable source. Node takes 3.870 seconds before and 3.820 after; Bun takes 1.967
before and 1.316 after. Neither timing phase overlaps this lane's early publisher.
Runtime, load, pressure and process limits are recorded. These single observations
are not causal performance comparisons.

Strict inventory, census and timing schemas are checked. Reconciliation retains
683 unrelated ledger hashes and all unrelated root/census objects byte-for-byte.
Twenty-eight packages and 1,215 saved actions remain. Goal-wide final proof and
acceptance remain open.
