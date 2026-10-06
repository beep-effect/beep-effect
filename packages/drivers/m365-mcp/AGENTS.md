# Agent Guide

`@beep/m365-mcp` holds two stdio MCP servers over `@beep/m365`. Keep Graph
auth, HTTP transport, decoding, and redaction in that driver.

- `beep-m365` (`bin.ts`, `M365Toolkit`, `makeServerLayer`): read-only tools on
  the delegated lane. Do not add a write tool to this toolkit; a test pins its
  tool names.
- `beep-m365-outbox` (`bin-outbox.ts`, `OutboxToolkit`, `makeOutboxServerLayer`):
  drafts, attachments, one send tool and calendar writes for one configured
  mailbox on the app-only lane. Contract: `goals/m365-agent-outbox/SPEC.md`.

Outbox rules that must hold after any change:

- Only `m365_outbox_send_draft` reaches the driver's send verb, after the send
  guard passes and the `send-intent` audit record is on disk.
- The guard compares what the mailbox stores: attachments are downloaded and
  hashed at check time. Never key on the size Graph reports or on a record of
  what was uploaded.
- No tool takes a mailbox or attendees.
- Attachments come only from the configured roots.

Do not add HTTP/SSE MCP transports, ingestion wiring, Teams, Excel, Search, or
custom Graph request construction here.

Span annotations may include resource names, counts, byte sizes and outcomes,
but never addresses, subjects, file names, paths, document content, message
bodies, tokens, or raw secrets.
