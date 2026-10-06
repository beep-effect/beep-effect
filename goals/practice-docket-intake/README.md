# Practice Docket Intake

## Status

Lifecycle: `active`

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

P1 Implement and P2 Verify. Slices 0 to 3b are merged (#1455, #1456, #1458,
#1475, #1502, plus driver follow-ups #1473 and #1501). The first-run safety
net (slice 3c) is in review as #1517; slice 4 (the live practice-KG matter
lookup and the docket-sheet cross-check) is being built. The Entra and
Exchange registration is complete and the live read and write smoke tests
passed on 2026-10-06; the operator-attended first run waits for its slot.

## Latest Evidence

Package handoffs pass for `@beep/m365`, `@beep/m365-mcp`,
`@beep/law-practice-domain`, `@beep/law-practice-use-cases`,
`@beep/law-practice-server` and `@beep/docket-intake`. Live smoke against the
attorney mailbox: read and write passed on 2026-10-06 (ids and counts only).

## Notes

- This packet has no source exploration. It was authored directly from the
  operator-ratified solo-practice alignment of 2026-10-06.
- The registration is operator-attended: an Entra app registration with a
  certificate, then an Exchange Online role assignment scoped to one mailbox.
  No tenant-wide admin consent is granted.
- Workstream B (mail matter tagging and attachment filing) consumes the driver
  verbs of slice 1 and does not edit `packages/drivers/m365`.
