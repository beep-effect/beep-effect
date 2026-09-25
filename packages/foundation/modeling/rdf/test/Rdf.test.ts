import * as RdfRoot from "@beep/rdf";
import {
  evidenceAnchorToWebAnnotation,
  WebAnnotationFromEvidenceAnchor,
  WebAnnotationSelectorFromEvidenceSelector,
  WebAnnotationTargetFromEvidenceTarget,
  webAnnotationToEvidenceAnchor,
} from "@beep/rdf/Adapters/WebAnnotation";
import {
  EvidenceAnchor,
  EvidenceSelector,
  EvidenceTarget,
  FragmentSelector,
  TextPositionSelector,
  TextQuoteSelector,
} from "@beep/rdf/Evidence";
import { AbsoluteIRI, IRI, IRIReference, RelativeIRIReference } from "@beep/rdf/Iri";
import {
  JsonLdBlankNodeIdentifier,
  JsonLdContext,
  JsonLdDocument,
  JsonLdFrame,
  JsonLdKeyword,
  JsonLdLiteralValue,
  JsonLdNodeIdentifier,
  JsonLdNodeObject,
  JsonLdPropertyValue,
  JsonLdReferenceValue,
  JsonLdTermDefinition,
} from "@beep/rdf/JsonLd";
import { ProvBundle } from "@beep/rdf/Prov";
import {
  areDatasetsEquivalent,
  BlankNode,
  Curie,
  DefaultGraph,
  GraphTerm,
  LanguageTag,
  Literal,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  NamedNode,
  NamespaceBinding,
  ObjectTerm,
  PrefixLabel,
  PrefixMap,
  Quad,
  Subject,
  serializeQuad,
  serializeTerm,
  sortDatasetQuads,
  Term,
} from "@beep/rdf/Rdf";
import {
  annotateSemanticSchema,
  getSemanticSchemaMetadata,
  makeSemanticSchemaMetadata,
  SemanticRepresentationKind,
  SemanticSchemaMetadata,
  SemanticSchemaMetadataKind,
  SemanticSchemaSpecification,
  SemanticSchemaSpecificationDisposition,
  SemanticSchemaStatus,
} from "@beep/rdf/SemanticSchemaMetadata";
import {
  AbsoluteURI,
  areUrisEquivalent,
  normalizeUriReference,
  RelativeURIReference,
  resolveUriReference,
  URI,
  URIReference,
} from "@beep/rdf/Uri";
import { OA_ANNOTATION, OA_HAS_SELECTOR, OA_HAS_TARGET, OA_NAMESPACE } from "@beep/rdf/Vocab/Oa";
import { OWL_CLASS, OWL_DATATYPE_PROPERTY, OWL_NAMESPACE, OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl";
import {
  PROV_ACTIVITY,
  PROV_AGENT,
  PROV_ENTITY,
  PROV_NAMESPACE,
  PROV_USED,
  PROV_WAS_GENERATED_BY,
} from "@beep/rdf/Vocab/Prov";
import { RDF_FIRST, RDF_NAMESPACE, RDF_NIL, RDF_REST, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_CLASS, RDFS_COMMENT, RDFS_LABEL, RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import {
  SKOS_ALT_LABEL,
  SKOS_BROAD_MATCH,
  SKOS_BROADER,
  SKOS_CLOSE_MATCH,
  SKOS_CONCEPT,
  SKOS_CONCEPT_SCHEME,
  SKOS_DEFINITION,
  SKOS_EDITORIAL_NOTE,
  SKOS_EXACT_MATCH,
  SKOS_HAS_TOP_CONCEPT,
  SKOS_HIDDEN_LABEL,
  SKOS_HISTORY_NOTE,
  SKOS_IN_SCHEME,
  SKOS_NAMESPACE,
  SKOS_NARROW_MATCH,
  SKOS_NARROWER,
  SKOS_PREF_LABEL,
  SKOS_RELATED,
  SKOS_RELATED_MATCH,
  SKOS_SCOPE_NOTE,
  SKOS_TOP_CONCEPT_OF,
} from "@beep/rdf/Vocab/Skos";
import { XSD_ANY_URI, XSD_BOOLEAN, XSD_DOUBLE, XSD_INTEGER, XSD_NAMESPACE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Equal, Exit, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeBlankNode = S.decodeUnknownEffect(BlankNode);
const decodeCurie = S.decodeUnknownEffect(Curie);
const decodeJsonLdContext = S.decodeUnknownEffect(JsonLdContext);
const decodeJsonLdDocument = S.decodeUnknownEffect(JsonLdDocument);
const decodeJsonLdFrame = S.decodeUnknownEffect(JsonLdFrame);
const decodeJsonLdNodeObject = S.decodeUnknownEffect(JsonLdNodeObject);
const decodeJsonLdReferenceValue = S.decodeUnknownEffect(JsonLdReferenceValue);
const decodeJsonLdTermDefinition = S.decodeUnknownEffect(JsonLdTermDefinition);
const decodeNamespaceBinding = S.decodeUnknownEffect(NamespaceBinding);
const decodeSemanticSchemaMetadata = S.decodeUnknownEffect(SemanticSchemaMetadata);
const decodeUnknownSemanticSchemaMetadata = S.decodeUnknownEffect(SemanticSchemaMetadata);
const encodeEvidenceAnchor = S.encodeEffect(EvidenceAnchor);
const encodeEvidenceSelector = S.encodeEffect(EvidenceSelector);
const encodeEvidenceTarget = S.encodeEffect(EvidenceTarget);
const encodeJsonLdDocument = S.encodeEffect(JsonLdDocument);
const encodeJsonLdFrame = S.encodeEffect(JsonLdFrame);
const encodeLiteral = S.encodeEffect(Literal);
const encodeProvBundle = S.encodeEffect(ProvBundle);
const encodeSemanticSchemaSpecification = S.encodeEffect(SemanticSchemaSpecification);
const encodeTextQuoteSelector = S.encodeEffect(TextQuoteSelector);
const encodeWebAnnotationFromEvidenceAnchor = S.encodeEffect(WebAnnotationFromEvidenceAnchor);
const encodeSemanticSchemaMetadata = S.encodeEffect(SemanticSchemaMetadata);
const isIRI = S.is(IRI);
const isJsonLdKeyword = S.is(JsonLdKeyword);
const isQuad = S.is(Quad);
const isSemanticRepresentationKind = S.is(SemanticRepresentationKind);
const isSemanticSchemaMetadata = S.is(SemanticSchemaMetadata);
const isSemanticSchemaMetadataKind = S.is(SemanticSchemaMetadataKind);
const isSemanticSchemaSpecificationDisposition = S.is(SemanticSchemaSpecificationDisposition);
const isSemanticSchemaStatus = S.is(SemanticSchemaStatus);

const decodeIri = IRI.decodeUnknownSync;
const decodeAbsoluteIri = AbsoluteIRI.decodeUnknownSync;
const decodeIriReference = IRIReference.decodeUnknownSync;
const decodeRelativeIriReference = RelativeIRIReference.decodeUnknownSync;
const decodeJsonLdLiteralValue = S.decodeUnknownEffect(JsonLdLiteralValue);
const decodeUri = URI.decodeUnknownSync;
const decodeAbsoluteUri = AbsoluteURI.decodeUnknownSync;
const decodeUriReference = URIReference.decodeUnknownSync;
const decodeRelativeUriReference = RelativeURIReference.decodeUnknownSync;
const decodePrefixLabel = PrefixLabel.decodeUnknownSync;
const decodePrefixMap = PrefixMap.decodeUnknownSync;
const encodePrefixMap = S.encodeEffect(PrefixMap);

const assertRoundTrips = Effect.fn("assertRoundTrips")(function* <
  Schema extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>,
>(schema: Schema, runs = 25) {
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.all([Arbitrary.schema(schema)]),
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
        expect(Equal.equals(decoded, value)).toBe(true);

        return true;
      }),
    { runs }
  );

  expect(result._tag).toBe("Passed");
});

const assertDecodeEncodeDecodeStable = Effect.fn("assertDecodeEncodeDecodeStable")(function* <
  Schema extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>,
>(schema: Schema, runs = 25) {
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.all([Arbitrary.schema(schema)]),
    ([input]) =>
      Effect.gen(function* () {
        const firstEncoded = yield* S.encodeEffect(schema)(input);
        const decoded = yield* S.decodeUnknownEffect(schema)(firstEncoded);
        const encoded = yield* S.encodeEffect(schema)(decoded);
        const decodedAgain = yield* S.decodeUnknownEffect(schema)(encoded);
        expect(Equal.equals(decodedAgain, decoded)).toBe(true);

        return true;
      }),
    { runs }
  );

  expect(result._tag).toBe("Passed");
});

const canParseWithNativeUrl = (value: string): boolean => {
  try {
    void new URL(value);
    return true;
  } catch {
    return false;
  }
};

const bidiFormattingCharacters = ["\u200E", "\u200F", "\u202A", "\u202B", "\u202C", "\u202D", "\u202E"] as const;

describe("@beep/rdf IRI schemas", () => {
  it("accepts internationalized IRIs across scheme, authority, path, query, and fragment forms", () => {
    const cases = [
      "https://例え.テスト/δοκιμή/𐌀?κλειδί=値#片段",
      "https://example.com/%C3%A9",
      "mailto:用户@example.org",
      "foo:",
      "foo:/",
      "foo://",
      "foo:bar",
      "foo:?q=1",
      "foo:#frag",
    ] as const;

    for (const value of cases) {
      expect(decodeIri(value)).toBe(value);
    }
  });

  it("accepts representative authority permutations", () => {
    const cases = [
      "https://user:pass@例え.テスト:8080/a",
      "https://1.2.3.4/",
      "https://10.20.30.40/",
      "https://100.0.0.1/",
      "https://249.0.0.1/",
      "https://255.255.255.255/",
      "https://1234.0.0.1/",
      "https://[::1]/",
      "https://[2001:db8::1]/",
      "https://[::ffff:192.0.2.128]:443/",
      "https://[::ffff:192.0.2.128]/",
      "https://[vF.FF-._~!$&'()*+,;=:]/",
      "https://999.0.0.1/",
      "scheme://",
      "scheme://@/path",
    ] as const;

    for (const value of cases) {
      expect(decodeIri(value)).toBe(value);
    }
  });

  it("accepts representative ucschar ranges and rejects excluded noncharacters", () => {
    const validCases = [
      "https://example.com/\u00A1",
      "https://example.com/\uF900",
      "https://example.com/𐌀",
      "https://example.com/\u{E1000}",
    ] as const;
    const invalidCases = [
      "https://example.com/\uFDD0",
      "https://example.com/\u{EFFFE}",
      "https://example.com/\uD800",
    ] as const;

    for (const value of validCases) {
      expect(decodeIri(value)).toBe(value);
    }

    for (const value of invalidCases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("accepts iprivate characters in query components only", () => {
    const validCases = ["https://example.com/search?\uE000", "https://example.com/search?\u{F0000}"] as const;
    const invalidCases = [
      "https://\uE000.example.com/",
      "https://example.com/\uE000",
      "https://example.com/#\uE000",
    ] as const;

    for (const value of validCases) {
      expect(decodeIri(value)).toBe(value);
    }

    for (const value of invalidCases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects malformed percent encoding across components", () => {
    const cases = [
      "https://example.com/%",
      "https://example.com/%2",
      "https://example.com/%ZZ",
      "https://exa%mple.com/",
      "https://user%ZZ@example.com/",
      "https:/%ZZ",
      "https://example.com/ok/%ZZ",
      "foo:%ZZ",
      "foo:ok/%ZZ",
      "https://example.com/path?value=%GG",
      "https://example.com/path#frag%",
    ] as const;

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects malformed authorities and illegal delimiters", () => {
    const cases = [
      "https://user@@example.com/",
      "https://example.com:port/",
      "https://example:80:90/",
      "https://[2001:db8::1/",
      "https://[2001:db8::1]:port/",
      "https://[192.168.0.1::1]/",
      "https://[2001:db8:12345::1]/",
      "https://[1:2:3:4:5:6:7:]/",
      "https://[2001::db8::1]/",
      "https://[2001:db8:::1]/",
      "https://[2001:db8::zzzz]/",
      "https://[vFabc]/",
      "https://[v1.]/",
      "https://example.com/has space",
      "https://example.com/<bad>",
      "https://example.com/`bad`",
    ] as const;

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects forbidden bidi formatting characters", () => {
    const cases = pipe(
      bidiFormattingCharacters,
      A.map((character) => `https://example.com/${character}`)
    );

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects leading or trailing whitespace", () => {
    const cases = [" https://example.com", "https://example.com ", "\nhttps://example.com"] as const;

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("IRI values must not contain leading or trailing whitespace");
    }
  });

  it("separates absolute, full, and relative IRI references", () => {
    const relativeCases = [
      "",
      "#片段",
      "?κλειδί=値",
      "../résumé/δοκιμή?x=値#片段",
      "//例え.テスト/path",
      "///path",
      "abc",
      "/absolute/path",
      "/segment/%C3%A9",
      "folder/child:leaf",
      "folder/%F0%90%8C%80",
      ".",
    ] as const;

    expect(decodeAbsoluteIri("https://example.com/δοκιμή?x=1")).toBe("https://example.com/δοκιμή?x=1");
    expect(decodeAbsoluteIri("mailto:用户@example.org")).toBe("mailto:用户@example.org");
    expect(() => decodeAbsoluteIri("https://example.com/δοκιμή#frag")).toThrow(
      "Expected a valid RFC 3987 absolute IRI"
    );
    expect(() => decodeAbsoluteIri("")).toThrow("Absolute IRI values must not be empty");

    for (const value of relativeCases) {
      expect(decodeIriReference(value)).toBe(value);
      expect(decodeRelativeIriReference(value)).toBe(value);
    }

    expect(Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(RelativeIRIReference), { count: 1 }))).toHaveLength(
      1
    );

    expect(decodeIriReference("folder:child/leaf")).toBe("folder:child/leaf");
    expect(decodeRelativeIriReference("folder/child:leaf")).toBe("folder/child:leaf");
    expect(() => decodeRelativeIriReference("folder:child/leaf")).toThrow(
      "Expected a valid RFC 3987 relative IRI reference"
    );
  });

  it("rejects malformed relative references", () => {
    const cases = [
      "foo/%ZZ",
      "/%ZZ",
      "/ok/%ZZ",
      "?%ZZ",
      "#%ZZ",
      "folder?%ZZ",
      "folder#%ZZ",
      "//user@@example.com/path",
      "//[2001::db8::1]/",
      "//[vFabc]/path",
      "//example.com:port/path",
      "\u202Erelative/path",
    ] as const;

    for (const value of cases) {
      expect(() => decodeRelativeIriReference(value)).toThrow("Expected a valid RFC 3987 relative IRI reference");
    }
  });

  it("keeps native URL parsing separate from RFC 3987 validation", () => {
    const nativeUrlFriendlyButSpecInvalid = "https://example.com/\uE000";

    expect(isIRI(nativeUrlFriendlyButSpecInvalid)).toBe(false);
    expect(canParseWithNativeUrl(nativeUrlFriendlyButSpecInvalid)).toBe(true);
  });
});

describe("@beep/rdf URI schemas and helpers", () => {
  it("publishes a canonical arbitrary for URI values", () => {
    expect(
      Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(URI), { count: 20, seed: 0x5eed })).every(URI.is)
    ).toBe(true);
  });

  it("accepts representative absolute and relative URI forms", () => {
    expect(decodeUri("https://example.com/path?q=1#frag")).toBe("https://example.com/path?q=1#frag");
    expect(decodeAbsoluteUri("mailto:user@example.com")).toBe("mailto:user@example.com");
    expect(decodeUriReference("../child?q=1")).toBe("../child?q=1");
    expect(decodeRelativeUriReference("../child?q=1")).toBe("../child?q=1");
    expect(decodeUriReference("")).toBe("");
    expect(decodeRelativeUriReference("")).toBe("");
  });

  it("normalizes scheme, host, default ports, mailto, relative references, and unreserved percent encoding", () => {
    expect(normalizeUriReference("HTTPS://Example.com:443/%7Ealice?q=%41#%7e")).toBe(
      "https://example.com/~alice?q=A#~"
    );
    expect(normalizeUriReference("HTTP://Example.com:80/%2F?q=%7E")).toBe("http://example.com/%2F?q=~");
    expect(normalizeUriReference("https://Example.com:444/%7Ealice")).toBe("https://example.com:444/~alice");
    expect(normalizeUriReference("mailto:USER%40Example.COM?subject=%48i")).toBe(
      "mailto:USER%40Example.COM?subject=Hi"
    );
    expect(normalizeUriReference("../%7Echild")).toBe("../~child");
  });

  it("resolves and compares URI references through both dual forms", () => {
    const base = "https://example.com/root/base/";

    expect(resolveUriReference(base, "../next?id=1")).toBe("https://example.com/root/next?id=1");
    expect(resolveUriReference("../next?id=1")(base)).toBe("https://example.com/root/next?id=1");
    expect(areUrisEquivalent("https://example.com:443/%7Ealice", "https://example.com/~alice")).toBe(true);
    expect(areUrisEquivalent("https://example.com/~alice")("https://example.com:443/%7Ealice")).toBe(true);
    expect(areUrisEquivalent("https://example.com/a", "https://example.com/b")).toBe(false);
  });

  it("rejects malformed URI values", () => {
    expect(() => decodeAbsoluteUri("folder/child")).toThrow("Expected a valid RFC 3986 absolute URI");
    expect(() => decodeAbsoluteUri("https://example.com/#frag")).toThrow("Expected a valid RFC 3986 absolute URI");
    expect(() => decodeAbsoluteUri("")).toThrow("Absolute URI values must not be empty");
    expect(() => decodeUri(" https://example.com")).toThrow(
      "URI values must not contain leading or trailing whitespace"
    );
    expect(() => decodeUri("folder/child")).toThrow("Expected a valid RFC 3986 URI");
    expect(() => decodeRelativeUriReference("scheme://example.com")).toThrow(
      "Expected a valid RFC 3986 relative URI reference"
    );
  });
});

describe("@beep/rdf RDF term and dataset models", () => {
  const alice = makeNamedNode("https://example.com/people/alice");
  const bob = makeNamedNode("https://example.com/people/bob");
  const person = makeNamedNode("https://schema.org/Person");
  const graph = makeNamedNode("https://example.com/graphs/main");
  const blank = makeBlankNode("b0");
  const label = makeLiteral("Alice", XSD_STRING.value, { language: "EN" });
  const typed = makeLiteral(XSD_STRING.value)("Alice");

  it.effect("decodes scalar RDF helpers and rejects malformed labels", () =>
    Effect.gen(function* () {
      expect(PrefixLabel.decodeUnknownSync("schema")).toBe("schema");
      expect(PrefixLabel.decodeUnknownSync("")).toBe("");
      expect(Curie.decodeUnknownSync("schema:Thing")).toBe("schema:Thing");
      expect(LanguageTag.decodeUnknownSync("en-US")).toBe("en-US");
      expect(() => PrefixLabel.decodeUnknownSync("bad prefix")).toThrow(
        "Prefix labels must be empty for the default prefix or begin with an ASCII letter"
      );
      const invalidCurie = yield* Effect.exit(decodeCurie("missing-colon"));
      expect(Exit.isFailure(invalidCurie)).toBe(true);
      if (Exit.isFailure(invalidCurie)) {
        expect(Cause.pretty(invalidCurie.cause)).toContain("CURIE values must be of the form");
      }
      expect(() => LanguageTag.decodeUnknownSync("en_US")).toThrow("Language tags must use alphanumeric subtags");
      expect(() => makeBlankNode("")).toThrow("Blank node labels must not be empty");
      const emptyBlank = yield* Effect.exit(decodeBlankNode({ termType: "BlankNode", value: "" }));
      expect(Exit.isFailure(emptyBlank)).toBe(true);
      if (Exit.isFailure(emptyBlank)) {
        expect(Cause.pretty(emptyBlank.cause)).toContain("Blank node labels must not be empty");
      }
      const whitespaceBlank = yield* Effect.exit(decodeBlankNode({ termType: "BlankNode", value: " b0" }));
      expect(Exit.isFailure(whitespaceBlank)).toBe(true);
      if (Exit.isFailure(whitespaceBlank)) {
        expect(Cause.pretty(whitespaceBlank.cause)).toContain(
          "Blank node labels must not contain leading or trailing whitespace"
        );
      }
    })
  );

  it("constructs and decodes every RDF term family", () => {
    const defaultGraph = DefaultGraph.make({ termType: "DefaultGraph", value: "" });
    const quad = makeQuad(alice, RDF_TYPE, { object: label, graph });
    const decodedNamedNode = pipe(
      NamedNode.decodeUnknownResult({ termType: "NamedNode", value: alice.value }),
      Result.getOrThrow
    );
    const decodedLiteral = pipe(
      Literal.decodeUnknownResult({
        termType: "Literal",
        value: "Alice",
        datatype: NamedNode.make({ termType: "NamedNode", value: XSD_STRING.value }),
      }),
      Result.getOrThrow
    );

    expect(makeNamedNode(alice.value)).toEqual(NamedNode.make({ termType: "NamedNode", value: alice.value }));
    expect(decodedNamedNode).toEqual(alice);
    expect(decodedLiteral).toEqual(typed);
    expect(blank).toEqual(BlankNode.make({ termType: "BlankNode", value: "b0" }));
    expect(label.language).toEqual(O.some("EN"));
    expect(typed.language).toEqual(O.none());
    expect(quad.graph).toEqual(graph);
    expect(Term.is(alice)).toBe(true);
    expect(Term.is(blank)).toBe(true);
    expect(Term.is(label)).toBe(true);
    expect(Term.is(defaultGraph)).toBe(true);
    expect(Subject.is(alice)).toBe(true);
    expect(Subject.is(blank)).toBe(true);
    expect(ObjectTerm.is(person)).toBe(true);
    expect(ObjectTerm.is(blank)).toBe(true);
    expect(ObjectTerm.is(label)).toBe(true);
    expect(GraphTerm.is(graph)).toBe(true);
    expect(GraphTerm.is(blank)).toBe(true);
    expect(GraphTerm.is(defaultGraph)).toBe(true);
    expect(isQuad(quad)).toBe(true);
  });

  it("supports direct and curried literal, quad, and dataset helpers", () => {
    const languageLiteral = makeLiteral(XSD_STRING.value, { language: "EN" })("Alice");
    const directLanguageLiteral = makeLiteral("Alice", XSD_STRING.value, { language: "EN" });
    const defaultGraphQuad = makeQuad(alice, RDF_TYPE, typed);
    const curriedQuad = makeQuad(RDF_TYPE, { object: person, graph })(alice);
    const directOptionsQuad = makeQuad(alice, RDF_TYPE, { object: blank });
    const directDataset = makeDataset([curriedQuad, defaultGraphQuad]);
    const reorderedDataset = makeDataset([defaultGraphQuad, curriedQuad]);

    expect(languageLiteral.language).toEqual(O.some("EN"));
    expect(directLanguageLiteral.language).toEqual(O.some("EN"));
    expect(serializeTerm(alice)).toBe("<https://example.com/people/alice>");
    expect(serializeTerm(blank)).toBe("_:b0");
    expect(serializeTerm(languageLiteral)).toBe('"Alice"@en');
    expect(serializeTerm(typed)).toBe('"Alice"^^<http://www.w3.org/2001/XMLSchema#string>');
    expect(serializeTerm(defaultGraphQuad.graph)).toBe("default");
    expect(serializeQuad(defaultGraphQuad)).toBe(
      '<https://example.com/people/alice> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> "Alice"^^<http://www.w3.org/2001/XMLSchema#string> default .'
    );
    expect(directOptionsQuad.graph).toEqual(DefaultGraph.make({ termType: "DefaultGraph", value: "" }));
    expect(A.map(sortDatasetQuads(directDataset), serializeQuad)).toEqual(
      A.map(sortDatasetQuads(reorderedDataset), serializeQuad)
    );
    expect(areDatasetsEquivalent(directDataset, reorderedDataset)).toBe(true);
    expect(areDatasetsEquivalent(reorderedDataset)(directDataset)).toBe(true);
    expect(areDatasetsEquivalent(directDataset, makeDataset([makeQuad(bob, RDF_TYPE, person)]))).toBe(false);
  });

  it.effect("decodes namespace bindings and prefix maps", () =>
    Effect.gen(function* () {
      const prefixMap = {
        "": "https://default.example/",
        ex: "https://example.com/",
        schema: "https://schema.org/",
      };

      expect(yield* decodeNamespaceBinding({ prefix: "schema", namespace: "https://schema.org/" })).toEqual(
        NamespaceBinding.make({ prefix: decodePrefixLabel("schema"), namespace: decodeIri("https://schema.org/") })
      );
      expect(decodePrefixMap(prefixMap)).toEqual(prefixMap);
      expect(yield* encodePrefixMap(decodePrefixMap(prefixMap))).toEqual(prefixMap);
      expect(() => decodePrefixMap({ "bad prefix": "https://example.com/" })).toThrow(
        "Prefix labels must be empty for the default prefix or begin with an ASCII letter"
      );
    })
  );
});

describe("@beep/rdf JSON-LD models", () => {
  it.effect("decodes keyword, context, identifier, value, document, and frame shapes", () =>
    Effect.gen(function* () {
      const rawContext = {
        "@base": "https://example.com/",
        "@vocab": "https://schema.org/",
        terms: {
          homepage: { "@id": "https://schema.org/url", "@type": "https://schema.org/URL" },
          name: "https://schema.org/name",
        },
      } as const;
      const context = yield* decodeJsonLdContext(rawContext);
      const rawNode = {
        "@id": "_:alice",
        "@type": ["https://schema.org/Person"],
        properties: {
          "https://schema.org/knows": [{ "@id": "_:bob" }],
          "https://schema.org/name": [{ "@value": "Alice", "@language": "en" }],
        },
      } as const;
      const node = yield* decodeJsonLdNodeObject(rawNode);
      const document = yield* decodeJsonLdDocument({ "@context": rawContext, "@graph": [rawNode] });
      const frame = yield* decodeJsonLdFrame({
        "@type": "https://schema.org/Person",
        includeProperties: ["https://schema.org/name"],
      });

      expect(isJsonLdKeyword("@context")).toBe(true);
      expect(isJsonLdKeyword("@invalid")).toBe(false);
      expect(context["@base"]).toEqual(O.some(decodeAbsoluteIri("https://example.com/")));
      expect((yield* decodeJsonLdTermDefinition({ "@id": "https://schema.org/name" }))["@type"]).toEqual(O.none());
      expect(JsonLdBlankNodeIdentifier.decodeUnknownSync("_:alice")).toBe("_:alice");
      expect(JsonLdNodeIdentifier.decodeUnknownSync("_:alice")).toBe("_:alice");
      expect((yield* decodeJsonLdReferenceValue({ "@id": "https://example.com/alice" }))["@id"]).toBe(
        "https://example.com/alice"
      );
      expect((yield* decodeJsonLdLiteralValue({ "@value": true }))["@value"]).toBe(true);
      expect(JsonLdPropertyValue.decodeUnknownSync({ "@id": "_:bob" })).toEqual(
        yield* decodeJsonLdReferenceValue({ "@id": "_:bob" })
      );
      expect(JsonLdPropertyValue.decodeUnknownSync({ "@value": 1 })).toEqual(
        yield* decodeJsonLdLiteralValue({ "@value": 1 })
      );
      expect(document["@graph"]).toEqual([node]);
      expect(frame.includeProperties).toEqual(O.some(["https://schema.org/name"]));
    })
  );

  it("rejects malformed JSON-LD identifiers", () => {
    expect(() => JsonLdBlankNodeIdentifier.decodeUnknownSync("alice")).toThrow(
      "Blank-node identifiers must begin with `_:`, and must not contain whitespace"
    );
    expect(() => JsonLdBlankNodeIdentifier.decodeUnknownSync("_:bad node")).toThrow(
      "Blank-node identifiers must begin with `_:`, and must not contain whitespace"
    );
    expect(() => JsonLdNodeIdentifier.decodeUnknownSync("\u202Ebad")).toThrow();
  });
});

describe("@beep/rdf semantic metadata", () => {
  const semanticMetadataInput = {
    kind: "identifier",
    canonicalName: "ExampleIdentifier",
    overview: "Example semantic schema metadata.",
    status: "stable",
    specifications: [{ name: "Example Profile", section: "1", disposition: "informative" }],
    equivalenceBasis: "String equality.",
    canonicalizationRequired: true,
    representations: [{ kind: "JSON-LD", note: "Example representation." }],
  } as const;

  it("constructs metadata and exposes literal domains", () => {
    const metadata = makeSemanticSchemaMetadata(semanticMetadataInput);
    const decodedMetadata = pipe(SemanticSchemaMetadata.decodeUnknownResult(semanticMetadataInput), Result.getOrThrow);

    expect(isSemanticSchemaMetadataKind("identifier")).toBe(true);
    expect(isSemanticSchemaStatus("stable")).toBe(true);
    expect(isSemanticSchemaSpecificationDisposition("informative")).toBe(true);
    expect(isSemanticRepresentationKind("JSON-LD")).toBe(true);
    expect(isSemanticSchemaMetadata(metadata)).toBe(true);
    expect(decodedMetadata).toEqual(metadata);
    expect(metadata.canonicalName).toBe("ExampleIdentifier");
  });

  it.effect("rejects unknown semantic schema metadata kinds", () =>
    Effect.gen(function* () {
      const invalid = yield* Effect.exit(
        decodeUnknownSemanticSchemaMetadata({
          ...semanticMetadataInput,
          kind: "unknown",
        })
      );
      expect(Exit.isFailure(invalid)).toBe(true);
      if (Exit.isFailure(invalid)) {
        expect(Cause.pretty(invalid.cause)).toContain("SemanticSchemaMetadataKind");
      }
    })
  );

  it("annotates schemas in direct and curried forms and finds nested metadata", () => {
    const direct = annotateSemanticSchema(S.String, semanticMetadataInput);
    const curried = annotateSemanticSchema({
      ...semanticMetadataInput,
      canonicalName: "NestedIdentifier",
    })(S.Finite);
    const wrapped = S.Array(curried);

    expect(O.map(getSemanticSchemaMetadata(direct), (m) => m.canonicalName)).toEqual(O.some("ExampleIdentifier"));
    expect(O.map(getSemanticSchemaMetadata(wrapped), (m) => m.canonicalName)).toEqual(O.some("NestedIdentifier"));
    expect(O.isNone(getSemanticSchemaMetadata(S.Array(S.String)))).toBe(true);
    expect(O.isNone(getSemanticSchemaMetadata(S.Boolean))).toBe(true);
  });

  it.effect("round-trips decode/encode for metadata derived from the source schema", () =>
    Effect.gen(function* () {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(SemanticSchemaMetadata)]),
        ([metadata]) =>
          Effect.gen(function* () {
            expect(yield* decodeSemanticSchemaMetadata(yield* encodeSemanticSchemaMetadata(metadata))).toEqual(
              metadata
            );

            return true;
          }),
        fcRuns(50)
      );

      expect(result._tag).toBe("Passed");
    })
  );
});

describe("@beep/rdf crispening parity", () => {
  it.effect("keeps constructor-defaulted encoded shapes byte-identical", () =>
    Effect.gen(function* () {
      const datatype = makeNamedNode(XSD_STRING.value);
      const literal = Literal.make({ termType: "Literal", value: "Alice", datatype });
      const quoteSelector = TextQuoteSelector.make({ kind: "text-quote", exact: "quoted text" });
      const fragmentSelector = FragmentSelector.make({ kind: "fragment", value: "section-1" });
      const target = EvidenceTarget.make({
        source: IRIReference.decodeUnknownSync("https://example.org/document"),
        selector: fragmentSelector,
      });
      const anchor = EvidenceAnchor.make({
        id: IRIReference.decodeUnknownSync("https://example.org/annotation/1"),
        target,
      });
      const specification = SemanticSchemaSpecification.make({
        name: "RDF 1.1 Concepts",
        disposition: "informative",
      });
      const document = JsonLdDocument.make({ "@graph": [] });
      const frame = JsonLdFrame.make({});
      const bundle = ProvBundle.make({ records: [] });

      expect(literal.language).toEqual(O.none());
      expect(quoteSelector.prefix).toEqual(O.none());
      expect(quoteSelector.suffix).toEqual(O.none());
      expect(fragmentSelector.conformsTo).toEqual(O.none());
      expect(anchor.note).toEqual(O.none());

      expect(yield* encodeLiteral(literal)).toEqual({
        termType: "Literal",
        value: "Alice",
        datatype: { termType: "NamedNode", value: XSD_STRING.value },
      });
      expect(yield* encodeTextQuoteSelector(quoteSelector)).toEqual({
        kind: "text-quote",
        exact: "quoted text",
      });
      expect(yield* encodeEvidenceAnchor(anchor)).toEqual({
        id: "https://example.org/annotation/1",
        target: {
          source: "https://example.org/document",
          selector: { kind: "fragment", value: "section-1" },
        },
      });
      expect(yield* encodeSemanticSchemaSpecification(specification)).toEqual({
        name: "RDF 1.1 Concepts",
        disposition: "informative",
      });
      expect(yield* encodeJsonLdDocument(document)).toEqual({ "@graph": [] });
      expect(yield* encodeJsonLdFrame(frame)).toEqual({});
      expect(yield* encodeProvBundle(bundle)).toEqual({ records: [] });
    })
  );

  it.effect("exposes reversible Web Annotation codecs without changing wrapper behavior", () =>
    Effect.gen(function* () {
      const selector = TextPositionSelector.make({
        kind: "text-position",
        start: NonNegativeInt.make(0),
        end: NonNegativeInt.make(5),
      });
      const target = EvidenceTarget.make({
        source: IRIReference.decodeUnknownSync("https://example.org/document"),
        selector,
      });
      const anchor = EvidenceAnchor.make({
        id: IRIReference.decodeUnknownSync("https://example.org/annotation/1"),
        target,
      });
      const encodedSelector = yield* encodeEvidenceSelector(selector);
      const encodedTarget = yield* encodeEvidenceTarget(target);
      const encodedAnchor = yield* encodeEvidenceAnchor(anchor);

      const annotation = WebAnnotationFromEvidenceAnchor.decodeUnknownSync(encodedAnchor);

      expect(WebAnnotationSelectorFromEvidenceSelector.decodeUnknownSync(encodedSelector).type).toBe(
        "TextPositionSelector"
      );
      expect(WebAnnotationTargetFromEvidenceTarget.decodeUnknownSync(encodedTarget).selector.type).toBe(
        "TextPositionSelector"
      );
      expect(evidenceAnchorToWebAnnotation(anchor)).toEqual(annotation);
      expect(webAnnotationToEvidenceAnchor(annotation)).toEqual(anchor);
      expect(yield* encodeWebAnnotationFromEvidenceAnchor(annotation)).toEqual({
        id: "https://example.org/annotation/1",
        target: {
          source: "https://example.org/document",
          selector: { kind: "text-position", start: 0, end: 5 },
        },
      });
    })
  );

  it.effect("round-trips schema-derived arbitrary values through crispened schemas", () =>
    Effect.gen(function* () {
      yield* assertDecodeEncodeDecodeStable(LanguageTag);
      yield* assertRoundTrips(PrefixMap);
      yield* assertDecodeEncodeDecodeStable(Literal);
      yield* assertRoundTrips(Term);
      yield* assertRoundTrips(Subject);
      yield* assertRoundTrips(ObjectTerm);
      yield* assertRoundTrips(GraphTerm);
      yield* assertRoundTrips(JsonLdDocument);
      yield* assertRoundTrips(EvidenceAnchor);
      yield* assertRoundTrips(WebAnnotationFromEvidenceAnchor);
      yield* assertRoundTrips(SemanticSchemaMetadata);
    })
  );
});

describe("@beep/rdf package and vocabulary exports", () => {
  it("exports the package root version and all core vocabulary named nodes", () => {
    expect(RdfRoot.VERSION).toBe("0.0.0");
    expect(OA_NAMESPACE).toBe("http://www.w3.org/ns/oa#");
    expect(OA_ANNOTATION.value).toBe(`${OA_NAMESPACE}Annotation`);
    expect(OA_HAS_TARGET.value).toBe(`${OA_NAMESPACE}hasTarget`);
    expect(OA_HAS_SELECTOR.value).toBe(`${OA_NAMESPACE}hasSelector`);
    expect(OWL_NAMESPACE).toBe("http://www.w3.org/2002/07/owl#");
    expect(OWL_CLASS.value).toBe(`${OWL_NAMESPACE}Class`);
    expect(OWL_OBJECT_PROPERTY.value).toBe(`${OWL_NAMESPACE}ObjectProperty`);
    expect(OWL_DATATYPE_PROPERTY.value).toBe(`${OWL_NAMESPACE}DatatypeProperty`);
    expect(PROV_NAMESPACE).toBe("http://www.w3.org/ns/prov#");
    expect(PROV_ENTITY.value).toBe(`${PROV_NAMESPACE}Entity`);
    expect(PROV_ACTIVITY.value).toBe(`${PROV_NAMESPACE}Activity`);
    expect(PROV_AGENT.value).toBe(`${PROV_NAMESPACE}Agent`);
    expect(PROV_WAS_GENERATED_BY.value).toBe(`${PROV_NAMESPACE}wasGeneratedBy`);
    expect(PROV_USED.value).toBe(`${PROV_NAMESPACE}used`);
    expect(RDF_NAMESPACE).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    expect(RDF_TYPE.value).toBe(`${RDF_NAMESPACE}type`);
    expect(RDF_FIRST.value).toBe(`${RDF_NAMESPACE}first`);
    expect(RDF_REST.value).toBe(`${RDF_NAMESPACE}rest`);
    expect(RDF_NIL.value).toBe(`${RDF_NAMESPACE}nil`);
    expect(RDFS_NAMESPACE).toBe("http://www.w3.org/2000/01/rdf-schema#");
    expect(RDFS_LABEL.value).toBe(`${RDFS_NAMESPACE}label`);
    expect(RDFS_COMMENT.value).toBe(`${RDFS_NAMESPACE}comment`);
    expect(RDFS_CLASS.value).toBe(`${RDFS_NAMESPACE}Class`);
    expect(SKOS_NAMESPACE).toBe("http://www.w3.org/2004/02/skos/core#");
    expect(SKOS_CONCEPT.value).toBe(`${SKOS_NAMESPACE}Concept`);
    expect(SKOS_CONCEPT_SCHEME.value).toBe(`${SKOS_NAMESPACE}ConceptScheme`);
    expect(SKOS_PREF_LABEL.value).toBe(`${SKOS_NAMESPACE}prefLabel`);
    expect(SKOS_ALT_LABEL.value).toBe(`${SKOS_NAMESPACE}altLabel`);
    expect(SKOS_HIDDEN_LABEL.value).toBe(`${SKOS_NAMESPACE}hiddenLabel`);
    expect(SKOS_DEFINITION.value).toBe(`${SKOS_NAMESPACE}definition`);
    expect(SKOS_SCOPE_NOTE.value).toBe(`${SKOS_NAMESPACE}scopeNote`);
    expect(SKOS_EDITORIAL_NOTE.value).toBe(`${SKOS_NAMESPACE}editorialNote`);
    expect(SKOS_HISTORY_NOTE.value).toBe(`${SKOS_NAMESPACE}historyNote`);
    expect(SKOS_BROADER.value).toBe(`${SKOS_NAMESPACE}broader`);
    expect(SKOS_NARROWER.value).toBe(`${SKOS_NAMESPACE}narrower`);
    expect(SKOS_RELATED.value).toBe(`${SKOS_NAMESPACE}related`);
    expect(SKOS_EXACT_MATCH.value).toBe(`${SKOS_NAMESPACE}exactMatch`);
    expect(SKOS_CLOSE_MATCH.value).toBe(`${SKOS_NAMESPACE}closeMatch`);
    expect(SKOS_BROAD_MATCH.value).toBe(`${SKOS_NAMESPACE}broadMatch`);
    expect(SKOS_NARROW_MATCH.value).toBe(`${SKOS_NAMESPACE}narrowMatch`);
    expect(SKOS_RELATED_MATCH.value).toBe(`${SKOS_NAMESPACE}relatedMatch`);
    expect(SKOS_IN_SCHEME.value).toBe(`${SKOS_NAMESPACE}inScheme`);
    expect(SKOS_HAS_TOP_CONCEPT.value).toBe(`${SKOS_NAMESPACE}hasTopConcept`);
    expect(SKOS_TOP_CONCEPT_OF.value).toBe(`${SKOS_NAMESPACE}topConceptOf`);
    expect(XSD_NAMESPACE).toBe("http://www.w3.org/2001/XMLSchema#");
    expect(XSD_STRING.value).toBe(`${XSD_NAMESPACE}string`);
    expect(XSD_ANY_URI.value).toBe(`${XSD_NAMESPACE}anyURI`);
    expect(XSD_BOOLEAN.value).toBe(`${XSD_NAMESPACE}boolean`);
    expect(XSD_INTEGER.value).toBe(`${XSD_NAMESPACE}integer`);
    expect(XSD_DOUBLE.value).toBe(`${XSD_NAMESPACE}double`);
  });
});
