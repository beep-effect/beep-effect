# @beep/m365-mcp

Model Context Protocol servers for Microsoft 365 over stdio. Both expose
`@beep/m365` driver verbs as schema-first MCP tools.

| Server | Executable | Lane | Does |
| --- | --- | --- | --- |
| `beep-m365` | `src/bin.ts` | Delegated, read-only | Reads drives, sites, mail and calendar. |
| `beep-m365-outbox` | `src/bin-outbox.ts` | App-only, one mailbox | Prepares mail with attachments and writes calendar events. Automated sending is disabled. |

## Read-only server

- OneDrive and SharePoint read tools for drives, sites, drive item deltas,
  downloads, list item fields, and versions.
- Outlook read tools for mail messages and calendar events.
- No write tools, HTTP transport, SSE transport, ingestion wiring, Teams, Excel,
  or Graph query logic.

`src/bin.ts` launches `makeServerLayer` with `NodeStdio.layer` and the live
`M365.layer`; authentication and Graph transport remain owned by `@beep/m365`.

## Outbox server

The outbox prepares mail in the configured mailbox. Automated sending is
temporarily disabled because Graph's draft-send action cannot bind the send to
the draft version that was checked. Contract and original design:
`goals/m365-agent-outbox/SPEC.md`; security decision:
`goals/codex-security-findings-2026-10-14/SPEC.md`.

| Tool | Does | Sends mail |
| --- | --- | --- |
| `m365_outbox_create_draft` | Creates a draft and attaches files from local paths. Returns the draft id and each attachment's name, size and sha256. | No |
| `m365_outbox_get_draft` | Returns the stored draft's recipients, subject, body length, and each stored attachment's name, size and sha256. Reads any draft id in the mailbox. | No |
| `m365_outbox_delete_draft` | Deletes a draft this server created that is still a draft. | No |
| `m365_outbox_send_draft` | Checks the stored draft against `expect`, then refuses with `version-unbound`; it cannot safely send a mutable draft. | No |
| `m365_outbox_create_event` | Creates a calendar event. No attendees. | No |
| `m365_outbox_update_event` | Changes fields of a calendar event this server created, when the event has no attendees. | No |
| `m365_outbox_check_drafts` | Rechecks every unsent draft this server created against its pins and sets or clears one Outlook category on it. | No |

No tool takes a mailbox: it is fixed by `M365_OUTBOX_MAILBOX`.

"This server created" means the audit log holds a `draft-created` or
`event-created` record for the id. `get_draft` reads any draft; sending,
deleting and updating are limited to what the log records.

### Calendar events

`update_event` reads the event before it changes anything and refuses when:

- the audit log has no `event-created` record for the id (`not-created-here`);
- the event has at least one attendee (`has-attendees`), for example because
  someone added one in Outlook.

Microsoft Graph mails every attendee of a meeting when its subject, body or
time changes. That would be a send outside the `expect` check and the audit
pair, so an event with attendees is never changed by this server.

### Basis

A draft can rest on things the agent read in the mailbox: the calendar event
a date came from, the message being answered. `create_draft` takes them as
`basis`, a list of pins. Each pin names one item by `kind` (`event` or
`message`) and Graph `id`, and carries the `view` the agent wrote the draft
from:

- an event: `subject`, `start` and `end` (`dateTime` and `timeZone` exactly
  as Graph returned them; the server asks for no time zone, so these are
  UTC), `isAllDay` and `isCancelled`;
- a message: its `internetMessageId` and, when the agent saw one,
  `newestOtherReply`, the `internetMessageId` of the newest later message
  in the conversation from someone other than the mailbox.

The server reads every pinned item itself before it creates anything, and
the pin stores the server's read, never the agent's. Creation is refused,
and nothing is created, with one of these reasons:

| Reason | Meaning |
| --- | --- |
| `basis-unreadable` | The item could not be read, or lacks a field the view needs. |
| `basis-series-master` | The event is a recurring series master; pin one occurrence instead. |
| `basis-changed` | The item no longer matches the view the agent passed. The message names the fields. Read the item again and redo the draft. |

Only the named fields count: a new category, reminder or `changeKey` on the
item changes nothing. A message is found again by its `internetMessageId` in
one listing of its conversation, so filing it into another folder does not
lose it.

`get_draft` rechecks every pin and returns a `basis` report with a status per
pin (`Current`, `Changed` with the fields and the fresh view, `Gone`, or
`Unreadable`) and one verdict:

| Verdict | Meaning |
| --- | --- |
| `unpinned` | The draft was created without pins. |
| `pinned-current` | Every pinned item is as it was. |
| `pinned-stale` | A pinned item changed or is gone. Review the draft. |
| `pinned-unverified` | No pin is stale, but one could not be read. |

`check_drafts` takes no parameters. It rechecks every draft this server
created that is not yet deleted, sent or closed, and marks it in Outlook with
the category `Draft - recheck before sending`:

- a `pinned-stale` draft gets the category;
- a `pinned-current` draft loses it again, but only when this server set it;
  a category a person added is left alone;
- a `pinned-unverified` draft keeps its categories as they are, and an
  `unpinned` draft is never touched.

Every other category stays, in order, and the write is conditional on the
draft's `changeKey`, so an edit in Outlook in between makes it fail; the next
call retries. The only change the tool makes to a draft is its category list.
Each mark is recorded before the category is written, and each removal right
after, so the audit log never misses a category this server set: when the
log cannot be written, nothing is set, and a removal whose record is still
missing is reported as `cleared-unrecorded` and recorded on the next call.
A draft moved out of Drafts into another folder gets a new Graph id; it is
still found by its RFC 5322 message id. A copy in Deleted Items does not
count: a draft deleted in Outlook is retired as missing. A draft recorded
before message ids were stored learns its id on the next check. A draft that is no longer a draft, or
is gone, is reported, recorded as closed and not checked again. The result lists each draft with its recorded
subject, verdict and what was done to the category, the closed and the
unreadable drafts, and a count per verdict.

The mark is advisory. The attorney's Send in Outlook is never blocked, and
nothing runs `check_drafts` on a schedule: a draft that goes stale between
calls stays unmarked until the next call, so a session that prepares or
reviews outbox drafts calls it first. Sending through this server stays
disabled (`version-unbound`). The category's colour comes from a category of
the same name created once in the attorney's Outlook; see
`docs/runbooks/m365-agent-outbox-registration.md`.

### Sending

`send_draft` takes the draft id and `expect`: the `to`, `cc` and `bcc`
addresses, the subject, and every attachment as `{ name, size, sha256 }`, all
three required. A draft id the audit log has no `draft-created` record for is
refused with the single field `not-created-here`; nothing is read or
downloaded. A draft created here and later edited in Outlook can be restated
in `expect`. For a draft it created, the server reads the draft back,
downloads each stored attachment and hashes it. It checks:

- the message is still a draft;
- each recipient list equals the expected one as a set (case and surrounding
  whitespace of an address are ignored);
- the subject is equal after trimming;
- the stored attachments equal the expected ones, counting duplicates, by
  name, byte length and sha256 of the stored bytes.

`size` is the length of the content, not the size Microsoft Graph reports for
the attachment, which includes storage overhead. `create_draft` and
`get_draft` return the values to restate. `get_draft` computes them from what
the mailbox stores, so a draft edited in Outlook can still be restated, and an
attachment swapped for another of the same name and size is caught by its
digest.

Even when every check matches, `send_draft` returns `refused` with
`version-unbound` and does not call Graph's send action. Another principal
could edit the draft between the final read and that action. A human can send
the prepared draft in Outlook after reviewing it. Automated sending can return
only after an immutable message request or a documented version-bound send
path is implemented and tested.

A draft is refused with `attachments` when it holds something that cannot be
verified: an item or reference attachment, an inline one, one without a name
or one that cannot be downloaded. It is also refused, without downloading,
when it holds more attachments than the count limit or when Graph reports
them as more than twice the per-message byte limit. `get_draft` fails on the
same drafts with the number of attachments at fault.

The result's `outcome` is one of:

| Outcome | Meaning | What to do |
| --- | --- | --- |
| `sent` | Graph accepted the send. | Nothing. |
| `refused` | Nothing was sent. `mismatches` names the differing fields. | Read the draft with `get_draft` and restate it. |
| `unknown` | The request may or may not have reached Graph. | Call `get_draft`. A draft that is still there was not sent. One that is gone, or is no longer a draft, was probably sent: confirm it in Sent Items before reporting it as sent, since a draft can also be deleted or moved elsewhere. Never send again blindly. |

A request Graph rejects outright is a tool error; nothing was sent.

### Attachments

A path must be absolute and must resolve, after following symlinks, to a
regular non-empty file under an attachment root. With
`M365_OUTBOX_ATTACHMENT_ROOTS` unset, the one root is the staging directory
`${XDG_DATA_HOME:-$HOME/.local/share}/beep/m365-outbox/attachments`, which the
server creates. Copy a file there to make it attachable. Limits default to
25 MiB per file, 25 MiB per message and 20 files. After attaching,
`create_draft` reads the stored attachments back and compares them with the
local files. If an attachment fails or does not round-trip, the draft is
deleted and the call fails.

### Audit log

Append-only JSON Lines, one `YYYY-MM.jsonl` per month, in
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/m365-outbox/audit` (mode 0700). A
send that passes the guard writes `send-intent`, flushed to disk before the
Graph call, then `send-outcome` with the same `auditId`; if the intent cannot
be written, nothing is sent. A send the guard refuses writes one refused
`send-outcome`, and so does a send of a draft the log has no creation record
for. Draft creation, draft deletion and event writes write one record each; a
refused event update writes none. `check_drafts` writes `draft-basis-marked` or
`draft-basis-cleared` for each category it sets or removes, `draft-closed`
for a draft it finds sent or missing, and `draft-identified` once for a draft
recorded without a message id. Records hold recipients, subjects, attachment names, sizes and
digests, never a body or bytes. The log stays on the workstation.

Each append writes a newline, the record and a newline, so a file has an empty
line between records. If a crash leaves a partial record at the end of a file,
the next record still starts on its own line; readers skip empty lines and
lines that do not decode. The `draft-created` and `event-created` records are
what later permit sending, deleting and updating, so do not delete or trim the
log files while drafts or events made through this server are still in use.

### Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `M365_OUTBOX_TENANT_ID` | yes | Entra tenant id. |
| `M365_OUTBOX_CLIENT_ID` | yes | Client id of the outbox's own registration. |
| `M365_OUTBOX_CERT_THUMBPRINT_SHA256` | yes | SHA-256 thumbprint of its certificate. |
| `M365_OUTBOX_CERT_PRIVATE_KEY` | yes | PEM private key of that certificate. |
| `M365_OUTBOX_MAILBOX` | yes | The one mailbox the tools address. |
| `M365_OUTBOX_ATTACHMENT_ROOTS` | no | Absolute directories separated by `:`. Default: the staging directory above. |
| `M365_OUTBOX_MAX_ATTACHMENT_BYTES` | no | Per-file limit. Default 26214400. |
| `M365_OUTBOX_MAX_MESSAGE_ATTACHMENT_BYTES` | no | Per-message limit. Default 26214400. |
| `M365_OUTBOX_MAX_ATTACHMENTS` | no | File count limit. Default 20. |
| `M365_OUTBOX_AUDIT_DIR` | no | Audit log directory. Default as above. |

The five required values are 1Password references in `outbox.env`, resolved at
launch:

```bash
op run --no-masking --env-file=./packages/drivers/m365-mcp/outbox.env -- bun run ./packages/drivers/m365-mcp/src/bin-outbox.ts
```

`--no-masking` is required: the server's stdout is the MCP JSON-RPC channel,
and without the flag `op run` rewrites any tool result that contains the
mailbox address to `<concealed by 1Password>`.

The repository's `.mcp.json` registers that command as `beep-m365-outbox`.
Without the credentials the server exits with a configuration error naming the
missing variable. Registration of the Entra application:
`docs/runbooks/m365-agent-outbox-registration.md`.

## Protocol versions

Both servers answer MCP `2026-07-28` first and also the handshake-era versions
`2025-11-25`, `2025-06-18`, `2025-03-26` and `2024-11-05`, so a client may open
with `initialize` or call tools directly. Claude Code and Claude Desktop open
with `initialize`; a host that lists only `2026-07-28` refuses it. The
read-only server gained the handshake-era versions on 2026-10-06; its tools,
instructions and handlers did not change.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

The outbox live smoke (`test/integration/Outbox.live.test.ts`) runs only when
the `M365_OUTBOX_*` credentials are present, and writes nothing without an
opt-in:

| Environment | What it does |
| --- | --- |
| credentials only | Acquires a token and reads one page of drafts. |
| `M365_OUTBOX_LIVE_WRITE=1` | Also creates a draft to the mailbox itself with one synthetic attachment, reads it back and deletes it. |
| `M365_OUTBOX_LIVE_SEND=1` (implies write) | Also creates such a draft and sends it, then checks the audit pair. |

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/m365-mcp` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
