# Hybrid Retrieval Fusion Core Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Symbol/topology audit and scorer migration parity baseline | pending | Search live source/barrels and package topology; confirm placement; inventory the sibling-checkout scorer/test; migrate the behavioral test matrix before extending it. | Audit evidence names every reused/net-new symbol and exact home; all prior scorer behaviors pass or a contradiction blocks P1. |
| P1 Implement | pending | Add schema-first ranked-channel/result contracts, weighted RRF, empty-channel renormalization, literal tier/floor, stable ties, span preservation, and contribution diagnostics in `@beep/nlp-processing`. | The ratified fixture set and ClaimGate-boundary proof satisfy `SPEC.md` without a storage/encoder/satellite dependency. |
| P2 Verify | pending | Run focused parity, fixture, schema, package, and repo-quality checks; archive contribution and boundary evidence. | Every acceptance criterion is green or a blocker is recorded without weakening deterministic ranking or admission. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, write the reflection, archive proof, and synchronize packet state. | Hosted checks/review are green; reflection and packet evidence are current. |

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest only from evidence.
4. Confirm Yeet/GitHub mergeability and archive parity, fixture, contribution,
   and ClaimGate-boundary proof.

## Execution Notes

- P0 precedes implementation scaffolding and must use live source/barrel search,
  not retired catalog artifacts.
- Preserve the prior scorer behavior before extending its contracts.
- Same-ID merging is fusion accounting; do not drift into near-duplicate policy.
- Keep the four satellite goals queued and preserve unrelated worktree changes.

## Verification Commands

```sh
test "$(wc -m < goals/hybrid-retrieval-fusion-core/GOAL.md)" -le 4000
jq . goals/hybrid-retrieval-fusion-core/ops/manifest.json
rg -n "hybrid-retrieval-fusion-core|GOAL.md|agentLaunchers|packetAnchorDocument" goals/hybrid-retrieval-fusion-core
git diff --check -- goals/hybrid-retrieval-fusion-core
bun run --filter=@beep/nlp-processing check
bun run --filter=@beep/nlp-processing test
bun run --filter=@beep/nlp-processing lint
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
