# Harness Hygiene Mechanical Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm zero tooling references for the four skills; pick owned destinations for evicted AGENTS.md prose; draft the three laws (1-2 lines each) with evidence citations. | Reference scan clean; destinations named; law text drafted. |
| P1 Implement | complete | Delete the four skill dirs; ONE batched AGENTS.md edit (evict volatile state + add laws); land evicted prose at owned surfaces with pointers. | `SPEC.md` acceptance criteria met; AGENTS.md not larger than before. |
| P2 Verify | complete | Run the verification matrix; record before/after `wc -c AGENTS.md` in evidence. | Matrix green. |
| P3 Close | complete | PR to mergeable via yeet, closeout reflection, packet status flipped in the SAME PR (this goal ships the law that requires it — practice it). | Packet closed; reflection lint passes. |

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` in the same PR as the final work.
