import * as RdfRoot from "@beep/rdf";
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
import {
  areDatasetsEquivalent,
  BlankNode,
  Curie,
  DefaultGraph,
  GraphTerm,
  LanguageTag,
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
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeIri = S.decodeUnknownSync(IRI);
const decodeAbsoluteIri = S.decodeUnknownSync(AbsoluteIRI);
const decodeIriReference = S.decodeUnknownSync(IRIReference);
const decodeRelativeIriReference = S.decodeUnknownSync(RelativeIRIReference);
const decodeUri = S.decodeUnknownSync(URI);
const decodeAbsoluteUri = S.decodeUnknownSync(AbsoluteURI);
const decodeUriReference = S.decodeUnknownSync(URIReference);
const decodeRelativeUriReference = S.decodeUnknownSync(RelativeURIReference);

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

    expect(S.is(IRI)(nativeUrlFriendlyButSpecInvalid)).toBe(false);
    expect(canParseWithNativeUrl(nativeUrlFriendlyButSpecInvalid)).toBe(true);
  });
});

describe("@beep/rdf URI schemas and helpers", () => {
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

  it("decodes scalar RDF helpers and rejects malformed labels", () => {
    expect(S.decodeUnknownSync(PrefixLabel)("schema")).toBe("schema");
    expect(S.decodeUnknownSync(Curie)("schema:Thing")).toBe("schema:Thing");
    expect(S.decodeUnknownSync(LanguageTag)("en-US")).toBe("en-US");
    expect(() => S.decodeUnknownSync(PrefixLabel)("bad prefix")).toThrow(
      "Prefix labels must begin with an ASCII letter"
    );
    expect(() => S.decodeUnknownSync(Curie)("missing-colon")).toThrow("CURIE values must be of the form");
    expect(() => S.decodeUnknownSync(LanguageTag)("en_US")).toThrow("Language tags must use alphanumeric subtags");
    expect(() => makeBlankNode("")).toThrow("Expected a value with a length of at least 1");
    expect(() => S.decodeUnknownSync(BlankNode)({ termType: "BlankNode", value: "" })).toThrow(
      "Blank node labels must not be empty"
    );
    expect(() => S.decodeUnknownSync(BlankNode)({ termType: "BlankNode", value: " b0" })).toThrow(
      "Blank node labels must not contain leading or trailing whitespace"
    );
  });

  it("constructs and decodes every RDF term family", () => {
    const defaultGraph = DefaultGraph.make({ termType: "DefaultGraph", value: "" });
    const quad = makeQuad(alice, RDF_TYPE, { object: label, graph });

    expect(makeNamedNode(alice.value)).toEqual(NamedNode.make({ termType: "NamedNode", value: alice.value }));
    expect(blank).toEqual(BlankNode.make({ termType: "BlankNode", value: "b0" }));
    expect(label.language).toEqual(O.some("EN"));
    expect(typed.language).toEqual(O.none());
    expect(quad.graph).toEqual(graph);
    expect(S.is(Term)(alice)).toBe(true);
    expect(S.is(Term)(blank)).toBe(true);
    expect(S.is(Term)(label)).toBe(true);
    expect(S.is(Term)(defaultGraph)).toBe(true);
    expect(S.is(Subject)(alice)).toBe(true);
    expect(S.is(Subject)(blank)).toBe(true);
    expect(S.is(ObjectTerm)(person)).toBe(true);
    expect(S.is(ObjectTerm)(blank)).toBe(true);
    expect(S.is(ObjectTerm)(label)).toBe(true);
    expect(S.is(GraphTerm)(graph)).toBe(true);
    expect(S.is(GraphTerm)(blank)).toBe(true);
    expect(S.is(GraphTerm)(defaultGraph)).toBe(true);
    expect(S.is(Quad)(quad)).toBe(true);
  });

  it("supports direct and curried literal, quad, and dataset helpers", () => {
    const languageLiteral = makeLiteral(XSD_STRING.value, { language: "EN" })("Alice");
    const directLanguageLiteral = makeLiteral("Alice", XSD_STRING.value, "EN");
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

  it("decodes namespace bindings and prefix maps", () => {
    expect(S.decodeUnknownSync(NamespaceBinding)({ prefix: "schema", namespace: "https://schema.org/" })).toEqual(
      NamespaceBinding.make({ prefix: "schema", namespace: "https://schema.org/" })
    );
    expect(S.decodeUnknownSync(PrefixMap)({ ex: "https://example.com/" })).toEqual({ ex: "https://example.com/" });
    expect(() => S.decodeUnknownSync(PrefixMap)({ "bad prefix": "https://example.com/" })).toThrow(
      "Prefix labels must begin with an ASCII letter"
    );
  });
});

describe("@beep/rdf JSON-LD models", () => {
  it("decodes keyword, context, identifier, value, document, and frame shapes", () => {
    const rawContext = {
      "@base": "https://example.com/",
      "@vocab": "https://schema.org/",
      terms: {
        homepage: { "@id": "https://schema.org/url", "@type": "https://schema.org/URL" },
        name: "https://schema.org/name",
      },
    } as const;
    const context = S.decodeUnknownSync(JsonLdContext)(rawContext);
    const rawNode = {
      "@id": "_:alice",
      "@type": ["https://schema.org/Person"],
      properties: {
        "https://schema.org/knows": [{ "@id": "_:bob" }],
        "https://schema.org/name": [{ "@value": "Alice", "@language": "en" }],
      },
    } as const;
    const node = S.decodeUnknownSync(JsonLdNodeObject)(rawNode);
    const document = S.decodeUnknownSync(JsonLdDocument)({ "@context": rawContext, "@graph": [rawNode] });
    const frame = S.decodeUnknownSync(JsonLdFrame)({
      "@type": "https://schema.org/Person",
      includeProperties: ["https://schema.org/name"],
    });

    expect(S.is(JsonLdKeyword)("@context")).toBe(true);
    expect(S.is(JsonLdKeyword)("@invalid")).toBe(false);
    expect(S.decodeUnknownSync(JsonLdTermDefinition)({ "@id": "https://schema.org/name" })["@type"]).toEqual(O.none());
    expect(S.decodeUnknownSync(JsonLdBlankNodeIdentifier)("_:alice")).toBe("_:alice");
    expect(S.decodeUnknownSync(JsonLdNodeIdentifier)("_:alice")).toBe("_:alice");
    expect(S.decodeUnknownSync(JsonLdReferenceValue)({ "@id": "https://example.com/alice" })["@id"]).toBe(
      "https://example.com/alice"
    );
    expect(S.decodeUnknownSync(JsonLdLiteralValue)({ "@value": true })["@value"]).toBe(true);
    expect(S.decodeUnknownSync(JsonLdPropertyValue)({ "@id": "_:bob" })["@id"]).toBe("_:bob");
    expect(S.decodeUnknownSync(JsonLdPropertyValue)({ "@value": 1 })["@value"]).toBe(1);
    expect(document["@graph"]).toEqual([node]);
    expect(frame.includeProperties).toEqual(O.some(["https://schema.org/name"]));
  });

  it("rejects malformed JSON-LD identifiers", () => {
    expect(() => S.decodeUnknownSync(JsonLdBlankNodeIdentifier)("alice")).toThrow(
      "Blank-node identifiers must begin with `_:`, and must not contain whitespace"
    );
    expect(() => S.decodeUnknownSync(JsonLdBlankNodeIdentifier)("_:bad node")).toThrow(
      "Blank-node identifiers must begin with `_:`, and must not contain whitespace"
    );
    expect(() => S.decodeUnknownSync(JsonLdNodeIdentifier)("\u202Ebad")).toThrow();
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

    expect(S.is(SemanticSchemaMetadataKind)("identifier")).toBe(true);
    expect(S.is(SemanticSchemaStatus)("stable")).toBe(true);
    expect(S.is(SemanticSchemaSpecificationDisposition)("informative")).toBe(true);
    expect(S.is(SemanticRepresentationKind)("JSON-LD")).toBe(true);
    expect(S.is(SemanticSchemaMetadata)(metadata)).toBe(true);
    expect(metadata.canonicalName).toBe("ExampleIdentifier");
    expect(() =>
      makeSemanticSchemaMetadata({
        ...semanticMetadataInput,
        kind: "unknown",
      })
    ).toThrow("Expected SemanticSchemaMetadataKind");
  });

  it("annotates schemas in direct and curried forms and finds nested metadata", () => {
    const direct = annotateSemanticSchema(S.String, semanticMetadataInput);
    const curried = annotateSemanticSchema({
      ...semanticMetadataInput,
      canonicalName: "NestedIdentifier",
    })(S.Number);
    const wrapped = S.Array(curried);

    expect(getSemanticSchemaMetadata(direct)?.canonicalName).toBe("ExampleIdentifier");
    expect(getSemanticSchemaMetadata(wrapped)?.canonicalName).toBe("NestedIdentifier");
    expect(getSemanticSchemaMetadata(S.Array(S.String))).toBeUndefined();
    expect(getSemanticSchemaMetadata(S.Boolean)).toBeUndefined();
  });
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
