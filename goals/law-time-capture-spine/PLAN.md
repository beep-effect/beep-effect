# Law Time Capture Spine Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Derive the initial native patent-prosecution task set from Tom's real matters; design the time-entry, explicit-timer-duration, candidate, approval-history, evidence, and export-boundary model schema-first; design one deletion contract covering content, metadata, projections, audit history, source revocation, and narrow tombstones. | Tom has supplied representative real matters; the bounded native task set and schema contracts are recorded; retention clocks, revocation behavior, deletion propagation, idempotency ownership, and privilege boundaries are testable before implementation begins. |
| P1 Implement | pending | Build the smallest Effect-first manual vertical: visible start/stop timer, explicit matter/task association, candidate duration and purpose-bounded narrative, evidence inspection, attorney edit/approve/reject/delete with approval history, and vendor-neutral approved-entry CSV/prebill preview. | Hourly, flat-fee, and nonbillable fixtures traverse the complete local lifecycle; only approved entries reach previews; repeated preview generation is duplicate-safe; no network or vendor adapter is required. |
| P2 Verify | pending | Run focused package/integration/restart/deletion/idempotency proof and a two-week Tom pilot against the ratified capture, matter-accuracy, approval, narrative-edit, approval-firewall, duplicate, retention, and revocation criteria. | Every `SPEC.md` acceptance criterion is green, or blockers and pilot evidence are archived reproducibly without weakening the firewall or privacy contract. |
| P3 Close | pending | Run repo proof, prepare and drive the PR to mergeable through Yeet, write the closeout reflection, and synchronize packet evidence/status. | Yeet/GitHub reports the PR mergeable; a schema-valid reflection exists; README, PLAN, and manifest state match the evidence. |

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained` / `complete`):

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`, covering tooling,
   implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` with final evidence.
4. Confirm Yeet/GitHub mergeability and archive the pilot/retention proof without
   privileged matter content.

## Execution Notes

- Tom supplies the initial native prosecution task set from real matters during
  P0; do not substitute UTBMS/LEDES or invent a general legal taxonomy.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Cut narrative sophistication or taxonomy breadth before visible timer state,
  evidence inspection, explicit approval, deletion, or export preview.
- Do not evaluate or implement FreshBooks here. Its API unknowns belong to the
  separately gated `law-time-freshbooks-export` P0.
- Archive only redacted fixtures and aggregate pilot evidence under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/law-time-capture-spine/GOAL.md)" -le 4000
jq . goals/law-time-capture-spine/ops/manifest.json
rg -n "law-time-capture-spine|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-time-capture-spine
git diff --check -- goals/law-time-capture-spine
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
