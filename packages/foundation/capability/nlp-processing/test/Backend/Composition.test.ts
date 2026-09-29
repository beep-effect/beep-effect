import * as Composition from "@beep/nlp-processing/Backend/Composition";
import * as Backend from "@beep/nlp-processing/Backend/NLPBackend";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const PosInt = S.Int.check(S.isGreaterThan(0));

const assertSchemaRoundTrip = Effect.fn("assertSchemaRoundTrip")(function* <
  Schema extends S.Codec<unknown, unknown, never, never>,
>(schema: Schema, value: Schema["Type"], label: string) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value), label).toBe(true);
});

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
  it.effect.prop(
    "round-trips schema-derived cache options and applies defaults",
    { CachingOptions: Arbitrary.schema(Composition.CachingOptions) },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaRoundTrip(Composition.CachingOptions, values.CachingOptions, "Composition.CachingOptions");
        const defaults = Composition.CachingOptions.make({});
        expect(defaults.capacity).toBe(1024);
        expect(Duration.equals(defaults.timeToLive, Duration.minutes(10))).toBe(true);
      }),
    { arbitrary: fcRuns(50) }
  );

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
    pipe(picked, O.isSome, assertTrue);
    expect(O.getOrThrow(picked).name).toBe("b");
  });

  it("returns none when no backend supports the capability", () => {
    const a = stub("a", baseCapabilities, () => Effect.succeed([]));
    assertNone(Composition.selectByCapability([a], "ner"));
  });
});
