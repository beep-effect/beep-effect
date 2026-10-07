# Practice Docket Intake

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Watch the solo attorney's Outlook mailbox from the operator's workstation,
classify each new message as a docket item or not, have a second agent
recompute the due date from the source document, and write tentative
`Docket - unverified` calendar entries with a 30/14/7/1-day reminder ladder
for the attorney to confirm. Outlook stays the system of record.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-docket-intake/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, typed outcomes and the
   Decision Log.
3. [`PLAN.md`](./PLAN.md) - active execution plan and PR slices.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance and the in-repo
   bricks this packet composes.
6. [`../../docs/runbooks/docket-intake-entra-registration.md`](../../docs/runbooks/docket-intake-entra-registration.md) -
   the operator-attended registration.
7. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P4 Close, complete. Slices 0 to 4 are merged (#1455, #1456, #1458, #1475, #1502,
#1517, #1528, plus driver follow-ups #1473 and #1501). The Entra and Exchange
registration is complete, the live read and write smoke tests passed on
2026-10-06, and the first live runs ran the same day: the IT mailbox run
processed 10 messages and found no docket item; the attorney mailbox run
processed 10 messages, entered 1, sent 2 to needs review, failed 0, and wrote 3
tentative events, none undone. The closeout reflection is
[`history/reflections/2026-10-06-claude.md`](./history/reflections/2026-10-06-claude.md).

Open operational items, outside the code deliverable: the attorney spot-check
of the first tentative entries (PLAN operator-attended step 2), and the
runbook path form fix on `main` (#1533).

## Latest Evidence

- Package handoffs pass for `@beep/m365`, `@beep/m365-mcp`,
  `@beep/law-practice-domain`, `@beep/law-practice-use-cases`,
  `@beep/law-practice-server`, `@beep/docket-intake` and `@beep/anthropic`.
- Live smoke against the attorney mailbox: read and write passed on 2026-10-06
  (ids and counts only).
- First live runs on 2026-10-06, unattended and bounded (since 2026-10-01, at
  most 10 messages, separate state directories): IT mailbox 10 processed, 0
  docket items, no undo needed; attorney mailbox 10 processed, 1 entered, 2 to
  review, 0 failed, 3 tentative events, kept.
- Review: #1517 closed three waves (seven threads) and #1528 merged with zero
  threads; both merged at the orchestrator gate with an attributed inherited red.

## Notes

- This packet has no source exploration. It was authored directly from the
  operator-ratified solo-practice alignment of 2026-10-06.
- The registration is operator-attended: an Entra app registration with a
  certificate, then an Exchange Online role assignment scoped to one mailbox.
  No tenant-wide admin consent is granted.
- Workstream B (mail matter tagging and attachment filing) consumes the driver
  verbs of slice 1 and does not edit `packages/drivers/m365`.
