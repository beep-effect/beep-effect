# Calibration evidence and approval handoff

Synthetic dataset, candidate inventory, execution and replay evidence now exist in
ops/protocol-v1.json, ops/dataset-v1.json, ops/fixture-v1.json and history/.
G2 independent review accepted an insufficient-evidence verdict; see history/G2-REPORT.md. G3 remains not-requested; G4 is excluded. No human
approval or production calibration receipt exists.
Keep concrete run records under history/ with stable references; raw private
inputs and identifying labels belong in an access-controlled evidence store.

## Required bundle

| Artifact | Required contents |
| --- | --- |
| Protocol | ID/version/freeze time, hypothesis/use case, independent labels/objective, minimum sample/coverage and uncertainty rules, metrics and pass/fail criteria, candidate ranges/search method, split rules, seeds and deterministic ordering |
| Dataset manifest | ID/version, scoped access authorization reference, provenance/selection period, org scope, accepted-authority snapshot and temporal coordinates, immutable evidence location, SHA-256 and exact hash encoding, input/usable/excluded counts with reasons, labels and limitations |
| Candidate inventory | Every attempted schema-valid policy plus rejected inputs, canonical policy digest via existing helper, all five fields/units and rationale, tuning history, negative results; no silent default or guessed production values |
| Run ledger | Source SHA, mechanism, protocol/data/policy digests, dependency/runtime versions, command/environment names without secrets, input/output digests, seed, wall time, outcome/failures, split/sample accounting and measurement tolerances |
| Evaluation report | Inert baseline and per-candidate held-out results/strata, uncertainty, useful-fact eviction-risk error against independent labels where available, cutoff/scale/budget sensitivity, byte-pressure scope, leakage review, exclusions, failed candidates and selection rationale |
| Replay proof | Exact replay procedure, independently reproduced result, complete owned projection-directory deletion and rebuild, canonical JSON/text hashes and answer equality at two coordinates, all authority rows unchanged |
| G2 review | Reviewer identity/role and evidence reference, protocol compliance, evidence quality/resolvability, field-by-field justification, supported recommendation or insufficient-evidence verdict, unresolved limitations |
| Approval handoff | Exact selected policy/data/report/protocol hashes and org/mechanism/deployment scope, proposed bounded validity, approver authority/authentication method, revocation owner and rollback drill; initially not-requested, with no signed approval or production receipt |

Hash algorithms and encodings must be named for every artifact. Use the shipped
retentionPolicyDigest for policy binding; do not assume file formatting equals
its canonical digest. Dataset evidence must account for all bytes/records behind
its digest and distinguish repeated query rows from independent source samples.
Nonzero sampleCount alone does not establish adequacy or representativeness.

## Approval separation

A recommendation record is not RetentionCalibration. Never fill approvedBy,
approvedAt, expiresAt or production purpose for an unsigned draft receipt.
Absent approval is represented as absent, with a status and hold reason.

For any later real approval, retain an authenticated human instruction or
approval record referencing the concrete bundle, exact hashes and scope. Record
approval validity, expiry, denial/revocation and supersession append-only.
Evidence changes invalidate the binding and require reevaluation/reapproval.
Never infer approval from silence, elapsed time, this packet's launch, commit
metadata, a merged PR, green CI, a fixture principal or a submitted JSON file.

A deployment-owned registry must independently verify report resolvability,
quality, authenticated approval, bounded/current validity and revocation before
admission. The service's knownAt validity filter is not a wall-clock deployment
safety check. The activation follow-on must test missing/corrupt storage,
unavailable evidence/authentication and revoked/expired approvals as fail-closed,
with rollback to inert. Historical as-of requests cannot bypass revocation.
This packet does not implement or enroll that production registry.
