import { Dataset, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import {
  CanonicalDatasetResult,
  CanonicalizationService,
  CanonicalizeDatasetRequest,
} from "@beep/semantic-web/services/canonicalization";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { afterEach, vi } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const { canonizeMock } = vi.hoisted(() => ({
  canonizeMock: vi.fn(),
}));

vi.mock("rdf-canonize", (importOriginal) =>
  importOriginal<typeof import("rdf-canonize")>().then((actual) => ({
    ...actual,
    canonize: canonizeMock,
  }))
);

const decodeUnknownSync = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownSync(schema);

const expectEncodedRoundTrip = <Schema extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
): void => {
  const encoded = Effect.runSync(S.encodeEffect(schema)(value));
  const decoded = Effect.runSync(S.decodeUnknownEffect(schema)(encoded));
  const reencoded = Effect.runSync(S.encodeEffect(schema)(decoded));

  expect(reencoded).toEqual(encoded);
};

const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/name"),
    makeLiteral("Alice", XSD_STRING.value)
  ),
  makeQuad(makeNamedNode("https://example.com/people/alice"), makeNamedNode("https://schema.org/knows"), {
    object: makeNamedNode("https://example.com/people/bob"),
  }),
]);

const runCanonicalization = <A, E>(effect: Effect.Effect<A, E, CanonicalizationService>) =>
  Effect.runPromise(effect.pipe(provideScopedLayer(CanonicalizationServiceLive), Effect.orDie));

const expectSemanticBudgetFailure = (error: Error) => {
  canonizeMock.mockRejectedValueOnce(error);

  return expect(
    runCanonicalization(
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        return yield* service.canonicalize(
          decodeUnknownSync(CanonicalizeDatasetRequest)({
            algorithm: "rdfc-1.0",
            dataset: yield* S.encodeEffect(Dataset)(dataset),
          })
        );
      })
    )
  ).rejects.toMatchObject({
    message: expect.stringContaining("configured resource budget"),
    reason: "workLimitExceeded",
  });
};

afterEach(() => {
  canonizeMock.mockReset();
});

describe("Canonicalization security hardening", () => {
  it("passes explicit resource controls to rdf-canonize for semantic canonicalization", () =>
    Effect.gen(function* () {
      const actual = yield* Effect.promise(() =>
        Promise.resolve(vi.importActual<typeof import("rdf-canonize")>("rdf-canonize"))
      );
      canonizeMock.mockImplementation(actual.canonize);

      yield* Effect.promise(() =>
        Promise.resolve(
          runCanonicalization(
            Effect.gen(function* () {
              const service = yield* CanonicalizationService;
              return yield* service.canonicalize(
                decodeUnknownSync(CanonicalizeDatasetRequest)({
                  algorithm: "rdfc-1.0",
                  dataset: yield* S.encodeEffect(Dataset)(dataset),
                })
              );
            })
          )
        )
      );

      expect(canonizeMock).toHaveBeenCalledTimes(1);
      const call = canonizeMock.mock.calls[0];
      expect(call).toBeDefined();

      if (call === undefined) {
        return;
      }

      const [, options] = call;
      expect(options.algorithm).toBe("RDFC-1.0");
      expect(options.format).toBe("application/n-quads");
      expect(options.maxWorkFactor).toBe(1);
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }));

  it("maps semantic resource-budget failures to work-limit errors", () =>
    Effect.promise(() =>
      Promise.resolve(expectSemanticBudgetFailure(new Error("Maximum deep iterations exceeded (8).")))
    ));

  it("maps abort-signal budget failures to work-limit errors", () =>
    Effect.promise(() => Promise.resolve(expectSemanticBudgetFailure(new Error("Abort signal received")))));

  it("maps timeout-style budget failures to work-limit errors", () =>
    Effect.gen(function* () {
      const timeoutError = new Error("signal timed out");
      timeoutError.name = "TimeoutError";

      yield* Effect.promise(() => Promise.resolve(expectSemanticBudgetFailure(timeoutError)));
    }));

  it("canonicalizes lexical requests without changing result encoded shape", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        runCanonicalization(
          Effect.gen(function* () {
            const service = yield* CanonicalizationService;
            return yield* service.canonicalize(
              decodeUnknownSync(CanonicalizeDatasetRequest)({
                algorithm: "lexical-sort-v1",
                dataset: yield* S.encodeEffect(Dataset)(dataset),
              })
            );
          })
        )
      );

      expectEncodedRoundTrip(CanonicalDatasetResult, result);
      expect(result.canonicalText).toContain("<https://example.com/people/alice>");
    }));

  it("round-trips schema-derived canonical dataset results through encoded form", {
    timeout: 30000,
  }, () => {
    const arbitrary = S.toArbitrary(CanonicalDatasetResult).map((result) =>
      CanonicalDatasetResult.make({
        ...result,
        dataset: makeDataset(result.dataset.quads.slice(0, 3)),
      })
    );

    fc.assert(
      fc.property(arbitrary, (result) => {
        expectEncodedRoundTrip(CanonicalDatasetResult, result);
      }),
      { numRuns: 5 }
    );
  });

  it("derives canonicalization requests from the source schema and proves an encode/decode round-trip", {
    timeout: 30000,
  }, () => {
    const encode = S.encodeSync(CanonicalizeDatasetRequest);
    const decode = S.decodeSync(CanonicalizeDatasetRequest);

    // Bound the generated RDF dataset to a small collection so deriving + encoding/decoding
    // stays fast and reliable. The round-trip law holds regardless of dataset size.
    const arbitrary = S.toArbitrary(CanonicalizeDatasetRequest).map((request) =>
      CanonicalizeDatasetRequest.make({
        ...request,
        dataset: makeDataset(request.dataset.quads.slice(0, 3)),
      })
    );

    fc.assert(
      fc.property(arbitrary, (request) => {
        const encoded = encode(request);

        expect(encode(decode(encoded))).toEqual(encoded);
      }),
      { numRuns: 5 }
    );
  });
});
