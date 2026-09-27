import { sentences, tokenCount, tokenize, tokenizeToDocument } from "@beep/nlp-processing/Core/Tokenization";
import { it } from "@beep/test-runner";
import { WinkTokenizationLive } from "@beep/wink";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";

describe("WinkTokenization", () => {
  it.layer(WinkTokenizationLive)("tokenizes text with lemma and position metadata", (it) => {
    it.effect("tokenizes text with lemma and position metadata", () =>
      Effect.gen(function* () {
        const program = tokenize("Ada Lovelace wrote the first algorithm.");
        const tokens = yield* program;

        expect(tokens).toHaveLength(7);
        expect(tokens[0]?.text).toBe("Ada");
        pipe(tokens[0]?.pos ?? O.none(), O.isSome, assertTrue);
        expect(tokens[0]?.start).toBe(0);
        expect(tokens[0]?.end).toBe(3);
        expect(tokens[6]?.text).toBe(".");
      })
    );
  });

  it.layer(WinkTokenizationLive)("builds sentences and documents from the live layer", (it) => {
    it.effect("builds sentences and documents from the live layer", () =>
      Effect.gen(function* () {
        const program = Effect.all([
          sentences("Ada wrote code. Grace debugged it."),
          tokenCount("Ada wrote code. Grace debugged it."),
          tokenizeToDocument("Ada wrote code. Grace debugged it.", "history"),
        ]);
        const [sentenceList, count, document] = yield* program;

        expect(sentenceList).toHaveLength(2);
        expect(sentenceList[0]?.text).toBe("Ada wrote code.");
        expect(sentenceList[1]?.text).toBe("Grace debugged it.");
        expect(count).toBe(8);
        expect(document.id).toBe("history");
        expect(document.sentenceCount).toBe(2);
        expect(document.tokenCount).toBe(8);
        expect(document.text).toBe("Ada wrote code. Grace debugged it.");
      })
    );
  });
});
