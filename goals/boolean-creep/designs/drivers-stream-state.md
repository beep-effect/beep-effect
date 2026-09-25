# Instance

- id: `drivers-stream-state`
- source/main: `0be1f13d62fa00cb65e34ff69ec99043380f8d81` (P2 refresh; not a new census)
- file:line: `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:221`
- symbol: `StreamState`
- members: `finished`, `textEnded`, `textStarted`
- evidence classes:
  - E4 at `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:822` — text-end is only emitted when `textStarted && !textEnded`; `textEnded` is unreachable without `textStarted`.
  - E2 at `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:846` — readers branch on `textStarted` vs not to emit text-start; `finished` short-circuits the wrap-up path and never treats ended-without-start as a case.

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

The private state is consumed through public provider callbacks accepting
arbitrary schema-valid chunk sequences, including zero/multiple choices and
usage before/after finish reasons. Do not restrict the grammar to typical
provider ordering. The three booleans represent eight combinations. The text span has three legal states, while the finish latch is independent, so exactly six combined states are legal:

- `idle` + unfinished
- `open` + unfinished
- `closed` + unfinished
- `idle` + finished
- `open` + finished
- `closed` + finished

An empty-choice usage chunk can finish an idle stream, or an open stream after
text without a finish reason. A later finish-bearing choice closes that already
finished open span. A finish-bearing text choice without usage closes a span
while leaving finished false. These source-derived witnesses establish all six
states without claiming normal providers emit each.

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

Transition the stored phase from emitted parts without changing stream behavior: an existing `closed` phase stays `closed`; otherwise any emitted `text-end` yields `closed`, any emitted `text-start` or existing `open` yields `open`, and the remaining case stays `idle`. Branch through `StreamTextPhase.$match` or compare with `StreamTextPhase.Enum` values; do not recreate `started`/`ended` helper booleans.

All choices in a chunk currently read the same incoming text state: updates
to text phase occur only after flattening all choice parts. Preserve this even
when multiple choices cause repeated text-start/text-end emissions. The mutable
tool-call map and finish reason still advance choice by choice. Do not make
text phase update per choice or stop processing after `finished` becomes true.

The current inline finish path at lines 888-890 tests `state.textStarted` without consulting `textEnded`. Its phase equivalent must therefore treat both `open` and `closed` as “started.” This preserves the current possibility of another `text-end` when a finish-bearing choice arrives after the state is already closed; changing that behavior is a separate stream-normalization decision. Only `finishStreamParts` at lines 818-824 uses the stricter open-span condition and maps exactly to the `open` phase.

# Migration inventory

- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:9` — extend the existing `@beep/schema` import with `LiteralKit`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:221-248` — add `StreamTextPhase`, replace `textStarted`/`textEnded` with `textPhase`, and initialize it to `idle`; retain independent `finished`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:818-824` — `finishStreamParts` matches `textPhase`; only `open` emits the synthetic `text-end`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:841-851` — the first text delta emits `text-start` only when `state.textPhase` is `idle`.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:884-893` — finish-time `text-end` treats both `open` and `closed` as started, exactly matching the current `state.textStarted` check; do not silently suppress the existing closed-state emission.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:901-912` — replace the two accumulating booleans with one phase transition derived from `allParts` and the prior phase.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:914-924` — write `textPhase` into the next state and remove both boolean fields.

Scoped exhaustive Graft search across the openai-compat package found all
StreamState/textStarted/textEnded hits in this module. The package wildcard
barrel exports public provider APIs, but StreamState is a non-exported class.
Other packages may use similarly named state; no repository-wide absence claim
is needed for this private lexical owner.

# Guard-deletion accounting

- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:822` — delete the coherence conjunction `textStarted && !textEnded`; one `open` phase names the condition.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:846` — delete the boolean interpretation “not started means emit start”; the `idle` arm owns it.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:888-890` — delete the read that infers an open-or-new span from `textStarted || nonEmpty(textParts)`; replace the state read with a phase match accepting both open and closed,
  retaining the independent nonempty textParts condition. The output-dependent
  condition is still necessary and earns no guard-deletion credit.
- `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:901-912` — delete the parallel OR-accumulators with the schema-owned phase accumulator. The current writer already obeys
  the relation; the schema removes representational slack, not an observed
  runtime bug.

# Encoded-side impact

none (internal)

`StreamState` is private to this module, is never encoded by a source or test consumer, and does not cross the provider wire. Preserve full active-tool-call records (index keys, id, name, argument text),
latest complete usage object and every optional nested token-detail field, full
finish-reason strings, emitted ids/deltas/tool payloads and error mapping. No
provider chunk/schema/JSON encoding or public callback input changes. Keep
`Stream.mapAccumEffect` and `onHalt` placement, including behavior for failures,
interruptions and trailing chunks; this design adds no early termination.

The separate `finished`/`finishReason` cluster is intentionally untouched: `finishReason` can arrive before `finished`, while an empty-choice usage wrap-up can set `finished` without a reason (`r25-drivers-n-r-stream-state-finished-finish-reason`, D1).

# Test impact

- `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts:390-434` — retains the expected `text-start`, deltas, `text-end`, `finish` sequence and proves the `idle -> open -> closed` path behaviorally.
- `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts:436-494` — retains the trailing-usage case and proves a closed span is not ended twice before finish.
- Add bounded provider fixtures for usage-only completion, open+finished,
multiple choices sharing the incoming phase, and finish-bearing chunks after
closed/finished state. Preserve repeated end/start behavior where the current
source emits it. Compare emitted order and full payloads, not only part counts.
The private abstract closure audit is source-derived evidence, not executed
service or schema proof. No tests or product implementation ran during P2.
After independent review, run focused language-model tests and package-verify.

No test directly constructs or reads the private `StreamState` members. Add a focused no-text completion case if P4 needs direct coverage of `idle + finished`; do not expose `StreamState` for testing.

# Risk & sequencing

This is a private Tier 1 state-machine edit in one module, but the transition ordering matters: derive the next phase from the same `allParts` that are returned, after finish-time text parts are assembled. Keep `finished` independent and preserve the different meanings of the two current reads: `finishStreamParts` asks whether a span is open, while the inline finish path asks whether text has ever started. Land the state schema, all reads, and the next-state write atomically so no intermediate edit reintroduces a boolean projection.
