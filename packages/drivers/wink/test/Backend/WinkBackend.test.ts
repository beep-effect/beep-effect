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
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";

const offsetsOf = (span: O.Option<{ readonly start: number; readonly end: number }>) =>
  O.map(span, ({ end, start }) => ({ end, start }));

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
  it.layer(TestLayer, { timeout: "30 seconds" })("resolves a repeated entity surface once per mention", (it) => {
    it.effect(
      "resolves a repeated entity surface once per mention",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const text = "Meet Monday and Monday.";
        const entities = yield* backend.extractEntities(text);
        deepStrictEqual(
          A.map(entities, (entity) => offsetsOf(entity.span)),
          [O.some({ end: 11, start: 5 }), O.some({ end: 22, start: 16 })]
        );
      })
    );
  });
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
          assertSome(
            O.map(entity.span, (span) => span.start < span.end),
            true
          );
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
        deepStrictEqual(
          A.map(entities, (entity) => offsetsOf(entity.span)),
          [O.some({ end: 13, start: 6 }), O.some({ end: 26, start: 19 })]
        );
        for (const entity of entities) {
          assertSome(
            O.map(entity.span, (span) => Str.slice(span.start, span.end)(text)),
            entity.text
          );
        }
      })
    );
  });

  it.layer(TestLayer, { timeout: "30 seconds" })("takes entity spans from the original text", (it) => {
    it.effect(
      "takes entity spans from the original text",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        // wink caps a token's stored preceding spaces at 65,534, so offsets rebuilt from them drift.
        const text = `${Str.repeat(65_535)(" ")}a@b.com`;
        const entities = yield* backend.extractEntities(text);
        deepStrictEqual(
          A.map(entities, (entity) => offsetsOf(entity.span)),
          [O.some({ end: 65_542, start: 65_535 })]
        );
      })
    );
  });

  it.layer(UnresolvableSpanLayer, { timeout: "30 seconds" })(
    "leaves an entity without a token span unresolved",
    (it) => {
      it.effect(
        "leaves an entity without a token span unresolved",
        Effect.fnUntraced(function* () {
          const backend = yield* Backend.NLPBackend;
          const entities = yield* backend.extractEntities("Email a@b.com today.");
          expect(entities.length).toBeGreaterThan(0);
          for (const entity of entities) assertNone(entity.span);
        })
      );
    }
  );

  it.layer(TestLayer, { timeout: "30 seconds" })("L5-4 fails parseDependencies with BackendNotSupported", (it) => {
    it.effect(
      "L5-4 fails parseDependencies with BackendNotSupported",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const result = yield* Effect.flip(backend.parseDependencies("a sentence"));
        expect(result._tag).toBe("BackendNotSupported");
      })
    );
  });

  it.layer(TestLayer, { timeout: "30 seconds" })("L5-4 fails extractRelations with BackendNotSupported", (it) => {
    it.effect(
      "L5-4 fails extractRelations with BackendNotSupported",
      Effect.fnUntraced(function* () {
        const backend = yield* Backend.NLPBackend;
        const result = yield* Effect.flip(backend.extractRelations("a sentence"));
        expect(result._tag).toBe("BackendNotSupported");
      })
    );
  });
});
