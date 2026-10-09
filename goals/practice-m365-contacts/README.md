# Practice M365 Contacts

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give `@beep/m365` its confidential-client auth lane and contacts write verbs
behind per-lane decoded scope configs, then seed the attorney's dedicated
contact folder from the salvaged contact-export CSVs — dedup by normalized
email, rollback-tagged, hand edits never overwritten.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-m365-contacts/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, inherited
   from the source exploration.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0/P1/P2 in progress. Route A consumes the existing certificate registration.
The orchestrator adds the attorney-only RBAC contacts grant after PR 1 merges.
The driver, private seeding app and grant/reversal runbook are implemented;
package qualification and synthetic fixtures remain in progress. No live call
or mailbox write has run.

## Latest Evidence

- [Contact census](./history/2026-10-09-p0-contact-census.md): 533 CSV records,
  487 normalized contacts; four inputs share one byte hash. VCF is census-only.
- [Offline dry run](./history/2026-10-09-seeding-dry-run.md): 480 creates, seven
  unidentifiable skips, zero conflicts and zero untracked tags.
- [Lane handoff](./history/handoffs/m365-contacts-2026-10-09.md): setup, decisions
  and current verification evidence.

## Notes

- Graduated 2026-08-30 from `explorations/practice-office-provisioning`
  (BRIEF solution sketch point 2). The write-verbs scope was deliberately
  shrunk to contacts in align — no driveItem upload, no `Sites.Selected`,
  no Graph mail-write lane. Do not re-expand it here.
- The r4 report's broader upload/MIME verb sketches are context for the
  HTTP-executor design only; those verbs are out of scope.
- Contact content, real mailbox addresses, and machine-local salvage paths
  never enter this public repo — evidence uses counts, headers, and tags.
