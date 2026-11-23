import { CanonicalWorkBound } from "@beep/rdf/Canonical";
import {
  Dataset,
  MakeQuadOptionsInput,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  Quad,
} from "@beep/rdf/Rdf";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import {
  CanonicalDatasetResult,
  CanonicalizationService,
  CanonicalizeDatasetRequest,
  FingerprintDatasetRequest,
} from "@beep/semantic-web/services/canonicalization";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeCanonicalizeDatasetRequest = S.decodeEffect(CanonicalizeDatasetRequest);
const encodeCanonicalizeDatasetRequest = S.encodeEffect(CanonicalizeDatasetRequest);
const encodeDataset = S.encodeEffect(Dataset);

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
).pipe(
  Arbitrary.map((result) => CanonicalDatasetResult.make({ ...result, dataset: makeDataset(result.dataset.quads) }))
);
const CanonicalizeDatasetRequestArbitrary = Arbitrary.schema(
  S.Struct({ ...CanonicalizeDatasetRequest.fields, dataset: BoundedDataset })
).pipe(
  Arbitrary.map((request) =>
    CanonicalizeDatasetRequest.make({ ...request, dataset: makeDataset(request.dataset.quads) })
  )
);

const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/name"),
    makeLiteral("Alice")
  ),
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/knows"),
    MakeQuadOptionsInput.make({
      object: makeNamedNode("https://example.com/people/bob"),
    })
  ),
]);

const cliqueLabels = ["k0", "k1", "k2", "k3", "k4", "k5"];

const clique = makeDataset(
  A.flatMap(cliqueLabels, (from) =>
    A.map(
      A.filter(cliqueLabels, (to) => to !== from),
      (to) => makeQuad(makeBlankNode(from), makeNamedNode("https://example.test/p"), makeBlankNode(to))
    )
  )
);

const refusedAtBound = {
  message: `Semantic canonicalization exceeded its bound of ${CanonicalWorkBound} Hash N-Degree Quads calls.`,
  reason: "workLimitExceeded",
};

describe("Canonicalization security hardening", () => {
  it.layer(CanonicalizationServiceLive, { timeout: "30 seconds" })((it) => {
    it.effect("refuses a blank-node clique past the bound as a work-limit error", () =>
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        const failure = yield* service
          .canonicalize(CanonicalizeDatasetRequest.make({ algorithm: "rdfc-1.0", dataset: clique }))
          .pipe(Effect.flip);
        expect(failure).toMatchObject(refusedAtBound);
      })
    );
    it.effect("refuses to fingerprint a blank-node clique past the bound", () =>
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        const failure = yield* service
          .fingerprint(FingerprintDatasetRequest.make({ algorithm: "rdfc-1.0", dataset: clique }))
          .pipe(Effect.flip);
        expect(failure).toMatchObject(refusedAtBound);
      })
    );
    it.effect("canonicalizes the clique lexically, which has no blank-node work", () =>
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        const result = yield* service.canonicalize(
          CanonicalizeDatasetRequest.make({ algorithm: "lexical-sort-v1", dataset: clique })
        );
        expect(Str.split("\n")(result.canonicalText).length).toBe(30);
      })
    );
    it.effect("canonicalizes lexical requests without changing result encoded shape", () =>
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        const decodedCanonicalizeDatasetRequest1 = yield* decodeCanonicalizeDatasetRequest({
          algorithm: "lexical-sort-v1",
          dataset: yield* encodeDataset(dataset),
        });
        const result = yield* service.canonicalize(decodedCanonicalizeDatasetRequest1);
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
          const encodedCanonicalizeDatasetRequest = yield* encodeCanonicalizeDatasetRequest(decoded);
          expect(encodedCanonicalizeDatasetRequest).toEqual(encoded);
        }),
      { arbitrary: fcRuns(5), timeout: 30000 }
    );
  });
});
