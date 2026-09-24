# Instance

- id: `xai-websocket-message-binary`
- file:line: `packages/drivers/xai/src/XAi.models.ts:469`
- symbol: `XAiWebSocketEvent`
- members: `isBinary`, `bytes`, `text`
- evidence classes:
  - E3/E1 at `packages/drivers/xai/src/XAi.service.ts:703-721` — the WebSocket callback writes either `isBinary: true` with bytes or `isBinary: false` with text and decoded-or-raw data.
- Additional supported-constructor evidence at
  `packages/drivers/xai/src/XAi.models.ts:456-463,518-522`: documented text
  messages may omit `isBinary`. This is compatibility evidence, not an E2
  exclusive-read claim.

# Current shape

The outer `close | error | message` tagged union currently gives every member the same optional `bytes`, `code`, `data`, `isBinary`, `reason`, and `text` fields:

```ts
type XAiWebSocketEventMember<T extends XAiWebSocketEventKind> = {
  readonly bytes?: Uint8Array;
  readonly code?: number;
  readonly data?: unknown;
  readonly isBinary?: boolean;
  readonly kind: T;
  readonly reason?: string;
  readonly text?: string;
};
```

For message events, `isBinary` has three representable states—absent, false, or true—and bytes/text each have absent/present states. The schema and type are re-exported by `packages/drivers/xai/src/index.ts` and are the element type of `XAiWebSocketSession.events` at `XAi.service.ts:146`. The package is `private: true`; repository search finds no persistence, RPC, outbound network encoding, or consumer outside the package tests and service.

# Cardinality gap

For the inventoried members alone, the optional boolean and two independent payload-presence bits represent `3 × 2 × 2 = 12` combinations. Exactly three combinations have current semantic evidence:

- binary parser event: `isBinary: true`, bytes present, text absent;
- text parser event: `isBinary: false`, bytes absent, text present;
- documented text constructor: `isBinary` absent, bytes absent, text present.

The parser's text event additionally carries decoded-or-raw `data`; the documented text constructor omits it. That optional payload distinction must survive inside the text case. Schema-derived arbitrary round trips prove the current codec is permissive, but do not make all arbitrary combinations meaningful domain states.

The canonical inventory now records the corrected 12/3 count. The independently optional fields on close/error and the optional message `data` are outside the inventoried three-member cardinality.

# Target schema

Keep the existing outer `XAiWebSocketEventKind`. Change only the `message` member to carry a nested `XAiWebSocketMessage` tagged union:

- `binary`: required `bytes`;
- `text`: required `text` plus `data: Option<unknown>`, encoded as an optional `data` key and defaulting to `None` when omitted.

Use `S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault)` for the text data field. This preserves the documented text-only constructor as `None`, preserves the parser's explicit decoded-or-raw payload as `Some(data)`, and distinguishes an explicitly present `undefined` payload as `Some(undefined)` if one is decoded. Build the two members from named classes with `S.tag(...)` and `S.toTaggedUnion("encoding")`; derive guards and matching from the schema.

The outer `message` case becomes `{ kind: "message", message: XAiWebSocketMessage }`. Do not retain an `isBinary` field on the decoded message: both current boolean values and absence normalize to the structural binary/text choice.

Keep the current close and error members unchanged, including all six optional fields. Repeating those fields on non-message cases is outside this instance, and making `code`, `reason`, or error `data` required would tighten unrelated accepted inputs. The live close writer continues supplying `code` and `reason`; the live error writer continues supplying `data` and `reason`.

# Migration inventory

- `packages/drivers/xai/src/XAi.models.ts:395-438` — retain `XAiWebSocketEventKind` and its exports.
- `packages/drivers/xai/src/XAi.models.ts:440-527` — add the binary/text message kind and member schemas; retain the existing close/error member field shape; replace only the outer message member with required `message: XAiWebSocketMessage`; update both message examples to the nested text case with `data: O.none()` or the constructor-supported default.
- `packages/drivers/xai/src/index.ts:72` — retain the root model re-export; the decoded TypeScript and internal schema encoding migrate atomically under the same `XAiWebSocketEvent` name.
- `packages/drivers/xai/src/XAi.service.ts:144-150` — retain `XAiWebSocketSession.events: Stream.Stream<XAiWebSocketEvent>`.
- `packages/drivers/xai/src/XAi.service.ts:703-721` — construct the binary case from bytes and the text case from text plus `O.some(decodedOrRawData)`; remove the copied callback boolean from the returned domain event. The `ws` callback parameter remains unchanged at the external-library boundary.
- `packages/drivers/xai/src/XAi.service.ts:791-802` — stream construction is unchanged; close/error writers retain their exact current objects and are accepted by the unchanged member schemas.
- `packages/drivers/xai/test/XAi.service.test.ts:27,99` — retain the package-alias schema import and update its schema-derived arbitrary transitively.
- `packages/drivers/xai/test/XAi.service.test.ts:305-309,361-365,372,422` — the direct close decode, exact close encode, invalid-close assertion, and arbitrary round trip stay unchanged because close is outside the migrated message member.
- Add focused schema cases for nested binary, text with `Some(data)`, and text with the omitted/defaulted `None` payload. Add service callback coverage for both `isBinary` values if the private parser is exposed through the WebSocket harness.

Repository-wide exact search finds no other source or test writer, reader, encoder, or decoder of `XAiWebSocketEvent`.

# Guard-deletion accounting

- Delete the copied `isBinary` writes at `XAi.service.ts:707,715`; the callback boolean chooses a message member exactly once.
- Delete the obligation to keep `isBinary` coherent with bytes versus text.
- The binary case makes bytes required and text unavailable. The text case makes text required and bytes unavailable while retaining optional decoded data honestly.
- Do not delete or tighten any close/error field or guard as part of this instance.

# Encoded-side impact

The internal message schema encoding changes deliberately from flat `{ kind: "message", isBinary?, bytes?, text?, data? }` to a nested binary/text member. This is not the xAI WebSocket frame encoding: the external `ws` callback remains the boundary and no driver event is serialized back to xAI. `@beep/xai` is private, no persisted/RPC/external-package consumer exists in the repository, and the current codec uses are package tests. The decision rider therefore permits an atomic decoded TypeScript/codec migration without a Tier 2 compatibility codec.

The documented text-only semantic case is preserved by the text member's defaulted `Option<data>`; its source syntax and internal encoded shape change with the exported model. Close/error encoded shapes and accepted inputs remain unchanged.

# Test impact

- Keep the existing close fixture and its exact encoded output unchanged at `XAi.service.test.ts:305-309,361-365`.
- Keep the invalid close-code failure at line 372 unchanged.
- The schema-derived arbitrary and round trip at lines 99 and 422 migrate to the new message member while continuing to cover unchanged close/error members.
- Add exact round trips for binary, text with data, and text without data. For the text-without-data case, assert decode supplies `None` and re-encoding matches the new canonical omitted-key form.
- Preserve sendBytes/sendText/sendJson behavior; those outbound session methods are independent of the inbound event carrier.
- Run full package verification for `@beep/xai` and add its required patch changeset during implementation.

# Risk and sequencing

Land in Tier 1A. The primary risk is overreaching beyond the evidenced message correlation. Retain the external callback signature and collapse `isBinary` exactly once in `parseWebSocketMessage`; retain close/error schemas and writer objects byte-for-byte. Land the message schemas, parser construction, documentation, and tests atomically.
