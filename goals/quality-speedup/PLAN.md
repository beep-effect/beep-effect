# Quality Speedup Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Measure | complete | Produce the three evidence artifacts: tstyche inventory + coverage-loss assessment, fleet/CI quality-time data + instrument audit, instantiation census re-run. Read-only. | All three `research/` docs drafted with verified instruments; census data committed under `research/data/`. |
| P1 Decisions | complete | `/grill-with-docs` session over the three reports locked 7 decisions — see `history/2026-08-03-grill-decisions.md`. | Decisions recorded in the packet (single PR for everything, per Benjamin). |
| P2 Tstyche removal | complete | Execute the removal per the reviewed inventory and grill decisions; measure before/after. | Removal complete; `tsconfig-sync --check` returned 0; residue gate clean; before/after recorded in `research/tstyche-inventory.md` §6. |
| P3 Ship | complete | One PR: packet + all three reports + grill decisions + tstyche removal (+ pulled-forward MimeType fix, CI cap, bounded docgen), via yeet citing `quality-speedup`. | PR [#548](https://github.com/beep-effect/beep-effect/pull/548) published from a green verify; merge readiness tracked via monitor. |
| P4 Close | complete | Closeout reflection + packet state flip in the same PR as final work. | `history/reflections/2026-08-04-claude.md`; manifest statuses updated. |

## Execution notes

- Heavy fan-out runs as `codex exec` background jobs (GPT-5.6 Sol, medium
  reasoning) writing drafts to the session scratchpad and data TSVs to
  `research/data/`; Fable integrates and verifies. Claude subagents are not
  used for bulk work (quota routing doctrine).
- The census sweep runs sequentially (tsgo is internally parallel) with the
  overlay tsconfig method from `goals/box-typecheck-cost`; raw per-package
  outputs stay in the scratchpad, the parsed TSV is committed.
- Prior-art census (2026-08-03, earlier session): the raw data did not
  survive, so P0 re-runs it; headline findings to re-verify are recorded in
  `research/SOURCES.md`.
- Shipping: ONE PR carries the packet skeleton, all three research reports,
  grill decisions, and the tstyche removal (Benjamin, 2026-08-03 — replaces
  the original three-PR split to avoid serial CI gauntlets).

## P4 Closeout Checklist

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` (frontmatter must validate).
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Verification Commands

```sh
test "$(wc -m < goals/quality-speedup/GOAL.md)" -le 4000
jq . goals/quality-speedup/ops/manifest.json
rg -n "quality-speedup|GOAL.md|agentLaunchers|packetAnchorDocument" goals/quality-speedup
git diff --check -- goals/quality-speedup
```
