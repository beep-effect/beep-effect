# Epistemic Retention Policy Calibration Spec

## Objective and authority

Produce a reproducible offline evaluation of the five shipped retention policy
parameters, an evidence-backed recommendation (or insufficient-evidence verdict),
and a reviewable approval handoff. This goal does not activate production.

Source hierarchy: user request of 2026-10-28; repo instructions and architecture;
merged report contracts; this SPEC; PLAN; GOAL; supporting evidence.
The user's explicit approval requirement overrides any broader autonomy default.

Baseline is merged PR #2322 at
`732e11fd6dc417e5954b22fbbd856a026299ea50`. Accepted Postgres bitemporal
records remain sole durable authority. The report is disposable, deterministic,
read-only, scoped by organization/logical keys and valid/known as-of coordinates.
The default registry remains `RetentionCalibrationRegistry.inert`.

## Scope and target surfaces

- Offline calibration protocol, versioned input manifests, native evaluation
  tooling, fixture controls, candidate policies and reproducible evidence.
- Existing epistemic domain/use-cases/server retention contracts and tests only
  as needed for offline evaluation; select placement after source discovery.
  Do not bootstrap a workspace package except through the repo generator.
- Evidence inventory, parameter rationale, approval handoff and activation
  readiness checklist. Production registry implementation/enrollment is excluded.

No authority writes/expiry/deletion, new migrations, production composition
changes, background rollout, real eviction, external graph authority,
operator-memory coupling, RRF weights/integration or donor code/constants.
No media/corpus/private product access is implied by this packet. No paid
compute, new endpoint or quota purchase is authorized.

## Calibration protocol

Freeze a versioned protocol before tuning. Record intended product use and which
independently measured outcome makes a tier or decay value useful. The shipped
mechanism observes recorded assertion age; it has no intrinsic usage, relevance,
reinforcement, confidence or salience signal. If justified labels or authorized
workload observations do not exist, say that usefulness cannot be established.
Do not grade a candidate solely by agreement with its own tier cutoffs.

Dataset manifest must account for provenance, authorization, organization scope,
source snapshot, all supplied rows and exclusions, nonzero usable sample count,
canonicalization and SHA-256 digest. Keep raw private facts and credentials out
of this public repo. Use private access-controlled evidence references plus
sanitized aggregates/digests when product data is authorized. A dataset digest
is not permission to publish its underlying data.

Separate tuning and held-out evaluation by time and logical identity to avoid
retroactive/known-time leakage; document tenant stratification and limitations.
Include missing keys, unresolved/rejected/superseded claims, non-claim endpoints,
empty slices, corrections, cutoff boundaries, timestamp/ID ties and payload-size
skew. Distinguish unique source records, selected edges and repeated query rows;
query repetition must not inflate independent sample counts.

Pre-register candidate ranges, search method, metrics, decision rules, minimum
coverage and uncertainty limits before viewing held-out outcomes. Values must
be justified by the authorized use case; this packet prescribes no numerical
production defaults. Changes after evaluation require a new protocol version
and fresh held-out evidence, retaining old results.

Compare the no-policy/inert baseline and every tested candidate. Report held-out
coverage, tier distribution, age/decay behavior, canonical payload bytes and
budget ratios; include per-stratum uncertainty and errors for independently
labelled must-retain or useful facts that would be advisory evictable. If no
independent labels exist, restrict claims to mechanical/descriptive validity.
Measure sensitivity around every cutoff, scale and budget, and retain failures.
Explain why each of hotThroughMillis, warmThroughMillis, coldThroughMillis,
decayScaleMillis and payloadBudgetBytes is supportable or unresolved.

Use the existing retention-v1 rational decay and inclusive tier cutoffs; a change
to mechanism is a separately versioned contract decision requiring renewed
calibration. Budget measures selected canonical fact-payload UTF-8 bytes. It is
not RAM, database size, model tokens or total org storage; query/filter selection
changes its denominator context. Do not claim actual memory savings or semantic
answer quality from this diagnostic alone.

## Evidence and activation gates

The detailed bundle contract is [ops/EVIDENCE.md](ops/EVIDENCE.md).

| Gate | Required evidence | Result / permitted action |
| --- | --- | --- |
| G0 Data admission | Scoped access authorization, provenance and immutable input accounting | Offline use of only that dataset; synthetic runs remain harness proof |
| G1 Protocol freeze | Versioned objective, splits, labels, candidate method and acceptance rules | Reproducible candidate evaluation |
| G2 Calibration review | Complete replayable report, exact hashes, nonzero samples, held-out results, uncertainty and review disposition | Evidence-backed recommendation or insufficient-evidence verdict; no production authority |
| G3 Explicit human approval | Authenticated approval reference binding accepted G2 evidence, exact policy/dataset digests, org, retention-v1, deployment, bounded validity, revocation and rollback | Approval handoff only; no enrollment in this goal |
| G4 Deployment admission | Separately authorized follow-on; tested trusted registry storage, authentication, admission, revocation, expiry, rollback and fail-closed behavior | Only then may a deployment compose approved registry membership |

This goal may finish at G2 with G3/G4 absent. Keep approval state explicitly
`not-requested`, `pending`, `approved`, `denied` or `revoked` in the evidence
inventory, recording authentic evidence for every transition; do not populate
approvedBy or approval timestamps from an agent identity, fabricated principal,
commit author, CI success or schema decode. An approval request must present the
concrete G2 bundle, exact scope, consequences and rollback; broad authorization
to run this goal, publish or merge never substitutes for G3.

The existing RetentionCalibration schema binds policyDigest, orgId,
mechanism=retention-v1, datasetDigest, evaluationReport, positive sampleCount,
approvedBy, approvedAt, expiresAt and purpose. Reuse it; document any needed
extension rather than invent a parallel production receipt. Its fields are
necessary but do not authenticate approval, authorize data access or prove
quality. Report admission checks knownAt against receipt validity; deployment
admission must additionally enforce current revocation/authorization and wall
clock validity. A historical as-of query must not resurrect revoked approval.
Synthetic-purpose receipts remain inadmissible in the shipped service. Offline
analysis must use an isolated evaluation seam; never mark a synthetic receipt
production merely to exercise classification or replace the production registry.

## Acceptance criteria

- [x] Baseline source/digest inventory and source drift decisions are recorded.
- [x] G0/G1 protocol, authorized input accounting and splits are frozen before
      tuning; absent real data or independent labels is explicit.
- [x] Reproducible offline harness evaluates all five parameters against inert
      baseline with held-out metrics, sensitivity and retained negative results.
- [x] Hashes, sample accounting, versions, commands, tolerances and private
      evidence references suffice to independently replay the recommendation.
- [x] Evidence supports each recommended value, or a reasoned insufficient-
      evidence verdict names unresolved fields and required next evidence.
- [x] Full output deletion/rebuild yields identical canonical bytes and answers
      at both temporal coordinates; all authority rows remain unchanged.
- [x] Negative controls cover malformed/unordered policy, wrong digest/org/
      mechanism, synthetic, self-submitted, future, expired, revoked, missing
      evidence and unauthenticated approvals; none can enroll production.
      Cases outside the existing service are validated in offline preflight,
      without claiming a production registry has been implemented.
- [x] Actual CLI and production composition stay inert, request-supplied data
      never creates trusted membership, and no production activation occurs.
- [x] G2 review verdict and G3/G4 status/holds are explicit; approval-ready does
      not imply human-approved. Activation remains a separate authorized step.
- [ ] Scoped audits/docgen/coverage and exact-head hosted checks pass, review
      threads/window clear, Yeet merge and completion evidence are retained,
      reflection and packet state synchronized, and execution lane retired.

An insufficient-evidence result must still include the working offline harness,
accounted fixture controls, complete attempted-run ledger, reproducible results
and G2 review. Missing required execution work is not a negative-result waiver.

## Verification matrix

| Check | Evidence | Required result |
| --- | --- | --- |
| Packet | manifest, references, launcher <=4000 chars, whitespace, reflection lint | Valid and synchronized |
| Policy/contracts | schema decode + invalid inputs, exact canonical policy digest | No imported defaults or bypass |
| Evaluation | frozen protocol, immutable inputs, replay command + run ledger | Independently repeatable results, honest uncertainty |
| Authority isolation | migrated fixture, two temporal coordinates, row comparisons | No authority changes; deterministic full rebuild |
| Activation isolation | real CLI inert composition + offline negative preflight cases | No trusted production membership or deployment change |
| Changed packages | quality package-verify for each touched package plus focused coverage | Required scoped gates pass, no baseline weakened |
| Delivery | Yeet exact-head verdict, hosted checks, review/window, merge receipt | Merged calibration artifacts; production still gated |

## Decisions and stop conditions

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-28 | Author paused packet only; keep predecessor completed-retained | User requested preparation | Explicit launch resumes calibration |
| 2026-10-28 | Calibration closes independently of activation | Evidence and explicit approval are separate requirements | New explicitly approved activation packet |
| 2026-10-28 | No numerical defaults; fixture proof is not product evidence | Baseline shipped no measured product calibration | Authorized representative data and frozen protocol |
| 2026-10-28 | Reuse retention-v1 and inert CLI | Preserve merged baseline and avoid synthetic admission | Versioned mechanism decision with renewed evidence |

Stop the affected path if access is unauthorized, evidence cannot be resolved,
policy would activate without G2/G3/G4, authority would change, or scope would
cross into RRF/operator memory/donor code. Record holds and continue independent
offline work. Money needs explicit authorization. Preserve private data and all
unrelated work. There are no approved exceptions.

## Execution decisions — 2026-10-28

- Launch authorization resumes the packet, but authorizes generated fixtures only.
  No private/product access exists. Reversal: discard disposable outputs; keep production inert.
- Reuse retention-v1 arithmetic in domain behavior and emit a distinct offline
  evaluation schema. Report admission and production composition are unchanged.
  Reversal: remove evaluator/runner and inline the identical arithmetic again.
- Freeze protocol-v1 and fixture-v1 before tuning; nearest-integer rounding explains
  the already frozen 230/282 budget controls. No fixture values were changed after evaluation.
- Independent review required executable split/candidate coverage checks and retention
  of typed failures. These enforcement repairs preserve the frozen design and inputs.
- Retain frozen bytes and resolve the scanner false positives through a separate
  reviewed prerequisite PR: only the 104 synthetic identities in three exact
  evidence files may be excluded from generic-api-key matches. Unknown values,
  other fields/files and other detectors remain enforced. Reversal: revert that
  narrow scanner entry; no runtime or production behavior is involved.
- While prerequisite PR #2354 completes its review window, prepare the calibration
  commit on its local branch under the unpublished dependent-lane workflow. Do not
  publish the dependent branch before the prerequisite merges; replay only the
  calibration commit onto the merged main afterward. This saves the long commit
  scan from serializing with the review wait. Recovery: retained staged patch and
  named stash; no existing remote branch is rebased or force-pushed.
- 2026-10-29: Shared tier aggregation and separated input/coverage checks preserve
  the accepted frozen output. Restore the complete matching-policy receipt test
  beside generated controls. Reversal: revert the refactor while retaining both
  receipt rejection controls; do not relax admission.
- 2026-10-29: Record one independently reviewed EV010 exception for the native
  filesystem shared with a separate Bun executable. The test is an executable
  integration/rebuild proof; replacing one side with memory changes its subject.
  Owner and exit conditions are in the exact inventory entry. Reversal: remove
  the exception when detection or a shared filesystem contract makes it obsolete.
