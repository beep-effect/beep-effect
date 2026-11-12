# Outbox Draft Basis

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

An outbox draft records the Microsoft Graph items it rested on, and a draft whose basis changed is reported and flagged in Outlook before the attorney sends it.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/outbox-draft-basis/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: objective,
   relationships, non-goals, design sketch, constraints, acceptance.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`decisions/`](./decisions/) - the alignment decisions this packet
   inherited, projected into `SPEC.md`.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
7. [`explorations/semantic-agent-graph-stack/BRIEF.md`](../../explorations/semantic-agent-graph-stack/BRIEF.md) -
   the shaped pitch this packet was seeded from.
8. [`history/`](./history/) - evidence and closeouts, when present.

## Current Phase

P0 Research, in progress. The pin, status and report schemas and the
time-zone rule are frozen (decision file of 2026-11-10). Next action: run
the tenant proof that a draft category does not reach recipients, and
decide whether the message pin ships given that a moved message changes
its Graph id.

## Latest Evidence

2026-11-10: graduated from
[`explorations/semantic-agent-graph-stack`](../../explorations/semantic-agent-graph-stack/README.md).
No package code has changed.

2026-11-10: P0 schemas type-checked inside `@beep/m365-mcp` and recorded in
[`research/2026-11-10-p0-basis-schemas.md`](./research/2026-11-10-p0-basis-schemas.md).

## Notes

- `m365_outbox_send_draft` refuses every send with `version-unbound`. The
  attorney sends prepared drafts in Outlook, so this goal's check is
  advisory.
- `m365-agent-outbox` slice 3 edits the same files and has no live session.
  Whichever packet opens a pull request second merges `main` first.
- The tenant proof needs one message sent from the attorney's mailbox by a
  person.
