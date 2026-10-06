import { Dataset, makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad, Quad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import {
  CanonicalizationService,
  CanonicalizeDatasetRequest,
  FingerprintDatasetRequest,
} from "@beep/semantic-web/services/canonicalization";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeCanonicalizeDatasetRequest = S.decodeEffect(CanonicalizeDatasetRequest);
const decodeFingerprintDatasetRequest = S.decodeEffect(FingerprintDatasetRequest);
const encodeDataset = S.encodeEffect(Dataset);
const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/name"),
    makeLiteral("Alice", XSD_STRING.value)
  ),
  makeQuad(makeNamedNode("https://example.com/people/alice"), RDF_TYPE, makeNamedNode("https://schema.org/Person")),
]);

// Integration with the concrete adapter belongs in the driver, which depends on
// the semantic-web contracts; declaring the reverse dependency would create a cycle.
it.layer(CanonicalizationServiceLive, { timeout: "10 seconds" })("canonicalization adapter integration", (it) => {
  const boundedDataset = Arbitrary.schema(S.Struct({ quads: S.Array(Quad).check(S.isMaxLength(3)) })).pipe(
    Arbitrary.map(Dataset.make)
  );
  it.prop(
    "keeps fingerprints stable under quad order for schema-derived datasets",
    [boundedDataset],
    ([generated]) =>
      Effect.gen(function* () {
        const service = yield* CanonicalizationService;
        const left = yield* service.fingerprint(
          FingerprintDatasetRequest.make({ algorithm: "rdfc-1.0", dataset: generated })
        );
        const right = yield* service.fingerprint(
          FingerprintDatasetRequest.make({ algorithm: "rdfc-1.0", dataset: makeDataset(A.reverse(generated.quads)) })
        );
        expect(left.fingerprint).toBe(right.fingerprint);
        expect(left.canonicalText).toBe(right.canonicalText);
      }),
    { arbitrary: fcRuns(5) }
  );

  it.effect(
    "canonicalizes and fingerprints datasets deterministically",
    Effect.fnUntraced(function* () {
      const service = yield* CanonicalizationService;
      const encodedDataset = yield* encodeDataset(dataset);
      const canonicalized = yield* service.canonicalize(
        yield* decodeCanonicalizeDatasetRequest({
          algorithm: "rdfc-1.0",
          dataset: encodedDataset,
        })
      );

      expect(pipe(canonicalized.canonicalText, Str.split("\n"))).toHaveLength(2);

      const fingerprint = yield* service.fingerprint(
        yield* decodeFingerprintDatasetRequest({
          algorithm: "rdfc-1.0",
          dataset: encodedDataset,
        })
      );

      expect(fingerprint.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(fingerprint.canonicalText).toBe(canonicalized.canonicalText);
    })
  );

  it.effect(
    "produces the same semantic fingerprint for isomorphic blank-node datasets",
    Effect.fnUntraced(function* () {
      const service = yield* CanonicalizationService;
      const knows = makeNamedNode("https://schema.org/knows");
      const name = makeNamedNode("https://schema.org/name");

      const left = makeDataset([
        makeQuad(makeBlankNode("a"), knows, makeBlankNode("b")),
        makeQuad(makeBlankNode("a"), name, makeLiteral("Alice", XSD_STRING.value)),
        makeQuad(makeBlankNode("b"), name, makeLiteral("Bob", XSD_STRING.value)),
      ]);

      const right = makeDataset([
        makeQuad(makeBlankNode("x"), knows, makeBlankNode("y")),
        makeQuad(makeBlankNode("x"), name, makeLiteral("Alice", XSD_STRING.value)),
        makeQuad(makeBlankNode("y"), name, makeLiteral("Bob", XSD_STRING.value)),
      ]);

      const [leftRequest, rightRequest] = yield* Effect.all(
        [
          encodeDataset(left).pipe(
            Effect.flatMap((encoded) =>
              decodeFingerprintDatasetRequest({
                algorithm: "rdfc-1.0",
                dataset: encoded,
              })
            )
          ),
          encodeDataset(right).pipe(
            Effect.flatMap((encoded) =>
              decodeFingerprintDatasetRequest({
                algorithm: "rdfc-1.0",
                dataset: encoded,
              })
            )
          ),
        ],
        { concurrency: "unbounded" }
      );
      const [leftFingerprint, rightFingerprint] = yield* Effect.all(
        [service.fingerprint(leftRequest), service.fingerprint(rightRequest)],
        { concurrency: "unbounded" }
      );

      expect(leftFingerprint.fingerprint).toBe(rightFingerprint.fingerprint);
      expect(leftFingerprint.canonicalText).toBe(rightFingerprint.canonicalText);
    })
  );
});
