# LeJeune workbench P2 proof

Source migration `cacb4ad34a` consumes 54 saved actions in D12 order. It belongs
to the consolidated PR; no production implementation or fixture data changed.

Twenty-two single-test public layer registrations replace repeated platform and
Crypto wrapper provision. Each non-live case owns its own test services, so the
retention cases retain independent TestClock state. Four original live-mode
cases retain that contract through excludeTestServices, with original test body
deadlines unchanged. Five single-store projection cases now acquire their real
PGlite, DuckDB and Oxigraph stores through public layers with a 30-second hook
budget. The intentionally reused-store second-build failure remains distinct
from two fresh-build comparisons. Those two comparisons retain the scoped helper
inside each rebuild invocation: sharing one database would change the subject.

Native filesystem temp directories, symlink publication and durable readback
remain the subject. The claimed/release Deferred handshake, interrupted build,
joined interrupt fiber and successful committed Exit remain. Exact retention
dates, reasons, option payloads, corruption matrices, quote anchors, digests and
byte comparisons are preserved. MemoryFileSystem would replace the publication
behavior under test and is not substituted.

Thirty-four assertion-helper conversions preserve all 118 original assertions
and all 27 static registration titles (28 expanded cases). Three aggregate
Passed checks become native properties: retention authorization codec
round-trip, mutable retention metadata codec round-trip, and exact-empty ledger
codec round-trip. Each retains its original arbitrary, predicate, Result failure
branch and floor of 20. Three independent inverted-predicate controls fail with
native replay seed 20260708 and shrinking, then restore both files exactly.

All three files adopt the shared runner. The new dependency introduces seven
reviewed cache dependency edges across ten owned nodes; commands and unrelated
qualification state remain unchanged. Full package audit passes in 13.9 seconds
with 400 trials and seed 20260708; this lab has no docgen target. Root oxlint,
Sherif, Fallow health/audit, cache policy and schema-first pass. Post-source-commit
changeset-status also passes.

Normal Node and Bun runs each pass all 28 cases, before and after, with zero
skips and stable source hashes. Whole-command observations: Node 10.781 to 12.134
seconds; Bun 9.828 to 10.582 seconds. Recorded load, pressure and limits provide
context for these single observations. They are not causal benchmarks, native
browser QA or live external-provider execution.

The final detector has three justified current exceptions: the two fresh-rebuild
scoped boundaries and native BunServices provenance. Historical live-mode
candidates explicitly retain their live contract. Strict schemas validate the
root inventory, all ledgers, the census and timing summaries. Reconciliation
preserves 683 unrelated ledger hashes and unrelated root/census objects. The
remaining saved queue contains 13 packages and 819 actions. This package proof
does not establish final root proof or hosted merge readiness.
