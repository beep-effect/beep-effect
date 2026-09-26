# Provenance existing-inventory preparation

The next independent modeling wave uses the existing three-file Provenance
inventory. Its identity/schema dependencies have landed; it does not depend
on the pending HTML, Markdown, NLP or RDF waves. The sibling lane starts at
main 7581ead6c8. No production or test changes have been made in preparation.

All three current test files were read. Relative to the frozen source snapshot,
only two Arbitrary import paths changed. Preserve the actual SHA digest
fixtures, raw UTF-16/surrogate distinctions, constructor/setter forgery checks,
source identity mutation before asynchronous hashing, exact stale/cross-scope
ordering, sanitized failure messages, and receipt-not-proof assertions.
The mutation stub is case-local and causal; no sleeps or shared mutation should
be introduced. Existing property floors are 50/50/25.

Fresh Node and Bun baselines pass with stable source hashes. Whole command
measurements are 4.080 seconds and 2.965 seconds respectively; reports retain
runtime, load, pressure and process-limit context. No performance claim follows
from comparison with the older frozen run.

Next follow the packet order: ground the installed Crypto layer constructor
and public harness before changing scope ownership, then assertion helpers,
public property registrations, flake review and runner instrumentation. Keep
custom Crypto stubs isolated and preserve their exact subjects and lifetimes.
