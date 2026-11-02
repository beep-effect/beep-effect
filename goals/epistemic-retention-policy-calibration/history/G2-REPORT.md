# G2 calibration evidence — insufficient evidence for production

## Decision

Keep production inert. No numerical production policy is selected. Synthetic
mechanical evaluation succeeds, but zero product observations and zero independent
usefulness/must-retain labels cannot justify any of the five policy parameters.
This is an accountable calibration outcome, not activation approval. G2 review
is mechanical evidence review only; G3 is **not-requested**, and G4 is excluded.

## Frozen evidence and replay

- Protocol: [protocol-v1.json](../ops/protocol-v1.json).
- Dataset admission/accounting: [dataset-v1.json](../ops/dataset-v1.json).
- Immutable synthetic inputs and complete candidate inventory:
  [fixture-v1.json](../ops/fixture-v1.json).
- Full canonical output: [calibration-v1.json](results/calibration-v1.json).
- Source/runtime/input/output bindings: [execution-v1.json](execution-v1.json).
- Every attempted run, including superseded and failed work:
  [run-ledger.jsonl](run-ledger.jsonl).
- Independent review and replay: [review](2026-10-28-independent-review.md).
- Per-stratum candidate metrics: [sensitivity-v1.json](sensitivity-v1.json).
- Local package/authority verification: [verification](2026-10-28-verification.md).

Run from repository root after the frozen dependency install:

```sh
bun run packages/epistemic/server/scripts/retention-calibrate.ts goals/epistemic-retention-policy-calibration /path/to/new-offline-bundle.json
```

The output file must not exist; the command refuses to overwrite it. The runner
reads only the frozen synthetic fixture, manifest and protocol. It has no database
configuration or credential path. It rejects unrecognized input, including caller
receipt submissions. All source hashes are SHA-256 over exact file bytes; artifact
hashes cover UTF-8 including the terminal newline. Policy digests use the shipped
retentionPolicyDigest helper, independently cross-checked against canonical JSON.

Final replay output SHA-256:
`245df0b67475dd56133be9e5abb65d043dcdd122252b5f91bbb6c99c50b92e86`.

## Data, splits and exclusions

104 generated source edges are all usable; zero source edges are excluded. The
manifest separately accounts for dispositions, four queries and candidates.
There are 26 disjoint logical identities in each organization/split stratum:
organizations 1 and 2, tuning at known/valid 10000/5000, held-out at 30000/25000
milliseconds. No claim identity or logical key crosses a split. Repeated queries
across 11 candidates do not multiply independent samples: 104 independent source
samples, 104 baseline selected rows, 1,144 evaluated candidate rows.

Each stratum deliberately repeats the same age distribution and payload-size skew.
This is a deterministic mechanical control, not representative sampling and not
held-out product generalization. Disposition is not a usefulness label. Missing
keys are explicit. Separate regression fixtures cover empty/filtered slices,
corrections, temporal upper bounds, disposition timestamp/ID ties, unresolved,
rejected, superseded and non-claim endpoints; they add no product samples.

## Results and sensitivity

The inert baseline classifies all 26 rows in each stratum as unclassified, with
no decay or pressure. Every stratum measures 27,212 canonical fact-payload UTF-8
bytes. That is selected payload volume, not memory usage, database size, model
tokens, total organization storage, or actual savings.

All 11 schema-valid candidates were evaluated in all four strata. Five malformed
policies were retained as rejected inputs (20 per-stratum rejection records).
No candidate was dropped because its outcome was unfavorable. The independent
oracle checked all 44 evaluations and all policy digests, with maximum decay
absolute error zero against the pre-registered 1e-12 tolerance.

| Variant | Hot | Warm | Cold | Evictable | Payload/budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| Central | 5 | 8 | 8 | 5 | 106.296875 |
| Hot cutoff -10% | 3 | 10 | 8 | 5 | 106.296875 |
| Hot cutoff +10% | 8 | 5 | 8 | 5 | 106.296875 |
| Warm cutoff -10% | 5 | 6 | 10 | 5 | 106.296875 |
| Warm cutoff +10% | 5 | 11 | 5 | 5 | 106.296875 |
| Cold cutoff -10% | 5 | 8 | 6 | 7 | 106.296875 |
| Cold cutoff +10% | 5 | 8 | 11 | 2 | 106.296875 |
| Decay scale -10% | 5 | 8 | 8 | 5 | 106.296875 |
| Decay scale +10% | 5 | 8 | 8 | 5 | 106.296875 |
| Budget -10%, rounded 230 | 5 | 8 | 8 | 5 | 118.31304347826087 |
| Budget +10%, rounded 282 | 5 | 8 | 8 | 5 | 96.49645390070921 |

The table applies separately to each of the four synthetic strata. At age 500,
decay is 0.5 centrally, 0.47368421052631576 at scale 450, and 0.5238095238095238 at
scale 550. Scale/budget changes leave age tiers unchanged. The budget variants use
nearest-integer rounding of the pre-registered nominal changes; the input values
were frozen before evaluation and never retuned.

There is no empirical useful-fact eviction error estimate in any stratum: no
independent labels exist. The full [0,1] risk interval represents ignorance, not
a statistical confidence interval. Exact deterministic replay supplies no estimate
of uncertainty on a real workload. No claim of answer quality is supported.

## Field-by-field decision

| Field | Mechanical evidence | Product decision / missing evidence |
| --- | --- | --- |
| hotThroughMillis | Inclusive cutoff and +/-10% sensitivity verified | Unresolved: authorized workload latency/reuse objective and independent labels |
| warmThroughMillis | Ordered inclusive cutoff and sensitivity verified | Unresolved: independent usefulness beyond hot period, temporal holdout |
| coldThroughMillis | Advisory-evictable boundary and sensitivity verified | Unresolved: must-retain error tolerance and sufficiently powered labelled holdout |
| decayScaleMillis | Rational retention-v1 decay and scale sensitivity verified | Unresolved: independent objective that rewards a particular decay profile |
| payloadBudgetBytes | Canonical selected-payload bytes and ratio verified | Unresolved: authorized workload scope and measured capacity/quality tradeoff |

All artificial values are control coordinates. The objective does not prescribe
minimum real-world sample sizes or uncertainty tolerances absent a product use
case. A future protocol must fix those before new tuning/held-out evaluation.

## Authority, replay and admission isolation

The native runner replays exact bytes after full owned-output-directory deletion;
an independent session reproduced the same bytes. The migrated PGlite authority
suite also deletes the complete projection directory, rebuilds canonical JSON/text
and answers at both coordinates, and compares all authoritative edge/disposition
rows. No source authority changes. The actual standalone report CLI and registry
port/composition remain unchanged and inert.

Negative controls are layered and must not be overstated:

| Layer | Proven | Not claimed |
| --- | --- | --- |
| Receipt schema | Malformed policy/dataset digests, wrong mechanism, empty report, zero samples, non-user principal, invalid time/purpose/org rejected | Authentication, evidence resolution or quality |
| Existing service | Synthetic purpose, wrong policy/org, future and expired receipt remain inert | Wall-clock revocation or deployment approval |
| Offline preflight | All receipt submissions refused, including complete schema-valid untrusted fixture receipt and claims of revoked/historical, missing-evidence or unauthenticated approval | Ten independent semantic registry validators |
| Actual CLI/inert registry | Candidate/request data cannot enroll membership | A production registry implementation |

The complete receipt used in the negative test is explicitly untrusted synthetic
test data, not a signed human approval or trusted production receipt. The public
evidence bundle contains no approvedBy/approvedAt/expiresAt draft receipt.
A revoked-status submission cannot be revived with historical knownAt because
this entrypoint rejects the receipt channel entirely. Future G4 must test real
revocation, authentication, current wall-clock validity, resolvability and rollback.

## Approval handoff and holds

No selected policy digest, production organization, deployment, approval principal,
approval time or validity period is proposed. The dataset/report/protocol hashes
bind synthetic evidence only. G3 remains not-requested; no approval request is
appropriate on this evidence. G4 remains a separately authorized follow-on.

To reopen production calibration: obtain explicit dataset access scope and product
objective, freeze independent labels/metrics/error tolerance/sample requirements,
evaluate fresh disjoint held-out product evidence, and review the exact bundle.
Only afterward may a separate authenticated human approval bind exact policy,
dataset, organization, mechanism, deployment, bounded validity, revocation owner
and rollback plan. Deployment needs separate authorization and a tested trusted
registry. Merging this calibration delivery supplies neither approval nor activation.

## Delivery state

This report does not declare goal completion. Exact-head hosted readiness, reviews,
review window, merge, completion receipt and execution-lane retirement remain
required. Lifecycle stays operative until those delivery facts are verified.
