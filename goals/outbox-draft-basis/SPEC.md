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
   one Graph item by kind and id and carrying the named fields the caller
   composed the draft from. The server reads each item, refuses creation
   when its read differs from what the caller composed from, keeps its own
   read of the named fields, and writes the pins into the `draft-created`
   audit record.
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
  pin compares named fields and not the item's `changeKey`.
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

Fat-marker fidelity. The schemas were frozen in P0 on 2026-11-10; the
type-checked listing is
[`research/2026-11-10-p0-basis-schemas.md`](./research/2026-11-10-p0-basis-schemas.md).
Schema first, then the service contract, then handlers.

```text
BasisPin     = { kind: "event" | "message", id, view, observedAt, changeKey }
               a message pin also keeps its conversationId, as a lookup key
BasisStatus  = Current
             | Changed      which named fields differ, and the fresh view
             | Gone         the item no longer exists
             | Unreadable   Graph could not be asked
BasisReport  = unpinned | pinned-current | pinned-stale | pinned-unverified,
               plus one status per pin
```

- The caller supplies `kind`, `id` and the view it composed the draft
  from. The server reads the item and keeps its own view, as it computes
  attachment digests from stored bytes instead of trusting the caller. The
  caller's view is only a precondition: the same pure comparison runs
  between it and the server's read, and any difference refuses creation
  with `basis-changed`, so a pin never records a state the draft was not
  written from.
- The pin stores the named view, not a digest of it. Event: subject, start,
  end, all-day flag, cancelled flag. Message: its RFC 5322 message id, and
  the newest later message from another sender in the same conversation.
  Equality is derived from the schema.
- A message pin is rechecked with one list call on its conversation, which
  spans folders, and the pinned message is found there by its RFC 5322
  message id. Design and tenant evidence:
  [`research/2026-11-10-p0-message-pin-probe.md`](./research/2026-11-10-p0-message-pin-probe.md).
- `pinned-unverified` means a read failed. It is neither stale nor
  current, and the check-drafts tool leaves the category as it is.
- `changeKey` is recorded for audit and never compared.
- The comparison is a pure function over two schemas, beside
  `checkSendExpectation`, with its statuses as a named literal domain.
- The stale reason word is `basis-changed`, the word
  `ClaimEvidenceReviewStatus.Stale` already uses in `@beep/epistemics`.
- The mark is one Outlook category, `Draft - recheck before sending`,
  written through the driver's `updateMessageCategories`, conditional on
  the draft's current `changeKey`, keeping every category the server did
  not add. The server clears only a mark its own audit log records.
- The check-drafts tool retires a draft it finds sent or missing with one
  `draft-closed` audit record, so later calls skip it.

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
- The basis read never sets a zone preference, so Graph returns start and
  end in UTC at creation and at recheck, and the pair is compared as
  returned. A test pins that, including an all-day event.
- A message's Graph id changes when it is moved to another folder. The
  message pin must not treat a moved message as gone.
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

- [x] The pin, status and report schemas and the pure comparison exist in
      `@beep/m365-mcp`, with property tests showing: an edit to a field
      outside the named view (a category, a reminder, `changeKey` alone)
      yields `Current`; an edit to any named field yields `Changed`.
- [x] `m365_outbox_create_draft` accepts a basis, reads each pinned item
      before creating the draft, and writes the pins into the
      `draft-created` record. An unreadable pin, a series-master pin, and a
      pin whose caller-supplied view differs from the server's read each
      refuse with a typed reason and create no draft; in the stub world,
      moving an event's start between the caller's read and creation
      refuses with `basis-changed` naming `start`.
- [x] A `draft-created` record without a basis field decodes with an empty
      basis, proven by a test over a fixture of the earlier shape.
- [x] `m365_outbox_get_draft` returns the basis report. In the stub world,
      moving a pinned event's start yields `pinned-stale` naming `start`,
      editing only its reminder yields `pinned-current`, and a failed read
      yields `pinned-unverified`.
- [x] The check-drafts tool rechecks every draft this server created that
      has no terminal audit record, sets the category on a stale draft,
      clears it when the basis is current again, leaves it unchanged when a
      read failed, skips and reports missing
      or sent drafts, and appends an audit record for each mark and clear.
      It never changes a subject or body.
- [x] The tenant proof for the category is recorded as a decision file. If
      the mark was dropped, the criterion above is amended in the same
      change.
- [x] The message pin is either shipped under the one-list-call rule or cut
      by decision file. Shipped: decision file of 2026-11-10.
- [x] `m365_outbox_send_draft` still returns `version-unbound`; its existing
      tests are unchanged and green.
- [x] The `@beep/m365-mcp` README and the registration runbook describe
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

### P0 schemas frozen: a pin stores the named view, and a failed read is its own verdict, 2026-11-10

Amends the decision 'A pin compares a digest of named fields'. Its substance stands: named fields are compared and changeKey never is. The digest is dropped. The pin stores the view itself (event: subject, start, end, all-day, cancelled), equality is derived from the schema, and Changed names the differing fields and carries the fresh observation. A digest suits bytes too large to store; five short fields are not that, and the audit log already holds event and draft subjects in clear. A fourth verdict, pinned-unverified, covers a read that failed: unknown is neither stale nor current, and the check-drafts tool leaves the category as it is. Time-zone rule: the basis read never sets a zone preference, so Graph returns UTC both times and the pair is compared as returned. The sketch was type-checked inside @beep/m365-mcp and removed. New hazard recorded for the message pin: a message's Graph id changes when it is moved to another folder. Evidence and the schema listing: research/2026-11-10-p0-basis-schemas.md in this packet. Agent-proposed; the operator, who had picked 'digest of named fields' earlier on 2026-11-10, confirmed the stored view the same day.

Reverse: Replace the view field of the pin with a digest and drop the fields and now members of Changed; no record with pins exists before the first pull request merges, so nothing migrates.

### The message pin ships on one conversation list call, 2026-11-10

Settles the P0 message pin question and the moved-message hazard. A read-only probe on the firm tenant (counts only, no mailbox write) showed that the driver's existing listMessages accepts $filter=conversationId eq '<id>' on the outbox mailbox, and that the page spans folders: 13 messages of one conversation came back from 2 folders, each with from, internetMessageId and receivedDateTime. So 'a later message from another sender' is one list call, and the same call finds a pinned message by its internetMessageId after it was moved and its Graph id changed. The message pin therefore ships. Creation costs one get and one list per message pin; recheck costs one list. The pin stores the conversationId beside the Graph id as a lookup key that is never compared. The view is the pinned message's internetMessageId and newestOtherReply: the newest message in the conversation that is not a draft, arrived after the pinned message and was not sent from the outbox mailbox. A conversation of more than one page (500 messages) reads as Unreadable. The sender test compares the from address with the configured mailbox; a mailbox configured as an object id matches no sender, which over-reports and never under-reports. No change to @beep/m365 is needed. Evidence: research/2026-11-10-p0-message-pin-probe.md. Agent-decided under the packet's cut rule.

Lane feat/outbox-draft-basis

Reverse: Cut the message kind from the pin union by decision file before the first pull request merges; after it, stop accepting message pins in create_draft and keep decoding recorded ones.

### Appetite is two pull requests, and the message pin is the named cut, 2026-11-10

Shaped as a small bet: schemas, comparison, audit field, create and get in the first pull request; the check-drafts tool, the category mark and the docs in the second. If a third would be needed, or a later-message check costs more than one list call, the message pin is cut and the event pin ships alone. Source: exploration BRIEF.md (Appetite) and DECISIONS.md, entry shape-accepted (operator, 2026-11-10).

Reverse: Record a decision file that raises the appetite and names what the third pull request carries.

### Creation checks the caller's view before pinning, 2026-11-12

A review of #3120 found a gap: an agent reads an event at A, the event changes to B, and create_draft pins B because the server reads the item at creation, so every recheck reports pinned-current although the draft was written from A. Each pin parameter now also carries the named view the caller composed from. The server compares it with its own read using the pin comparison and refuses creation with basis-changed on any difference, creating nothing; the stored view stays the server's read, and changeKey is still never compared, since it moves on edits outside the named fields. Comparing the caller's view rather than a server-issued observation token keeps the server stateless between read and create. Agent-proposed while addressing the review; the operator reviews asynchronously.

Lane @chore/organizing-goal-packets · PR #3120

Reverse: Drop the caller view from the create_draft pin parameter and pin the server's read alone; no record with pins exists before the first pull request merges, so nothing migrates.

### A deleted draft is retired, and a draft without a recorded message id learns it on the next read, 2026-11-13

Round-two review fixes on pull request 3172, agent-decided; they amend the same day's decision on finding a moved draft by its message id. First: that lookup spans every folder, so a draft the attorney deletes in Outlook was found in Deleted Items, kept open and could even be marked. A hit in the mailbox's Deleted Items folder no longer counts as the moved draft, so a deleted draft closes as missing; the folder id is read at most once per call and only when a draft hit names a folder, and if it cannot be read the draft is unreadable for that run. Second: a draft-created record written before message ids were stored, or one whose id could not be read at creation, had no fallback. check-drafts now appends one draft-identified record with the message id Graph returns the next time such a draft is read under its recorded id, at no extra Graph call, and the lookup uses it. Keeping id-less records open forever was rejected because it brings back the unbounded re-read that draft-closed prevents. Not verified on the tenant, which was down: that a deleted draft keeps its draft flag and message id in Deleted Items, and that a message's parentFolderId equals the id Graph returns for the deleteditems folder. The tenant proof checks both.

Lane feat/outbox-draft-basis-check · PR #3172

Reverse: Drop the Deleted Items test and the draft-identified record; recorded draft-identified lines stay readable and are ignored.

### check-drafts records a mark before writing it and finds a moved draft by its message id, 2026-11-13

Review fixes on pull request 3172, agent-decided. First: the audit log is the only way the server knows a category on a draft is its own, so a mark is now recorded before it is written. If the record cannot be appended nothing is written; if the write then fails, the journal says marked with no category, and the next call appends the missing clear record without touching Graph. A clear writes first and records after, retrying the record once. The failure direction is always 'recorded but absent', never 'present but unrecorded', which had left the server's own category on a draft for good. Second: a message's Graph id changes when it moves, so a draft filed into a folder read as missing and was retired. The draft-created record now keeps the draft's RFC 5322 message id, and on a 404 check-drafts makes one lookup by it: a draft that moved keeps being checked under its recorded id, a hit that is no longer a draft closes as sent, and no hit closes as missing. Immutable Graph ids were rejected: the driver has no such header and recorded ids would need migrating. Third: a read without an isDraft value no longer retires a draft; it is unreadable for that run. Not verified on the tenant, which was down: that a draft carries a message id from creation and keeps it when moved or sent. The tenant proof checks it.

Lane feat/outbox-draft-basis-check · PR #3172

Reverse: Write the category before the record again and drop the message-id lookup; draft-created lines that carry internetMessageId stay readable and the field is ignored.

### check-drafts retires a sent or missing draft with one draft-closed record, 2026-11-13

Operator ruling, 2026-11-13 (grill session). The attorney sends prepared drafts from Outlook, so the audit log never learns that a draft was sent, and without a closing record check-drafts would re-read every draft the server ever created on every call. When check-drafts finds a draft missing, or no longer a draft, it reports it and appends one draft-closed record with the reason; later calls skip it. A draft is open while it has a draft-created record and no draft-deleted, sent send-outcome or draft-closed record. The audit journal gains a record kind and no existing record changes, as the m365-agent-outbox packet's D-28 requires. Rejected: an age cutoff (a draft older than the cutoff would silently stop being checked while still unsent) and re-reading everything (cost grows without bound).

Lane feat/outbox-draft-basis-check

Reverse: Stop appending draft-closed and bound the check by draft age instead; recorded draft-closed lines stay readable and are ignored.

### Sessions call check-drafts; this goal ships no scheduled caller, 2026-11-13

Operator ruling, 2026-11-13 (grill session). SPEC.md forbids a timer inside the server, and a scheduled caller needs an entry point that is not an MCP tool call, which is a third pull request and so outside the appetite. The second pull request ships the tool and a runbook line: a session that prepares or reviews outbox drafts calls check-drafts first. Known limit, accepted: a draft that goes stale between calls stays unmarked until the next call, and the mark is as fresh as the last session that touched the outbox.

Lane feat/outbox-draft-basis-check

Reverse: Record a decision file that raises the appetite to a third pull request with a command-line entry and a workstation timer, and rule there whether the message pin stays.

### Tenant proof: the category stays on the sender's side, 2026-11-13

Run on 2026-11-13 in the firm tenant, by the route the operator ruled. Two test drafts were written to the attorney's mailbox through the outbox's app-only Graph path, and the category 'Draft - recheck before sending' was set on each with updateMessageCategories under the change key just read. One was addressed to a firm mailbox and to an outside mailbox the operator owns at another mail provider; the operator sent it from Outlook at 16:21Z. An agent's click on Send was refused by its permission layer, so the send was a person's. The other draft had no recipients and was discarded in Outlook on the web by the agent, on the operator's instruction, to test deletion.

Recipients. The firm recipient's copy, read through Graph, has an empty category list. The outside recipient's raw message (52 headers, read by the orchestrator session) has no Keywords header and no occurrence of the category text in headers or body; its Message-ID equals the draft's. The category reaches neither an internal nor an external recipient, so the mark ships as built and the check-drafts criterion stands unamended. The Sent Items copy in the attorney's mailbox keeps the category; that copy is the sender's own.

The three points the review fixes left unverified, now observed. First: the create response already carries an internetMessageId, the value is unchanged after the category write, and the sent copy has the same value under a new Graph id, with isDraft false; the recorded draft id answers 404 after the send. Second: the discarded draft has a new Graph id, keeps isDraft true and the same internetMessageId, and its recorded id answers 404. Third: that copy's parentFolderId equals the id Graph returns for the deleteditems folder. The moved-draft lookup, the sent test and the Deleted Items rule therefore rest on observed behaviour.

Limits. One tenant, one day, Outlook on the web, plain-text body, one outside provider. Whether a filing rule or another client would behave differently was not tested. The colour of the category still needs the one-time manual red category in the attorney's Outlook.

Lane feat/outbox-draft-basis-check · PR #3172

Reverse: Drop the mark by decision file and amend the check-drafts criterion if a later tenant or client shows the category on a recipient copy.

### The stale mark is the category 'Draft - recheck before sending', coloured by hand once, 2026-11-13

Operator ruling, 2026-11-13 (grill session). The attorney reads this label on a draft in his Drafts folder, so it says what to do and uses no system word; the internal reason word stays basis-changed. Rejected: 'Draft - basis changed' (our term, not his) and 'Draft - source changed'. Colour: the outbox app holds Mail.ReadWrite, Mail.Send and Calendars.ReadWrite on the one mailbox and cannot create an entry in the mailbox's category list, which needs MailboxSettings.ReadWrite. The runbook therefore gains one manual step: create the category once in the attorney's Outlook, in red. The server only writes the name and Outlook matches it to the coloured entry. Rejected: an uncoloured label (easy to miss) and a fourth Exchange role for the app (it would also let the app change other mailbox settings).

Lane feat/outbox-draft-basis-check

Reverse: Rename the category constant and the runbook step; drafts already carrying the old name keep it until check-drafts next clears them, so rename only while no draft is marked.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
