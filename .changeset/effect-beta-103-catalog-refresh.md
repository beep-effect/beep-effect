---
{}
---

No release: refresh the vendored Effect subtree and root dependency catalog to
Effect 4.0.0-beta.103, and migrate the repo to the breaking API changes that
release carries.

- `SchemaIssue` no longer carries `actual` on any variant (upstream #6912), so
  every `InvalidValue` / `InvalidType` / `Forbidden` / `Composite` construction
  drops that argument. Built-in formatters no longer interpolate rejected input;
  the repo's own messages are unchanged.
- `Schema.UnknownFromJsonString` became internal (upstream #6707); call sites now
  use `Schema.fromJsonString(Schema.Unknown)`, including the `SyncDataToTs`
  renderer and its generated modules, and the schema-first lint advisory text.
- `McpServer.layerStdio` / `layerHttp` now require a `protocols` adapter list.
- `Context.mutate` is gone now that `Context.add` is O(1); the DuckDB SQL client
  pipes `Context.add` directly, matching upstream's own SQL client.
- `FileSystem.File` no longer exposes `fd`, so the vault sync engine binds the
  canonical path to the open descriptor by device + inode instead of reading
  `/proc/self/fd`, preserving the same TOCTOU guarantee portably.
- `Sse.decode` can now fail with `SseError`; the OpenAI-compatible streaming
  client maps it to an `InvalidOutputError`.

The `@effect/tsgo-*` platform binaries are held back alongside `@effect/tsgo`
itself, so `deps:update` stops pulling a compiler whose 0.20+ rules are a
separate remediation campaign.
