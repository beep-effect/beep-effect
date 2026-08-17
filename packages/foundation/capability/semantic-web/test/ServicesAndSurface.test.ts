import { WebAnnotation } from "@beep/rdf/Adapters/WebAnnotation";
import { Dataset, makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
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
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { FastCheck as fc } from "effect/testing";

const decodeUnknownSync = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownSync(schema);

const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/name"),
    makeLiteral("Alice", XSD_STRING.value)
  ),
  makeQuad(makeNamedNode("https://example.com/people/alice"), RDF_TYPE, makeNamedNode("https://schema.org/Person")),
]);

const boundDataset = (value: Dataset): Dataset => Dataset.make({ quads: pipe(value.quads, A.take(3)) });

const DatasetArbitrary = S.toArbitrary(Dataset)(fc).map(boundDataset);
const CanonicalizeDatasetRequestArbitrary = S.toArbitrary(CanonicalizeDatasetRequest)(fc).map((request) =>
  CanonicalizeDatasetRequest.make({
    algorithm: request.algorithm,
    dataset: boundDataset(request.dataset),
    workLimit: request.workLimit,
  })
);
const FingerprintDatasetRequestArbitrary = S.toArbitrary(FingerprintDatasetRequest)(fc).map((request) =>
  FingerprintDatasetRequest.make({
    algorithm: request.algorithm,
    dataset: boundDataset(request.dataset),
    workLimit: request.workLimit,
  })
);

const ServiceTestLayer = Layer.merge(CanonicalizationServiceLive, UnsupportedSparqlQueryServiceLive);

describe("Services and Surface", () => {
  it("publishes a canonical arbitrary for SHACL severity", () => {
    expect(SchemaAST.resolve(ShaclSeverity.ast)?.toArbitrary).toBeDefined();
    expect(fc.sample(S.toArbitrary(ShaclSeverity)(fc), { numRuns: 20, seed: 0x5eed }).every(S.is(ShaclSeverity))).toBe(
      true
    );
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
      fc.assert(
        fc.property(
          DatasetArbitrary,
          CanonicalizeDatasetRequestArbitrary,
          FingerprintDatasetRequestArbitrary,
          (generatedDataset, canonicalizeRequest, fingerprintRequest) => {
            const encodedDataset = Effect.runSync(S.encodeEffect(Dataset)(generatedDataset));
            const decodedDataset = Effect.runSync(S.decodeEffect(Dataset)(encodedDataset));
            const reencodedDataset = Effect.runSync(S.encodeEffect(Dataset)(decodedDataset));

            const encodedCanonicalizeRequest = Effect.runSync(
              S.encodeEffect(CanonicalizeDatasetRequest)(canonicalizeRequest)
            );
            const decodedCanonicalizeRequest = Effect.runSync(
              S.decodeEffect(CanonicalizeDatasetRequest)(encodedCanonicalizeRequest)
            );
            const reencodedCanonicalizeRequest = Effect.runSync(
              S.encodeEffect(CanonicalizeDatasetRequest)(decodedCanonicalizeRequest)
            );

            const encodedFingerprintRequest = Effect.runSync(
              S.encodeEffect(FingerprintDatasetRequest)(fingerprintRequest)
            );
            const decodedFingerprintRequest = Effect.runSync(
              S.decodeEffect(FingerprintDatasetRequest)(encodedFingerprintRequest)
            );
            const reencodedFingerprintRequest = Effect.runSync(
              S.encodeEffect(FingerprintDatasetRequest)(decodedFingerprintRequest)
            );

            expect(reencodedDataset).toEqual(encodedDataset);
            expect(reencodedCanonicalizeRequest).toEqual(encodedCanonicalizeRequest);
            expect(reencodedFingerprintRequest).toEqual(encodedFingerprintRequest);
          }
        ),
        fcRuns(5)
      )
  );

  it("keeps optional service control fields absent in encoded wire shapes when omitted", () => {
    const emptyDataset = decodeUnknownSync(Dataset)({ quads: [] });
    const namedNode = makeNamedNode("https://schema.org/name");

    const encodedCanonicalizeRequest = S.encodeSync(CanonicalizeDatasetRequest)(
      CanonicalizeDatasetRequest.make({
        algorithm: "rdfc-1.0",
        dataset: emptyDataset,
      })
    );
    const encodedFingerprintRequest = S.encodeSync(FingerprintDatasetRequest)(
      FingerprintDatasetRequest.make({
        algorithm: "rdfc-1.0",
        dataset: emptyDataset,
      })
    );
    const encodedPropertyShape = S.encodeSync(ShaclPropertyShape)(
      ShaclPropertyShape.make({
        path: namedNode,
      })
    );
    const encodedNodeShape = S.encodeSync(ShaclNodeShape)(
      ShaclNodeShape.make({
        properties: [],
      })
    );
    const encodedValidationRequest = S.encodeSync(ShaclValidationRequest)(
      ShaclValidationRequest.make({
        dataset: emptyDataset,
        shapes: [],
      })
    );
    const encodedSparqlRequest = S.encodeSync(SparqlQueryRequest)(
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
  });

  it.layer(ServiceTestLayer)("with canonical service layers", (it) => {
    it.effect(
      "canonicalizes and fingerprints datasets deterministically",
      Effect.fnUntraced(function* () {
        const service = yield* CanonicalizationService;
        const encodedDataset = yield* S.encodeEffect(Dataset)(dataset);
        const canonicalized = yield* service.canonicalize(
          decodeUnknownSync(CanonicalizeDatasetRequest)({
            algorithm: "rdfc-1.0",
            dataset: encodedDataset,
          })
        );

        expect(pipe(canonicalized.canonicalText, Str.split("\n"))).toHaveLength(2);

        const fingerprint = yield* service.fingerprint(
          decodeUnknownSync(FingerprintDatasetRequest)({
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
          [S.encodeEffect(Dataset)(left), S.encodeEffect(Dataset)(right)],
          { concurrency: "unbounded" }
        );
        const [leftFingerprint, rightFingerprint] = yield* Effect.all(
          [
            service.fingerprint(
              decodeUnknownSync(FingerprintDatasetRequest)({
                algorithm: "rdfc-1.0",
                dataset: leftRequest,
              })
            ),
            service.fingerprint(
              decodeUnknownSync(FingerprintDatasetRequest)({
                algorithm: "rdfc-1.0",
                dataset: rightRequest,
              })
            ),
          ],
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
            decodeUnknownSync(SparqlQueryRequest)({
              dataset: yield* S.encodeEffect(Dataset)(dataset),
              profile: "select",
              query: "SELECT * WHERE { ?s ?p ?o }",
            })
          )
          .pipe(Effect.flip);

        expect(error.message).toBe("No SPARQL engine is wired into the v1 semantic-web package.");

        const annotation = decodeUnknownSync(WebAnnotation)({
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
