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

P1 Implement, in progress, with one P0 item still open. The first pull
request merged as #3137. The second is being built: the check-drafts tool,
the category mark, the package README and the runbook. Still open in P0:
the tenant proof that a draft category does not reach recipients. Its route
is chosen (a test draft in the attorney's mailbox, sent by a person); the
first attempt was blocked by Microsoft Graph gateway errors on that
mailbox. Next action: run the proof, record it as a decision file, then
merge the second pull request. No category is written before that.

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

2026-11-13: the first pull request merged as #3137 (`fe9d360e92c`) with
all 15 required checks green and no review thread. It was marked ready and
merged by the operator's account before the lane's own `yeet final-check`
finished, so there is no final-check receipt for that head; hosted CI is
the proof.

2026-11-13: the operator ruled the category name, its colour route, the
check cadence, the closing record and the proof route in a grill session;
each is a decision file of that date.

2026-11-13: second pull request built: the `m365_outbox_check_drafts`
tool, the category mark, three audit record kinds (`draft-basis-marked`,
`draft-basis-cleared`, `draft-closed`), the package README and the
runbook. `bun run beep quality package-verify @beep/m365-mcp` passed; 126
package tests pass. It is held as a draft: it does not merge until the
tenant proof is recorded.

2026-11-13: the tenant proof could not start. Microsoft Graph answered
HTTP 502 or 504 for mail reads on two mailboxes of the tenant, through the
outbox app and through the Microsoft 365 connector, for over an hour.

2026-11-13: #3172 finished hosted checks with 47 passed and one red,
`Heavy / Coverage Regression`, which is not required on `main`. Every row
it lists is a `@beep/repo-cli` file added on `main` without a baseline row
(#3138, #3144, #3165); none is under `m365-mcp`. No review thread was
opened. The session was paused there, with tenant mail still down.

2026-11-13: three review findings on #3172 fixed in one push: a mark is
recorded before it is written, so the server's own category can no longer
be left on a draft without a record; a draft moved to another folder is
found by its message id and not retired; a read without an `isDraft`
value no longer retires a draft. 29 of 29 cheap gates passed.

2026-11-13: two round-two review findings on #3172 fixed in one push: a
draft deleted in Outlook is retired and never marked, and a draft recorded
without a message id learns it on the next read (`draft-identified`). 136
package tests pass and 29 of 29 cheap gates passed. Three Graph facts the
lookup rests on are still unverified on the tenant and are listed in the
decision file of that date.

## Notes

- `m365_outbox_send_draft` refuses every send with `version-unbound`. The
  attorney sends prepared drafts in Outlook, so this goal's check is
  advisory.
- `m365-agent-outbox` slice 3 edits the same files and has no live session.
  Whichever packet opens a pull request second merges `main` first.
- The tenant proof needs one message sent from the attorney's mailbox by a
  person.
