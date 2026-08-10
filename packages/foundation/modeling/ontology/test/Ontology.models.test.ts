import {
  GraphInfo,
  HealthResponse,
  HTTPValidationError,
  HttpUrl,
  OWLClass,
  OWLClassList,
  OWLObjectProperty,
  OWLObjectPropertyList,
  OWLSearchResults,
  OWLSearchScore,
} from "@beep/ontology/Ontology.models";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const HttpUrlArbitrary = S.toArbitrary(HttpUrl)(fc);
const GraphInfoArbitrary = S.toArbitrary(GraphInfo)(fc);
const HealthResponseArbitrary = S.toArbitrary(HealthResponse)(fc);
const OWLClassArbitrary = S.toArbitrary(OWLClass)(fc);
const OWLObjectPropertyArbitrary = S.toArbitrary(OWLObjectProperty)(fc);
const OWLClassListArbitrary = S.toArbitrary(OWLClassList)(fc);
const OWLObjectPropertyListArbitrary = S.toArbitrary(OWLObjectPropertyList)(fc);
const OWLSearchScoreArbitrary = S.toArbitrary(OWLSearchScore)(fc);
const OWLSearchResultsArbitrary = S.toArbitrary(OWLSearchResults)(fc);
const HTTPValidationErrorArbitrary = S.toArbitrary(HTTPValidationError)(fc);

const encode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  const decoded = decode(schema, encode(schema, value));

  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const expectWireRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): void => {
  expect(encode(schema, decode(schema, value))).toEqual(value);
};

const graphInfoGithubWire: S.Codec.Encoded<typeof GraphInfo> = {
  num_classes: 1025,
  num_properties: 175,
  title: "FOLIO Ontology",
  description: "Federated Open Legal Information Ontology",
  source_type: "github",
  github_repo_owner: "alea-institute",
  github_repo_name: "folio",
  github_repo_branch: "2.0.0",
};

const graphInfoHttpWire: S.Codec.Encoded<typeof GraphInfo> = {
  num_classes: 1025,
  num_properties: 175,
  title: "FOLIO Ontology",
  description: "Federated Open Legal Information Ontology",
  source_type: "http",
  http_url: "https://example.com/ontology.owl",
};

const owlClassWire: S.Codec.Encoded<typeof OWLClass> = {
  iri: "R8pNPutX0TN6DlEqkyZuxSw",
  label: "Lessor",
  sub_class_of: ["oS5FqyVBbOYQbhqb0G28oZR"],
  parent_class_of: ["Rparent"],
  see_also: ["RseeAlso"],
  deprecated: false,
  definition: "A party that grants a right to use something in return for payment.",
};

const owlObjectPropertyWire: S.Codec.Encoded<typeof OWLObjectProperty> = {
  iri: "R6qohvM786wjw0MNQJg9Dq",
  label: "drafted",
  sub_property_of: ["RparentProperty"],
  domain: ["Rdomain"],
  range: ["Rrange"],
  definition: "A relationship indicating that something was drafted.",
};

const owlSearchResultsWire: S.Codec.Encoded<typeof OWLSearchResults> = {
  results: [[owlClassWire, 0.95]],
};

const httpValidationErrorWire: S.Codec.Encoded<typeof HTTPValidationError> = {
  detail: [
    {
      loc: ["body", 0, "iri"],
      msg: "Field required",
      type: "missing",
      input: { iri: "" },
      ctx: { reason: "empty" },
    },
  ],
};

describe("@beep/ontology models", () => {
  it("preserves representative OpenAPI encoded wire shapes", () => {
    expectWireRoundTrip(GraphInfo, graphInfoGithubWire);
    expectWireRoundTrip(GraphInfo, graphInfoHttpWire);
    expectWireRoundTrip(OWLClass, owlClassWire);
    expectWireRoundTrip(OWLObjectProperty, owlObjectPropertyWire);
    expectWireRoundTrip(OWLSearchResults, owlSearchResultsWire);
    expectWireRoundTrip(HTTPValidationError, httpValidationErrorWire);
  });

  it("round-trips schema-derived ontology payloads", () =>
    fc.assert(
      fc.property(
        GraphInfoArbitrary,
        HealthResponseArbitrary,
        OWLClassArbitrary,
        OWLObjectPropertyArbitrary,
        OWLClassListArbitrary,
        OWLObjectPropertyListArbitrary,
        OWLSearchResultsArbitrary,
        HTTPValidationErrorArbitrary,
        (
          graphInfo,
          healthResponse,
          owlClass,
          owlObjectProperty,
          owlClassList,
          owlObjectPropertyList,
          searchResults,
          error
        ) => {
          expectRoundTrip(GraphInfo, graphInfo);
          expectRoundTrip(HealthResponse, healthResponse);
          expectRoundTrip(OWLClass, owlClass);
          expectRoundTrip(OWLObjectProperty, owlObjectProperty);
          expectRoundTrip(OWLClassList, owlClassList);
          expectRoundTrip(OWLObjectPropertyList, owlObjectPropertyList);
          expectRoundTrip(OWLSearchResults, searchResults);
          expectRoundTrip(HTTPValidationError, error);
        }
      ),
      fcRuns(25)
    ));

  it("round-trips schema-derived URL and search-score primitives", () =>
    fc.assert(
      fc.property(HttpUrlArbitrary, OWLSearchScoreArbitrary, (url, score) => {
        expectRoundTrip(HttpUrl, url);
        expectRoundTrip(OWLSearchScore, score);
      }),
      fcRuns(50)
    ));

  it("rejects malformed values for the absorbed precision invariants", () => {
    expect(Result.isFailure(S.decodeResult(HttpUrl)("not a url"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(OWLSearchScore)(Number.POSITIVE_INFINITY))).toBe(true);
    expect(Result.isFailure(S.decodeResult(OWLClass)({ iri: "" }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(OWLClass)({ iri: "Rclass", sub_class_of: [""] }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(OWLObjectProperty)({ iri: "", domain: ["Rdomain"] }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(OWLObjectProperty)({ iri: "Rproperty", range: [""] }))).toBe(true);
  });
});
