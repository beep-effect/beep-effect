# @beep/m365-mcp

Model Context Protocol servers for Microsoft 365 over stdio. Both expose
`@beep/m365` driver verbs as schema-first MCP tools.

| Server | Executable | Lane | Does |
| --- | --- | --- | --- |
| `beep-m365` | `src/bin.ts` | Delegated, read-only | Reads drives, sites, mail and calendar. |
| `beep-m365-outbox` | `src/bin-outbox.ts` | App-only, one mailbox | Prepares and sends mail with attachments; writes calendar events. |

## Read-only server

- OneDrive and SharePoint read tools for drives, sites, drive item deltas,
  downloads, list item fields, and versions.
- Outlook read tools for mail messages and calendar events.
- No write tools, HTTP transport, SSE transport, ingestion wiring, Teams, Excel,
  or Graph query logic.

`src/bin.ts` launches `makeServerLayer` with `NodeStdio.layer` and the live
`M365.layer`; authentication and Graph transport remain owned by `@beep/m365`.

## Outbox server

The outbox is the route by which an agent session sends mail from the
configured mailbox. Contract and decisions: `goals/m365-agent-outbox/SPEC.md`.

| Tool | Does | Sends mail |
| --- | --- | --- |
| `m365_outbox_create_draft` | Creates a draft and attaches files from local paths. Returns the draft id and each attachment's name, size and sha256. | No |
| `m365_outbox_get_draft` | Returns the stored draft's recipients, subject, body length, and each stored attachment's name, size and sha256. | No |
| `m365_outbox_delete_draft` | Deletes a draft this server created that is still a draft. | No |
| `m365_outbox_send_draft` | Checks the stored draft against an `expect` block, then sends it. | **Yes, the only one** |
| `m365_outbox_create_event` | Creates a calendar event. No attendees. | No |
| `m365_outbox_update_event` | Changes fields of a calendar event. No attendees. | No |

No tool takes a mailbox: it is fixed by `M365_OUTBOX_MAILBOX`.

### Sending

`send_draft` takes the draft id and `expect`: the `to`, `cc` and `bcc`
addresses, the subject, and every attachment as `{ name, size, sha256 }`, all
three required. It reads the draft back, downloads each stored attachment and
hashes it, and sends only when:

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
| `unknown` | The request may or may not have reached Graph. | Call `get_draft`. A draft that is gone, or is no longer a draft, was sent. Never send again blindly. |

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
`send-outcome`. Draft creation, draft deletion and event writes write one
record each. Records hold recipients, subjects, attachment names, sizes and
digests, never a body or bytes. The log stays on the workstation.

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
op run --env-file=./packages/drivers/m365-mcp/outbox.env -- bun run ./packages/drivers/m365-mcp/src/bin-outbox.ts
```

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
