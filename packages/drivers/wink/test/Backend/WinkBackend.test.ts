/**
 * Proofs for the wink-nlp backend: tokenize/sentencize/posTag/lemmatize/
 * extractEntities produce the expected node shapes, and the unsupported
 * operations (parseDependencies/extractRelations) fail with BackendNotSupported.
 *
 * Runs against the real wink-nlp model via WinkEngineLive.
 */

import * as Backend from "@beep/nlp-processing/Backend/NLPBackend";
import { it } from "@beep/test-runner";
import * as WinkEngine from "@beep/wink";
import { WinkBackendLive } from "@beep/wink";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const TestLayer = Layer.provide(WinkBackendLive, WinkEngine.WinkEngineLive);

describe("WinkBackend", () => {
  it.layer(TestLayer)("tokenizes text into words", (it) => {
    it.effect(
      "tokenizes text into words",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const tokens = yield* backend.tokenize("Hello world");
        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens).toContain("Hello");
      })
    );
  });

  it.layer(TestLayer)("splits text into sentences", (it) => {
    it.effect(
      "splits text into sentences",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const sentences = yield* backend.sentencize("Hello world. How are you?");
        expect(sentences.length).toBe(2);
      })
    );
  });

  it.layer(TestLayer)("tags parts of speech, one POSNode per token", (it) => {
    it.effect(
      "tags parts of speech, one POSNode per token",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const tagged = yield* backend.posTag("dogs run");
        expect(tagged.length).toBe(2);
        expect(tagged[0]?.text).toBe("dogs");
        expect(typeof tagged[0]?.tag).toBe("string");
        expect(tagged[0]?.position).toBe(0);
      })
    );
  });

  it.layer(TestLayer)("lemmatizes tokens to canonical forms", (it) => {
    it.effect(
      "lemmatizes tokens to canonical forms",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const lemmas = yield* backend.lemmatize("running dogs");
        expect(lemmas.length).toBe(2);
        expect(lemmas[0]?.token).toBe("running");
        expect(typeof lemmas[0]?.lemma).toBe("string");
      })
    );
  });

  it.layer(TestLayer)("extracts entities with a type and span", (it) => {
    it.effect(
      "extracts entities with a type and span",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const entities = yield* backend.extractEntities("Meet me at 5pm on Monday.");
        expect(entities.length).toBeGreaterThan(0);
        // wink detects temporal entities; each carries a type + span
        for (const entity of entities) {
          expect(typeof entity.entityType).toBe("string");
          expect(entity.span.end).toBeGreaterThanOrEqual(entity.span.start);
        }
      })
    );
  });

  it.layer(TestLayer)("fails parseDependencies with BackendNotSupported", (it) => {
    it.effect(
      "fails parseDependencies with BackendNotSupported",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const result = yield* Effect.flip(backend.parseDependencies("a sentence"));
        expect(result._tag).toBe("BackendNotSupported");
      })
    );
  });

  it.layer(TestLayer)("fails extractRelations with BackendNotSupported", (it) => {
    it.effect(
      "fails extractRelations with BackendNotSupported",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const result = yield* Effect.flip(backend.extractRelations("a sentence"));
        expect(result._tag).toBe("BackendNotSupported");
      })
    );
  });
});
