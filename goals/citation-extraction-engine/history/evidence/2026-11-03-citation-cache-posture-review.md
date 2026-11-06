# Citation package cache posture review

Reviewer: GPT-6.1-Sol, medium, citation-extraction-engine lane.

Compared the current law-practice server and use-cases manifests and effective
commands with origin/main at 7438cf69c6. This review covers those two package
subjects only. The earlier citation work separated server integration tests from
unit/coverage tasks, selected the Bun Vitest runtime, selected the package test
tsconfig, and added the use-cases portable parity checker. The server ships its
native HTML assets and moves the Bun adapter to runtime dependencies. The Node
worker entry additionally moves the existing Node adapter from development to
runtime dependencies at the same catalog version. The lockfile update records
only this dependency classification.

These are intentional execution/dependency changes for the citation engine.
The baseline should record their actual command and dependency fingerprints.
Existing cache flags, inputs, outputs, environment policy and qualification
scope are retained; no computation gains qualification or reusable producer
trust. The generated writer must reject any change outside the two named
subjects. Unrelated baseline reviews must carry unchanged.

Validation: server quick package lint/check and focused real-worker tests pass;
full corpus and repository checks remain hosted. This is a review of legacy
configuration posture, not evidence of cache equivalence or complete citation
parity. Revert the package changes and regenerate the prior reviewed baseline
to reverse the posture.
