import {
  acceptsEscapedLocal,
  EscapedPnLocal,
  escapeLocal,
  isSafeLocal,
  prefixedNameOrIri,
  SafePnLocal,
  unescapeLocal,
} from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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

  it("accepts escaped parser-side local names", () => {
    expect(acceptsEscapedLocal("Ontology.models\\/HttpUrl")).toBe(true);
    expect(acceptsEscapedLocal("claim\\#1")).toBe(true);
    expect(acceptsEscapedLocal("bad\\z")).toBe(false);
    expect(acceptsEscapedLocal("bad%0Z")).toBe(false);
  });

  it("round-trips escaped PN_LOCAL characters through parser-side acceptance", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(...escapableLocalCharacters), { minLength: 1, maxLength: 40 })
          .map((characters) => characters.join("")),
        (local) => {
          const escaped = escapeLocal(local);

          expect(unescapeLocal(escaped)).toBe(local);
          expect(acceptsEscapedLocal(escaped)).toBe(true);
        }
      )
    );
  });

  it("round-trips generated safe PN_LOCAL schema values", () => {
    fc.assert(
      fc.property(S.toArbitrary(SafePnLocal), (local) => {
        const decoded = O.flatMap(S.encodeOption(SafePnLocal)(local), S.decodeUnknownOption(SafePnLocal));

        expect(O.exists(decoded, (value) => Equal.equals(value, local))).toBe(true);
        expect(isSafeLocal(local)).toBe(true);
      })
    );
  });

  it("round-trips generated escaped PN_LOCAL schema values", () => {
    fc.assert(
      fc.property(S.toArbitrary(EscapedPnLocal), (local) => {
        const decoded = O.flatMap(S.encodeOption(EscapedPnLocal)(local), S.decodeUnknownOption(EscapedPnLocal));

        expect(O.exists(decoded, (value) => Equal.equals(value, local))).toBe(true);
        expect(acceptsEscapedLocal(local)).toBe(true);
      })
    );
  });

  it("falls back to full IRI when a local cannot be emitted unescaped", () => {
    expect(
      prefixedNameOrIri("Ontology.models/HttpUrl", {
        prefix: "beep",
        fullIri: "https://ns.beep.sh/ontology/Ontology.models/HttpUrl",
      })
    ).toBe("<https://ns.beep.sh/ontology/Ontology.models/HttpUrl>");
  });
});
