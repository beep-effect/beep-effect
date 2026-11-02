# Reviewed storage input after accepted coverage and input exclusions

PR #2611 integrates accepted main `930758e06bf4`, including coverage repair
#2616, the reviewed input exclusions from #2575, and the GitHub resource #2600.
The conflicted baseline starts from the exact accepted-main bytes, retaining
those approved settings and all subject reviews.

The merged root Turbo and policy fingerprint each differ from accepted main
by exactly the existing `Cache.workflow.storage.ts` quality-seal input. No
accepted input exclusion is removed or changed. Re-acknowledge this additional
implementation dependency through the canonical compare-and-swap writer for
root subject `//` only. Keep the existing four-task scope, current runtime
profile/epoch and qualification ledger; grant no task qualification.

Require exactly the quality-seal node and the `turbo.json` source digest to
change relative to the accepted-main baseline. Preserve every non-root review,
all global configuration, all other nodes and source hashes, and the complete
qualification ledger. This is a source-input acknowledgment, not deployment,
signing activation, proof replacement or renewed historical native evidence.

Reverse through a newly reviewed compare-and-swap request against the then-live
baseline, after reverting the extra storage dependency; never overwrite newer
reviews or restore an older baseline wholesale.
