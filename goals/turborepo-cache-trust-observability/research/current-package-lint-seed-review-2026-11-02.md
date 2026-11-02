# Current package-lint mutation seed review

Accepted PR #2526 (`3ceb6833db`) moved `noDeprecatedImports` out of each
package's Biome invocation into the root `lint:deprecated-imports` task. The
frozen task source for this comparison is `930758e06b`; its root Biome config
sets that rule to `off`. The reviewed four-task closure contains identity,
types, fc-runs and test-runner package lint; it does not contain that root task.

The dependency-source seed imports a deprecated synthetic export. Its selected
package-lint verdict must therefore be success in this current configuration.
The root-lint-config seed still introduces invalid syntax and must fail. Keep
these expectations independent of observed exits: the new negative control
rejects both a successful syntax seed and a failed dependency-source seed.

Change the local runner, signed runner and signed receipt validator together.
Keep every fresh-only origin check, exact changed path/digests, changed task hash,
same-backend wire join, fresh authority, signed replay/log/archive equality,
source/tool integrity, actual selected-task overlap and full matrix counts.
A successful dependency seed now uploads a real artifact before the source
changes, so the changed producer must miss despite an existing earlier artifact.
The failed syntax seed remains forbidden from uploading. No guard is skipped,
no verdict is inferred from the observed run, and limits remain 20 minutes for
comparison and 10 minutes for owned upload.

The older complete ordinary matrices at source `68834a997e` keep their original
bytes, source binding and validation implementation. Do not rewrite those
receipts or claim they validate the new source. The current ledger contains only
excluded entries; this repair enables no reuse or production signing. Fresh full
stable/canary observations are required before this current-source candidate is
accepted. Reversal reverts the runner/validator/fixture expectation change as one
unit; it does not turn the old failure assumption into a current proof.
