# Instance

- id: `drivers-stream-state`
- file:line: `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:229`
- symbol: `StreamState`
- members: `finished`, `textEnded`, `textStarted`
- evidence classes:
  - E4 at `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:821` — text-end is only emitted when `textStarted && !textEnded`; `textEnded` is unreachable without `textStarted`.
  - E2 at `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:845` — readers branch on `textStarted` vs not to emit text-start; `finished` short-circuits the wrap-up path and never treats ended-without-start as a case.

# Current shape

Live declaration at `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:221`:

```ts
class StreamState extends S.Class<StreamState>($I`StreamState`)(
  {
    activeToolCalls: S.Record(S.String, ActiveToolCall).annotateKey({
      description: "Active streaming tool calls keyed by provider tool-call index.",
    }),
    finishReason: S.Option(S.String).annotateKey({
      description: "Latest finish reason seen while reconstructing the stream.",
    }),
    finished: S.Boolean.annotateKey({ description: "Whether a finish part has already been emitted." }),
    textEnded: S.Boolean.annotateKey({ description: "Whether the current text span has ended." }),
    textStarted: S.Boolean.annotateKey({ description: "Whether the current text span has started." }),
    usage: OpenAiCompatChatCompletionChunk.fields.usage.annotateKey({
      description: "Latest token usage observed in stream chunks.",
    }),
  },
  $I.annote("StreamState", {
    description: "Mutable stream reconstruction state for OpenAI-compatible streaming chunks.",
  })
) {
  static readonly initial = (): StreamState => ({
    activeToolCalls: {},
    finishReason: O.none(),
    finished: false,
    textEnded: false,
    textStarted: false,
    usage: O.none(),
  });
}
```

# Cardinality gap

The three booleans represent eight combinations. The text span has three legal states, while the finish latch is independent, so exactly six combined states are legal:

- `idle` + unfinished
- `open` + unfinished
- `closed` + unfinished
- `idle` + finished
- `open` + finished
- `closed` + finished

`textStarted: false, textEnded: true` is illegal for either finish value. The target therefore replaces only the correlated text pair with one literal; folding `finished` into a six-member lifecycle would falsely couple an independent concern.

# Target schema

Add `LiteralKit` to the existing `@beep/schema` import and name the text lifecycle `StreamTextPhase`:

```ts
const StreamTextPhase = LiteralKit(["idle", "open", "closed"]).pipe(
  $I.annoteSchema("StreamTextPhase", {
    description: "Lifecycle of the text span reconstructed from streaming response parts.",
  })
);
type StreamTextPhase = typeof StreamTextPhase.Type;

class StreamState extends S.Class<StreamState>($I`StreamState`)(
  {
    activeToolCalls: S.Record(S.String, ActiveToolCall).annotateKey({
      description: "Active streaming tool calls keyed by provider tool-call index.",
    }),
    finishReason: S.Option(S.String).annotateKey({
      description: "Latest finish reason seen while reconstructing the stream.",
    }),
    finished: S.Boolean.annotateKey({ description: "Whether a finish part has already been emitted." }),
    textPhase: StreamTextPhase.annotateKey({
      description: "Current lifecycle phase of the reconstructed text span.",
    }),
    usage: OpenAiCompatChatCompletionChunk.fields.usage.annotateKey({
      description: "Latest token usage observed in stream chunks.",
    }),
  },
  $I.annote("StreamState", {
    description: "Mutable stream reconstruction state for OpenAI-compatible streaming chunks.",
  })
) {
  static readonly initial = (): StreamState => ({
    activeToolCalls: {},
    finishReason: O.none(),
    finished: false,
    textPhase: StreamTextPhase.Enum.idle,
    usage: O.none(),
  });
}
```

Transition the phase from emitted parts: any `text-end` yields `closed`; otherwise any `text-start` or an existing `open` yields `open`; otherwise retain `idle` (and keep `closed` closed). Branch through `StreamTextPhase.$match` or compare with `StreamTextPhase.Enum` values; do not recreate `started`/`ended` helper booleans.

# Migration inventory

- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:9` — extend the existing `@beep/schema` import with `LiteralKit`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:221-248` — add `StreamTextPhase`, replace `textStarted`/`textEnded` with `textPhase`, and initialize it to `idle`; retain independent `finished`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:817-823` — `finishStreamParts` matches `textPhase`; only `open` emits the synthetic `text-end`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:838-848` — the first text delta emits `text-start` only when `state.textPhase` is `idle`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:883-890` — finish-time `text-end` uses `idle` versus started phases instead of `state.textStarted`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:900-911` — replace the two accumulating booleans with one phase transition derived from `allParts` and the prior phase.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:913-921` — write `textPhase` into the next state and remove both boolean fields.

Repository-wide search finds no other source reader or writer of `StreamState`, `textStarted`, or `textEnded` outside this module.

# Guard-deletion accounting

- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:821` — delete the coherence conjunction `textStarted && !textEnded`; one `open` phase names the condition.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:845` — delete the boolean interpretation “not started means emit start”; the `idle` arm owns it.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:887-889` — delete the read that infers an open-or-new span from `textStarted || nonEmpty(textParts)`; the transition computes one phase.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:900-911` — delete the parallel OR-accumulators that can manufacture the illegal ended-without-started pair.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts:331-375` — retains the expected `text-start`, deltas, `text-end`, `finish` sequence and proves the `idle -> open -> closed` path behaviorally.
- `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts:377-435` — retains the trailing-usage case and proves a closed span is not ended twice before finish.
- No test directly constructs or reads the private `StreamState` members. Add a focused no-text completion case if P4 needs direct coverage of `idle + finished`; do not expose `StreamState` for testing.

# Risk & sequencing

This is a private Tier 1 state-machine edit in one module, but the transition ordering matters: derive the next phase from the same `allParts` that are returned, after finish-time text parts are assembled. Keep `finished` independent and land the state schema, all reads, and the next-state write atomically so no intermediate edit reintroduces a boolean projection.
