# Tracked-Changes Ingest Wedge Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 U4 kill-gate | pending | Trace insertion/deletion identity, content, context, and order across OOXML/Pandoc/Md. | Semantic viability or the structural fallback is evidence-backed and recorded. |
| P1 Minimal ingest rung | pending | Implement only the representation selected by U4. | The first vertical slice satisfies the SPEC. |
| P2 Verify with synthetic C&H | pending | Measure preservation and regressions through the sibling eval framework. | Acceptance evidence is green or blockers are recorded. |
| P3 Yeet: PR to mergeable | pending | Publish through Yeet and resolve hosted checks/review. | PR is merge-ready with zero unresolved threads. |
| P4 Close | pending | Record evidence/reflection and close the packet. | Receipts, status, and reflection are current. |

## P0 Kill-Gate Protocol

1. Freeze a minimal OOXML fixture containing ordered `w:ins` and `w:del`.
2. Record the Pandoc representation without assuming generic Span/Attr survival.
3. Record the canonical Md representation.
4. Classify pass, bounded-partial, or hard fail.
5. On hard fail, stop semantic implementation and record the structural
   representation plus operator re-entry condition.

## Execution Notes

- Synthetic C&H first.
- OIP real data is later and on-device only.
- Consume, do not duplicate, the sibling eval framework.

## Verification Commands

```sh
test "$(wc -m < goals/tracked-changes-ingest-wedge/GOAL.md)" -le 4000
jq . goals/tracked-changes-ingest-wedge/ops/manifest.json
rg -n "tracked-changes-ingest-wedge|GOAL.md|agentLaunchers|packetAnchorDocument" goals/tracked-changes-ingest-wedge
git diff --check -- goals/tracked-changes-ingest-wedge
```
