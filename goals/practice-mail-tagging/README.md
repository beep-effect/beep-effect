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

P1 Implement — PR 1 (domain schemas, ports, tagger, tagging job, attachment
filer, undo, file ledgers, synthetic tests). PR 2 adds the Box, practice-KG,
and `@beep/m365` adapters once workstream A's message-category verbs merge.

## Latest Evidence

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
