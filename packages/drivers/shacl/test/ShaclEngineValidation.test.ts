import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_INTEGER, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";

const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_NODE = makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_MIN_COUNT = makeNamedNode(`${SHACL_NAMESPACE}minCount`);
const SH_HAS_VALUE = makeNamedNode(`${SHACL_NAMESPACE}hasValue`);
const SH_DATATYPE = makeNamedNode(`${SHACL_NAMESPACE}datatype`);

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

const label = makeNamedNode("https://example.test/label");
const labelShape = makeNamedNode("urn:shape:string-label");
const labelProperty = makeBlankNode("shape-string-label-property");

// One xsd:string-typed label on `material`, checked against sh:datatype xsd:string.
const labelRequest = (text: string): ShaclValidationRequest =>
  ShaclValidationRequest.make({
    dataset: makeDataset([makeQuad(material, label, makeLiteral(text, XSD_STRING.value))]),
    shapes: [],
    shapesDataset: O.some(
      makeDataset([
        makeQuad(labelShape, RDF_TYPE, SH_NODE_SHAPE),
        makeQuad(labelShape, SH_TARGET_NODE, material),
        makeQuad(labelShape, SH_PROPERTY, labelProperty),
        makeQuad(labelProperty, SH_PATH, label),
        makeQuad(labelProperty, SH_DATATYPE, XSD_STRING),
      ])
    ),
    maxResults: O.none(),
  });

const runValidation = Effect.fn("ShaclEngineValidation.runValidation")(function* (request: ShaclValidationRequest) {
  const service = yield* ShaclValidationService;
  return yield* service.validate(request);
});

it.layer(ShaclValidationServiceLive, { timeout: "30 seconds" })("@beep/shacl real shacl-engine validation", (it) => {
  it.effect(
    "reports focusNode and path for hasValue plus minCount violations",
    Effect.fnUntraced(function* () {
      const result = yield* runValidation(validationRequest());

      pipe(result.conforms, assertFalse);
      expect(result.violations.length).toBeGreaterThan(0);
      pipe(result.truncated, assertFalse);

      const violation = result.violations[0];
      expect(violation?.focusNode).toBe(material.value);
      expect(violation?.path.value).toBe(RDF_TYPE.value);
    })
  );

  it.effect(
    "returns zero violations for a conforming data graph",
    Effect.fnUntraced(function* () {
      const result = yield* runValidation(validationRequest(makeDataset([makeQuad(material, RDF_TYPE, OWL_CLASS)])));

      pipe(result.conforms, assertTrue);
      expect(result.violations).toHaveLength(0);
      pipe(result.truncated, assertFalse);
    })
  );

  it.effect.each(["plain text", "lobster \u{1F99E} emoji", "a \u{1D712} 2-test"])(
    "accepts astral-plane characters as xsd:string (%s)",
    Effect.fnUntraced(function* (text) {
      const result = yield* runValidation(labelRequest(text));

      pipe(result.conforms, assertTrue);
    })
  );

  it.effect(
    "rejects a lone surrogate as xsd:string",
    Effect.fnUntraced(function* () {
      const result = yield* runValidation(labelRequest("broken \uD83E pair"));

      pipe(result.conforms, assertFalse);
    })
  );
});
