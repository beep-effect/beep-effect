# Agent Guide

`@beep/nlp-mcp` is a stdio MCP server (~42 tools) that mounts two toolkits:

- the product-neutral `@beep/nlp-processing/Tools/NlpToolkit` (25 tools) bound
  to its wink-backed handler layer (`WinkNlpToolkitLive` from `@beep/wink`) —
  this driver must not redeclare those tools, schemas, or handlers; and
- a driver-local `StreamingToolkit` (17 file/JSONL/dataset/pipeline tools)
  backed by `StreamingToolkitHandlersLive`, which uses `effect/FileSystem` +
  `effect/Path` (+ `HttpClient` for URL loads), provided at the entrypoint.

Streaming handlers annotate spans with counts, `path_length`, and `size_bytes`
only — never raw file content or line/record text. Integration tests use
synthetic temp fixtures only.
