# Instance

- id: `venice-sse-done-payload`
- exact source SHA: `dc852c92efdd7d259e3983ec30cd19cb9b4fd65d`
- file:line: `packages/drivers/venice-ai/src/VeniceAI.service.ts:636`
- symbol: `VeniceAIServerSentEvent`
- members: `done`, `data`
- P2 proposal only; replacement independent P3 review and implementation remain pending.

# Current shape

`VeniceAI.service.ts:636-648` declares `data: Option<unknown>` (optional-key codec with None default), `done: boolean`, and required `index: NonNegativeInt`. The payload alias is `S.Unknown` at line 324. `parseSseData:1881-1894` derives the model from one assembled SSE block, not one physical line. It constructs done=true/None for the exact `[DONE]` payload and done=false/Some(decoded JSON) otherwise. `VeniceAiLanguageModel.service.ts:192-215` drops done events and otherwise Option-matches data.

# Cardinality gap

Four abstract flag/presence combinations versus two legal producer states: false/Some and true/None. E3 is the paired construction at `VeniceAI.service.ts:1886-1893`; E2 is the consumer branch at `VeniceAiLanguageModel.service.ts:215`, whose data path defensively rejects None at 197-203. Payload contents and index values are orthogonal and are not counted as additional states. This is derived internal state, Tier 1; the model is not Venice's wire format, despite residing in a driver. Preserve this historical qualified owner and its union goal.

# Target schema


Reuse `LiteralKit`, add `Tuple` to the existing Effect import, and follow the same pattern as `xai-sse-done-payload.md`:

```ts
const VeniceAISseEventKind = LiteralKit(["data", "done"]);


class VeniceAIServerSentEventData extends S.Class<VeniceAIServerSentEventData>($I`VeniceAIServerSentEventData`)(
  {
    kind: S.tag("data"),
    data: VeniceAIUnknownPayload,
    index: NonNegativeInt,
  },
  $I.annote("VeniceAIServerSentEventData", { description: "A decoded Venice AI SSE data payload." })
) {
  static readonly thunkThis = () => VeniceAIServerSentEventData;
}

class VeniceAIServerSentEventDone extends S.Class<VeniceAIServerSentEventDone>($I`VeniceAIServerSentEventDone`)(
  { kind: S.tag("done"), index: NonNegativeInt },
  $I.annote("VeniceAIServerSentEventDone", { description: "The terminal Venice AI SSE marker." })
) {
  static readonly thunkThis = () => VeniceAIServerSentEventDone;
}

export const VeniceAIServerSentEvent = VeniceAISseEventKind.mapMembers(
  Tuple.evolve([VeniceAIServerSentEventData.thunkThis, VeniceAIServerSentEventDone.thunkThis])
).pipe(
  $I.annoteSchema("VeniceAIServerSentEvent", {
    description: "Parsed server-sent event emitted by Venice streaming endpoints.",
  }),
  S.toTaggedUnion("kind")
);
export type VeniceAIServerSentEvent = typeof VeniceAIServerSentEvent.Type;
```

The data member carries the payload directly, not `Option`; the discriminator already proves presence. Use `.cases` for construction and the union's `.match` for consumption.

# Migration inventory

All paths below are under `packages/drivers/venice-ai/` unless fully qualified.

- `src/VeniceAI.service.ts:15,614-648`: add Tuple, update the exported event example to `.cases.data.make({ data: ..., index })`, remove the example's Option import, and replace the bag with the schema above. Retain the same exported event name; no legacy alias or compatibility bag.
- `src/VeniceAI.service.ts:1456-1458`: retain the stream method's event type name, now schema-derived union.
- `src/VeniceAI.service.ts:1881-1894`: `.cases.done.make({ index: NonNegativeInt.make(index) })` for `[DONE]`; `.cases.data.make({ data: decoded, index: NonNegativeInt.make(index) })` after successful JSON decode. Omit `kind` because S.tag supplies constructor defaults. Preserve the existing error mapping around JSON decode.
- `src/VeniceAI.service.ts:1896-1923`: no framing/pipeline rewrite. `mapAccum` and sequential `mapEffect` retain ordering, incremented indices and onHalt flush.
- `src/VeniceAiLanguageModel.service.ts:25-26,192-215`: import `VeniceAIServerSentEvent` as a runtime value for `.match`, keep VeniceAIError/VeniceAIShape type imports, delete `parseStreamEvent`, and use `Stream.flatMap(VeniceAIServerSentEvent.match({ done: () => Stream.empty, data: ({ data }) => Stream.fromEffect(decodeChatCompletionChunkEffect(data)) }))`.
- `src/index.ts:23`: existing star export exposes the replacement runtime schema and same-name type; no barrel changes needed. The kind kit and case classes remain module-local; do not add an unused exported kind domain. Apply the event annotation before S.toTaggedUnion so .cases/.match are attached to the final schema. Use the unannotated local kit for mapMembers; do not rely on annotation preserving kit statics.
- `test/VeniceAI.service.test.ts:137-138,490-508,524-542`: update constructors and internal codec expected objects; existing schema arbitrary/round-trip property now ranges over union members.
- `test/VeniceAI.service.test.ts:959-1001,1006-1040`: replace direct `done` and optional-data reads with schema guards/match; retain data contents, 0/1 indices, request headers/body, chat/response parity, and emission before body close.

Repository-wide symbol/import search finds only these event producers/readers. The excluded labs provider-smoke source imports the service/adapter but does not construct/read this event. Equivalence and integration tests do not consume it. No dedicated language-model test currently exists; new adapter assertions are necessary (below).

# Guard-deletion accounting

- Delete `done` and the optional-key/None-default `data` schema at `src/VeniceAI.service.ts:638-642`.
- Delete coherent paired Boolean/Option writes at 1887 and 1891; the cases require precisely their payloads.
- Delete all of `parseStreamEvent` at `src/VeniceAiLanguageModel.service.ts:192-207`, including the missing-payload InvalidOutputError and Option match. The data arm has a required key.
- Delete the `event.done` conditional at line 215; replace with the exhaustive schema match. Keep `decodeChatCompletionChunkEffect` and its schema-error conversion: malformed JSON shapes remain real errors.
- Update the JSDoc descriptions that currently communicate the payload/flag relationship; there is no separate comment-only invariant to claim as deleted.

# Encoded-side impact

The internal event codec changes `{ done, data?, index }` to `{ kind, data?, index }`, with a required data key for the data member and no payload field for done. This is an intentional atomic migration of the internal codec fixtures and decoded TypeScript consumers. The package is private (`package.json:6`), exports its source via the root barrel, and has no found persisted event artifacts or remote consumers. No alias, old codec, normalization layer, or wire compatibility wrapper is warranted. Venice HTTP/SSE bytes, content-type checks, request stream flag, payload values, and error behavior stay unchanged.

`S.Unknown` deliberately admits any decoded JSON value, including null, false, zero, strings and arrays; do not tighten it to an object/chunk schema. Adapter validation remains separate. Required key presence is distinct from non-null truthiness. The installed Effect runtime rejects a missing data key; it accepts explicit null. Default schema excess-property stripping is not changed into new strict unknown-key rejection; the union only owns its declared fields.

# Ordering and error contract

`src/VeniceAI.service.ts:1796-1880` trims `data:` lines, joins multiline payloads, splits LF/CRLF block boundaries, streams UTF-8 decoding across byte chunks, and flushes trailing text on halt. Blank blocks are ignored. A nonempty block with no nonempty data yields an empty string and currently fails JSON decoding; do not silently turn it into an ignored comment/heartbeat during this migration. Indices count assembled emitted payload blocks, including DONE markers.

`[DONE]` is the provider marker name, not a driver termination instruction: the driver emits it and continues parsing. The adapter maps it to an empty inner stream and keeps pulling upstream. Preserve post-DONE data, repeated markers, and post-DONE failures; do not add takeUntil or interrupt the source. Preserve immediate output before response close and existing trailing flush semantics.

Keep response status/content-type validation and transport-to-VeniceAIError mapping, JSON failures mapped with reason `sse decoding` at 1893, stream failures at 1910, adapter driver-error mapping at 214, and chunk-shape InvalidOutputError at adapter 113-125. Only the now-unrepresentable missing-event-payload error disappears. Logging and spans remain in the same pipeline positions.

# Test impact

Existing tests bind schema codec/round-trip assertions (490-542), malformed SSE/content-type errors (807-897), both streaming operation endpoints (959-1001), and early emission (1006-1040). Update those fixtures atomically and retain their existing assertions.

Add focused tests for both cases and missing data-key rejection, valid JSON null/false/0/string/array values preserved in the driver, and invalid chunk shape still rejected by the adapter. Do not demand strict rejection of surplus keys, which would add behavior.

Add mocked stream fixtures for chunk-split UTF-8, LF/CRLF boundaries, multiline JSON, trailing unterminated block flush, blank blocks, empty/non-data nonempty blocks failing as before, and data/DONE/data with stable indices. Exercise the public adapter via its existing make/layer API to show DONE is skipped, later valid data is consumed, malformed later JSON and bad chunk schema still fail, and source completion/cancellation remains unchanged. These are planned P4 tests; this P2 refresh does not claim they ran.

Before package handoff run `bun run beep quality package-verify @beep/venice-ai`, including audit/docgen, then canonical campaign Yeet proof. No gesture-bearing UI is affected.

# Risk & sequencing

Land schema, parser, adapter runtime import, examples and tests atomically in Tier 1A after GATE 2. Keep the provider-local data/done target aligned with the XAI sibling without extracting shared services or editing its implementation here. This P2 proposal is source-bound and supplies no independent review, census dry-round, package-verification or implementation credit.
