import {
  addElements,
  applyPatch,
  BracketStringToEntityPatternElement,
  BracketStringToLiteralPatternElement,
  BracketStringToPOSPatternElement,
  combine,
  composePatches,
  drop,
  EntityPatternOption,
  elementAt,
  entity,
  filterElements,
  generalizeLiterals,
  getMark,
  hasMark,
  head,
  isEmpty,
  LiteralPatternOption,
  last,
  length,
  literal,
  make,
  mapElements,
  optionalLiteral,
  optionalPos,
  Pattern,
  PatternFromString,
  POSPatternOption,
  patchReplaceAllLiterals,
  patchReplaceLiteralAt,
  pos,
  prependElements,
  take,
  withId,
  withMark,
} from "@beep/nlp/Core/index";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { Str } from "@beep/utils";
import { Chunk, Effect, Schema } from "effect";
import * as O from "effect/Option";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { describe, expect, it } from "vitest";
import type { PatternElement } from "@beep/nlp/Core/index";

const decodeBracketStringToEntityPatternElement = Schema.decodeEffect(BracketStringToEntityPatternElement);
const decodeBracketStringToLiteralPatternElement = Schema.decodeEffect(BracketStringToLiteralPatternElement);
const decodeBracketStringToPOSPatternElement = Schema.decodeEffect(BracketStringToPOSPatternElement);
const decodeEntityPatternOption = Schema.decodeEffect(EntityPatternOption);
const decodeLiteralPatternOption = Schema.decodeEffect(LiteralPatternOption);
const decodePOSPatternOption = Schema.decodeEffect(POSPatternOption);
const decodePatternElement = Schema.decodeEffect(Pattern.Element);
const decodeBracketStringToLiteralPatternElementSync = Schema.decodeSync(BracketStringToLiteralPatternElement);
const decodeEntityPatternOptionSync = Schema.decodeSync(EntityPatternOption);
const decodeLiteralPatternOptionSync = Schema.decodeSync(LiteralPatternOption);
const decodePOSPatternOptionSync = Schema.decodeSync(POSPatternOption);
const encodePatternElement = Schema.encodeEffect(Pattern.Element);

const POSPatternOptionArbitrary = Arbitrary.schema(POSPatternOption);
const EntityPatternOptionArbitrary = Arbitrary.schema(EntityPatternOption);
const LiteralPatternOptionArbitrary = Arbitrary.schema(LiteralPatternOption);
const PatternElementArbitrary = Arbitrary.schema(Pattern.Element);
const PatternArbitrary = Arbitrary.schema(Pattern);

const firstIncludes = (values: ReadonlyArray<string>, searchString: string): boolean => {
  const first = values[0];
  return first !== undefined && Str.includes(searchString)(first);
};
const nonNegativeInt = Schema.decodeUnknownSync(NonNegativeInt);
const mark = (start: number, end: number) => [nonNegativeInt(start), nonNegativeInt(end)] as const;

describe("Core Pattern", () => {
  it("creates element builders with optional values", () => {
    expect(pos("ADJ", "NOUN").value).toEqual(["ADJ", "NOUN"]);
    expect(entity("DATE").value).toEqual(["DATE"]);
    expect(literal("Apple", "", "Google").value).toEqual(["Apple", "Google"]);
    expect(optionalPos("DET").value).toEqual(["", "DET"]);
    expect(optionalLiteral("the").value).toEqual(["", "the"]);
  });

  it("supports pattern construction and inspection helpers", () => {
    const pattern = withMark(make("test", [pos("ADJ"), pos("NOUN"), literal("thing")]), mark(0, 1));

    expect(length(pattern)).toBe(3);
    expect(isEmpty(pattern)).toBe(false);
    expect(hasMark(pattern)).toBe(true);
    expect(O.getOrThrow(getMark(pattern))).toEqual([0, 1]);
    expect(O.getOrThrow(head(pattern))._tag).toBe("POSPatternElement");
    expect(O.getOrThrow(last(pattern))._tag).toBe("LiteralPatternElement");
    expect(O.getOrThrow(elementAt(pattern, 1))._tag).toBe("POSPatternElement");
  });

  it("keeps absent pattern marks absent in the encoded wire shape", () => {
    const pattern = Pattern.make({
      _tag: "Pattern",
      elements: Chunk.of(literal("Effect")),
      id: Pattern.Id("effect-token"),
    });

    const encoded = Pattern.encode(pattern);

    expect(encoded).toEqual({
      _tag: "Pattern",
      elements: encoded.elements,
      id: "effect-token",
    });
    expect(Chunk.toReadonlyArray(encoded.elements)).toEqual([{ _tag: "LiteralPatternElement", value: ["Effect"] }]);
  });

  it("supports structural transforms", () => {
    const base = make("base", [pos("ADJ"), pos("NOUN")]);
    const extended = prependElements(addElements(base, [literal("thing")]), [literal("the")]);
    const renamed = withId(extended, "renamed");
    const sliced = drop(take(renamed, 3), 1);

    expect(renamed.id).toBe("renamed");
    expect(length(extended)).toBe(4);
    expect(length(sliced)).toBe(2);
    expect(Chunk.isChunk(mapElements(base, () => pos("VERB")).elements)).toBe(true);
    expect(
      Chunk.isChunk(filterElements(extended, (item: PatternElement) => item._tag !== "LiteralPatternElement").elements)
    ).toBe(true);
    expect(hasMark(prependElements(withMark(base, mark(0, 1)), [literal("the")]))).toBe(false);
  });

  it("supports patch-based literal generalization", () => {
    const pattern = make("id", [literal("hello"), literal("2010"), pos("NOUN")]);
    const patched = applyPatch(
      pattern,
      composePatches(
        patchReplaceLiteralAt(0, () => entity("URL")),
        patchReplaceAllLiterals(() => pos("ADV"))
      )
    );
    const generalized = generalizeLiterals(pattern, (values) =>
      firstIncludes(values, "2010") ? entity("DATE") : pos("NOUN")
    );
    const combined = combine(pattern, make("other", [pos("VERB")]), { id: "combined" });

    expect(O.getOrThrow(elementAt(patched, 0))._tag).toBe("EntityPatternElement");
    expect(O.getOrThrow(elementAt(patched, 1))._tag).toBe("POSPatternElement");
    expect(O.getOrThrow(elementAt(generalized, 0))._tag).toBe("POSPatternElement");
    expect(O.getOrThrow(elementAt(generalized, 1))._tag).toBe("EntityPatternElement");
    expect(combined.id).toBe("combined");
    expect(length(combined)).toBe(4);
  });

  it("encodes and decodes element schemas", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const posResult = yield* decodeBracketStringToPOSPatternElement("[ADJ|NOUN]");
        const entityResult = yield* decodeBracketStringToEntityPatternElement("[DATE|TIME]");
        const literalResult = yield* decodeBracketStringToLiteralPatternElement("[|Apple|Google]");

        expect(posResult.value).toEqual(["ADJ", "NOUN"]);
        expect(entityResult.value).toEqual(["DATE", "TIME"]);
        expect(literalResult.value).toEqual(["", "Apple", "Google"]);
        expect(Pattern.POS.toBracketString(posResult.value)).toBe("[ADJ|NOUN]");
        expect(Pattern.Entity.toBracketString(entityResult.value)).toBe("[DATE|TIME]");
        expect(Pattern.Literal.toBracketString(literalResult.value)).toBe("[|Apple|Google]");
      })
    ));

  it("round-trips schema-derived pattern values", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            POSPatternOptionArbitrary,
            EntityPatternOptionArbitrary,
            LiteralPatternOptionArbitrary,
            PatternElementArbitrary,
            PatternArbitrary,
          ]),
          ([posOption, entityOption, literalOption, patternElement, pattern]) => {
            const decodedPOSOption = Effect.runSync(decodePOSPatternOption(posOption));
            const decodedEntityOption = Effect.runSync(decodeEntityPatternOption(entityOption));
            const decodedLiteralOption = Effect.runSync(decodeLiteralPatternOption(literalOption));
            const encodedElement = Effect.runSync(encodePatternElement(patternElement));
            const decodedElement = Effect.runSync(decodePatternElement(encodedElement));
            const decodedPattern = Pattern.decode(Pattern.encode(pattern));

            expect(decodedPOSOption).toEqual(posOption);
            expect(decodedEntityOption).toEqual(entityOption);
            expect(decodedLiteralOption).toEqual(literalOption);
            expect(decodedElement).toEqual(patternElement);
            expect(decodedPattern).toEqual(pattern);
            expect(Pattern.is(decodedPattern)).toBe(true);
            expect(Pattern.POS.toBracketString(decodedPOSOption)).toEqual(expect.stringMatching(/^\[.*\]$/s));
            expect(Pattern.Entity.toBracketString(decodedEntityOption)).toEqual(expect.stringMatching(/^\[.*\]$/s));
            expect(Pattern.Literal.toBracketString(decodedLiteralOption)).toEqual(expect.stringMatching(/^\[.*\]$/s));

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("parses mixed pattern strings in order", () => {
    const elements = PatternFromString(["[ADJ|NOUN]", "[DATE]", "[|the]"]);
    const nounElement = PatternFromString(["[NOUN]"]);

    expect(elements).toHaveLength(3);
    expect(elements[0]?._tag).toBe("POSPatternElement");
    expect(elements[1]?._tag).toBe("EntityPatternElement");
    expect(elements[2]?._tag).toBe("LiteralPatternElement");
    expect(nounElement[0]?._tag).toBe("POSPatternElement");
  });

  it("rejects all-empty pattern options at the schema boundary", () => {
    expect(() => decodePOSPatternOptionSync([""])).toThrow();
    expect(() => decodeEntityPatternOptionSync([""])).toThrow();
    expect(() => decodeLiteralPatternOptionSync([""])).toThrow();
  });

  it("rejects reserved literal choices that would collide with typed bracket syntax", () => {
    expect(() => literal("DATE")).toThrow();
    expect(() => decodeBracketStringToLiteralPatternElementSync("[DATE]")).toThrow();
  });

  it("supports Pattern schema helpers", () => {
    const pattern = make("money-amount", [literal("$"), entity("CARDINAL"), literal("million", "billion")]);
    const encoded = Pattern.encode(pattern);
    const decoded = Pattern.decode(encoded);

    expect(Pattern.is(pattern)).toBe(true);
    expect(decoded.id).toBe("money-amount");
    expect(Chunk.size(decoded.elements)).toBe(3);
  });
});
