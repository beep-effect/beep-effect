# Todox Marketing Site Plan

## Status

Status: `pending` — packet scaffolded at graduation 2026-08-27; execution not
started. P3 publication is explicitly deferred until Benjamin's go.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Pre-flight: fonts, licenses, direction contract | pending | Choose typefaces against rendered specimens per ASSET-PLAN, record licenses, and write the Impeccable direction contract into the root layout from SHAPE-BRIEF. | Faces + licenses recorded; contract comment present and build-surviving. |
| P1 Implement: Terminal of Record build | pending | Build the seven-passage homepage in `apps/todox`: exact DEMO-SCRIPT session, PUBLIC-COPY prose, five binding raises, authored assets only. | Page complete at production fidelity on the portless dev server. |
| P2 Verify: detector, finish review, browser QA, claim re-check | pending | Run the Impeccable detector once, batched screenshot rounds, the shipped finish reviewer + documenter (DESIGN.md), recorded browser QA for the record inspector, accessibility and no-JS checks, and re-run the PUBLIC-COPY claim reconciliation over shipped copy. | Reviewer disposition closed; QA has zero required findings; `bun run --cwd apps/todox audit` green; reconciliation clean. |
| P3 Yeet: PR to mergeable (awaits explicit go) | pending | After Benjamin green-lights publication: `bun run beep yeet` repair → verify → publish `--pr` → monitor to `merge-ready: yes`. | `mergeStateStatus` CLEAN; zero unresolved review threads. |
| P4 Close | pending | Closeout reflection, packet state flip, evidence links. | Reflection passes `bun run beep lint reflection-artifacts`; README/manifest updated. |

## P4 Closeout Checklist

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` (frontmatter must validate
   against `ReflectionFrontmatter`).
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Current Blockers

- **P3 gate:** publication deferred 2026-08-27 (repo contention). Local work
  through P2 may proceed; do not publish or open a PR without the explicit go.
- `[walkthrough-email]` placeholder: address to be supplied by Benjamin;
  non-blocking for P0–P2.

## Execution Notes

- Preserve unrelated worktree changes; the checkout carries concurrent work.
- Keep `SPEC.md` normative; update it only when the contract changes.
- Copy is not free-editable: wording changes re-run the PUBLIC-COPY
  reconciliation against `CLAIMS.jsonl` before they ship.
- Dev server only via `bun run dev` (portless) in `apps/todox`.
- Archive run outputs (QA sessions, reviewer returns, screenshots) under
  `history/`.

## Verification Commands

```sh
bun run --cwd apps/todox audit
test "$(wc -m < goals/todox-marketing-site/GOAL.md)" -le 4000
jq . goals/todox-marketing-site/ops/manifest.json
rg -n "todox-marketing-site|GOAL.md|agentLaunchers|packetAnchorDocument" goals/todox-marketing-site
git diff --check -- goals/todox-marketing-site
```
