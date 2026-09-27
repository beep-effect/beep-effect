# Observed codec laws and transport witnesses

Two new native Effect properties draw from the complete existing ObservedCause
and ObservedExit production-schema arbitraries. Each encodes a JSON codec value,
decodes it, and compares the complete re-encoding. Each also encodes JSON text
through a hoisted fromJsonString codec, decodes the text, and compares the entire
re-encoded text. This tests stable canonical wire representations without
requiring decoded Error reference identity. There are no filters, narrowed
arbitraries, discarded counterexamples or custom JSON replacements.

Four fixed cases independently check a complete success payload, a string defect,
an interruption with fiber id 37, and a mixed typed failure/string defect Cause.
They assert the decoded payloads and reason kinds/counts as well as text stability.
The existing failed Cause/Exit examples and original membership laws remain.

The initial full-domain codec and JSON-text pilots each passed their 400-run
fixed-seed test. An initial command ran only the unchanged baseline because its
edit path was relative to the wrong working directory; that result is excluded
from pilot credit. Final full package verification passed audit in 8.9 seconds
and docgen in 3.3 seconds after replacing two nested codec compositions with
equivalent pipe form. All thirteen existing/new laws passed at a 400-run floor
and seed 20260708; the receipt lists their executed names.

The configured Node and Bun suites each passed all eighty-six cases with zero
failures/skips in 6.276 and 3.420 whole-command seconds. Hashes were stable and
load/pressure/limits are recorded. All 192 previous assertion expressions, eleven
previous property registrations and eighty previous case names are preserved.
These finite generated runs are passing evidence, not an exhaustive claim for
all values of Unknown. No production schema or codec changed.

Remaining observability work is the flake review and logger/test-runner pilot,
then inventory reconciliation and full PR proof.
