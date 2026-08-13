# Candor Gate Follow-Ups Closeout Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Re-verify and decide | complete | Re-check every parked claim against live source, architecture, primary identity authority, and current tooling. | `research/DECISIONS.md` records one scoped implementation or terminal evidence path per item. |
| P1 Implement and evidence-dispose | complete | Ship the behavioral items and capture measured no-build/already-fixed dispositions. | All six SPEC criteria have focused proof. |
| P2 Verify and review | complete | Run focused gates, quality baseline, and up to three read-only reviewer/fixer rounds. | Green baseline and zero required reviewer findings. |
| P3 Yeet: PR to mergeable | active | Verify, publish, answer and resolve every review thread, and monitor hosted checks. | Yeet reports `merge-ready: yes`. |
| P4 Close | pending | Write reflection, flip lifecycle, and remove predecessor routing residue. | Reflection validates and packet reports no remaining owned follow-up. |

## Execution Order

1. Lock the identity relationship from primary USPTO/WIPO sources, including
   an explicit no-conversion result when required fields cannot be derived.
2. Define the smallest shared promotion-gate contract and its law adapter.
3. Wire the candidate-output acceptance boundary through the gate.
4. Widen the candor quantified set and pin behavior.
5. Require globally scoped ST.13 identity and preserve exact-representation
   equality at read/write boundaries.
6. Measure the current SQL plan at representative volume and act only on evidence.
7. Audit Crypto fixtures and close with build or explicit no-build evidence.
8. Explain and pin the current Lint Policy scope modes; resolve the old receipt.
9. Run focused checks, then the quality-review-fix-loop and Yeet closeout.

## P4 Closeout Checklist

1. Use `/reflect candor-gate-followups-closeout` and validate the reflection.
2. Mark every phase complete and lifecycle `completed-retained` only after P3 is merge-ready.
3. Replace the predecessor's unowned list with a resolved-successor table.
4. Search packet, predecessor, and touched code for TODO/deferred/follow-up residue;
   any intentional non-build decision must point to measured evidence.

## Verification Commands

```sh
test "$(wc -m < goals/candor-gate-followups-closeout/GOAL.md)" -le 4000
jq . goals/candor-gate-followups-closeout/ops/manifest.json
bun run beep goals doctor
git diff --check -- goals/candor-gate-followups-closeout
```
