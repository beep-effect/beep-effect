# Agent Guide

`@beep/uspto-mcp` is a thin stdio MCP host wiring `@beep/uspto` through
`@beep/mcp-kit`: credential-keyed composition, the `api_key_required`
envelope, and field-tier projection.

Keep the kit as the source of gating machinery: handlers resolve the shared
`USPTO_API_KEY` credential via `resolveSourceCredential` (soft-gate
`UsptoSourceAuthRegistration`) before ever calling `@beep/uspto`, tool
failures are a union of the kit's `ApiKeyRequiredFailure` and post-gate
`UsptoToolError`, and the server composes the toolkit through
`composeGatedLayers`/`gatedLayer`/`sanitizedToolkit`. Document projection uses
the kit's `projectFieldTier`/`toColumnarEnvelope`/`estimateJsonSize` budget
helpers — do not reimplement any of this locally.
