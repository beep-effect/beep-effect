---
goal: agent-observability-foundation
agent: codex
date: 2026-11-02
trigger: closeout
confidence: high
findings:
  - category: tooling-friction
    confidence: high
    instruction: "Read readiness separately from a successful monitor exit that observed an external merge."
    explanation: "The PR #2578 observer ended after merge with exit zero and readiness false. The canonical writer verified fifteen required contexts but returned unknown for the missing readiness verdict. Original records remain unchanged."
  - category: tooling-friction
    confidence: high
    instruction: "Read check annotations when a failed runner has no completed step result or downloadable log."
    explanation: "The lint-policy job's annotation established runner loss. Its failed state did not establish a lint diagnostic. After external merge the canonical retry correctly refused no-open-pull-request."
  - category: goal-critique
    confidence: high
    instruction: "Advance a reviewable draft while resolving final merge ownership."
    explanation: "Repeated external merges bypassed the documented readiness hold. Draft preparation can preserve progress while GitHub blocks ordinary merging. The ready transition and normal review window remain separate gates; the draft is not achievement."
  - category: implementation-improvement
    confidence: high
    instruction: "Publish a source applicability comparison without relabeling historical executions."
    explanation: "The new selected-input comparison matches the reviewed manifest, test and two-helper deltas. Current hosted execution separately passes all 51 HarnessLedger tests. The original 870/40/73/44 executions and backend routes retain their own scope."
todos:
  - Distinguish observed-merged from pre-merge-ready in durable job summaries.
  - Make merge ownership explicit before a final draft is made ready.
  - Reuse the authoritative observer and record API read failures as unknown observations.
---

# Reflection — agent-observability-foundation (2026-11-02, Codex)

## Summary

This is prospective closeout evidence while execution remains active. The
foundation source and scoped synthetic proof are retained. Final delivery still
requires genuine current-head readiness, a qualified merge and a verified
canonical completion result.

## Tooling experience

- **Worked:** Exact input comparisons, GitHub check annotations, canonical
  completion refresh and verified recovery bundles kept separate facts legible.
- **Did not work:** A successful observer exit after an external merge did not
  establish readiness. A missing job log could not explain the failed check.
- **Frustrating:** External merges preceded the owner's readiness release,
  despite the visible hold. The closed PR then became ineligible for the
  canonical runner-loss retry.
- **Wished existed:** One enforceable merge-ownership boundary shared by the
  publisher, observer, coordinator and manual merge surfaces.

The earlier proposed final PR2578 merged externally before its owner retained a
positive readiness verdict. Fifteen green required contexts do not establish
that missing fact. The canonical result is unknown, and the original merge,
observer and receipt are preserved. No completion policy was silently changed.

## Implementation improvement opportunities

Exact source comparisons avoid unnecessary backend replay: the same selected
package inputs, root membership and reviewed helper changes remain applicable.
Their scope excludes a full transitive closure and real-harness enrollment.
Current hosted execution of 51 reconciliation tests is recorded separately from
the original44-test run. The compatibility follow-up's 37 passed jobs and one
skip qualify its source after merge, without inventing pre-merge readiness.

## Goal and prompt critique

The operator has reserved the next final merge for this chat. Draft preparation is a
reviewable result and a server-enforced merge boundary; it does not remove the
normal ready transition, review window or exact-head verification requirements.
Routine source repair and evidence preparation continue within the authorized
goal. An external merge is not an instruction to weaken its acceptance gate.

## TODOs worth codifying

The historical recovery hold remains intact. Resource guards, explicit pins,
metadata-only collection, separate receipt populations and owned rollback remain
the implementation boundaries. Historical raw archives are preserved without
reingestion, and all seven real-harness populations remain Unknown.

The reusable todos above are workflow improvements, not deferred implementation
defects required for the foundation's domain acceptance. They do not certify
production deployment, human alert delivery or universal agent coverage.

## Lessons

- **HIGH — Critical:** A merge, monitor exit and positive pre-merge readiness
  verdict are distinct facts. Preserve their actual times and accepted heads.
- **HIGH — Critical:** Keep original evidence and unknown results when a
  later observation cannot establish a missing historical fact.
- **HIGH — Critical:** Inspect actual check annotations before treating a
  runner loss as a source defect or submitting a retry.
- **MEDIUM — Best practice:** Publish a reviewable draft while resolving merge
  ownership, and retain the ordinary ready transition and review window.
- **MEDIUM — Best practice:** Reuse scoped historical proof only after exact
  input membership, bytes and the reviewed deltas have been checked again.


## Later accepted repair round

Coverage provenance needed an independent installed-library comparison: agreement
between two hardcoded values did not establish which implementation processed the
reports. PR2621 corrects that contract and preserves historical artifacts.

A strict protocol test raced a short live deadline under CI load. PR2620 separates
its clock from real socket/database work. A controlled failure probe then exposed
finalizer ordering that delayed cleanup; PR2621 releases the held response before
graceful shutdown and adds the enclosing-scope regression. The original failure
and positive corrected probe remain distinct evidence.

Both supporting repairs retained positive exact-head readiness before merging.
Actual hosted AI871 and HarnessLedger51 results supersede only their recorded
component inputs. The 234/249 selected comparison and changed legacy Git
requirements require explicit scope, not reuse of the former script-only claim.
Historical root/stage applicability does not establish current exact-root admission.
The final PR still requires its own terminal readiness, archived positive verdict,
qualified merge and VERIFIED canonical receipt before completion is projected.
