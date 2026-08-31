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

P0 Research — operator-attended Entra app registration (certificate
credential; mailbox access granted exclusively via the Exchange
RBAC-for-Applications assignment scoped to the attorney's mailbox — never
the unscoped tenant-wide contacts role), seeding-job home choice, and a
headers/counts-only census of the salvaged contact CSVs.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-30 from `explorations/practice-office-provisioning`
  (BRIEF solution sketch point 2). The write-verbs scope was deliberately
  shrunk to contacts in align — no driveItem upload, no `Sites.Selected`,
  no Graph mail-write lane. Do not re-expand it here.
- The r4 report's broader upload/MIME verb sketches are context for the
  HTTP-executor design only; those verbs are out of scope.
- Contact content, real mailbox addresses, and machine-local salvage paths
  never enter this public repo — evidence uses counts, headers, and tags.
