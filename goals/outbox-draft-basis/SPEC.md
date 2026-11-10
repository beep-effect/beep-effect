# Outbox Draft Basis Spec

## Objective

An outbox draft records the Microsoft Graph items it rested on, and a draft whose basis changed is reported and flagged in Outlook before the attorney sends it.

An agent session prepares a draft in the attorney's mailbox from things it
read: a date on the Outlook docket entry, the message it is answering. The
attorney reviews the draft and sends it from Outlook, sometimes days later.
The outbox send guard proves the draft is what the caller thinks it is. This
goal adds the other half: a record of what the draft was written from, and a
visible signal when that has changed.

Delivered behavior:

1. `m365_outbox_create_draft` accepts a basis: a list of pins, each naming
   one Graph item by kind and id. The server reads each item, computes a
   digest of the fields the draft relied on, and writes the pins into the
   `draft-created` audit record.
2. `m365_outbox_get_draft` returns a basis report for the draft: one status
   per pin and an overall verdict.
3. A new check-drafts tool rechecks every unsent draft this server created
   and sets or clears one Outlook category on each.

Shaped in [`explorations/semantic-agent-graph-stack/BRIEF.md`](../../explorations/semantic-agent-graph-stack/BRIEF.md).
The alignment log is
[`explorations/semantic-agent-graph-stack/DECISIONS.md`](../../explorations/semantic-agent-graph-stack/DECISIONS.md).

## Relationships

- [`m365-agent-outbox`](../m365-agent-outbox/README.md) (active) built the
  server this goal extends. Its slices 0 to 2 are merged and are the base.
  Its slice 3 (reply, forward and draft update) edits the same handlers,
  tools and audit log and has no live session. This goal does not wait on
  that packet's completion, so it is not a manifest requirement. Whichever
  of the two opens a pull request second merges `main` first.
- The audit journal evolves under that packet's D-28: a new field must leave
  every earlier record readable.
- [`text-knowledge-stack-rebuild`](../text-knowledge-stack-rebuild/README.md)
  (active) is not a dependency. Nothing here imports the packages it
  rewrites.
- [`practice-mail-tagging`](../practice-mail-tagging/README.md)
  (completed-retained) writes categories onto inbound mail. That is why a
  pin compares a digest of named fields and not the item's `changeKey`.
- Three gated follow-ons stay in
  [`explorations/semantic-agent-graph-stack/MAP.md`](../../explorations/semantic-agent-graph-stack/MAP.md):
  a version-bound send, pins on epistemic claims, and a task context view.
  A fired gate reopens that exploration; this packet spawns none of them.

## Non-Goals

- Reopening agent sending. `m365_outbox_send_draft` keeps refusing with
  `version-unbound`.
- A pin on a fact outside Microsoft Graph, or a digest restated by the
  caller.
- Any import of a slice from the driver family, and any shared-kernel or
  foundation schema for pins. The pin types stay in `@beep/m365-mcp` until a
  second consumer exists.
- Blocking Outlook's Send, or editing a draft's subject or body to show
  staleness.
- A timer or background service inside the MCP server. A session or a
  scheduled task calls the check-drafts tool.
- A transitive dependency walk, a graph store, a context assembler or an
  extraction pipeline.
- A pin on a recurring series master.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards, in particular
   `standards/architecture/03-driver-boundaries.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the source
   exploration.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/m365-mcp`: the pin and report schemas, the pure
  comparison, the tool parameters and results, the handlers, the audit
  record, the package README and tests.
- `packages/drivers/m365`: only if a read the comparison needs is missing a
  selected field.
- `docs/runbooks/m365-agent-outbox-registration.md`: the category, the new
  tool's permission setting and the advisory limit.
- This packet.

## Design Sketch

Fat-marker fidelity. P0 freezes the schemas in a decision file before any
handler changes. Schema first, then the service contract, then handlers.

```text
BasisPin     = { kind: "event" | "message", id, digest, observedAt, changeKey }
BasisStatus  = Current
             | Changed      the named fields differ now
             | Gone         the item no longer exists
             | Unreadable   Graph could not be asked
BasisReport  = pinned-current | pinned-stale | unpinned, plus one status per pin
```

- The caller supplies `kind` and `id`. The server reads the item and
  computes the digest, as it computes attachment digests from stored bytes.
- The digest covers a named view. Event: subject, start, end with time
  zone, all-day flag, cancelled flag. Message: its RFC 5322 message id, and
  whether a later message from another sender exists in the same
  conversation.
- `changeKey` is recorded for audit and never compared.
- The comparison is a pure function over two schemas, beside
  `checkSendExpectation`, with its statuses as a named literal domain.
- The stale reason word is `basis-changed`, the word
  `ClaimEvidenceReviewStatus.Stale` already uses in `@beep/epistemics`.
- The mark is one Outlook category written through the driver's
  `updateMessageCategories`, conditional on the draft's current
  `changeKey`, keeping every category the server did not add.

## Constraints

- Design order is schema, then `Context.Service` contract, then
  implementation. Effect v4 APIs are validated against the reference
  checkout, not written from memory.
- The driver imports no slice. A driver that imports anything from a slice
  has the wrong boundary.
- Pins are read before the draft is created. An unreadable pin, or a pin on
  a series master, refuses creation with a typed reason and creates nothing.
- An empty basis is legal and reported as `unpinned`. Reports count unpinned
  drafts so the share can be measured.
- Start and end are canonicalized with their zone before hashing. P0 fixes
  the rule and its test cases, including an all-day event.
- A `draft-created` record written before this goal decodes with an empty
  basis.
- A draft that is missing, or no longer a draft, is skipped and reported by
  the check-drafts tool. It is never marked.
- No category is written to any draft until the tenant proof in P0 shows a
  draft category does not reach recipients. If it does, or the proof cannot
  be run, the mark is dropped by decision file and the report stays in tool
  output only.
- The message pin ships only if "a later message from another sender" costs
  one list call. Otherwise it is cut by decision file and the event pin
  ships alone.
- Two pull requests. A third means the message pin is cut.
- Message and event bodies are never logged or written to the audit log.

## Acceptance Criteria

- [ ] The pin, status and report schemas and the pure comparison exist in
      `@beep/m365-mcp`, with property tests showing: an edit to a field
      outside the named view (a category, a reminder, `changeKey` alone)
      yields `Current`; an edit to any named field yields `Changed`.
- [ ] `m365_outbox_create_draft` accepts a basis, reads each pinned item
      before creating the draft, and writes the pins into the
      `draft-created` record. An unreadable pin and a series-master pin each
      refuse with a typed reason and create no draft.
- [ ] A `draft-created` record without a basis field decodes with an empty
      basis, proven by a test over a fixture of the earlier shape.
- [ ] `m365_outbox_get_draft` returns the basis report. In the stub world,
      moving a pinned event's start yields `pinned-stale`, and editing only
      its reminder yields `pinned-current`.
- [ ] The check-drafts tool rechecks every draft this server created that
      has no terminal audit record, sets the category on a stale draft,
      clears it when the basis is current again, skips and reports missing
      or sent drafts, and appends an audit record for each mark and clear.
      It never changes a subject or body.
- [ ] The tenant proof for the category is recorded as a decision file. If
      the mark was dropped, the criterion above is amended in the same
      change.
- [ ] The message pin is either shipped under the one-list-call rule or cut
      by decision file.
- [ ] `m365_outbox_send_draft` still returns `version-unbound`; its existing
      tests are unchanged and green.
- [ ] The `@beep/m365-mcp` README and the registration runbook describe
      pins, the report, the category and the advisory limit.
- [ ] `bun run beep quality package-verify @beep/m365-mcp` passes and no
      coverage ratchet row for the package is lowered.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package handoff | `bun run beep quality package-verify @beep/m365-mcp` | Passes |
| Final gates | `bun run beep yeet final-check` | Passing receipt for the pushed head |
| Stub-world slice | Handler tests over the outbox stub world | Event moved: stale. Reminder edited: current. |
| Journal compatibility | Decode test over an earlier `draft-created` fixture | Empty basis |
| Category proof | Decision file with the tenant evidence | Recorded before any mark is written |
| Packet launcher size | `test "$(wc -m < goals/outbox-draft-basis/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/outbox-draft-basis/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/outbox-draft-basis` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- The tenant proof needs a message sent from the attorney's mailbox. An
  agent does not send it; the operator or the attorney does, and the goal
  waits on that one step while everything else proceeds.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add outbox-draft-basis --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug outbox-draft-basis`; add a `kind: decision` file there, never edit this block._

### The basis check attaches to the draft, and send stays closed, 2026-11-10

The outbox send tool refuses every send with version-unbound (PR 1728), so the attorney's Send in Outlook is the release point. The check records what a draft rested on at create time, reports it on read and flags a stale draft in Outlook. It is advisory: beep cannot block Outlook's Send. Rejected: a promised second slice that reopens agent sending, moving the first consumer to the docket reminder, and parking. Source: explorations/semantic-agent-graph-stack/DECISIONS.md, entries first-consumer and attach-point (operator, 2026-11-10).

Reverse: Reopen the exploration at decompose and fire the version-bound send gate in its MAP.md; the pins recorded here are what that send would recheck.

### A pin compares a digest of named fields; changeKey is recorded and never compared, 2026-11-10

The driver schema documents changeKey as changing on every edit, and mail tagging writes categories onto inbound messages. A changeKey pin would report a draft stale after a tag, a reminder change or a read-state write. The server hashes only what the draft relied on: for an event, subject, start, end with zone, all-day and cancelled; for a message, its message id and whether a later message from another sender is in the conversation. Rejected: changeKey as the comparison. Source: exploration DECISIONS.md, entry pin-comparison (operator, 2026-11-10).

Reverse: Switch the comparison to changeKey in the pure function and drop the view schemas; recorded pins already carry changeKey, so no journal migration is needed.

### A pin points only at a Microsoft Graph item the server re-reads itself, 2026-11-10

The outbox is a driver and a driver imports no slice, so it cannot ask the epistemic slice whether a claim changed. It can re-read Graph, which lets it detect a change without trusting the caller, as it already does for attachment bytes. First kinds: the Outlook calendar event a date came from and the message being answered. Rejected: a digest the agent restates for outside facts, and wiring a second driver into the outbox binary in the first slice. Source: exploration DECISIONS.md, entry basis-source (operator, 2026-11-10).

Reverse: Add a pin kind by decision file once the outbox server has its own read path to the new source; the pin shape does not change.

### This is its own goal, not a fourth slice of m365-agent-outbox, 2026-11-10

m365-agent-outbox is active with no code since 2026-10-31 and no live session; its slice 3 edits the same handlers, tools and audit log. A separate goal does not wait behind that slice and does not hold that packet's closeout open. The dependency is on merged code, so the manifest declares no requirement on that packet. Whichever of the two opens a pull request second merges main first. Source: exploration DECISIONS.md, entry goal-home (operator, 2026-11-10).

Reverse: Fold the remaining work into m365-agent-outbox as a slice by a decision file there, mark this packet superseded and move its decision files across.

### Appetite is two pull requests, and the message pin is the named cut, 2026-11-10

Shaped as a small bet: schemas, comparison, audit field, create and get in the first pull request; the check-drafts tool, the category mark and the docs in the second. If a third would be needed, or a later-message check costs more than one list call, the message pin is cut and the event pin ships alone. Source: exploration BRIEF.md (Appetite) and DECISIONS.md, entry shape-accepted (operator, 2026-11-10).

Reverse: Record a decision file that raises the appetite and names what the third pull request carries.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
