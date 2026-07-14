# Court Reporter Vocabulary Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Pinned-source assembly and stable-ID spike | pending | Pin courts-db/reporters-db commits; distinguish templated inputs from rendered releases; render deterministically; prove record/ID counts; exercise tombstone, alias/successor, reused-abbreviation, date-split, drift-report, and compatibility classifications. | Authoritative inputs, checksums, exact counts, artifact-version rules, and fixture outcomes are recorded; root notice pins are filled; contradictions block P1. |
| P1 Implement | pending | Add the two public sync targets, package-private artifacts/sidecars, stable domain IDs/vocabulary/lookups, lifecycle rules, compatibility API, drift report, and canonical notice metadata. | Public consumers use stable IDs/versioned compatibility surface; raw artifacts remain private; regeneration is deterministic. |
| P2 Verify | pending | Run deterministic regeneration/count, lifecycle/drift, compatibility, consumer-contract, package, notice, and repo proof. | Every `SPEC.md` criterion is green or a blocker is archived without weakening identity/provenance. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, write reflection, archive evidence, and synchronize packet state. | Hosted checks/review are green; reflection and packet evidence are current. |

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest from evidence.
4. Confirm Yeet/GitHub mergeability and archive regeneration/count/drift proof.

## Execution Notes

- P0 is a hard gate. Do not infer current counts or pins from historical notes.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Do not implement resolver behavior, fuzzy ranking, SKOS, or citation extraction.
- The citation engine's only data boundary is the public compatibility contract.

## Verification Commands

```sh
test "$(wc -m < goals/court-reporter-vocabulary/GOAL.md)" -le 4000
jq . goals/court-reporter-vocabulary/ops/manifest.json
rg -n "court-reporter-vocabulary|GOAL.md|agentLaunchers|packetAnchorDocument" goals/court-reporter-vocabulary
git diff --check -- goals/court-reporter-vocabulary THIRD_PARTY_NOTICES.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
