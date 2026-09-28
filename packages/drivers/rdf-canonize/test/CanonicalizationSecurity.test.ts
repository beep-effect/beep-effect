import { Dataset, makeDataset, makeLiteral, makeNamedNode, makeQuad, Quad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import {
  CanonicalDatasetResult,
  CanonicalizationService,
  CanonicalizeDatasetRequest,
} from "@beep/semantic-web/services/canonicalization";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { afterEach, describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import { vi } from "vitest";

const decodeCanonicalizeDatasetRequest = S.decodeEffect(CanonicalizeDatasetRequest);
const encodeCanonicalizeDatasetRequest = S.encodeEffect(CanonicalizeDatasetRequest);
const encodeDataset = S.encodeEffect(Dataset);

const { canonizeMock } = vi.hoisted(() => ({
  canonizeMock: vi.fn(),
}));

vi.mock("rdf-canonize", (importOriginal) =>
  importOriginal<typeof import("rdf-canonize")>().then((actual) => ({
    ...actual,
    canonize: canonizeMock,
  }))
);

const expectEncodedRoundTrip = Effect.fnUntraced(function* <
  Schema extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>,
>(schema: Schema, value: Schema["Type"]) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  const reencoded = yield* S.encodeEffect(schema)(decoded);
  expect(reencoded).toEqual(encoded);
});

const BoundedDataset = S.Struct({ quads: S.Array(Quad).check(S.isMaxLength(3)) });
const CanonicalDatasetResultArbitrary = Arbitrary.schema(
  S.Struct({ ...CanonicalDatasetResult.fields, dataset: BoundedDataset })
).pipe(Arbitrary.map((result) => CanonicalDatasetResult.make({ ...result, dataset: Dataset.make(result.dataset) })));
const CanonicalizeDatasetRequestArbitrary = Arbitrary.schema(
  S.Struct({ ...CanonicalizeDatasetRequest.fields, dataset: BoundedDataset })
).pipe(
  Arbitrary.map((request) => CanonicalizeDatasetRequest.make({ ...request, dataset: Dataset.make(request.dataset) }))
);

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

const expectSemanticBudgetFailure = Effect.fnUntraced(function* (error: Error) {
  canonizeMock.mockRejectedValueOnce(error);
  const service = yield* CanonicalizationService;
  const request = yield* decodeCanonicalizeDatasetRequest({
    algorithm: "rdfc-1.0",
    dataset: yield* encodeDataset(dataset),
  });
  const failure = yield* service.canonicalize(request).pipe(Effect.flip);
  expect(failure).toMatchObject({
    message: expect.stringContaining("configured resource budget"),
    reason: "workLimitExceeded",
  });
});

afterEach(() => {
  canonizeMock.mockReset();
});

// `vitest.shared.ts` sets `sequence.concurrent`, and every case here drives the
// same module-level `canonizeMock`: they queue `mockRejectedValueOnce`, assert
// call counts, and share one `afterEach` reset. Run concurrently they would
// consume each other's queued rejections and assert against foreign call
// history. That was latent while these cases returned an Effect nobody ran.
describe("Canonicalization security hardening", { concurrent: false }, () => {
  it.layer(CanonicalizationServiceLive, { timeout: "30 seconds" })((it) => {
    it.effect("passes explicit resource controls to rdf-canonize for semantic canonicalization", () =>
      Effect.gen(function* () {
        const actual = yield* Effect.promise(() =>
          Promise.resolve(vi.importActual<typeof import("rdf-canonize")>("rdf-canonize"))
        );
        canonizeMock.mockImplementation(actual.canonize);
        const service = yield* CanonicalizationService;
        yield* service.canonicalize(
          yield* decodeCanonicalizeDatasetRequest({
            algorithm: "rdfc-1.0",
            dataset: yield* encodeDataset(dataset),
          })
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
      })
    );
    it.effect("maps semantic resource-budget failures to work-limit errors", () =>
      expectSemanticBudgetFailure(new Error("Maximum deep iterations exceeded (8)."))
    );
    it.effect("maps abort-signal budget failures to work-limit errors", () =>
      expectSemanticBudgetFailure(new Error("Abort signal received"))
    );
    it.effect("maps timeout-style budget failures to work-limit errors", () =>
      Effect.gen(function* () {
        const timeoutError = new Error("signal timed out");
        timeoutError.name = "TimeoutError";
        yield* expectSemanticBudgetFailure(timeoutError);
      })
    );
    it.effect("canonicalizes lexical requests without changing result encoded shape", () =>
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        const result = yield* service.canonicalize(
          yield* decodeCanonicalizeDatasetRequest({
            algorithm: "lexical-sort-v1",
            dataset: yield* encodeDataset(dataset),
          })
        );
        yield* expectEncodedRoundTrip(CanonicalDatasetResult, result);
        expect(result.canonicalText).toContain("<https://example.com/people/alice>");
      })
    );
    it.effect.prop(
      "round-trips schema-derived canonical dataset results through encoded form",
      [CanonicalDatasetResultArbitrary],
      ([result]) => expectEncodedRoundTrip(CanonicalDatasetResult, result),
      { arbitrary: fcRuns(5), timeout: 30000 }
    );
    it.effect.prop(
      "derives canonicalization requests from the source schema and proves an encode/decode round-trip",
      [CanonicalizeDatasetRequestArbitrary],
      ([request]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeCanonicalizeDatasetRequest(request);
          const decoded = yield* decodeCanonicalizeDatasetRequest(encoded);
          expect(yield* encodeCanonicalizeDatasetRequest(decoded)).toEqual(encoded);
        }),
      { arbitrary: fcRuns(5), timeout: 30000 }
    );
  });
});
