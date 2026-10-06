---
"@beep/m365": minor
"@beep/m365-mcp": patch
---

Add mail-outbound verbs to the Microsoft 365 driver: create a draft, attach a file, send a draft and
delete a draft. Attachments up to 3 MiB go in one request and larger ones through an upload session
whose chunks carry no bearer token and run with HTTP client tracing off, so the session token in the
upload URL never reaches a span; a send with an unknown outcome fails as `"ambiguous write"` and
is not replayed. `GraphMessage` now decodes `bccRecipients` and `GraphEvent` decodes `attendees`
(new `GraphEventAttendee`), and the MCP server's test stubs cover the new verbs without exposing
them as tools.
