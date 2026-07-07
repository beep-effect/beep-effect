/**
 * Proofs for backend composition: withFallback (secondary used when primary
 * fails, union of capabilities), withCaching (memoized lookups), and
 * selectByCapability (first supporting backend).
 *
 * Uses lightweight stub backends so the laws are checked without loading a model.
 */

import * as Composition from "@beep/nlp-processing/Backend/Composition";
import * as Backend from "@beep/nlp-processing/Backend/NLPBackend";
import { PosInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equals(decode(encode(value)), value)).toBe(true);
    }),
    { numRuns: 50 }
  );
};

const baseCapabilities: Backend.BackendCapabilities = {
  constituencyParsing: false,
  coreferenceResolution: false,
  dependencyParsing: false,
  lemmatization: false,
  ner: false,
  posTagging: false,
  relationExtraction: false,
  sentencization: false,
  tokenization: false,
};

const stub = (
  name: string,
  capabilities: Backend.BackendCapabilities,
  tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>, Backend.NLPBackendError>
): Backend.NLPBackendShape => ({
  capabilities,
  extractEntities: () => Effect.succeed([]),
  extractRelations: () => Effect.succeed([]),
  lemmatize: () => Effect.succeed([]),
  name,
  parseDependencies: () => Effect.succeed([]),
  posTag: () => Effect.succeed([]),
  sentencize: () => Effect.succeed([]),
  tokenize,
});

describe("withFallback", () => {
  it.effect(
    "uses the secondary backend when the primary fails",
    Effect.fnUntraced(function* () {
      const primary = stub("primary", { ...baseCapabilities, tokenization: true }, () =>
        Effect.fail(Backend.operationError("primary", "tokenize", { cause: new Error("boom") }))
      );
      const secondary = stub("secondary", { ...baseCapabilities, ner: true }, () => Effect.succeed(["fallback"]));
      const composed = Composition.withFallback(primary, secondary);
      const tokens = yield* composed.tokenize("x");
      expect(tokens).toEqual(["fallback"]);
      expect(composed.name).toBe("primary+secondary");
      expect(composed.capabilities.tokenization).toBe(true);
      expect(composed.capabilities.ner).toBe(true);
    })
  );

  it.effect(
    "keeps the primary result when it succeeds",
    Effect.fnUntraced(function* () {
      const primary = stub("primary", baseCapabilities, () => Effect.succeed(["primary"]));
      const secondary = stub("secondary", baseCapabilities, () => Effect.succeed(["secondary"]));
      const composed = Composition.withFallback(primary, secondary);
      expect(yield* composed.tokenize("x")).toEqual(["primary"]);
    })
  );
});

describe("withCaching", () => {
  it("round-trips schema-derived cache options and applies defaults", () => {
    assertSchemaRoundTrip(Composition.CachingOptions);
    const defaults = Composition.CachingOptions.make({});
    expect(defaults.capacity).toBe(1024);
    expect(Duration.equals(defaults.timeToLive, Duration.minutes(10))).toBe(true);
  });

  it.effect(
    "memoizes a lookup so the backend runs once per key",
    Effect.fnUntraced(function* () {
      let calls = 0;
      const backend = stub("counting", { ...baseCapabilities, tokenization: true }, (text) =>
        Effect.sync(() => {
          calls = calls + 1;
          return [text];
        })
      );
      const cached = yield* Composition.withCaching(backend, { capacity: PosInt.make(8) });
      const first = yield* cached.tokenize("hello");
      const second = yield* cached.tokenize("hello");
      expect(first).toEqual(["hello"]);
      expect(second).toEqual(["hello"]);
      expect(calls).toBe(1);
      expect(cached.name).toBe("cached(counting)");
    })
  );
});

describe("selectByCapability", () => {
  it("picks the first backend that supports the capability", () => {
    const a = stub("a", baseCapabilities, () => Effect.succeed([]));
    const b = stub("b", { ...baseCapabilities, ner: true }, () => Effect.succeed([]));
    const picked = Composition.selectByCapability([a, b], "ner");
    expect(O.isSome(picked)).toBe(true);
    expect(O.getOrThrow(picked).name).toBe("b");
  });

  it("returns none when no backend supports the capability", () => {
    const a = stub("a", baseCapabilities, () => Effect.succeed([]));
    expect(O.isNone(Composition.selectByCapability([a], "ner"))).toBe(true);
  });
});
