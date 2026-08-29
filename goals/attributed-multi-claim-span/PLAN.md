# Attributed Multi-Claim Span Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Seam and CQ audit | pending | Bind live anchor/span/extraction/gate seams and author the lexicog CQ. | Target modules and the two-claim fixture contract are fixed. |
| P1 Annotation slice | pending | Implement attributed/supersedable annotations and the LangExtract-to-ClaimGate loop. | The first vertical slice satisfies the SPEC. |
| P2 Verify | pending | Run focused schema, behavior, and gate-path proof. | Acceptance evidence is green or blockers are recorded. |
| P3 Yeet: PR to mergeable | pending | Publish through Yeet and resolve hosted checks/review. | PR is merge-ready with zero unresolved threads. |
| P4 Close | pending | Record evidence/reflection and close the packet. | Receipts, status, and reflection are current. |

## P4 Closeout Checklist

Write a reflection under `history/reflections/`, run required verification,
update evidence/status, and close only after the Yeet completion gate.

## Execution Notes

- Keep annotation authority separate from epistemic claim authority.
- Keep SHACL and multilingual work in the source exploration.
- Never vendor reference-only ontology artifacts.

## Verification Commands

```sh
test "$(wc -m < goals/attributed-multi-claim-span/GOAL.md)" -le 4000
jq . goals/attributed-multi-claim-span/ops/manifest.json
rg -n "attributed-multi-claim-span|GOAL.md|agentLaunchers|packetAnchorDocument" goals/attributed-multi-claim-span
git diff --check -- goals/attributed-multi-claim-span
```
