# Producer-object coverage identity review

The current hosted comparison, job `125576027983` in run `41530448013`,
reports only one missing new-file identity: `Cache.workflow.storage.ts`.
Its measured row is 96.11 percent lines, 86.20 statements, 80.43 branches
and 73.07 functions, with 4, 16, 9 and 7 uncovered units respectively.
The file is byte-identical to the source recorded by all six CI producer
artifacts. This is the actual reported row, not a chosen threshold.

Propose that one file identity for review. Preserve every existing file row,
package total, document metadata field, minimum, epsilon, exemption and
follow-up. No existing coverage floor is lowered. Decode and encode with the
existing coverage schemas and artifact formatter. Before and after writing,
removing the single proposed identity must recover the complete previous
document. The canonical reporter explicitly supplies this measured file row
for the reviewed pin; a broad package regeneration would also move unrelated
floors, so it is inappropriate for this repair.

Four additional negative cases bring the affected suites to 94 passing tests
on both Bun and the CI-pinned Node 24 runtime: empty and schema-invalid private
files, an oversized observation refused before issuer/credential access, and
a failed response stream whose private cause is not disclosed. The current
Node measurement is 97.08 percent lines, 88.79 statements, 82.60 branches and
80.76 functions. It exceeds the proposed hosted floors independently.

Keep the production module, byte bounds, post-read identity checks, typed
errors and defensive schema/crypto guards. The remaining unexecuted callbacks
include codec failures after a validated snapshot, invariant re-encoding and
binding checks. No guard is removed or forced through invalid typed fixtures
solely to increase a percentage. Existing revocation, tampered-MAC, wrong-run,
credential-aliasing, transport, timeout, size and in-flight mutation controls
remain part of the complete affected suites.

Local and hosted instrumentation layouts differ. An attempted counter union
was refused and is not used as evidence. The local replay of the full hosted
collector also refused a Labs assignment; it is not a passing hosted result.
The proposed row comes directly from the actual hosted comparison above.
Additional local measurements remain separate, source-bound observations.

The checkpoint records the source digest and exact measured row. Fresh hosted
checks and independent primary review still gate merge. This grants no cache
qualification, signing activation or whole-goal acceptance. Reversal removes
only this newly proposed identity; never replace the document wholesale.


## Accepted-main reconciliation

Accepted #2632 supplies a stronger measured file row: 98.05% lines, 94.82% statements, 93.47% branches and 88.46% functions. The merge preserves its complete baseline bytes and both sets of storage tests. The lower proposal above is historical source-bound evidence and is superseded for the current baseline. The remaining failure-boundary tests and the independent merge-preview regression remain in this PR. No new local verification is claimed; fresh hosted CI is required.
