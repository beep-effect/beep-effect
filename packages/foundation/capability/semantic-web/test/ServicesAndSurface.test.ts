import { WebAnnotation } from "@beep/rdf/Adapters/WebAnnotation";
import { Dataset, makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad, Quad } from "@beep/rdf/Rdf";
import { getSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import * as SemanticWeb from "@beep/semantic-web";
import * as CanonicalizationServiceModule from "@beep/semantic-web/services/canonicalization";
import {
  CanonicalizationService,
  CanonicalizeDatasetRequest,
  FingerprintDatasetRequest,
} from "@beep/semantic-web/services/canonicalization";
import * as ShaclValidationServiceModule from "@beep/semantic-web/services/shacl-validation";
import {
  ShaclNodeShape,
  ShaclPropertyShape,
  ShaclSeverity,
  ShaclValidationRequest,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import {
  SparqlQueryRequest,
  SparqlQueryService,
  UnsupportedSparqlQueryServiceLive,
} from "@beep/semantic-web/services/sparql-query";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeCanonicalizeDatasetRequest = S.decodeEffect(CanonicalizeDatasetRequest);
const decodeDataset = S.decodeEffect(Dataset);
const decodeFingerprintDatasetRequest = S.decodeEffect(FingerprintDatasetRequest);
const decodeSparqlQueryRequest = S.decodeEffect(SparqlQueryRequest);
const decodeWebAnnotation = S.decodeEffect(WebAnnotation);
const decodeCanonicalizeDatasetRequestResult = S.decodeResult(CanonicalizeDatasetRequest);
const decodeDatasetResult = S.decodeResult(Dataset);
const decodeFingerprintDatasetRequestResult = S.decodeResult(FingerprintDatasetRequest);
const encodeCanonicalizeDatasetRequest = S.encodeEffect(CanonicalizeDatasetRequest);
const encodeDataset = S.encodeEffect(Dataset);
const encodeFingerprintDatasetRequest = S.encodeEffect(FingerprintDatasetRequest);
const encodeShaclNodeShape = S.encodeEffect(ShaclNodeShape);
const encodeShaclPropertyShape = S.encodeEffect(ShaclPropertyShape);
const encodeShaclValidationRequest = S.encodeEffect(ShaclValidationRequest);
const encodeSparqlQueryRequest = S.encodeEffect(SparqlQueryRequest);
const encodeCanonicalizeDatasetRequestResult = S.encodeResult(CanonicalizeDatasetRequest);
const encodeDatasetResult = S.encodeResult(Dataset);
const encodeFingerprintDatasetRequestResult = S.encodeResult(FingerprintDatasetRequest);
const isShaclSeverity = S.is(ShaclSeverity);

const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/name"),
    makeLiteral("Alice", XSD_STRING.value)
  ),
  makeQuad(makeNamedNode("https://example.com/people/alice"), RDF_TYPE, makeNamedNode("https://schema.org/Person")),
]);

const BoundedDataset = S.Struct({ quads: S.Array(Quad).check(S.isMaxLength(3)) });
const DatasetArbitrary = Arbitrary.schema(BoundedDataset).pipe(Arbitrary.map(Dataset.make));
const CanonicalizeDatasetRequestArbitrary = Arbitrary.schema(
  S.Struct({ ...CanonicalizeDatasetRequest.fields, dataset: BoundedDataset })
).pipe(
  Arbitrary.map((request) => CanonicalizeDatasetRequest.make({ ...request, dataset: Dataset.make(request.dataset) }))
);
const FingerprintDatasetRequestArbitrary = Arbitrary.schema(
  S.Struct({ ...FingerprintDatasetRequest.fields, dataset: BoundedDataset })
).pipe(
  Arbitrary.map((request) => FingerprintDatasetRequest.make({ ...request, dataset: Dataset.make(request.dataset) }))
);

const ServiceTestLayer = Layer.merge(CanonicalizationServiceLive, UnsupportedSparqlQueryServiceLive);

describe("Services and Surface", () => {
  it("publishes a canonical arbitrary for SHACL severity", () => {
    expect(
      Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(ShaclSeverity), { count: 20, seed: 0x5eed })).every(
        isShaclSeverity
      )
    ).toBe(true);
  });

  it("models validation findings as a severity tagged union", () => {
    const finding = ShaclValidationViolation.cases.warning.make({
      focusNode: "https://example.com/people/alice",
      message: "A name is recommended.",
      path: makeNamedNode("https://schema.org/name"),
    });

    expect(ShaclValidationViolation.guards.warning(finding)).toBe(true);
    expect(ShaclValidationViolation.guards.violation(finding)).toBe(false);
  });

  it("keeps the package root surface curated to the service contracts", () => {
    const surface = pipe(Object.keys(SemanticWeb), A.sort(Order.String));
    expect(surface).toEqual(
      expect.arrayContaining(["CanonicalizationService", "ShaclValidationService", "SparqlQueryService"])
    );
    // Model families live in @beep/rdf; the legacy re-exports must not return.
    expect(surface).not.toEqual(expect.arrayContaining(["IRI"]));
    expect(surface).not.toEqual(expect.arrayContaining(["Dataset"]));
    expect(surface).not.toEqual(expect.arrayContaining(["ProvBundle"]));
  });

  it("audits semantic schema metadata coverage for the service contract families", () => {
    const auditModules = [
      {
        exclude: ["CanonicalizationAlgorithm"],
        exports: CanonicalizationServiceModule,
        name: "services/canonicalization",
      },
      {
        exclude: ["ShaclSeverity"],
        exports: ShaclValidationServiceModule,
        name: "services/shacl-validation",
      },
    ];

    for (const moduleAudit of auditModules) {
      const schemaEntries = pipe(
        Object.entries(moduleAudit.exports),
        A.filter(
          ([name, value]) => /^[A-Z]/.test(name) && S.isSchema(value) && !pipe(moduleAudit.exclude, A.contains(name))
        )
      );

      expect(schemaEntries.length, moduleAudit.name).toBeGreaterThan(0);

      for (const [name, schema] of schemaEntries) {
        const metadata = getSemanticSchemaMetadata(schema);
        expect(O.isSome(metadata), `${moduleAudit.name}.${name}`).toBe(true);
        expect(
          O.map(metadata, (m) => m.canonicalName),
          `${moduleAudit.name}.${name}`
        ).toEqual(O.some(name));
      }
    }
  });

  it(
    "round-trips schema-derived RDF datasets and canonicalization DTOs through boundary encoders",
    {}, // Inherit the deep-sweep timeout from vitest.shared.ts.
    () =>
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(
            Arbitrary.all([DatasetArbitrary, CanonicalizeDatasetRequestArbitrary, FingerprintDatasetRequestArbitrary]),
            ([generatedDataset, canonicalizeRequest, fingerprintRequest]) => {
              const encodedDataset = encodeDatasetResult(generatedDataset);
              const reencodedDataset = pipe(
                encodedDataset,
                Result.flatMap(decodeDatasetResult),
                Result.flatMap(encodeDatasetResult)
              );

              const encodedCanonicalizeRequest = encodeCanonicalizeDatasetRequestResult(canonicalizeRequest);
              const reencodedCanonicalizeRequest = pipe(
                encodedCanonicalizeRequest,
                Result.flatMap(decodeCanonicalizeDatasetRequestResult),
                Result.flatMap(encodeCanonicalizeDatasetRequestResult)
              );

              const encodedFingerprintRequest = encodeFingerprintDatasetRequestResult(fingerprintRequest);
              const reencodedFingerprintRequest = pipe(
                encodedFingerprintRequest,
                Result.flatMap(decodeFingerprintDatasetRequestResult),
                Result.flatMap(encodeFingerprintDatasetRequestResult)
              );

              expect(reencodedDataset).toEqual(encodedDataset);
              expect(reencodedCanonicalizeRequest).toEqual(encodedCanonicalizeRequest);
              expect(reencodedFingerprintRequest).toEqual(encodedFingerprintRequest);

              return true;
            },
            fcRuns(5)
          )
        )
      ).toMatchObject({ _tag: "Passed" })
  );

  it.effect(
    "keeps optional service control fields absent in encoded wire shapes when omitted",
    Effect.fnUntraced(function* () {
      const emptyDataset = yield* decodeDataset({ quads: [] });
      const namedNode = makeNamedNode("https://schema.org/name");

      const encodedCanonicalizeRequest = yield* encodeCanonicalizeDatasetRequest(
        CanonicalizeDatasetRequest.make({
          algorithm: "rdfc-1.0",
          dataset: emptyDataset,
        })
      );
      const encodedFingerprintRequest = yield* encodeFingerprintDatasetRequest(
        FingerprintDatasetRequest.make({
          algorithm: "rdfc-1.0",
          dataset: emptyDataset,
        })
      );
      const encodedPropertyShape = yield* encodeShaclPropertyShape(
        ShaclPropertyShape.make({
          path: namedNode,
        })
      );
      const encodedNodeShape = yield* encodeShaclNodeShape(
        ShaclNodeShape.make({
          properties: [],
        })
      );
      const encodedValidationRequest = yield* encodeShaclValidationRequest(
        ShaclValidationRequest.make({
          dataset: emptyDataset,
          shapes: [],
        })
      );
      const encodedSparqlRequest = yield* encodeSparqlQueryRequest(
        SparqlQueryRequest.make({
          dataset: emptyDataset,
          profile: "ask",
          query: "ASK { ?s ?p ?o }",
        })
      );

      expect(encodedCanonicalizeRequest).not.toHaveProperty("workLimit");
      expect(encodedFingerprintRequest).not.toHaveProperty("workLimit");
      expect(encodedPropertyShape).not.toHaveProperty("minCount");
      expect(encodedPropertyShape).not.toHaveProperty("maxCount");
      expect(encodedPropertyShape).not.toHaveProperty("datatype");
      expect(encodedPropertyShape).not.toHaveProperty("class");
      expect(encodedPropertyShape).not.toHaveProperty("hasValue");
      expect(encodedNodeShape).not.toHaveProperty("id");
      expect(encodedNodeShape).not.toHaveProperty("targetNode");
      expect(encodedNodeShape).not.toHaveProperty("targetClass");
      expect(encodedValidationRequest).not.toHaveProperty("maxResults");
      expect(encodedValidationRequest).not.toHaveProperty("shapesDataset");
      expect(encodedSparqlRequest).not.toHaveProperty("timeoutMs");
    })
  );

  it.layer(ServiceTestLayer)("with canonical service layers", (it) => {
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

    it.effect(
      "exposes the unsupported SPARQL fallback and the web-annotation seam DTOs",
      Effect.fnUntraced(function* () {
        const service = yield* SparqlQueryService;
        const error = yield* service
          .execute(
            yield* decodeSparqlQueryRequest({
              dataset: yield* encodeDataset(dataset),
              profile: "select",
              query: "SELECT * WHERE { ?s ?p ?o }",
            })
          )
          .pipe(Effect.flip);

        expect(error.message).toBe("No SPARQL engine is wired into the v1 semantic-web package.");

        const annotation = yield* decodeWebAnnotation({
          id: "https://example.com/annotations/1",
          target: {
            selector: {
              exact: "Alice",
              type: "TextQuoteSelector",
            },
            source: "https://example.com/documents/1",
          },
          type: "Annotation",
        });

        expect(annotation.type).toBe("Annotation");
        expect(annotation.target.selector.type).toBe("TextQuoteSelector");
      })
    );
  });
});
