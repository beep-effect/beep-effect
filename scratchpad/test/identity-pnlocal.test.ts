import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Arbitrary from "effect/Arbitrary";
import { describe, expect, it } from "vitest";
import { acceptsEscapedLocal, escapeLocal, isSafeLocal, prefixedNameOrIri, unescapeLocal } from "@beep/identity";

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
    expect(isSafeLocal("ClassificationPin")).toBe(true);
    expect(isSafeLocal("Classification.models/ClassificationPin")).toBe(false);
    expect(isSafeLocal("a.b")).toBe(true);
    expect(isSafeLocal("a.b.")).toBe(false);
    expect(isSafeLocal("9lives")).toBe(true);
    expect(isSafeLocal("")).toBe(false);
    expect(isSafeLocal("claim#1")).toBe(false);
  });

  it("round-trips escaped PN_LOCAL characters through parser-side acceptance", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            Arbitrary.map(
              Arbitrary.schema(
                S.Array(S.Literals(escapableLocalCharacters)).check(S.isMinLength(1), S.isMaxLength(40)),
              ),
              (characters) => A.join(characters, ""),
            ),
          ]),
          ([local]) => {
            const escaped = escapeLocal(local);

            expect(unescapeLocal(escaped)).toBe(local);
            expect(acceptsEscapedLocal(escaped)).toBe(true);

            return true;
          },
        ),
      )._tag,
    ).toBe("Passed");
  });

  it("falls back to full IRI when a local cannot be emitted unescaped", () => {
    expect(
      prefixedNameOrIri("Classification.models/ClassificationPin", {
        prefix: "beep",
        fullIri: "https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin",
      }),
    ).toBe("<https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin>");
  });
});
