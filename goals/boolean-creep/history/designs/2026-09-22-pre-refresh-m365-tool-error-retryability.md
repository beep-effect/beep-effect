# Instance

- id: `m365-tool-error-retryability`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/drivers/m365-mcp/src/M365Tools.ts:78`
- symbol: `M365ToolError`
- members: `reason`, `retryable`
- evidence classes:
  - E4 at `packages/drivers/m365-mcp/src/M365Handlers.ts:36-47` — the sole production writer sets retryable exactly for `throttled` and `transport` while carrying the same driver reason.
  - E4 at `packages/drivers/m365-mcp/test/Server.test.ts:170-200` — explicit wire fixtures preserve `Some(throttled)` with true and `None` with false.

# Current shape

`M365ErrorReason` is the existing eight-literal owner at `packages/drivers/m365/src/M365.errors.ts:49-62`. `M365ToolError` stores `reason: Option<M365ErrorReason>` and a separate required boolean at `M365Tools.ts:70-91`. The handler derives both from one `M365Error` at `M365Handlers.ts:36-47`: every production error has a reason, and only transport or throttling is retryable.

The class is exported through `packages/drivers/m365-mcp/src/index.ts:28-41` and is the failure codec for eleven MCP tools at `M365Tools.ts:108-377`. Its encoding is therefore an app-owned MCP wire contract, not a mirror of a Graph SDK type. The explicit tests at `Server.test.ts:168-205` require the encoded `retryable` key and optional-key encoding for `reason`. The schema-derived arbitrary test at lines 207-226 proves that the current permissive codec is invertible; it does not make incoherent business tuples supported.

# Cardinality gap

The boolean combined with absence or one of eight reason literals represents 18 tuples. Nine are supported:

| reason | retryable |
| --- | --- |
| absent | false |
| `config` | false |
| `auth` | false |
| `request encoding` | false |
| `response decoding` | false |
| `response status` | false |
| `encrypted item` | false |
| `transport` | true |
| `throttled` | true |

There is no supported absent/true state, retryable false transport or throttling, or retryable true non-transport reason. False does not imply absence, so this is a reason-derived policy projection rather than an option-presence bit.

# Target schema

Keep `Option<M365ErrorReason>` as the only semantic variable and target shape; do not introduce another literal vocabulary. Replace the public schema with a transformation between an exact private legacy encoded struct and the semantic `M365ToolError` model without a decoded `retryable` field.

The encoded struct retains `message`, `operation`, optional-key `reason`, required boolean `retryable`, and `toolName` exactly. Decode derives the expected retryability from the decoded reason and succeeds only when the encoded boolean matches. Encode always writes `retryable: true` for `Some(transport)` or `Some(throttled)` and false otherwise. `None` continues to omit `reason` while emitting `retryable: false`. Use the existing `M365ErrorReason` match/guards and `Option`; do not add a generic retry-policy helper.

# Migration inventory

- `packages/drivers/m365/src/M365.errors.ts:49-79` — reuse the existing `M365ErrorReason` LiteralKit and exported type unchanged.
- `packages/drivers/m365-mcp/src/M365Tools.ts:46-91` — split the exact five-key legacy encoded struct from the semantic model, remove decoded `retryable`, and expose the transformed schema under the existing `M365ToolError` name. Update the example to inspect the reason or encoded result rather than a removed semantic boolean.
- `M365Tools.ts:108-377` — keep all eleven `Tool.make` declarations on `failure: M365ToolError`; their names, failure mode, hints, parameters, and success schemas do not change.
- `packages/drivers/m365-mcp/src/M365Handlers.ts:34-48` — delete `isRetryableM365Error` and the duplicate `retryable` constructor argument. Continue mapping message, operation, `Some(error.reason)`, and tool name exactly.
- `packages/drivers/m365-mcp/src/index.ts:28-41` and `package.json:39-60` — preserve the root export and published subpath behavior.
- `packages/drivers/m365-mcp/test/Server.test.ts:66-68,168-226` — derive arbitrary values from the target semantic schema, retain both exact wire fixtures, add all nine supported projections, and reject all nine incoherent legacy tuples on decode.
- `packages/drivers/m365-mcp/test/Server.test.ts:228-247` and integration tests — preserve the eleven exposed tool names and stdio MCP behavior.

Targeted repository and barrel search found no reader of `M365ToolError.retryable` outside its JSDoc and wire assertions. The handler is the sole production constructor; the explicit no-reason test fixture is the sole supported constructor outside it.

# Guard-deletion accounting

Delete the decoded `retryable` class field and its independent constructor input at `M365Tools.ts:81-83`, the handler-local `isRetryableM365Error` function at `M365Handlers.ts:36-37`, and the `retryable` write at line 46. The codec has one boundary derivation and one equality validation because the legacy wire key must remain; it cannot represent an incoherent semantic value. Remove arbitrary-test coverage of incoherent decoded objects and replace it with supported-schema generation plus explicit legacy rejection cases.

# Encoded-side impact

The encoded wire is byte-shape compatible for all nine supported values. `retryable` remains a required boolean key, `reason` remains an optional string key with the same eight literals, and the other fields remain unchanged. Decoding now rejects the nine incoherent combinations that no documented fixture or runtime writer supports. Encoding the semantic model deterministically reproduces the old canonical projection. No migration of MCP clients, persisted data, or tool declarations is required.

# Test impact

Retain exact assertions for throttled/true and absent/false. Add table-driven encode/decode assertions for all eight reasons and absence, including transport/true. Add decode failures for the inverse boolean of every row. Keep the schema-derived property test, now generated from the semantic target, so it proves all generated values round-trip through the compatibility codec without granting incoherent tuples business legitimacy. Retain the MCP toolkit list and stdio call tests unchanged.

# Risk and sequencing

Tier 2 stored/wire migration. Land the semantic model, compatibility codec, handler constructor, JSDoc, and tests atomically because `M365ToolError` is exported and installed in eleven tools. The main risks are dropping the required wire key, encoding `None` with a `reason` key, or changing which reason literals retry. No source reason vocabulary, tool API, dependency, generated file, or generic abstraction is added.
