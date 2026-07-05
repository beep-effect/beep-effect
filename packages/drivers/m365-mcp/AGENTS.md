# Agent Guide

`@beep/m365-mcp` is a stdio MCP server exposing Microsoft 365 read-only tools
(`M365Toolkit`, `makeServerLayer`). It is a read-only facade over `@beep/m365`;
keep Graph auth, HTTP transport, decoding, and redaction in that driver.

Do not add write tools, HTTP/SSE MCP transports, ingestion wiring, Teams,
Excel, Search, or custom Graph request construction here.

Span annotations may include resource names, counts, and byte sizes, but never
document content, message bodies, tokens, or raw secrets.
