# P0: the message pin costs one list call

Dated 2026-11-10. This note backs the decision file
`2026-11-10-the-message-pin-ships-on-one-conversation-list-call.md`. It
records a read-only probe against the firm tenant and the recheck design it
supports.

## The question

`SPEC.md` ships the message pin only if "a later message from another
sender" costs one list call. The schema note of the same day added a hazard:
a message's Graph id changes when it is moved to another folder, so a pin
rechecked by id would read as `Gone` once the attorney files the message.

Both turn on one fact the Graph resource page does not state: whether
`conversationId` can be used in a `$filter` on a mailbox's messages.

## The probe

A scratch script inside `@beep/m365-mcp` built the outbox's own live
services (`loadOutboxConfig`, `makeOutboxLiveServices`) and called the
driver's `listMessages` on the outbox mailbox. It printed counts and
booleans only: no address, subject, body or id. It was deleted after the
run and no mailbox write was made.

| Request | Result |
| --- | --- |
| `$orderby=receivedDateTime desc`, `$top=25` | 25 messages; the busiest conversation had 9 of them |
| `$filter=conversationId eq '<id>'`, `$top=500` | HTTP 200, 13 messages, no next link |
| the same, plus `$orderby=receivedDateTime desc` | HTTP 400 |
| `$filter=receivedDateTime ge 1900-01-01T00:00:00Z and conversationId eq '<id>'`, `$orderby=receivedDateTime desc` | HTTP 200, 13 messages |

Shape of the 13 messages from the plain filter: every one carried the
requested `conversationId`, `from`, `internetMessageId` and
`receivedDateTime`; they sat in 2 distinct folders; none was a draft.

## What it shows

- `conversationId eq` is a supported filter on `/users/{mailbox}/messages`
  in this tenant, through the driver's existing `listMessages`. The driver
  needs no change.
- The list spans folders. A pinned message that was filed into another
  folder is still in the page, under a new Graph id and the same
  `internetMessageId`.
- Sorting by receipt time needs the documented filter-first form. The
  design does not sort on the server: one page of a conversation is small
  and is ordered in memory.

## The recheck design

At creation, for a pin `{ kind: "message", id }`:

1. `getMessage(id)` reads the pinned message. It must carry an
   `internetMessageId` and a `conversationId`; otherwise creation is
   refused as unreadable.
2. One `listMessages` call with `conversationId eq '<id>'`, a fixed
   `$select` (`id`, `internetMessageId`, `from`, `receivedDateTime`,
   `isDraft`) and `$top=500` reads the conversation.
3. The view is the pinned message's `internetMessageId` and
   `newestOtherReply`: the `internetMessageId` of the newest message in the
   conversation that is not a draft, was received after the pinned message
   and was not sent from the outbox mailbox. It is absent when there is
   none.

The pin stores the `conversationId` beside the Graph id. It is a lookup
key, like the id, and is never compared.

At recheck, one `listMessages` call by the stored `conversationId`:

- the pinned message is found by `internetMessageId`, whatever folder it is
  in now. Not found: `Gone`;
- the view is rebuilt from the page and compared field by field;
- a failed call, or a page with a next link (a conversation of more than
  500 messages), is `Unreadable`.

"Another sender" is decided by comparing a message's `from` address with
the configured mailbox, ignoring case. When the mailbox is configured as a
directory object id and not an address, no sender matches, so a reply the
attorney sent by hand also counts. That over-reports and never
under-reports, and the report is advisory.

## Cost

Creation: one get and one list per message pin. Recheck: one list per
message pin. The event pin stays at one get either way.
