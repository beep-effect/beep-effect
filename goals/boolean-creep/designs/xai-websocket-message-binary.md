# Instance

- id: `xai-websocket-message-binary`
- file:line: `packages/drivers/xai/src/XAi.models.ts:469`
- symbol: `XAiWebSocketEvent`
- members: `isBinary`, `bytes`, `text`
- evidence: E3/E1 at `XAi.service.ts:706-721` — the WebSocket callback writes
  either binary bytes or text/decoded data and copies `isBinary`; it never
  writes the opposite payload.

# Current shape

Every outer `close | error | message` member currently receives the same
optional `bytes`, `data`, `isBinary`, and `text` fields. For message events the
flag plus alternative payloads are stored in one loose member. The schema and
type are re-exported by `packages/drivers/xai/src/index.ts:72` and appear as the
element type of `XAiWebSocketSession.events` at `XAi.service.ts:146`, but the
workspace package is marked `private: true` and the current repository has no
persisted, RPC, network-wire, or external-package consumer of the event
encoding.

# Cardinality gap

For the inventoried `isBinary`, `bytes`, and `text` members, the boolean plus
two independent payload-presence bits represent eight combinations. The
service writes two legal message kinds. The sibling optional `data` and the
same optionals on non-message cases create additional loose structure, but are
outside the inventory count and are still corrected by the same exact-case
schema.

# Target schema

Keep the existing outer `XAiWebSocketEventKind` and define an honest nested
`XAiWebSocketMessage` tagged union:

- `binary`: required `bytes`;
- `text`: required `text` and required decoded-or-raw `data`.

The outer message case owns `message: XAiWebSocketMessage`. The exact outer
cases are:

- `close`: required close `code` and `reason`;
- `error`: required diagnostic `data` and `reason`;
- `message`: required nested `message` union.

Build the nested union from named classes with `S.tag(...)` and
`S.toTaggedUnion("encoding")`, then build exact named outer cases under the
existing `kind` tag. Do not introduce `isBinary` helpers or optional message
payload fields on the decoded side. In particular, `data` is a legitimate
error payload as well as the text-message decoded/raw payload and must not be
dropped from the error case.

# Migration inventory

- `packages/drivers/xai/src/XAi.models.ts:440-507` — replace the one
  all-purpose field builder with exact close, error, and message schemas plus
  the nested message union.
- `packages/drivers/xai/src/XAi.models.ts:456-527` — update both examples,
  exported schema/type declarations, and annotations to the nested message
  value.
- `packages/drivers/xai/src/index.ts:72` — retain the root model re-export; the
  exported decoded TypeScript shape and internal schema encoding change
  atomically under the same `XAiWebSocketEvent` name.
- `packages/drivers/xai/src/XAi.service.ts:144-150` — retain
  `XAiWebSocketSession.events: Stream.Stream<XAiWebSocketEvent>` and migrate
  its element shape transitively; sendBytes/sendText/sendJson are independent.
- `packages/drivers/xai/src/XAi.service.ts:703-719` — construct binary/text
  cases directly from the callback flag; the callback parameter remains an
  external-library boundary and is out of campaign scope.
- `packages/drivers/xai/src/XAi.service.ts:791-792` — retain the event stream
  construction under the migrated exact event type.
- `packages/drivers/xai/src/XAi.service.ts:795-802` — construct the exact close
  case with its current `code` and `reason`, and the exact error case with both
  `data: websocketErrorData(error)` and its current `reason`; neither writer may
  be treated as an empty non-message case.
- `packages/drivers/xai/package.json:5` — retain the `private: true` package
  boundary that proves this encoding was never shipped as a supported public
  package contract.
- `packages/drivers/xai/test/XAi.service.test.ts:27` and `:99` — retain the
  package-alias schema import and migrate its schema-derived arbitrary.
- `packages/drivers/xai/test/XAi.service.test.ts:305-309`, `:361-365`, `:372`,
  and `:422` — migrate every direct decode, exact encode assertion, invalid
  decode assertion, and property round trip. These are the complete current
  schema-codec consumers found by the exact repository search.

# Guard-deletion accounting

- Delete copied `isBinary` writes. Remove message-only `bytes` and `text` from
  close/error and remove decoded message alternatives from their generic
  shared shape, while retaining close `code`/`reason` and error
  `data`/`reason` as required case payloads.
- Delete the obligation to keep `bytes` versus `text`/`data` coherent in the
  generic message member.
- Readers exhaustively match `message.encoding`; no presence tests remain.

# Encoded-side impact

The internal schema encoding changes deliberately: message fields become a
nested exact binary/text union and close/error stop accepting message-only
fields. Error `data` remains encoded because it is a legitimate live error
payload, not a message-only field. This is not the xAI network frame encoding. `@beep/xai` is private,
the root export has no supported external or persisted consumer, and the only
current encode/decode/round-trip fixtures are named above, so this remains the
ratified Tier 1 atomic decoded-TypeScript migration. Migrate every named
consumer in the same PR and do not add a compatibility alias for a
never-shipped contract.

# Test impact

Update the existing arbitrary at line 99, direct decode at 305, exact encode at
361, invalid decode at 372, and property round trip at 422. Add schema-derived
binary and text construction/round-trip cases, service callback cases for both
`isBinary` values, and exact close/error cases proving that close code/reason
and error data/reason survive while message-only bytes/text are unavailable.
Preserve sendBytes/sendText behavior. Run full package
verification for `@beep/xai` and add its required patch changeset.

# Risk and sequencing

Land in Tier 1A. The main risk is confusing the external `ws` callback's
boolean with the internal event model: retain the callback signature and
collapse it exactly once at `parseWebSocketMessage`.
