# Court Reporter Vocabulary Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Pinned-source assembly | completed 2026-07-25 | Pin courts-db/reporters-db commits; distinguish templated inputs from rendered releases; audit eyecite-js/ts; prove authoritative counts and assembly semantics. | Pins, archive checksums, input mapping, exact counts, and the eyecite audit are recorded. |
| P1a Ingestion substrate | completed 2026-08-27 | Add the two public sync targets, internal artifacts/sidecars, deterministic reporters decode and courts assembly, focused tests, workflow ownership, and notice metadata. | Both targets regenerate with no diff; raw artifacts remain private; focused proof is green. |
| P1b Public domain contract | completed 2026-08-27 | Add stable domain IDs/vocabulary/lookups, lifecycle rules, compatibility API, and drift classification. | Public consumers use stable IDs and the versioned compatibility surface without raw imports. |
| P2 Verify | completed 2026-08-27 | Run deterministic regeneration/count, lifecycle/drift, compatibility, consumer-contract, package, notice, and repo proof. | Every `SPEC.md` criterion is green or a blocker is archived without weakening identity/provenance. |
| P3 Close | completed 2026-08-27 | Drive the PR to mergeable through Yeet, write reflection, archive evidence, and synchronize packet state. | Hosted checks/review are green; reflection and packet evidence are current. |

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest from evidence.
4. Confirm Yeet/GitHub mergeability and archive regeneration/count/drift proof.

## Execution Notes

- P0 is complete for ingestion: reporters-db has 1,236 keys / 1,262 records and
  courts-db assembles 2,809 unique records from the pinned sources.
- P1a and P1b shipped together for final completion. Raw generated files remain
  private; the named law-practice subpath is the only consumer contract.
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
