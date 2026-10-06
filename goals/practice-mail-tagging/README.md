# Practice Mail Tagging

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Tag the solo attorney Outlook mailbox by matter through the practice KG and auto-file attachments into the Box matter tree, reversibly.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-mail-tagging/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P2 Verify. Tagging is live on the attorney's mailbox: 325 messages since
2026-07-01 carry their matter category. Filing is on (no attachment has been
routable yet). Open: the attorney's spot-check of the tags, contact evidence
from the KG correspondent lookup (off until that spot-check), and enabling the
unit.

## Latest Evidence

- 2026-10-06: backfill since 2026-07-01 on the attorney's mailbox: 300 more
  matter tags, 24 review, 20 USPTO; filing on, nothing routable
  ([record](history/2026-10-06-backfill-attorney-mailbox.md)).
- 2026-10-06: first live apply on the attorney's mailbox (mail since
  2026-10-01, categories only): 25 messages tagged to 7 matters, 2 flagged
  for review ([record](history/2026-10-06-first-apply-attorney-mailbox.md)).
- 2026-10-06: first live apply and undo drill on the operator's IT mailbox:
  `P: USPTO` written on 5 messages and undone, verified server-side
  ([record](history/2026-10-06-first-apply-it-mailbox.md)).
- 2026-10-06: live dry-run over mail since 2026-07-01 — 1,802 scanned, 323
  matched across 27 matters, nothing written
  ([record](history/2026-10-06-live-dry-run.md)). PRs #1464, #1480, #1495,
  #1511 merged. Next: the attended bounded apply and undo drill, and the
  attorney's contact overlay.
- 2026-10-06: PR 3 adds the `apps/practice-mail-tagging` entrypoint, a sample
  user unit, and `docs/runbooks/practice-mail-tagging.md`; PR 1 (#1464) and
  PR 2 (#1480) are merged. Next: the live dry-run over mail since 2026-07-01.
- 2026-10-06: PR 2 adds the Outlook, practice-KG, and Box adapters, tested
  against driver fakes only (no live calls); decisions D-17..D-25 recorded.
- 2026-10-06: packet opened from the operator-ratified solo-practice
  decisions; design and Decision Log D-1..D-8 recorded in `SPEC.md`.

## Notes

- Sibling workstream A ("Outlook docket intake") owns every `@beep/m365` edit.
  Coordinate through the orchestrator session, never by editing the driver.
- Ledgers, checkpoints, and the matter-folder map are private operator state;
  this repo is public.
