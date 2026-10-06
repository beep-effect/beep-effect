---
"@beep/practice-kg-mcp": patch
---

Add `practice-kg-mcp --self-check`: it opens the bundle and both stores the way
the server does, prints one JSON line with the versions, node and matter counts
and tool count, and exits without serving MCP, so an install can be verified
over SSH.
