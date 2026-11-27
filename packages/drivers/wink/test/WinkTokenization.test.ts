import { sentences, tokenCount, tokenize, tokenizeToDocument } from "@beep/nlp-processing/Core/Tokenization";
import { it } from "@beep/test-runner";
import { Position } from "@beep/text/OffsetUnit";
import { WinkTokenizationLive } from "@beep/wink";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

describe("WinkTokenization", () => {
  it.layer(WinkTokenizationLive, { timeout: "30 seconds" })("tokenizes text with lemma and position metadata", (it) => {
    it.effect("tokenizes text with lemma and position metadata", () =>
      Effect.gen(function* () {
        const program = tokenize("Ada Lovelace wrote the first algorithm.");
        const tokens = yield* program;

        expect(tokens).toHaveLength(7);
        expect(tokens[0]?.text).toBe("Ada");
        pipe(tokens[0]?.pos ?? O.none(), O.isSome, assertTrue);
        expect(tokens[0]?.span).toEqual(Position.make({ unit: "utf16-code-unit", start: 0, end: 3 }));
        expect(tokens[6]?.text).toBe(".");
      })
    );
  });

  it.layer(WinkTokenizationLive, { timeout: "30 seconds" })(
    "builds sentences and documents from the live layer",
    (it) => {
      it.effect("builds sentences and documents from the live layer", () =>
        Effect.gen(function* () {
          const program = Effect.all(
            [
              sentences("Ada wrote code. Grace debugged it."),
              tokenCount("Ada wrote code. Grace debugged it."),
              tokenizeToDocument("Ada wrote code. Grace debugged it.", "history"),
            ],
            { concurrency: 1 }
          );
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
    }
  );

  it.layer(WinkTokenizationLive, { timeout: "30 seconds" })("takes token offsets from the original text", (it) => {
    it.effect("takes token offsets from the original text", () =>
      Effect.gen(function* () {
        const text = `${Str.repeat(65_535)(" ")}Ada`;
        const tokens = yield* tokenize(text);

        expect(
          A.map(tokens, (token) => [token.text, token.span.start, token.span.end]),
          "wink caps stored preceding spaces at 65,534, so offsets rebuilt from them would drift"
        ).toEqual([["Ada", 65_535, 65_538]]);
      })
    );
  });
});
