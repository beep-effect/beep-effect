# Ciops current-source preparation

Both existing inventory files were read in full. Compared with frozen commit
662823dd960367046ba7d73dd8fd25d15782865a, only the Effect HttpRouter and Arbitrary
import paths have changed. The current files retain the frozen tests and inputs.
Configured Node and Bun baselines pass with stable source hashes; whole-command
times are 4.346849 and 2.310689 seconds. Resource pressure, load and runtime
versions accompany the reports. These runs are not controlled performance
comparisons.

Scope review must preserve the acquired web-handler disposal and the native
tracked Turtle/journal golden sources. Projection state should remain isolated
from pure schedule tests. Property migrations must retain native generator
constraints, floors 64/64/64/48, every emitted-content predicate, fixed saturated
ledger checks, and the transactional waiter/queue assertions. No source changes
have been made during preparation.

## Scope, assertions and property migration

Scope changes use a five-second-budgeted native filesystem suite and a nested
five-second-budgeted CiOpsProjection layer only for the stateful test. The
health handler retains acquireRelease and dispose; it.effect supplies the case
scope, as verified in the installed adapter's implementation. All sixteen
per-call filesystem provider wrappers are removed. Full package verification
passed after scope changes (audit 6.4 seconds; docgen not configured).

Two invalid episode inputs now use Effect.exit and assertExitFailure. Only
expected Fail payloads are projected to their SchemaError tags; complete cause
reason order, multiplicity, defects and interruptions remain visible. The
initial proposal state uses assertNone. Full package verification passed after
assertion changes (audit 6.0 seconds; docgen not configured).

Four native properties now use it.effect.prop with floors 64/64/64/48. The first
three retain the same PendingRequest array schema and maximum length twelve;
normalizePending moves from the arbitrary map into the callback after policy
acquisition. Pure schedule/emission effects are yielded rather than run through
nested runtimes. The fixed saturated-class case becomes a separate named test.
Full package verification passed after migration (audit 17.5 seconds). Reading
policy inside each callback adds work; final timings must capture that cost.

A syntax-tree comparison confirms all original matcher expressions remain
except the four manual Passed-summary wrappers. The occurs-once oracle now
asserts raw projected cardinality and one occurrence per input nonce before
retaining the original HashSet checks. This addresses the existing inventory's
duplicate-output gap. Its full package verification completed successfully; docgen is not configured.

Flake review retains fixed input times, caller-visible golden sources, joined
fibers and the projection notification wait. No retry or timeout relaxation is
introduced. Runner integration, final timings and ledger reconciliation remain.

## Shared policy and runner

A read-only TestPolicy service now acquires the same decoded tracked policy once
through a five-second-budgeted suite layer. The native filesystem remains in
the layer output for golden reads. All tests yield that service; the nested
stateful projection layer remains limited to its own test. This removes the
per-generated-case parsing introduced during property migration. Package audit
passed after this adjustment in 7.1 seconds.

Both files now use @beep/test-runner. The development dependency uses workspace:^;
two generated TypeScript reference files and Fallow boundaries include it.
The cache projection changes only seven Ciops dependency lists, preserving the
Chalk and Brand lists and all computation identities/configuration. The review
receipt and basis hash identify the combined wave. Cache audit has zero blocking
findings; 1251 unassessed computations are not claimed as qualified. Full runner
package verification passed (audit 12.2 seconds; docgen not configured), and
Fallow boundary checks passed. Matcher parity was rechecked after this change.

## Final local measurements

Final configured Node and Bun runs pass all 19 tests with stable source hashes;
whole-command times are 6.626471 and 2.677500 seconds. The original 18 tests
become 19 because the existing fixed saturated-class assertions now have their
own named case. All four generated floors and original matcher predicates remain.
These shared-workstation measurements do not prove a performance improvement.

Twenty-three resolved baseline rows are removed and one native-filesystem
exception retains a subject-specific reason. All 8001 unrelated baseline records
are preserved byte-for-byte. The exception is not an empty global baseline or
permission to omit global closeout. Scoped ledger attribution follows the
implementation commit, and hosted wave proof remains outstanding.
