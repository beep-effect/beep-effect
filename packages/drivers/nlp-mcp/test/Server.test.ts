import { StreamingToolkit } from "@beep/nlp-mcp/StreamingTools";
import { NlpToolkit, NlpTools } from "@beep/nlp-processing/Tools/NlpToolkit";
import { WinkNlpToolkitLive } from "@beep/wink";
import { assert, describe, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

describe("nlp-mcp tool surface", () => {
  it("mounts the full @beep/nlp NlpToolkit", () => {
    const names = NlpTools.map((tool) => tool.name);
    assert.strictEqual(names.length, 25);
    assert.strictEqual(new Set(names).size, names.length);
    assert.strictEqual(Object.keys(NlpToolkit.tools).length, 25);
    assert.isTrue(names.includes("Tokenize"));
  });

  it("exposes a combined 42-tool surface across both mounted toolkits", () => {
    // Guards the server contract from `makeServerLayer`: both toolkits must be
    // mounted, with no cross-toolkit name collision, summing to 42 unique tools.
    const nlpNames = Object.keys(NlpToolkit.tools);
    const streamingNames = Object.keys(StreamingToolkit.tools);
    const merged = [...nlpNames, ...streamingNames];

    assert.strictEqual(streamingNames.length, 17);
    assert.strictEqual(merged.length, 42);
    assert.strictEqual(new Set(merged).size, 42, "NLP and streaming tool names must be disjoint");
    assert.isTrue(merged.includes("Tokenize"), "NLP toolkit tool must be present");
    assert.isTrue(merged.includes("stream_read_lines"), "streaming toolkit tool must be present");
  });
});

describe("nlp-mcp wink-backed handlers", () => {
  layer(WinkNlpToolkitLive)("via the mounted toolkit", (it) => {
    it.effect(
      "Tokenize resolves through the wink handler layer",
      Effect.fnUntraced(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("Tokenize", { text: "Hello world." });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        assert.isDefined(first);
        assert.isFalse(first.isFailure);
      })
    );

    it.effect(
      "WordCount resolves through the wink handler layer",
      Effect.fnUntraced(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("WordCount", { text: "Hello brave new world." });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        assert.isDefined(first);
        assert.isFalse(first.isFailure);
      })
    );

    it.effect(
      "Stem resolves through the wink handler layer",
      Effect.fnUntraced(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("Stem", { text: "running runners ran" });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        assert.isDefined(first);
        assert.isFalse(first.isFailure);
      })
    );

    it.effect(
      "BagOfWords encodes its nested AiNGram array through the wink handler layer",
      Effect.fnUntraced(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("BagOfWords", { text: "the cat sat on the mat" });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        assert.isDefined(first);
        assert.isFalse(first.isFailure);
      })
    );

    it.effect(
      "Analyze encodes its nested AiAnalysis token array through the wink handler layer",
      Effect.fnUntraced(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("Analyze", { text: "The quick brown fox. It was fast." });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        assert.isDefined(first);
        assert.isFalse(first.isFailure);
      })
    );
  });
});
