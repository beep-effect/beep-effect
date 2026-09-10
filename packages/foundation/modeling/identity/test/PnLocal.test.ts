import {
  acceptsEscapedLocal,
  EscapedPnLocal,
  escapeLocal,
  isSafeLocal,
  isSafePrefix,
  prefixedNameOrIri,
  SafePnLocal,
  SafePnPrefix,
  unescapeLocal,
} from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownEscapedPnLocalOption = S.decodeUnknownOption(EscapedPnLocal);
const decodeUnknownSafePnLocalOption = S.decodeUnknownOption(SafePnLocal);
const decodeUnknownSafePnPrefixOption = S.decodeUnknownOption(SafePnPrefix);
const encodeEscapedPnLocalOption = S.encodeOption(EscapedPnLocal);
const encodeSafePnLocalOption = S.encodeOption(SafePnLocal);
const encodeSafePnPrefixOption = S.encodeOption(SafePnPrefix);

const escapableLocalCharacters = [
  "_",
  "~",
  ".",
  "-",
  "!",
  "$",
  "&",
  "'",
  "(",
  ")",
  "*",
  "+",
  ",",
  ";",
  "=",
  "/",
  "?",
  "#",
  "@",
  "%",
];

describe("PnLocal", () => {
  it("recognizes safe unescaped Turtle PN_LOCAL values", () => {
    expect(isSafeLocal("HttpUrl")).toBe(true);
    expect(isSafeLocal("Ontology.models/HttpUrl")).toBe(false);
    expect(isSafeLocal("a.b")).toBe(true);
    expect(isSafeLocal("a.b.")).toBe(false);
    expect(isSafeLocal("9lives")).toBe(true);
    expect(isSafeLocal("")).toBe(false);
    expect(isSafeLocal("claim#1")).toBe(false);
  });

  it("recognizes safe unescaped Turtle PN_PREFIX values", () => {
    expect(isSafePrefix("skos")).toBe(true);
    expect(isSafePrefix("schema.org")).toBe(true);
    expect(isSafePrefix("bad:prefix")).toBe(false);
    expect(isSafePrefix("9lives")).toBe(false);
    expect(isSafePrefix("bad.")).toBe(false);
  });

  it("accepts escaped parser-side local names", () => {
    expect(acceptsEscapedLocal("Ontology.models\\/HttpUrl")).toBe(true);
    expect(acceptsEscapedLocal("claim\\#1")).toBe(true);
    expect(acceptsEscapedLocal("bad\\z")).toBe(false);
    expect(acceptsEscapedLocal("bad%0Z")).toBe(false);
  });

  it("rejects a local name ending in a lone backslash", () => {
    expect(acceptsEscapedLocal("bad\\")).toBe(false);
    expect(acceptsEscapedLocal("\\")).toBe(false);
    expect(O.isNone(decodeUnknownEscapedPnLocalOption("bad\\"))).toBe(true);
  });

  it.prop(
    "round-trips escaped PN_LOCAL characters through parser-side acceptance",
    [S.Array(S.Literals(escapableLocalCharacters)).check(S.isMinLength(1), S.isMaxLength(40))],
    ([characters]) => {
      const local = A.join(characters, "");
      const escaped = escapeLocal(local);
      expect(unescapeLocal(escaped)).toBe(local);
      expect(acceptsEscapedLocal(escaped)).toBe(true);
    }
  );

  it("round-trips generated safe PN_LOCAL schema values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(SafePnLocal)]), ([local]) => {
          const decoded = O.flatMap(encodeSafePnLocalOption(local), decodeUnknownSafePnLocalOption);

          expect(O.exists(decoded, (value) => Equal.equals(value, local))).toBe(true);
          expect(isSafeLocal(local)).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
  });

  it("round-trips generated safe PN_PREFIX schema values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(SafePnPrefix)]), ([prefix]) => {
          const decoded = O.flatMap(encodeSafePnPrefixOption(prefix), decodeUnknownSafePnPrefixOption);

          expect(O.exists(decoded, (value) => Equal.equals(value, prefix))).toBe(true);
          expect(isSafePrefix(prefix)).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
  });

  it("round-trips generated escaped PN_LOCAL schema values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(EscapedPnLocal)]), ([local]) => {
          const decoded = O.flatMap(encodeEscapedPnLocalOption(local), decodeUnknownEscapedPnLocalOption);

          expect(O.exists(decoded, (value) => Equal.equals(value, local))).toBe(true);
          expect(acceptsEscapedLocal(local)).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
  });

  it("falls back to full IRI when a local cannot be emitted unescaped", () => {
    expect(
      prefixedNameOrIri("Ontology.models/HttpUrl", {
        prefix: "beep",
        fullIri: "https://ns.beep.sh/ontology/Ontology.models/HttpUrl",
      })
    ).toBe("<https://ns.beep.sh/ontology/Ontology.models/HttpUrl>");
  });

  it("does not interpolate unsafe prefixes or full IRI delimiters into Turtle", () => {
    expect(
      prefixedNameOrIri("safe", {
        prefix: "bad:prefix",
        fullIri: 'https://ns.beep.sh/x"> <urn:evil>',
      })
    ).toBe("<https://ns.beep.sh/x%22%3E%20%3Curn:evil%3E>");
  });
});

describe("PN_LOCAL boundary grammar", () => {
  it("checks single characters, interior punctuation, and invalid final units", () => {
    for (const value of ["a", ":", "a:b", "a\u0300b", "a\u203Fb"]) expect(isSafeLocal(value), value).toBe(true);
    for (const value of ["!a", "a/b", "a ", "a.!"]) expect(isSafeLocal(value), value).toBe(false);
    for (const value of ["a", "a.b", "a-b"]) expect(isSafePrefix(value), value).toBe(true);
    for (const value of ["", "a:b", "a/b", "a:"]) expect(isSafePrefix(value), value).toBe(false);
    for (const value of ["", "!a", "a.", "a/b", "%", "%A", "%GG", "bad\\z"]) {
      expect(acceptsEscapedLocal(value), value).toBe(false);
    }
    for (const value of ["a", "%20", "%af", "a%20b", "a:b", "a.b", "𐀀x"]) {
      expect(acceptsEscapedLocal(value), value).toBe(true);
    }
    expect(prefixedNameOrIri("term", { prefix: "ex", fullIri: "https://example.com/term" })).toBe("ex:term");
  });
});

it("preserves PN names through both arbitrary-codec directions", () => {
  for (const schema of [SafePnLocal, SafePnPrefix, EscapedPnLocal]) {
    const arbitrary = S.resolveAnnotations(schema)?.toCodecArbitrary;
    if (typeof arbitrary !== "function") return expect.fail("Expected a PN name arbitrary codec");
    const link = (arbitrary as S.Annotations.ToArbitrary.Declaration<string, []>)({
      typeParameters: [],
      constraint: undefined,
    });
    if (link.transformation._tag !== "Transformation")
      return expect.fail("Expected a bidirectional PN name transformation");
    const codec = S.make<S.Codec<string, string>>(SchemaAST.decodeTo(link.to, schema.ast, link.transformation));
    const value = schema === SafePnPrefix ? "skos" : "prefLabel";
    expect(S.decodeSync(codec)(value)).toBe(value);
    expect(S.encodeSync(codec)(value)).toBe(value);
  }
});
