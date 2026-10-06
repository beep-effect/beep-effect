---
"@beep/m365": minor
"@beep/m365-mcp": patch
---

Add `getMailFolder`: read one Outlook mail folder by id or well-known name
(`inbox`, `sentitems`, `deleteditems`, `junkemail`), so a caller can resolve
the folders it must skip. The MCP server does not expose it.
