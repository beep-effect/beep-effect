# Instance

- id: `xai-websocket-message-binary`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- P2 refresh only; independent P3 and implementation remain pending.
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

Use a private unannotated `LiteralKit(["binary", "text"])` for the nested domain, named `S.Class` members with `encoding: S.tag("binary")` or `S.tag("text")`, and `.mapMembers(Tuple.evolve([...]))`. Existing imports already supply LiteralKit, SchemaUtils, Tuple and S. The binary class declares only `encoding` and required `bytes: S.Uint8Array`; the text class declares `encoding`, required `text: S.String`, and the Option field specified above. Required `text` permits the empty string.

Export the runtime `XAiWebSocketMessage` union and its schema-derived same-name type because the service genuinely consumes its case constructors. Keep its kind kit and member classes private. Annotate the union before applying `S.toTaggedUnion("encoding")` so `.cases` and `.match` attach to the final schema. Use `$I` class/union annotations and complete exported-symbol examples. No unused exported encoding kit or legacy alias is needed.

For the outer union use the existing **unannotated** `XAiWebSocketEventKindBase.mapMembers`, not the annotated exported kit: `withLiteralKitStatics` does not promise `mapMembers`. Retain the existing exported kind API. Build close and error with their existing schemas and fields. Restrict the old shared type/helper to close/error; it must no longer type the message case or reintroduce its optional flag/payload bag. Give the replacement message class a required nested `message: XAiWebSocketMessage` and `kind: S.tag("message")`. Apply the outer event annotation before `S.toTaggedUnion("kind")` as well.

The outer `message` case becomes `{ kind: "message", message: XAiWebSocketMessage }`. Do not retain an `isBinary` field on the decoded message: both current boolean values and absence normalize to the structural binary/text choice.

Keep the current close and error members unchanged, including all six optional fields. Repeating those fields on non-message cases is outside this instance, and making `code`, `reason`, or error `data` required would tighten unrelated accepted inputs. The live close writer continues supplying `code` and `reason`; the live error writer continues supplying `data` and `reason`.

# Migration inventory

- `packages/drivers/xai/src/XAi.models.ts:395-438` — retain `XAiWebSocketEventKind` and its exports.
- `packages/drivers/xai/src/XAi.models.ts:440-527` — add the binary/text message kind and member schemas; retain the existing close/error member field shape; replace only the outer message member with required `message: XAiWebSocketMessage`; update both message examples to the nested text case with `data: O.none()` or the constructor-supported default.
- `packages/drivers/xai/src/index.ts:72` — retain the root model re-export; the decoded TypeScript and internal schema encoding migrate atomically under the same `XAiWebSocketEvent` name.
- `packages/drivers/xai/src/XAi.service.ts:144-150` — retain `XAiWebSocketSession.events: Stream.Stream<XAiWebSocketEvent>`.
- `packages/drivers/xai/src/XAi.service.ts:18-39,703-719` — move XAiWebSocketEvent from its type-only import into the runtime import and add XAiWebSocketMessage; construct the binary case from bytes and the text case from text plus `O.some(decodedOrRawData)`; remove the copied callback boolean from the returned domain event. The `ws` callback parameter remains unchanged at the external-library boundary.
- `packages/drivers/xai/src/XAi.service.ts:791-802` — stream construction is unchanged; close/error writers retain their exact current objects and are accepted by the unchanged member schemas.
- `packages/drivers/xai/test/XAi.service.test.ts:27,46,106` — retain the package-alias schema import and update its schema-derived arbitrary transitively.
- `packages/drivers/xai/test/XAi.service.test.ts:316-320,372-376,383,434` — the direct close decode, exact close encode, invalid-close assertion, and arbitrary round trip stay unchanged because close is outside the migrated message member.
- Add focused schema cases for nested binary, text with `Some(data)`, and text with the omitted/defaulted `None` payload. Add service callback coverage for both SDK `isBinary` values through a controlled WebSocket mock behind the public service. Do not export the private parser merely for tests; the current test suite has no successful socket callback harness, so implementing that harness is an explicit P4 obligation.

Repository-wide exact search finds no other source or test writer, reader, encoder, or decoder of `XAiWebSocketEvent`.

# Runtime construction and ordering

At `XAi.service.ts:703-719`, binary construction becomes:

```ts
return XAiWebSocketEvent.cases.message.make({
  message: XAiWebSocketMessage.cases.binary.make({ bytes: rawDataToBytes(data) }),
});
```

Text construction keeps `const text = rawDataToText(data)` and becomes:

```ts
return XAiWebSocketEvent.cases.message.make({
  message: XAiWebSocketMessage.cases.text.make({
    text,
    data: O.some(O.getOrElse(decodeJsonOption(text), () => text)),
  }),
});
```

Omit tag properties in `.make` inputs; S.tag supplies them. Preserve the actual raw conversions at service 666-676: strings are UTF-8 encoded, Buffer arrays concatenated, other RawData converted to Uint8Array, and text decoded with the existing TextDecoder. Do not replace the SDK callback boolean with guessed content or JSON success. Binary JSON-looking bytes remain binary; nonbinary Buffer input is text.

Malformed JSON, empty text and arbitrary non-JSON text are successful text events with `Some(originalText)`. Valid JSON null/false/0/arrays/strings remains `Some(decodedValue)`; do not use truthiness, turn invalid JSON into a typed failure, or require object payloads. `decodeJsonOption` remains the existing helper at 570. The optional None text-data state remains supported for documented/manual constructors, although the callback always supplies Some.

`makeWebSocketEvents:791-820` installs message/close/error callbacks for stream acquisition. Message parsing and Queue.offerUnsafe remain synchronous in callback order. Close offers its close event before Queue.endUnsafe. An established socket error offers its existing `{ kind: "error", data: { name }, reason: "websocket error" }` event and does not fail/end the stream. Keep error-name sanitization at 721-723. Keep listener removal and OPEN/CONNECTING socket close in the release finalizer; add no eager subscription, buffering policy change or new asynchronous scheduling.

Connection failures before open remain `XAiError` failures in `connectSocket:746-789`, with its own once-listeners and cleanup. Do not conflate those failures with established-session error events. The operation/session wiring at 852-880 and outbound text/bytes/JSON methods at 822-850 retain byte content, JSON encoding, typed send errors and close arguments. No session lifetime redesign is included.

# Guard-deletion accounting

- Delete the copied `isBinary` writes at `XAi.service.ts:707,715`; the callback boolean chooses a message member exactly once.
- Delete the obligation to keep `isBinary` coherent with bytes versus text.
- The binary case makes bytes required and text unavailable. The text case makes text required and bytes unavailable while retaining optional decoded data honestly.
- Do not delete or tighten any close/error field or guard as part of this instance. There is no current downstream defensive if-chain over message fields to claim as deleted. The actual deletions are the message-member optional bytes/text/isBinary schema bag, its shared handwritten type participation, and the copied isBinary writes. The boundary `if (isBinary)` remains necessary to select the case once.

# Encoded-side impact

The internal message schema encoding changes deliberately from flat `{ kind: "message", isBinary?, bytes?, text?, data? }` to a nested binary/text member. This is not the xAI WebSocket frame encoding: the external `ws` callback remains the boundary and no driver event is serialized back to xAI. `@beep/xai` is private, no persisted/RPC/external-package consumer exists in the repository, and the current codec uses are package tests. These inspected internal-only uses support the proposed encoding change without a Tier 2 compatibility codec; the decoded-TypeScript rider alone is not blanket encoded-change authorization. Independent P3 must verify this boundary before implementation.

The documented text-only semantic case is preserved by the text member's defaulted `Option<data>`; its source syntax and internal encoded shape change with the exported model. Close/error encoded shapes and accepted inputs remain unchanged. Message code/reason have no producer, documented constructor or reader evidence; their incidental permissiveness is not a reason to add them to the new message domain. This atomic internal migration preserves evidenced message semantics rather than every formerly representable incoherent object. Default excess-property handling remains unchanged; no strict unknown-key policy is introduced.

# Test impact

- Keep the existing close fixture and its exact encoded output unchanged at `XAi.service.test.ts:316-320,372-376`.
- Keep the invalid close-code failure at line 383 unchanged.
- The schema-derived arbitrary and round trip at lines 106 and 434 migrate to the new message member while continuing to cover unchanged close/error members.
- Add exact round trips for binary, text with data, and text without data. For the text-without-data case, assert decode supplies `None` and re-encoding matches the new canonical omitted-key form.
- Preserve sendBytes/sendText/sendJson behavior; those outbound session methods are independent of the inbound event carrier.
- Run `bun run beep quality package-verify @beep/xai` before package handoff, then the canonical campaign Yeet checks. Determine changeset requirements from the implementation landing rules; this P2 audit does not establish a new patch-changeset requirement.

Additional mandatory implementation fixtures:

- Decode and encode nested text with missing data, explicit undefined, null, false and zero. Assert None versus Some and own-key absence/presence; JSON stringification alone cannot prove explicit undefined preservation.
- Require binary bytes and text text keys. Exercise zero-length bytes and empty text; reject missing required keys/unknown encoding. Do not require rejection of surplus keys under default stripping semantics.
- With the public service and controlled ws mock, emit binary Buffer, ArrayBuffer and Buffer-array payloads and nonbinary UTF-8 payloads. Assert exact bytes/text and event ordering; JSON-looking binary stays binary, malformed text stays a successful text event.
- Emit text, error, another message, then close: assert error is an event rather than stream failure, all earlier events precede close, and close ends collection. Assert cleanup removes the three installed callbacks and closes an OPEN/CONNECTING socket on release without changing closed-socket behavior.
- Preserve existing invalid-URL/connection-error and outbound send behavior coverage; add missing callback assertions as needed. These are planned tests, not executed claims.

# Risk and sequencing

Land in Tier 1A. The primary risk is overreaching beyond the evidenced message correlation. Retain the external callback signature and collapse `isBinary` exactly once in `parseWebSocketMessage`; retain close/error schemas and writer objects byte-for-byte. Land the message schemas, parser construction, documentation, and tests atomically.
