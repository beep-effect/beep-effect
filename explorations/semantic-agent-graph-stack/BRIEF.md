# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

An agent session prepares a mail draft in the attorney's mailbox from things
it read: a date on the Outlook docket entry, the message it is answering.
The attorney reviews the draft and sends it from Outlook, sometimes hours or
days later. If the docket entry moves or the thread gains a new message in
between, the draft still says the old thing, and nothing shows the attorney
that it went stale.

The outbox already checks the other half. Its send guard proves the draft is
what the caller thinks it is: recipients, subject, attachment bytes. Nothing
checks that the facts the draft was written from are still the facts.

No incident is on record. The scenario is the operator-change example from
Liu et al. ([`RESEARCH.md`](RESEARCH.md), 2026-11-06 section) mapped onto
the practice: the read succeeds, the draft is well formed, and the action is
wrong. It is cheap to guard now and expensive to explain to a client later.

Why this slice and not the wider stack: [`DECISIONS.md`](DECISIONS.md)
closes nine of the ten ranked patterns by reference. This is the one that
has no owner.

## Appetite

Small: two pull requests, about a week of one lane. The budget shapes the
solution in three ways.

- Pins point only at Microsoft Graph items, which the outbox can re-read
  itself. Nothing outside the driver is touched.
- The check is advisory. Send stays closed.
- If the work needs a third pull request, the message pin is cut and the
  event pin ships alone.

## Solution Sketch

A draft carries a list of pins. A pin names one Graph item and holds a
digest of the fields the draft relied on. Staleness is a comparison of that
digest with a fresh read.

```text
BasisPin     = { kind: "event" | "message", id, digest, observedAt }
BasisStatus  = Current
             | Changed      the fields differ now
             | Gone         the item no longer exists
             | Unreadable   Graph could not be asked
BasisReport  = pinned-current | pinned-stale | unpinned, plus one status per pin
```

The caller supplies `kind` and `id` only. The server reads the item and
computes the digest, the way it already computes attachment digests from
stored bytes instead of trusting the caller.

The digest covers a named view of the item, not the whole item:

- event: subject, start, end (with time zone), all-day flag, cancelled flag;
- message: its RFC 5322 message id, and whether a later message from
  another sender exists in the same conversation.

Flow:

```text
create_draft(..., basis: [{kind, id}])
   server reads each item, computes its digest,
   writes the pins into the draft-created audit record
        |
   (time passes; the docket entry is moved in Outlook)
        |
get_draft            -> returns the BasisReport for that draft
check_drafts (new)   -> every unsent draft this server created:
                        recheck, then set or clear one Outlook
                        category on the draft
        |
   the attorney sees the category in Drafts before pressing Send
```

Boundaries:

- Everything lives in `@beep/m365-mcp`, beside the send guard. The
  comparison is a pure function over two schemas and is property-tested,
  like `checkSendExpectation`.
- The mark is one Outlook category written through the driver's existing
  category verb. The draft's subject and body are never edited.
- An empty basis is allowed and reported as `unpinned`, so the share of
  unpinned drafts can be counted. The server cannot make an agent pin.
- The reason word is `basis-changed`, the word
  `ClaimEvidenceReviewStatus.Stale` already uses in `@beep/epistemics`.

## Rabbit Holes

- **`changeKey` over-triggers.** The operator's pick named the item id plus
  its `changeKey`. The driver's own schema says `changeKey` changes on every
  edit, and mail tagging writes categories onto inbound messages, so a
  `changeKey` pin would call a draft stale when someone tagged the message
  or dismissed a reminder. Patched here: compare a digest of the named
  fields, and keep `changeKey` in the audit record only.
- **Does a category on a draft travel with the sent mail?** Not known.
  The goal proves it on the firm tenant before it writes any mark. If the
  category reaches recipients, the mark is dropped and the report stays in
  tool output only. Inherited risk.
- **Recurring events.** A pin on one occurrence, an exception or a series
  master each mean something different. First slice: single instances and
  occurrences by their own id; a series master is refused as a pin.
- **Time zones.** The digest must canonicalize start and end with their
  zone, or a harmless re-rendering reads as a change.
- **What "a newer message" means.** Listing a conversation can be slow and
  paged. If it takes more than one list call, the message pin is cut (see
  Appetite).
- **Audit log shape.** `draft-created` gains a field. Old records must
  decode with an empty basis; the outbox packet's D-28 already asks for
  compatible journal evolution.
- **Which drafts are open.** A draft with no terminal audit record may have
  been sent or deleted in Outlook. `check_drafts` reads it; a missing or
  non-draft message is skipped and reported, never marked.
- **File overlap.** `m365-agent-outbox` slice 3 (reply, forward, draft
  update) edits the same handlers and tools. The goal sequences its pull
  requests around that slice and states what an updated draft does to its
  basis.

## No-Gos

- No reopening of agent sending and no change to `version-unbound`.
- No pin on a fact outside Microsoft Graph, and no digest restated by the
  caller.
- No import of any slice from the driver, and no shared-kernel or
  foundation schema for pins until a second consumer exists.
- No blocking of Outlook's Send, and no edit to a draft's subject or body
  to show staleness.
- No timer or background service inside the MCP server. A session or a
  scheduled task calls `check_drafts`.
- No transitive dependency walk, no graph store, no context assembler, no
  extraction pipeline.
