---
"@beep/acp": patch
---

Follow effect rc.117 in the ACP JSON-RPC codec: an untagged JSON-RPC error response now decodes to a `Fail` cause entry carrying the raw error (matching effect's ndjson `RpcSerialization`, which previously produced a `Die` defect), and the JSON-text getter is built with `SchemaGetter.transformEffect` because rc.116 removed `SchemaGetter.onSome`.
