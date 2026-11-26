/**
 * WinkBackend - an {@link NLPBackend} implementation backed by wink-nlp.
 *
 * **Details**
 *
 * Implements the pluggable {@link NLPBackend} contract on top of the existing
 * {@link WinkEngine} service (the single wink-nlp wrapper in this package), so the
 * model lifecycle is owned in one place. Provides tokenization, sentence
 * detection, POS tagging, lemmatization, and named-entity recognition; dependency
 * parsing and relation extraction are unsupported and fail with
 * {@link BackendNotSupported}.
 *
 * It reads the shared {@link WinkEngine} service rather than creating its own
 * wink-nlp instance, so the model lifecycle has one owner, and node timestamps come
 * from `Clock`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { BackendCapabilities, NLPBackend, notSupported, operationError } from "@beep/nlp-processing/Backend/NLPBackend";
import * as Schema from "@beep/nlp-processing/Graph/Schema";
import { Position } from "@beep/text/OffsetUnit";
import { Resolution, resolve } from "@beep/text/Resolution";
import { A } from "@beep/utils";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { WinkEngine } from "./Wink.service.ts";
import type { Detail, ItsFunction } from "wink-nlp";

const BACKEND_NAME = "wink-nlp";

const capabilities: BackendCapabilities = BackendCapabilities.make({
  constituencyParsing: false,
  coreferenceResolution: false,
  dependencyParsing: false,
  lemmatization: true,
  ner: true,
  posTagging: true,
  relationExtraction: false,
  sentencization: true,
  tokenization: true,
});

type CharSpan = { readonly end: number; readonly start: number };

/**
 * Character offsets of every wink token, located in the original text with a
 * cursor that only moves forward; `None` when any token value is not found.
 *
 * Offsets are not rebuilt from wink's `precedingSpaces`: wink 2.4 caps a token's
 * stored preceding spaces at 65,534, so a rebuilt offset drifts after a longer run.
 */
const tokenCharSpans = (text: string, values: ReadonlyArray<string>): O.Option<ReadonlyArray<CharSpan>> =>
  O.all(
    A.mapAccum(values, O.some(0), (cursor, value) => {
      const start = O.flatMap(cursor, (from) => O.map(Str.indexOf(value)(Str.slice(from)(text)), N.sum(from)));
      return [O.map(start, N.sum(value.length)), O.map(start, (at) => ({ end: at + value.length, start: at }))];
    })[1]
  );

/** Map a wink `its.span` token range (`[first, last]`, inclusive) onto character offsets. */
const entityCharSpan = (tokens: ReadonlyArray<CharSpan>, tokenRange: ReadonlyArray<number>): O.Option<CharSpan> =>
  O.zipWith(
    O.flatMap(A.get(tokenRange, 0), (first) => A.get(tokens, first)),
    O.flatMap(A.get(tokenRange, 1), (last) => A.get(tokens, last)),
    (first, last) => ({ end: last.end, start: first.start })
  );

const entityPosition = (text: string, located: CharSpan, value: string): O.Option<Position> =>
  O.flatMap(Position.makeOption({ unit: "utf16-code-unit", start: located.start, end: located.end }), (position) =>
    Resolution.match(resolve(text, position), {
      Unique: (unique) => (Str.Equivalence(unique.quote, value) ? O.some(unique.position) : O.none()),
      Ambiguous: O.none<Position>,
      NotFound: O.none<Position>,
    })
  );

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
      const spanAccessor: ItsFunction<Array<number>> = its.span;
      const details = doc.entities().out(detailAccessor);
      const tokenRanges: ReadonlyArray<ReadonlyArray<number> | string> = doc.entities().out(spanAccessor);
      const tokens = tokenCharSpans(text, doc.tokens().out());
      return A.map(details, (element, index) => {
        const detail = P.isString(element) ? { type: "UNKNOWN", value: element } : element;
        const span = O.flatMap(A.get(tokenRanges, index), (tokenRange) =>
          P.isString(tokenRange) ? O.none() : O.flatMap(tokens, (located) => entityCharSpan(located, tokenRange))
        ).pipe(O.flatMap((located) => entityPosition(text, located, detail.value)));
        return Schema.EntityNode.make({
          confidence: 1,
          entityType: detail.type,
          span,
          text: detail.value,
          timestamp,
        });
      });
    }),

    parseDependencies: Effect.fn("WinkBackend.parseDependencies")(function* (_sentence: string) {
      return yield* notSupported(BACKEND_NAME, "parseDependencies", {
        message: "wink-nlp does not support dependency parsing",
      });
    }),

    extractRelations: Effect.fn("WinkBackend.extractRelations")(function* (_text: string) {
      return yield* notSupported(BACKEND_NAME, "extractRelations", {
        message: "wink-nlp does not support relation extraction",
      });
    }),
  });
});

/**
 * Live {@link NLPBackend} layer backed by wink-nlp (requires {@link WinkEngine}).
 *
 * **Example** (Providing WinkBackendLive layer)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
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
