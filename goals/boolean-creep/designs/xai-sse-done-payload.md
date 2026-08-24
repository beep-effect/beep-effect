# Instance

- id: `xai-sse-done-payload`
- file:line: `packages/drivers/xai/src/XAi.models.ts:390`
- symbol: `XAiServerSentEvent`
- members: `done`, `data`
- evidence classes:
  - E3 at `packages/drivers/xai/src/XAi.service.ts:591` — `[DONE]` writes `done=true` with no data; JSON writes data plus `done=false`. `done` restates payload absence.
  - E2 at `packages/drivers/xai/src/XAiLanguageModel.service.ts:211` — reader treats done as terminal empty stream and otherwise parses event data; no done+data arm.

# Current shape

Live declaration at `packages/drivers/xai/src/XAi.models.ts:387`:

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
export const XAiSseEventKind = LiteralKit(["data", "done"]).pipe(
  $I.annoteSchema("XAiSseEventKind", {
    description: "Kinds of parsed xAI server-sent events.",
  })
);
export type XAiSseEventKind = typeof XAiSseEventKind.Type;

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
  S.toTaggedUnion("kind"),
  $I.annoteSchema("XAiServerSentEvent", {
    description: "Parsed server-sent event emitted by streaming xAI endpoints.",
  })
);
export type XAiServerSentEvent = typeof XAiServerSentEvent.Type;
```

Construct with `.cases.data.make(...)` / `.cases.done.make(...)` and consume with `XAiServerSentEvent.match`. This is the shared target pattern also specified in `venice-sse-done-payload.md`; provider-specific names and payload schemas remain local.

# Migration inventory

- `packages/drivers/xai/src/XAi.models.ts:367-396` — update the example and replace the class bag with the kind kit, two member classes, union schema, and derived type.
- `packages/drivers/xai/src/XAi.service.ts:28` — import name remains stable.
- `packages/drivers/xai/src/XAi.service.ts:127` — `XAiStreamMethod` continues streaming `XAiServerSentEvent`, now the union type.
- `packages/drivers/xai/src/XAi.service.ts:586-597` — `parseSseData` maps `[DONE]` to `.cases.done` and decoded JSON to `.cases.data`; delete both boolean writes.
- `packages/drivers/xai/src/XAi.service.ts:638-644` — stream output type remains the union; no wire encoding occurs here.
- `packages/drivers/xai/src/XAiLanguageModel.service.ts:32,202-211` — type import remains; change `parseStreamEvent` to accept the data payload, then use one schema-derived match that drops done and passes only `dataEvent.data` to the parser.
- `packages/drivers/xai/test/XAi.service.test.ts:25,97` — import and schema-derived arbitrary remain valid against the union.
- `packages/drivers/xai/test/XAi.service.test.ts:303-307,359-363` — construct the data case and update the internal encoded expectation to `{ kind: "data", data, index }`.
- `packages/drivers/xai/test/XAi.service.test.ts:410-425` — round-trip property now generates only coherent data/done members.

Repository-wide search finds no other source or test read/write of this event model.

# Guard-deletion accounting

- `packages/drivers/xai/src/XAi.service.ts:591-596` — delete paired `done` writes whose value must agree with data absence/presence; case constructors make disagreement unrepresentable.
- `packages/drivers/xai/src/XAiLanguageModel.service.ts:202-203` — delete the implicit assumption that optional `event.data` exists whenever parsing is called; the data arm carries it as required.
- `packages/drivers/xai/src/XAiLanguageModel.service.ts:211` — delete `event.done === true ? ... : ...`, which otherwise enters the parse branch even for an incoherent false-without-data object; exhaustive union matching replaces it.
- `packages/drivers/xai/src/XAi.models.ts:387-396` — delete the comment-only invariant connecting `done` and optional `data`.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/xai/test/XAi.service.test.ts:97,410-429` — schema-derived arbitrary/round-trip coverage becomes a direct proof that only coherent cases generate.
- `packages/drivers/xai/test/XAi.service.test.ts:303-363` — update the data constructor and expected internal schema encoding; add a done-case encoding assertion.
- Streaming behavior exercised through `XAiLanguageModel.service.ts` should continue dropping the terminal case and decoding data cases; add a focused mixed data/`[DONE]` stream assertion if the current driver tests do not expose both events.

# Risk & sequencing

This exported schema is Tier 1 because it is an internal parsed-stream model, not the provider wire JSON. Still, its structural TypeScript/codec shape changes, so land model, parser, language-model consumer, docs, and tests together. Keep this design synchronized with the Venice twin's `kind: "data" | "done"` pattern to avoid provider adapters drifting into different conventions.
