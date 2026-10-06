---
"@beep/m365": minor
"@beep/m365-mcp": patch
---

Add an app-only (confidential client, certificate-first) auth lane and mailbox
write verbs: calendar event create, update, delete and lookup by idempotency
key, master category list, create and ensure, message category update, paged
message listing, and attachment list and download. A create whose outcome is
unknown now fails as `"ambiguous write"` instead of being replayed. The unused
`clientSecret` field is removed from the delegated `M365ConfigInput`. The MCP server
exposes none of the new verbs; its tool-error schema gains the new reason.
