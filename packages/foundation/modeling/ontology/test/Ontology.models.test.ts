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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeHttpUrlResult = S.decodeResult(HttpUrl);
const decodeOWLClassResult = S.decodeResult(OWLClass);
const decodeOWLObjectPropertyResult = S.decodeResult(OWLObjectProperty);
const decodeOWLSearchScoreResult = S.decodeResult(OWLSearchScore);
const isHttpUrl = S.is(HttpUrl);

const HttpUrlArbitrary = Arbitrary.schema(HttpUrl);
const GraphInfoArbitrary = Arbitrary.schema(GraphInfo);
const HealthResponseArbitrary = Arbitrary.schema(HealthResponse);
const OWLClassArbitrary = Arbitrary.schema(OWLClass);
const OWLObjectPropertyArbitrary = Arbitrary.schema(OWLObjectProperty);
const OWLClassListArbitrary = Arbitrary.schema(OWLClassList);
const OWLObjectPropertyListArbitrary = Arbitrary.schema(OWLObjectPropertyList);
const OWLSearchScoreArbitrary = Arbitrary.schema(OWLSearchScore);
const OWLSearchResultsArbitrary = Arbitrary.schema(OWLSearchResults);
const HTTPValidationErrorArbitrary = Arbitrary.schema(HTTPValidationError);

const encode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  const decoded = decode(schema, encode(schema, value));

  pipe(S.toEquivalence(schema)(decoded, value), assertTrue);
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
  it.effect("owns constructive HTTP URL metadata and codec statics", () =>
    Effect.gen(function* () {
      pipe(
        (yield* Arbitrary.sampleEffect(Arbitrary.schema(HttpUrl), { count: 20, seed: 0x5eed })).every(isHttpUrl),
        assertTrue
      );
      expect(Result.getOrThrow(S.decodeResult(HttpUrl)("https://example.com/ontology.owl"))).toBe(
        "https://example.com/ontology.owl"
      );
    })
  );

  it("accepts only HTTP and HTTPS URL schemes", () => {
    pipe(isHttpUrl("http://example.com/ontology.owl"), assertTrue);
    pipe(isHttpUrl("https://example.com/ontology.owl"), assertTrue);
    pipe(isHttpUrl("ftp://example.com/ontology.owl"), assertFalse);
  });

  it("preserves representative OpenAPI encoded wire shapes", () => {
    expectWireRoundTrip(GraphInfo, graphInfoGithubWire);
    expectWireRoundTrip(GraphInfo, graphInfoHttpWire);
    expectWireRoundTrip(OWLClass, owlClassWire);
    expectWireRoundTrip(OWLObjectProperty, owlObjectPropertyWire);
    expectWireRoundTrip(OWLSearchResults, owlSearchResultsWire);
    expectWireRoundTrip(HTTPValidationError, httpValidationErrorWire);
  });

  it.prop(
    "round-trips schema-derived ontology payloads",
    [
      GraphInfoArbitrary,
      HealthResponseArbitrary,
      OWLClassArbitrary,
      OWLObjectPropertyArbitrary,
      OWLClassListArbitrary,
      OWLObjectPropertyListArbitrary,
      OWLSearchResultsArbitrary,
      HTTPValidationErrorArbitrary,
    ],
    ([
      graphInfo,
      healthResponse,
      owlClass,
      owlObjectProperty,
      owlClassList,
      owlObjectPropertyList,
      searchResults,
      error,
    ]) => {
      expectRoundTrip(GraphInfo, graphInfo);
      expectRoundTrip(HealthResponse, healthResponse);
      expectRoundTrip(OWLClass, owlClass);
      expectRoundTrip(OWLObjectProperty, owlObjectProperty);
      expectRoundTrip(OWLClassList, owlClassList);
      expectRoundTrip(OWLObjectPropertyList, owlObjectPropertyList);
      expectRoundTrip(OWLSearchResults, searchResults);
      expectRoundTrip(HTTPValidationError, error);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips schema-derived URL and search-score primitives",
    [HttpUrlArbitrary, OWLSearchScoreArbitrary],
    ([url, score]) => {
      expectRoundTrip(HttpUrl, url);
      expectRoundTrip(OWLSearchScore, score);
    },
    { arbitrary: fcRuns(50) }
  );

  it("rejects malformed values for the absorbed precision invariants", () => {
    pipe(decodeHttpUrlResult("not a url"), Result.isFailure, assertTrue);
    pipe(decodeOWLSearchScoreResult(Number.POSITIVE_INFINITY), Result.isFailure, assertTrue);
    pipe(decodeOWLClassResult({ iri: "" }), Result.isFailure, assertTrue);
    pipe(decodeOWLClassResult({ iri: "Rclass", sub_class_of: [""] }), Result.isFailure, assertTrue);
    pipe(decodeOWLObjectPropertyResult({ iri: "", domain: ["Rdomain"] }), Result.isFailure, assertTrue);
    pipe(decodeOWLObjectPropertyResult({ iri: "Rproperty", range: [""] }), Result.isFailure, assertTrue);
  });
});
