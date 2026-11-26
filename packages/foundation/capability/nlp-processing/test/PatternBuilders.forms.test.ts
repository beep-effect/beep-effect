import {
  entity,
  extractBracketContent,
  generalizeLiterals,
  head,
  literal,
  make,
  optionalEntity,
  optionalLiteral,
  optionalPos,
  pos,
} from "@beep/nlp-processing/Core/index";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";

describe("pattern element builders", () => {
  it("build the same element from an array and from variadic arguments", () => {
    expect(pos(["NOUN", "ADJ"])).toEqual(pos("NOUN", "ADJ"));
    expect(entity(["DATE", "TIME"])).toEqual(entity("DATE", "TIME"));
    expect(literal(["Inc.", "LLC"])).toEqual(literal("Inc.", "LLC"));
    expect(optionalPos(["NOUN", "ADJ"])).toEqual(optionalPos("NOUN", "ADJ"));
    expect(optionalEntity(["DATE", "TIME"])).toEqual(optionalEntity("DATE", "TIME"));
    expect(optionalLiteral(["Inc.", "LLC"])).toEqual(optionalLiteral("Inc.", "LLC"));
    expect(optionalEntity("EMAIL").value).toEqual(["", "EMAIL"]);
  });

  it("make reads the id from either argument order", () => {
    const elements = [literal("Acme")];
    expect(make("company")(elements)).toEqual(make("company", elements));
  });

  it("generalizeLiterals replaces every literal with a fixed element", () => {
    const generalized = generalizeLiterals(make("specific", [literal("agreement")]), pos("NOUN"));
    assertSome(
      O.map(head(generalized), (element) => element._tag),
      "POSPatternElement"
    );
  });

  it("extractBracketContent requires both brackets", () => {
    assertSome(extractBracketContent("[ADJ|NOUN]"), "ADJ|NOUN");
    assertNone(extractBracketContent("ADJ]"));
    assertNone(extractBracketContent("[ADJ"));
  });
});
