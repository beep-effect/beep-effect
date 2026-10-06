---
"@beep/m365-mcp": minor
"@beep/m365": patch
---

Add the `beep-m365-outbox` stdio MCP server (`bin-outbox.ts`): prepare a mail draft with attachments
from allowlisted local directories, read or delete that draft, send it, and create or update calendar
events for one configured mailbox on the app-only lane. Only `m365_outbox_send_draft` sends, only a
draft this server recorded creating, and only after the stored draft matches the restated
recipients, subject and attachments, which are verified by downloading and hashing the stored bytes;
every send is written to a local audit log first. `m365_outbox_update_event` changes only an event
this server recorded creating that has no attendees, because Graph mails attendees when a meeting
changes. Launch it with `op run --no-masking`: stdout is the JSON-RPC channel. The read-only `beep-m365` toolkit is unchanged; both servers now also answer the handshake-era MCP
protocol versions (2025-11-25 back to 2024-11-05), so Claude clients that open with `initialize` can
start them. `@beep/m365` now
exports `GraphPathSegment` so a host can validate ids at its own boundary. The read-only
`m365_get_event` and `m365_list_events` results now include `attendees` when Graph returns them.
