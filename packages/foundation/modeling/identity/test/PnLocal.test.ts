import { acceptsEscapedLocal, escapeLocal, isSafeLocal, prefixedNameOrIri, unescapeLocal } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
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

  it("falls back to full IRI when a local cannot be emitted unescaped", () => {
    expect(
      prefixedNameOrIri("beep", "Ontology.models/HttpUrl", "https://ns.beep.sh/ontology/Ontology.models/HttpUrl")
    ).toBe("<https://ns.beep.sh/ontology/Ontology.models/HttpUrl>");
  });
});
