# NLP generated operation laws and Effect property bodies

Composable retains all fixed examples and adds six public Effect properties:
functor identity/composition, left/right identity, associativity, and traverse.
Each has fcRuns(100), generated production-domain strings or string arrays,
and explicit empty-input checks. Left identity additionally checks the actual
String identity operation before len, while retaining the original len/inc
comparison. Existing input/output schema metadata remains unchanged.

Eight existing round-trip properties now use it.effect.prop. Their 38 internal
Effect.runSync calls are yielded within the property fiber. An AST comparison
checks the exact transformation against saved pre-edit sources, preserving
inputs, assertions, comparators, options, and other code. The Handoff codec
sequence is flattened from a nested generator without changing effect order.

Composable package verification passed (audit 8.9 seconds, docgen 4.5 seconds).
The combined final package verification passed (audit 9.4 seconds, docgen
4.6 seconds). Initial compiler diagnostics required pipe-style schema generation
and flattening the nested generator; both were repaired without suppressions.

The ten existing flake-lens no-findings rows were reread against the current
scope. The test tree has no sleeps, timers, clock reads or independent random
source; the inherited PatternCore discard budget remains unchanged. New laws
use awaited Effects and case-local values. Runner instrumentation, two remaining
native test boundaries, final ledger reconciliation, and final timings remain.
