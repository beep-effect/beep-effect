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

P1 Implement, in progress, with one P0 item still open. Decided in P0: the
schemas and the time-zone rule (frozen), the message pin (it ships, on one
conversation list call), the caller-view check at creation, and the
sequencing with `m365-agent-outbox` slice 3 (not started, so this goal
opens first). Still open in P0: the tenant proof that a draft category does
not reach recipients, which waits on one message sent by a person. Next
action: merge the first pull request (schemas, comparison, audit field,
`create_draft` and `get_draft`); the second pull request writes no category
until the proof is recorded.

## Latest Evidence

2026-11-10: graduated from
[`explorations/semantic-agent-graph-stack`](../../explorations/semantic-agent-graph-stack/README.md).

2026-11-10: P0 schemas type-checked inside `@beep/m365-mcp` and recorded in
[`research/2026-11-10-p0-basis-schemas.md`](./research/2026-11-10-p0-basis-schemas.md).

2026-11-10: a read-only probe on the firm tenant showed a conversation
filter is one list call and spans folders, recorded in
[`research/2026-11-10-p0-message-pin-probe.md`](./research/2026-11-10-p0-message-pin-probe.md).

2026-11-10: a read-only live check of the reader on the firm tenant
observed and rechecked one real all-day event (start and end came back in
UTC, status `Current`) and one real message (status `Current`), and an
unknown event id refused as `basis-unreadable`. It ran before the
caller-view check was added.

2026-11-12: first pull request built on current `main`: `OutboxBasis.ts`
(schemas and the pure comparison), `OutboxBasisReader.ts` (the reader
service), the `basis` field on `draft-created`, the basis parts of
`create_draft` and `get_draft`, and the caller-view check that refuses
creation with `basis-changed`. `bun run beep quality package-verify
@beep/m365-mcp` and the cheap gates passed; the two new modules are at
100% coverage. The caller-view check is proven in the stub world only: a
live re-run was blocked, see
[`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md).

## Notes

- `m365_outbox_send_draft` refuses every send with `version-unbound`. The
  attorney sends prepared drafts in Outlook, so this goal's check is
  advisory.
- `m365-agent-outbox` slice 3 edits the same files and has no live session.
  Whichever packet opens a pull request second merges `main` first.
- The tenant proof needs one message sent from the attorney's mailbox by a
  person.
