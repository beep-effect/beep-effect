import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_INTEGER } from "@beep/rdf/Vocab/Xsd";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";

const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_NODE = makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_MIN_COUNT = makeNamedNode(`${SHACL_NAMESPACE}minCount`);
const SH_HAS_VALUE = makeNamedNode(`${SHACL_NAMESPACE}hasValue`);

const material = makeNamedNode("https://example.test/materials#Material");
const marker = makeNamedNode("https://example.test/marker");
const markerValue = makeNamedNode("https://example.test/marker-value");
const shape = makeNamedNode("urn:shape:material-class");
const property = makeBlankNode("shape-material-class-property");

const shapesDataset = makeDataset([
  makeQuad(shape, RDF_TYPE, SH_NODE_SHAPE),
  makeQuad(shape, SH_TARGET_NODE, material),
  makeQuad(shape, SH_PROPERTY, property),
  makeQuad(property, SH_PATH, RDF_TYPE),
  makeQuad(property, SH_HAS_VALUE, OWL_CLASS),
  makeQuad(property, SH_MIN_COUNT, makeLiteral("1", XSD_INTEGER.value)),
]);

const violatingDataset = makeDataset([makeQuad(material, marker, markerValue)]);

const validationRequest = (dataset = violatingDataset): ShaclValidationRequest =>
  ShaclValidationRequest.make({
    dataset,
    shapes: [],
    shapesDataset: O.some(shapesDataset),
    maxResults: O.none(),
  });

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const runValidation = Effect.fn("ShaclEngineValidation.runValidation")(function* (request: ShaclValidationRequest) {
  const service = yield* ShaclValidationService;
  return yield* service.validate(request);
});

describe("@beep/shacl real shacl-engine validation", () => {
  it.effect(
    "reports focusNode and path for hasValue plus minCount violations",
    Effect.fnUntraced(function* () {
      const result = yield* pipe(runValidation(validationRequest()), provideScopedLayer(ShaclValidationServiceLive));

      expect(result.conforms).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.truncated).toBe(false);

      const violation = result.violations[0];
      expect(violation?.focusNode).toBe(material.value);
      expect(violation?.path.value).toBe(RDF_TYPE.value);
    })
  );

  it.effect(
    "returns zero violations for a conforming data graph",
    Effect.fnUntraced(function* () {
      const result = yield* pipe(
        runValidation(validationRequest(makeDataset([makeQuad(material, RDF_TYPE, OWL_CLASS)]))),
        provideScopedLayer(ShaclValidationServiceLive)
      );

      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.truncated).toBe(false);
    })
  );
});
