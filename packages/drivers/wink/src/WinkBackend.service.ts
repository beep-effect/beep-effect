/**
 * WinkBackend - an {@link NLPBackend} implementation backed by wink-nlp.
 *
 * Implements the pluggable {@link NLPBackend} contract on top of the existing
 * {@link WinkEngine} service (the single wink-nlp wrapper in this package), so the
 * model lifecycle is owned in one place. Provides tokenization, sentence
 * detection, POS tagging, lemmatization, and named-entity recognition; dependency
 * parsing and relation extraction are unsupported and fail with
 * {@link BackendNotSupported}.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - instead of instantiating its own `winkNLP(model)`, it reads the existing
 *   {@link WinkEngine} service (one wink wrapper, shared lifecycle).
 * - `doc...out(its.detail)` accessors are assigned to typed
 *   `ItsFunction<...>` locals (the proven repo pattern) and the
 *   `Detail | string` entity output is narrowed with `typeof`, so there are no
 *   assertions.
 * - service methods use `Effect.fn`; nodes are built with `Schema.X.make(...)` and
 *   a `Clock`-sourced timestamp (was `new S.XNode(...)` + `Date.now()`).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as Schema from "@beep/nlp/Graph/Schema";
import { NLPBackend, notSupported, operationError } from "@beep/nlp-processing/Backend/NLPBackend";
import { A } from "@beep/utils";
import { Clock, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { WinkEngine } from "./Wink.service.ts";
import type { BackendCapabilities } from "@beep/nlp-processing/Backend/NLPBackend";
import type { Detail, ItsFunction } from "wink-nlp";

const BACKEND_NAME = "wink-nlp";

const capabilities: BackendCapabilities = {
  constituencyParsing: false,
  coreferenceResolution: false,
  dependencyParsing: false,
  lemmatization: true,
  ner: true,
  posTagging: true,
  relationExtraction: false,
  sentencization: true,
  tokenization: true,
};

/** Locate `needle` in `haystack`, returning a character span (length-correct if absent). */
const findSpan = (haystack: string, needle: string): { readonly end: number; readonly start: number } => {
  const start = haystack.indexOf(needle);
  return start < 0 ? { end: needle.length, start: 0 } : { end: start + needle.length, start };
};

const makeWinkBackend = Effect.gen(function* () {
  const engine = yield* WinkEngine;
  const toOpError = (operation: string) => (cause: unknown) => operationError(BACKEND_NAME, operation, cause);

  return NLPBackend.of({
    capabilities,
    name: BACKEND_NAME,

    tokenize: Effect.fn("WinkBackend.tokenize")(function* (text: string) {
      const doc = yield* Effect.mapError(engine.getWinkDoc(text), toOpError("tokenize"));
      return doc.tokens().out();
    }),

    sentencize: Effect.fn("WinkBackend.sentencize")(function* (text: string) {
      const doc = yield* Effect.mapError(engine.getWinkDoc(text), toOpError("sentencize"));
      return doc.sentences().out();
    }),

    posTag: Effect.fn("WinkBackend.posTag")(function* (text: string) {
      const doc = yield* Effect.mapError(engine.getWinkDoc(text), toOpError("posTag"));
      const its = yield* Effect.mapError(engine.its, toOpError("posTag"));
      const timestamp = yield* Clock.currentTimeMillis;
      const valueAccessor: ItsFunction<string> = its.value;
      const posAccessor: ItsFunction<string> = its.pos;
      const tokens = doc.tokens().out(valueAccessor);
      const tags = doc.tokens().out(posAccessor);
      return A.map(tokens, (token, index) =>
        Schema.POSNode.make({
          position: index,
          tag: O.getOrElse(A.get(tags, index), () => "UNKNOWN"),
          text: token,
          timestamp,
        })
      );
    }),

    lemmatize: Effect.fn("WinkBackend.lemmatize")(function* (text: string) {
      const doc = yield* Effect.mapError(engine.getWinkDoc(text), toOpError("lemmatize"));
      const its = yield* Effect.mapError(engine.its, toOpError("lemmatize"));
      const timestamp = yield* Clock.currentTimeMillis;
      const valueAccessor: ItsFunction<string> = its.value;
      // `its.lemma` needs the model addons, so adapt it to the 4-arg token accessor shape.
      const lemmaAccessor: ItsFunction<string> = (index, token, _cache, addons) => its.lemma(index, token, addons);
      const tokens = doc.tokens().out(valueAccessor);
      const lemmas = doc.tokens().out(lemmaAccessor);
      return A.map(tokens, (token, index) =>
        Schema.LemmaNode.make({
          lemma: O.getOrElse(A.get(lemmas, index), () => token),
          position: index,
          timestamp,
          token,
        })
      );
    }),

    extractEntities: Effect.fn("WinkBackend.extractEntities")(function* (text: string) {
      const doc = yield* Effect.mapError(engine.getWinkDoc(text), toOpError("extractEntities"));
      const its = yield* Effect.mapError(engine.its, toOpError("extractEntities"));
      const timestamp = yield* Clock.currentTimeMillis;
      const detailAccessor: ItsFunction<Detail> = its.detail;
      const details = doc.entities().out(detailAccessor);
      return A.map(details, (element) => {
        const detail = P.isString(element) ? { type: "UNKNOWN", value: element } : element;
        return Schema.EntityNode.make({
          confidence: 1,
          entityType: detail.type,
          span: findSpan(text, detail.value),
          text: detail.value,
          timestamp,
        });
      });
    }),

    parseDependencies: Effect.fn("WinkBackend.parseDependencies")(function* (_sentence: string) {
      return yield* notSupported(BACKEND_NAME, "parseDependencies", "wink-nlp does not support dependency parsing");
    }),

    extractRelations: Effect.fn("WinkBackend.extractRelations")(function* (_text: string) {
      return yield* notSupported(BACKEND_NAME, "extractRelations", "wink-nlp does not support relation extraction");
    }),
  });
});

/**
 * Live {@link NLPBackend} layer backed by wink-nlp (requires {@link WinkEngine}).
 *
 * **Example** (Providing WinkBackendLive layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { NLPBackend } from "@beep/nlp-processing/Backend/NLPBackend"
 * import { WinkBackendLive, WinkEngineLive } from "@beep/wink"
 *
 * const readCapabilities = Effect.gen(function* () {
 *   const backend = yield* NLPBackend
 *   return backend.capabilities.tokenization
 * })
 *
 * const supportsTokenization = await Effect.runPromise(
 *   readCapabilities.pipe(
 *     Effect.provide(WinkBackendLive.pipe(Layer.provide(WinkEngineLive)))
 *   )
 * )
 *
 * supportsTokenization === true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkBackendLive: Layer.Layer<NLPBackend, never, WinkEngine> = Layer.effect(NLPBackend, makeWinkBackend);
