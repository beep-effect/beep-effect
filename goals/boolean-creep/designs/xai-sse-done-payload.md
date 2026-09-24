# Instance

- id: `xai-sse-done-payload`
- file:line: `packages/drivers/xai/src/XAi.models.ts:384`
- symbol: `XAiServerSentEvent`
- members: `done`, `data`
- evidence classes:
  - E3 at `packages/drivers/xai/src/XAi.service.ts:589` — `[DONE]` writes `done=true` with no data; JSON writes data plus `done=false`. `done` restates payload absence.
  - E2 at `packages/drivers/xai/src/XAiLanguageModel.service.ts:210` — reader drops the done marker event and otherwise parses event data; no done+data arm.

# Current shape

Live declaration at `packages/drivers/xai/src/XAi.models.ts:384`:

```ts
export class XAiServerSentEvent extends S.Class<XAiServerSentEvent>($I`XAiServerSentEvent`)(
  {
    data: S.optionalKey(S.Unknown),
    done: S.Boolean,
    index: XAiSseEventIndex,
  },
  $I.annote("XAiServerSentEvent", {
    description: "Parsed server-sent event emitted by streaming xAI endpoints.",
  })
) {}
```

# Cardinality gap

The done bit plus optional payload represents four categories, but only two are legal:

- `data({ data, index })` — a decoded JSON SSE event.
- `done({ index })` — the terminal `[DONE]` marker with no payload.

Done-with-data and non-done-without-data are illegal. The result is derived from one `data:` line, so parsing should choose one tagged member directly.

# Target schema

Reuse the file's existing `LiteralKit`, `Tuple`, `$I`, `S.Class`, and `S.toTaggedUnion` idioms:

```ts
const XAiSseEventKind = LiteralKit(["data", "done"]);

class XAiServerSentEventData extends S.Class<XAiServerSentEventData>($I`XAiServerSentEventData`)(
  { kind: S.tag("data"), data: S.Unknown, index: XAiSseEventIndex },
  $I.annote("XAiServerSentEventData", { description: "A decoded xAI SSE data payload." })
) {
  static readonly thunkThis = () => XAiServerSentEventData;
}

class XAiServerSentEventDone extends S.Class<XAiServerSentEventDone>($I`XAiServerSentEventDone`)(
  { kind: S.tag("done"), index: XAiSseEventIndex },
  $I.annote("XAiServerSentEventDone", { description: "The terminal xAI SSE marker." })
) {
  static readonly thunkThis = () => XAiServerSentEventDone;
}

export const XAiServerSentEvent = XAiSseEventKind.mapMembers(
  Tuple.evolve([XAiServerSentEventData.thunkThis, XAiServerSentEventDone.thunkThis])
).pipe(
  $I.annoteSchema("XAiServerSentEvent", {
    description: "Parsed server-sent event emitted by streaming xAI endpoints.",
  }),
  S.toTaggedUnion("kind")
);
export type XAiServerSentEvent = typeof XAiServerSentEvent.Type;
```

Construct with `.cases.data.make(...)` / `.cases.done.make(...)` and consume with `XAiServerSentEvent.match`. This is the shared target pattern also specified in `venice-sse-done-payload.md`; provider-specific names and payload schemas remain local.

# Migration inventory

- `packages/drivers/xai/src/XAi.models.ts:364-393` — update the example and replace the class bag with the kind kit, two member classes, union schema, and derived type.
- `packages/drivers/xai/src/XAi.service.ts:28` — import name remains stable.
- `packages/drivers/xai/src/XAi.service.ts:127` — `XAiStreamMethod` continues streaming `XAiServerSentEvent`, now the union type.
- `packages/drivers/xai/src/XAi.service.ts:583-594` — `parseSseData` maps `[DONE]` to `.cases.done` and decoded JSON to `.cases.data`; delete both boolean writes.
- `packages/drivers/xai/src/XAi.service.ts:632-642` — stream output type remains the union; no wire encoding occurs here.
- `packages/drivers/xai/src/XAiLanguageModel.service.ts:32,202-211` — replace the type-only event import with a runtime import for `.match`; change `parseStreamEvent` to accept the data payload, then use one schema-derived match that drops done and passes only `dataEvent.data` to the parser.
- `packages/drivers/xai/test/XAi.service.test.ts:25,104` — import and schema-derived arbitrary remain valid against the union.
- `packages/drivers/xai/test/XAi.service.test.ts:311-315,367-371` — construct the data case and update the internal encoded expectation to `{ kind: "data", data, index }`.
- `packages/drivers/xai/test/XAi.service.test.ts:398-435` — round-trip property now generates only coherent data/done members.

Repository-wide search finds no other source or test read/write of this event model.

# Guard-deletion accounting

- `packages/drivers/xai/src/XAi.service.ts:589-593` — delete paired `done` writes whose value must agree with data absence/presence; case constructors make disagreement unrepresentable.
- `packages/drivers/xai/src/XAiLanguageModel.service.ts:201-202` — delete the implicit assumption that optional `event.data` exists whenever parsing is called; the data arm carries it as required.
- `packages/drivers/xai/src/XAiLanguageModel.service.ts:210` — delete `event.done === true ? ... : ...`, which otherwise enters the parse branch even for an incoherent false-without-data object; exhaustive union matching replaces it.
- `packages/drivers/xai/src/XAi.models.ts:384-393` — replace the optional-payload bag. There is no actual comment asserting coherence here; do not claim a deleted comment as evidence.

# Encoded-side impact

The schema encoding changes from `{ done, data?, index }` to `{ kind, data?, index }`, with `data` required only in the data member. This is an internal parsed-event codec, not xAI's SSE wire: `parseSseData` consumes the provider's `data:` text and the driver never serializes this model back to xAI. `@beep/xai` is private and repository search finds only the in-package language-model consumer and codec fixtures named above, so the decoded TypeScript and internal encoded shape migrate atomically. No compatibility codec is needed for persisted or external data.

# Test impact

- `packages/drivers/xai/test/XAi.service.test.ts:104,398-435` — schema-derived arbitrary/round-trip coverage becomes a direct proof that only coherent cases generate.
- `packages/drivers/xai/test/XAi.service.test.ts:311-371` — update the data constructor and expected internal schema encoding; add a done-case encoding assertion.
- The mixed data/`[DONE]` fixture at `packages/drivers/xai/test/XAi.service.test.ts:735-772` already exercises all four driver routes but checks only lengths. Strengthen it to exact ordered data/done cases and indexes; add adapter-level coverage that drops the marker, continues later data, and preserves later failures.

# Risk & sequencing

This exported schema is Tier 1 because it is an internal parsed-stream model in a private package, not the provider wire JSON. Its structural TypeScript/codec shape changes, so land model, parser, language-model consumer, docs, and tests together. Keep this design synchronized with the Venice twin's `kind: "data" | "done"` pattern to avoid provider adapters drifting into different conventions.


# September 22 exact-source refresh

Source: `dc852c92efdd7d259e3983ec30cd19cb9b4fd65d`. This is P2 only;
reset the inventory status from historical `reviewed` to `designed`; this
substantive P2 refresh supplies no current P3 credit. Input digests
and qualification audit are in [the owner audit](../data/design-refresh-2026-09-22-xai-sse-done-payload.md).

## Qualification and boundary precision

The cardinality is still 4 representable versus 2 intended categories, counting
payload presence rather than payload contents. `[DONE]` emits absent data and
true; every successfully decoded JSON value emits present data and false
(`XAi.service.ts:583-594`). JSON `null`, false, zero, strings, arrays and objects
are all data values; do not replace `S.Unknown` with an object-only schema or
truthiness test. The driver result is derived from the parsed block, not stored
lifecycle state. E3 and E2 remain evidenced at service lines 589/592 and adapter
201-210 respectively. It is a parsed internal envelope, not a mirror of xAI's
`data:` wire framing, so the driver-wire D2 exclusion does not apply.

The root barrel re-exports models (`src/index.ts:74`) and service types; therefore
this is an exported decoded API change even though no external encoded contract
was found. `package.json` is private and exposes only the root (internal subpaths
blocked). Repository-wide symbol search finds exactly the model, service,
adapter, and service-test files. The additional package consumer
`apps/labs/semantica/src/layers/LanguageModelLive.ts` imports only XAi and its
language-model adapter, not the event codec. Package metadata references in CLI
CI partitions/coverage and identity do not consume events. No persistence writer,
RPC/MCP envelope, event JSON export or external codec reader was found. The only
observed event encoding is the codec test. This evidence explicitly authorizes
changing that internal encoding atomically; no compatibility aliases or legacy
normalizer should be added. Provider request/response wire bytes stay unchanged.

## Required behavior preservation

- `dataLine` and `sseBlockData` (service 574-581) trim `data:` fields, join multiline
  data with newlines, and ignore empty/non-data blocks. Leave these rules intact.
- `collectSseBlock` (616-624) advances the zero-based index only for nonempty
  data blocks. `collectSseLine` and `streamSseData` (626-642) retain line splitting,
  final-block flush through `onHalt`, source ordering and parse concurrency 1.
- `[DONE]` becomes a done member at the driver boundary. The language-model
  reader's `Stream.empty` drops just that marker; it does not terminate the
  upstream stream. A later data block is still parsed. Do not introduce
  `takeUntil`, interruption, or completion state as part of this migration.
- Malformed JSON and response-stream failures retain
  `XAiError.fromDescriptor(descriptor, "sse decoding", { cause })` (593,637).
  Status/content-type checks precede decoding (650-653), logging and spans
  remain unchanged (657-664). Adapter driver errors retain `mapXAiError` (209);
  invalid chat chunk payloads retain `mapSchemaError("streamChatCompletion")`
  (202). Preserve their ordering and do not collapse these errors.
- `parseStreamEvent` accepts a required data payload (`unknown`), not the entire
  union; only the schema-derived data match arm invokes it. The adapter needs a
  runtime model import (currently type-only at line 32). This is required for
  the proposed `.match` call to compile.

## Current helper correction

The kind kit remains private and is used directly for `.mapMembers`; no current
consumer justifies a new public kind export or companion type. Do not annotate
and rebuild the kit before calling `.mapMembers`: the current statics helper
(schema package `src/SchemaUtils/withLiteralKitStatics.ts:38-53`) explicitly
reattaches literal helpers but does not reattach `mapMembers`. The private kit
needs no extra annotated wrapper. Annotate the assembled union before
`S.toTaggedUnion("kind")` so cases/guards/match are attached to the final value.
The local Effect reference implements those helpers at `Schema.ts:6126-6158`.
Keep S.tag constructor defaults; do not pass a duplicate kind discriminator to
case `.make`. Member classes stay local. Existing Tuple/LiteralKit/SchemaUtils
imports suffice; do not clone helpers or add dependencies.

## Concrete test delta

The current mixed SSE test already exists at `test/XAi.service.test.ts:735-772`.
It exercises chat, response, legacy and Anthropic stream methods, but asserts
only array lengths. Replace those weak assertions with exact ordered data and
done case payload/index assertions for all four routes. Codec fixtures at
311-315/367-371 migrate to data cases; add a done case fixture and retain the
schema arbitrary at 104 and round-trip test at 432.

Add focused fixture coverage for JSON null and scalar data, multiline data,
empty/comment blocks, final unterminated block flushing, and data/done/data
ordering. Retain malformed JSON/content-type/status failures at 514-566 and
check the same error reason rather than merely any failure. Through the public
XAiLanguageModel.make path, assert valid chat chunks are forwarded, marker events
are dropped without termination, and malformed chat chunks still map to the
existing AI error. There is no separate language-model test file in this source
snapshot; extend the existing in-package test harness rather than assuming one.

Coherence claims concern the constructed/decoded union, not strict rejection of
all extra keys: do not add strict excess-property rejection, reject legitimate
JSON values, or claim S.Unknown implies a non-null payload. P4 must verify actual
case constructors, `.match` exhaustiveness, codec behavior, and docgen examples,
then run full `bun run beep quality package-verify @beep/xai`. No tests or package
verification were run by this read-only P2 audit.
