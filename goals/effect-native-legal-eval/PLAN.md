# Effect-Native Legal Eval Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Baseline and contract audit | pending | Pin C&H, approve/contain the one baseline, and bind live judge/QA seams. | Inputs, costs, cleanup, and framework contracts are fixed. |
| P1 Eval framework | pending | Implement schemas, typed judge service, criterion isolation, scoring, and evidence integration. | The first vertical slice satisfies the SPEC. |
| P2 Verify and baseline | pending | Run focused framework proof and the one approved external baseline. | Evidence is complete or blockers are recorded. |
| P3 Yeet: PR to mergeable | pending | Publish through Yeet and resolve hosted checks/review. | PR is merge-ready with zero unresolved threads. |
| P4 Close | pending | Record evidence/reflection and close the packet. | Receipts, status, and reflection are current. |

## P4 Closeout Checklist

Write a reflection under `history/reflections/`, run required verification,
update evidence/status, and close only after the Yeet completion gate.

## Execution Notes

- Keep C&H on-demand; do not add its bulk corpus to normal gates.
- The external harness runs once and requires explicit approval.
- Keep OIP material out of the repo and telemetry.

## Verification Commands

```sh
test "$(wc -m < goals/effect-native-legal-eval/GOAL.md)" -le 4000
jq . goals/effect-native-legal-eval/ops/manifest.json
rg -n "effect-native-legal-eval|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-native-legal-eval
git diff --check -- goals/effect-native-legal-eval
```
