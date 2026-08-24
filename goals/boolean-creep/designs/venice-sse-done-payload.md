# Instance

- id: `venice-sse-done-payload`
- file:line: `packages/drivers/venice-ai/src/VeniceAI.service.ts:657`
- symbol: `VeniceAIServerSentEvent`
- members: `done`, `data`
- evidence classes:
  - E3 at `packages/drivers/venice-ai/src/VeniceAI.service.ts:1901` — `[DONE]` writes `done=true` with no data; JSON writes `data=some` plus `done=false`. `done` restates payload absence.
  - E2 at `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:215` — reader treats done as terminal empty stream and otherwise parses event data; no done+data arm.

# Current shape

Live declaration at `packages/drivers/venice-ai/src/VeniceAI.service.ts:651`:

```ts
export class VeniceAIServerSentEvent extends S.Class<VeniceAIServerSentEvent>($I`VeniceAIServerSentEvent`)(
  {
    data: S.OptionFromOptionalKey(VeniceAIUnknownPayload).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Decoded SSE payload when the event carries data." })
    ),
    done: S.Boolean.annotateKey({ description: "Whether this SSE event is the terminal [DONE] marker." }),
    index: NonNegativeInt.annotateKey({ description: "Zero-based stream event index." }),
  },
  $I.annote("VeniceAIServerSentEvent", {
    description: "Parsed server-sent event emitted by Venice streaming endpoints.",
  })
) {}
```

# Cardinality gap

The done bit plus `Option<data>` represents four combinations, but only two are legal:

- `data({ data, index })` — decoded Venice SSE JSON.
- `done({ index })` — terminal `[DONE]` with no data.

Done-with-Some and non-done-with-None are illegal. The parser derives the result from one SSE line; no stored or optional parallel state is needed.

# Target schema

Reuse `LiteralKit`, add `Tuple` to the existing Effect import, and follow the same pattern as `xai-sse-done-payload.md`:

```ts
export const VeniceAISseEventKind = LiteralKit(["data", "done"]).pipe(
  $I.annoteSchema("VeniceAISseEventKind", {
    description: "Kinds of parsed Venice AI server-sent events.",
  })
);
export type VeniceAISseEventKind = typeof VeniceAISseEventKind.Type;

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
  S.toTaggedUnion("kind"),
  $I.annoteSchema("VeniceAIServerSentEvent", {
    description: "Parsed server-sent event emitted by Venice streaming endpoints.",
  })
);
export type VeniceAIServerSentEvent = typeof VeniceAIServerSentEvent.Type;
```

The data member carries the payload directly, not `Option`; the discriminator already proves presence. Use `.cases` for construction and the union's `.match` for consumption.

# Migration inventory

- `packages/drivers/venice-ai/src/VeniceAI.service.ts:15` — add `Tuple` to the existing Effect imports.
- `packages/drivers/venice-ai/src/VeniceAI.service.ts:629-663` — update the example and replace the class bag with the kind kit, data/done classes, union schema, and derived type.
- `packages/drivers/venice-ai/src/VeniceAI.service.ts:1473` — the stream method signature keeps the same exported type name but now returns the tagged union.
- `packages/drivers/venice-ai/src/VeniceAI.service.ts:1896-1909` — map `[DONE]` to `.cases.done` and decoded JSON directly to `.cases.data`; remove `O.some` and both boolean writes.
- `packages/drivers/venice-ai/src/VeniceAI.service.ts:1911-1926` — stream plumbing retains the union output with no encoded boundary change.
- `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:26,192-207` — type import remains; change `parseStreamEvent` to accept the data payload (or inline decode in the data arm) and remove the defensive `Option` match.
- `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:209-215` — replace `event.done` branching with `VeniceAIServerSentEvent.match`, dropping done and decoding data.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:20,137-138` — imports, encoder, and schema-derived arbitrary target the union.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:494-512` — construct `.cases.data`/`.cases.done` and update internal encoded expectations to the `kind` discriminator.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:529-548` — property round trips generate only legal union cases.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:985-1000` — narrow events by `kind`; read `data` only in the data case and assert the second event is done.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:1030-1039` — narrow the collected first event to `data` before reading its payload.

Repository-wide search finds no other source or test reader/writer of this event model.

# Guard-deletion accounting

- `packages/drivers/venice-ai/src/VeniceAI.service.ts:1901-1907` — delete paired `done`/`Option` writes whose coherence is manually maintained; case constructors make the illegal combinations unrepresentable.
- `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:195-207` — delete the defensive `O.match` and `InvalidOutputError` for a non-done event with no payload. The data case requires payload and the done case never reaches parsing.
- `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:215` — delete the truthiness branch over `event.done`; the schema-derived match is exhaustive.
- `packages/drivers/venice-ai/src/VeniceAI.service.ts:651-663` — delete the comment-only invariant connecting `done` and the optional payload.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:137-145,529-548` — schema-derived arbitrary/round-trip coverage becomes a coherence proof for the tagged union.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:494-512` — update explicit data/done constructors and internal schema encodings.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts:985-1000,1030-1039` — replace direct optional-data/boolean reads with discriminator narrowing while retaining stream ordering and payload assertions.

# Risk & sequencing

This exported model is Tier 1 because it represents parsed internal stream events, not Venice's SSE bytes. Land the schema, parser, language-model adapter, JSDoc, and tests atomically. Keep its `kind: "data" | "done"` surface aligned with the XAI twin design; only payload schemas and provider names should differ. Removing the defensive missing-data error is safe only in the same change that makes missing data unrepresentable.
