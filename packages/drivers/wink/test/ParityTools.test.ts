import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { WinkNlpToolkitLive } from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";

describe("Adjunct-parity NLP tools", () => {
  it.layer(WinkNlpToolkitLive)("WordCount counts word-like tokens", (it) => {
    it.effect("WordCount counts word-like tokens", () =>
      Effect.gen(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("WordCount", { text: "Hello brave new world." });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        expect(first).toBeDefined();
        expect(first?.isFailure).toBe(false);
        expect(first?.encodedResult).toMatchObject({ wordCount: 4 });
      })
    );
  });

  it.layer(WinkNlpToolkitLive)("RemoveStopWords drops at least one stop word", (it) => {
    it.effect("RemoveStopWords drops at least one stop word", () =>
      Effect.gen(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("RemoveStopWords", {
          text: "the quick brown fox jumps over the lazy dog",
        });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        expect(first).toBeDefined();
        expect(first?.isFailure).toBe(false);
        const encoded = first?.encodedResult as { readonly removedCount: number };
        expect(encoded.removedCount >= 1).toBe(true);
      })
    );
  });

  it.layer(WinkNlpToolkitLive)("Paragraphize splits on blank-line boundaries", (it) => {
    it.effect("Paragraphize splits on blank-line boundaries", () =>
      Effect.gen(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("Paragraphize", { text: "A.\n\nB." });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        expect(first).toBeDefined();
        expect(first?.isFailure).toBe(false);
        expect(first?.encodedResult).toMatchObject({ count: 2 });
      })
    );
  });

  it.layer(WinkNlpToolkitLive)("Stem returns a stem for each word token", (it) => {
    it.effect("Stem returns a stem for each word token", () =>
      Effect.gen(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("Stem", { text: "running runners ran" });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        expect(first).toBeDefined();
        expect(first?.isFailure).toBe(false);
        const encoded = first?.encodedResult as { readonly count: number; readonly stems: ReadonlyArray<string> };
        expect(encoded.count).toBe(3);
        expect(encoded.stems.length).toBe(3);
      })
    );
  });
});
