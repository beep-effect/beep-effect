# Semantica Atlas Sync Plan

## Status

Status: `pending`

Not started. P0 and P1 (the verdict lane) can run now: hours of docs plus
Notion, no code risk. P2 (the facts lane) is gated on semantica 0.6.7+ shipping, the firing recorded in a dated
`DECISIONS.md` entry.

## Phases

The verdict lane ships as one PR driven to mergeable via `/yeet`. Phase ids
match `ops/manifest.json` `phases[]`. If P2 is still gated when P1 ships, the
P1 PR itself sets the packet `paused` with the resume condition below; the
packet closes at P3 when the facts lane has run or has been retired by a dated
entry.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Access check + live baseline | pending | Re-verify Notion access; read `Verdict` across the 33 catalogs; enumerate every row the lane will touch. | One-catalog read succeeds; baseline archived with per-catalog counts; every unexplained non-empty value dispositioned; `verdicts.json` lists exact rows. |
| P1 Verdict lane | pending | Schema + data file + lab render/diff script; one canary write; apply; SQL read-back. | Read-back returns exactly the file's rows; receipt archived without Notion ids; PR `merge-ready: yes`. |
| P2 Facts lane (gated: semantica 0.6.7+) | pending | IR → component rows once the trigger fires; extractor home decided first. | semantica 0.6.7+ shipped, recorded in a dated `DECISIONS.md` entry; home decided; IR SHA-256 recorded; rows synced by the same render/diff method. |
| P3 Close | pending | Reflection; packet state flip after P2 has run or has been retired by a dated entry. | Closeout reflection validates; packet `completed-retained`. While P2 is still gated the packet stays `paused` (flipped in the P1 PR) and P3 does not run. |

## P0 Access check + live baseline

1. From the operating session's own Notion connection, read one catalog;
   record the outcome under `history/p0-access.md` (counts only, no ids). A
   failed read stops here.
2. Read `Verdict` across all 33 catalogs; archive per-catalog counts of
   non-empty values. Reconcile against the two dated observations: the six P5
   `park` rows (2026-09-02) and the thirteen D10 auto-parks the 2026-08-24
   upgrade report read back (five MCP Server Integrations, eight LLM
   Providers) that P5's ten-catalog inventory never saw (R3.b).
3. Enumerate in `verdicts.json` every row the lane will touch: the live park
   rows as baseline, the four P5-declined positive rows, and any
   `already-have` row that already has a dated, row-specific `DECISIONS.md`
   entry. Rows without such an entry are not written; propose entries in the
   exploration and wait for ratification (R3.d).

## P1 Verdict lane

Schema first, then data, then the script, then the write:

1. `atlas-verdicts/v1`: record = catalog, row title, `Verdict` (D3
   `LiteralKit`: `adopt | adapt | already-have | park | drop`),
   `Beep counterpart` (required for positive verdicts), evidence (dated
   `DECISIONS.md` entry + sheet section). Home: beside the data file or in the
   lab's `src/schema/`; no reusable export.
2. `explorations/semantica-lab/research/atlas/verdicts.json` with every
   enumerated row; the tracked-data precedent is
   `research/tracker/inventory.jsonl` (redaction law applies).
3. `apps/labs/semantica/scripts/` render/diff script: decode the file, render
   the intended state, diff against the live read, print the apply plan.
   Archive the plan under `history/` before any write.
4. One canary write (the first positive row), read back.
5. Apply the rest; SQL read-back across the 33 catalogs must return exactly
   the file's rows and no other non-empty `Verdict`.
6. Receipt as `history/p1-verdict-lane.md` (rows, before/after, evidence;
   rollback = row page history).
7. In the same PR, set the packet `paused` with resume condition "semantica
   0.6.7+ ships, recorded in a dated `DECISIONS.md` entry"
   (`bun run beep goals set-status`): packet-state flips land in the PR that
   ships the work, never after `merge-ready: yes`.
8. Publish through Yeet; `merge-ready: yes`.

## P2 Facts lane (gated)

Entry condition: a dated `DECISIONS.md` entry records that semantica 0.6.7+ shipped and
decides the extractor's home (default: a pinned out-of-repo clone under the
cache root; the extractor lives in git history at `fd560ca8e5`).

1. Recover `extract.py`, `ir-schema.json` and the README from history into
   the decided home; run over the pinned semantica checkout; record the IR
   SHA-256 in the exploration's `research/ir-extraction-report.md`.
2. Render component/module rows from the IR by the same render/diff method;
   diff, canary write, apply, read-back; never add schema.
3. Publish; receipt under `history/p2-facts-lane.md`.

## P3 Closeout Checklist

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` (`bun run beep goals set-status`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive receipts under `history/`.
- Never paste Notion ids, home paths or session ids into tracked files.

## Verification Commands

```sh
test "$(wc -m < goals/semantica-atlas-sync/GOAL.md)" -le 4000
jq . goals/semantica-atlas-sync/ops/manifest.json
rg -n "semantica-atlas-sync|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantica-atlas-sync
git diff --check -- goals/semantica-atlas-sync explorations/semantica-lab
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
