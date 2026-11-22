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
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";

const TestLayer = Layer.provide(WinkBackendLive, WinkEngine.WinkEngineLive);

// The live engine with `its.span` returning an empty token range, so no entity span resolves.
const UnresolvableSpanEngine = Layer.effect(
  WinkEngine.WinkEngine,
  Effect.gen(function* () {
    const live = yield* WinkEngine.WinkEngine;
    return WinkEngine.WinkEngine.of({
      ...live,
      its: Effect.map(live.its, (its) => ({ ...its, span: (): Array<number> => [] })),
    });
  })
).pipe(Layer.provide(WinkEngine.WinkEngineLive));
const UnresolvableSpanLayer = Layer.provide(WinkBackendLive, UnresolvableSpanEngine);

describe("WinkBackend", () => {
  it.layer(TestLayer, { timeout: "30 seconds" })("tokenizes text into words", (it) => {
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

  it.layer(TestLayer, { timeout: "30 seconds" })("splits text into sentences", (it) => {
    it.effect(
      "splits text into sentences",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const sentences = yield* backend.sentencize("Hello world. How are you?");
        expect(sentences.length).toBe(2);
      })
    );
  });

  it.layer(TestLayer, { timeout: "30 seconds" })("tags parts of speech, one POSNode per token", (it) => {
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

  it.layer(TestLayer, { timeout: "30 seconds" })("lemmatizes tokens to canonical forms", (it) => {
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

  it.layer(TestLayer, { timeout: "30 seconds" })("extracts entities with a type and span", (it) => {
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

  it.layer(TestLayer, { timeout: "30 seconds" })("gives each repeated entity mention its own span", (it) => {
    it.effect(
      "gives each repeated entity mention its own span",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const text = "Email a@b.com then a@b.com again.";
        const entities = yield* backend.extractEntities(text);
        expect(A.map(entities, (entity) => entity.span)).toEqual([
          { end: 13, start: 6 },
          { end: 26, start: 19 },
        ]);
        for (const entity of entities) {
          expect(Str.slice(entity.span.start, entity.span.end)(text)).toBe(entity.text);
        }
      })
    );
  });

  it.layer(UnresolvableSpanLayer, { timeout: "30 seconds" })("fails extractEntities when no span resolves", (it) => {
    it.effect(
      "fails extractEntities when no span resolves",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const result = yield* Effect.flip(backend.extractEntities("Email a@b.com today."));
        expect(result._tag).toBe("BackendOperationError");
      })
    );
  });

  it.layer(TestLayer, { timeout: "30 seconds" })("fails parseDependencies with BackendNotSupported", (it) => {
    it.effect(
      "fails parseDependencies with BackendNotSupported",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const result = yield* Effect.flip(backend.parseDependencies("a sentence"));
        expect(result._tag).toBe("BackendNotSupported");
      })
    );
  });

  it.layer(TestLayer, { timeout: "30 seconds" })("fails extractRelations with BackendNotSupported", (it) => {
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
