---
"@beep/mcp-kit": patch
"@beep/uspto-mcp": patch
---

Measure compact JSON budgets in UTF-8 bytes and include the USPTO inline response wrapper
when selecting a document tier. Return a fetchable handle when the minimal inline response
exceeds the limit, including for multibyte identifiers and exact boundary budgets.
