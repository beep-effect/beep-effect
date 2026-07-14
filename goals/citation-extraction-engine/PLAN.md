# Citation Extraction Engine Plan

## Status

Status: `pending` (P1-P3 blocked by both prerequisite goals)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Pinned parity corpus, regex safety, and provenance | pending | Pin eyecite code/fixtures; inventory licenses and affected material; build stage-level parity expectations; scan the full regex corpus for re2js compatibility and adversarial timing; map outputs to existing law-practice values. | Pin/checksum/provenance are recorded; root notice is complete; regex strategy and expected per-stage outputs are reviewable; both blockers' public contracts are confirmed before P1. |
| P1 Implement | pending | Port the smallest Effect-native clean/tokenize/extract/group/resolve pipeline over existing values; repair `CitationBase.confidence`; integrate stable vocabulary version/IDs and verified anchors. Blocked until both prerequisites land. | Ratified case and patent forms emit existing schemas with exact spans; no raw data or `eyecite-js` dependency. |
| P2 Verify | pending | Run pinned parity, statute/regulation, confidence, regex-safety, span-fidelity-on-Bun, focused package, and repo proof. Blocked until P1. | Every `SPEC.md` criterion is green or a blocker is archived without weakening fidelity/safety. |
| P3 Close | pending | Drive PR to mergeable through Yeet, write reflection, archive proof, synchronize state. Blocked until P2. | Hosted checks/review are green; reflection and packet evidence are current. |

## Blockers

- `goals/citation-verified-span-substrate`
- `goals/court-reporter-vocabulary`

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest from evidence.
4. Confirm Yeet/GitHub mergeability; archive parity/span/regex proof.

## Execution Notes

- P0 can proceed while blocked, but no public consumer contract freezes before both prerequisites land.
- Preserve unrelated changes and keep `SPEC.md` normative.
- Keep parity failures attributable by stage and run span proof on Bun.
- Do not hide MPEP patterns inside v1 or use raw vocabulary artifacts.

## Verification Commands

```sh
test "$(wc -m < goals/citation-extraction-engine/GOAL.md)" -le 4000
jq . goals/citation-extraction-engine/ops/manifest.json
rg -n "citation-extraction-engine|blockedBy|GOAL.md|agentLaunchers|packetAnchorDocument" goals/citation-extraction-engine
git diff --check -- goals/citation-extraction-engine THIRD_PARTY_NOTICES.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
