/**
 * Data-only translation of the pinned tokenizer's reviewed Python re syntax.
 * Source behavior: eyecite 2.7.6 models.TokenExtractor, Free Law Project,
 * BSD-2-Clause; see THIRD_PARTY_NOTICES.md. Native compilation/evaluation belong
 * exclusively to the owned regex child, never this responsive parent stage.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { citationPythonRegexData } from "./PythonRegexData.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexTranslator");
const Limits = S.toType(CitationEngineLimits);
const Reason = LiteralKit(["invalid-policy", "invalid-input", "unsupported-syntax"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Redacted private translation failures; unsupported syntax is never silently reinterpreted.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRegexTranslationFailure extends S.TaggedError<
  CitationRegexTranslationFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexTranslationFailure`)(
  "CitationRegexTranslationFailure",
  { reason: Reason },
  $I.annoteError<CitationRegexTranslationFailure>("CitationRegexTranslationFailure", {
    description: "Pattern translation failed without retaining a pattern, source text or nested cause.",
  })
) {}
const SourceFlags = LiteralKit([0, 2]).pipe(
  $I.annoteSchema("SourceFlags", {
    description: "The complete captured tokenizer flag domain: default Unicode or Unicode ignore-case.",
  })
);
const TargetFlags = LiteralKit(["dgu", "dgiu"]).pipe(
  $I.annoteSchema("TargetFlags", {
    description: "Native Unicode iteration and capture indices, with optional reviewed ASCII ignore-case adaptation.",
  })
);
const Pattern = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.patternUtf16)).pipe(
  $I.annoteSchema("Pattern", {
    description: "Bounded translated pattern text; native execution remains isolated.",
  })
);
const Input = S.Struct({ pattern: S.String, flags: SourceFlags }).pipe(
  $I.annoteSchema("Input", { description: "Private server pattern descriptor, never a function-valued raw request." })
);
/** @internal @category models @since 0.0.0 */
export class CitationTranslatedRegex extends S.Opaque<CitationTranslatedRegex, { readonly brand: unique symbol }>()(
  S.Struct({ pattern: Pattern, flags: TargetFlags }).pipe(
    $I.annoteSchema("CitationTranslatedRegex", {
      description:
        "Bounded translated pattern data. This is not a compilation, source-family approval or execution authority.",
    })
  )
) {}
const point = (text: string, index: number) => O.getOrElse(Str.codePointAt(text, index), () => -1);
const asciiLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const asciiDigit = (code: number) => code >= 48 && code <= 57;
const fail = (reason: CitationRegexTranslationFailure["reason"]) => CitationRegexTranslationFailure.make({ reason });
const budget = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
const categoryBody = (escaped: number) =>
  Match.value(escaped).pipe(
    Match.when(100, () => citationPythonRegexData.digitClass),
    Match.whenOr(115, 83, () => citationPythonRegexData.spaceClass),
    Match.when(119, () => citationPythonRegexData.wordClass),
    Match.orElse(() => "")
  );
const spansI = (before: number, after: number) => (before <= 73 && after >= 73) || (before <= 105 && after >= 105);
const iRangeAt = (text: string, index: number) =>
  index > 0 && index + 1 < Str.length(text) && spansI(point(text, index - 1), point(text, index + 1));
const isI = (point: number) => point === 73 || point === 105;
const classHasI = (text: string) => {
  for (let index = 0; index < Str.length(text); index++) {
    const current = point(text, index);
    if (current === 92) {
      index++;
      continue;
    }
    if (isI(current)) return true;
    if (current === 45 && iRangeAt(text, index)) return true;
  }
  return false;
};
/** Capture explicit limits; returned translation is R = never. Charge each output
 * fragment before retaining it, including frozen Unicode class expansion. This
 * stage does not compile regexes or claim to parse arbitrary Python extensions.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexTranslator = Effect.fn("Citation.makeRegexTranslator")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(() => fail("invalid-policy")));
  const translate = Effect.fn("Citation.translateRegex")(function* (input: unknown) {
    const source = yield* S.decodeUnknownEffect(Input)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    if (Str.length(source.pattern) > limits.patternUtf16) return yield* budget();
    const insensitive = source.flags === 2;
    let output = Chunk.empty<string>();
    let units = 0;
    let index = 0;
    let classStart = O.none<number>();
    const emitBuild = Effect.fnUntraced(function* (length: number, build: () => string) {
      if (length > limits.patternUtf16 - units) return yield* budget();
      units += length;
      const fragment = build();
      if (Str.length(fragment) !== length) return yield* Effect.die("regex fragment length invariant failed");
      output = Chunk.append(output, fragment);
    });
    const emit = Effect.fnUntraced(function* (text: string) {
      yield* emitBuild(Str.length(text), () => text);
    });
    const emitCategory = Effect.fnUntraced(function* (escaped: number, body: string, inside: boolean) {
      if ((escaped === 83 && inside) || (escaped === 119 && insensitive)) return yield* fail("unsupported-syntax");
      if (inside) yield* emit(body);
      else yield* emitBuild(Str.length(body) + (escaped === 83 ? 3 : 2), () => `[${escaped === 83 ? "^" : ""}${body}]`);
    });
    const emitEscapeLiteral = Effect.fnUntraced(function* (escaped: number) {
      if (escaped === 110) yield* emit("\\x0a");
      else if (escaped === 92) yield* emit("\\\\");
      else if (escaped < 128 && !asciiLetter(escaped) && !asciiDigit(escaped)) {
        // All escaped punctuation in the captured source is an ASCII literal.
        yield* emitBuild(4, () => `\\x${escaped < 16 ? "0" : ""}${escaped.toString(16)}`);
      } else return yield* fail("unsupported-syntax");
    });
    const escape = Effect.fn("Citation.translateRegexEscape")(function* (inside: boolean) {
      const escaped = point(source.pattern, index + 1);
      if (escaped < 0) return yield* fail("unsupported-syntax");
      const body = categoryBody(escaped);
      if (Str.isNonEmpty(body)) yield* emitCategory(escaped, body, inside);
      else yield* emitEscapeLiteral(escaped);
      index += 2;
    });
    const namedGroup = Effect.fn("Citation.translateRegexGroupName")(function* () {
      let end = index + 4;
      while (end < Str.length(source.pattern) && point(source.pattern, end) !== 62) {
        const nameCode = point(source.pattern, end);
        if (!(asciiLetter(nameCode) || nameCode === 95 || (end > index + 4 && asciiDigit(nameCode))))
          return yield* fail("unsupported-syntax");
        end++;
      }
      if (end === index + 4 || point(source.pattern, end) !== 62) return yield* fail("unsupported-syntax");
      yield* emitBuild(end - index, () => `(?<${Str.slice(index + 4, end)(source.pattern)}>`);
      index = end + 1;
    });
    const quantifier = Effect.fn("Citation.translateRegexQuantifier")(function* () {
      let end = index + 1;
      while (asciiDigit(point(source.pattern, end))) end++;
      if (point(source.pattern, end) === 44) {
        end++;
        while (asciiDigit(point(source.pattern, end))) end++;
      }
      if (point(source.pattern, end) !== 125) return yield* fail("unsupported-syntax");
      const omitted = point(source.pattern, index + 1) === 44;
      yield* emitBuild(
        end - index + 1 + (omitted ? 1 : 0),
        () => `{${omitted ? "0" : ""}${Str.slice(index + 1, end)(source.pattern)}}`
      );
      index = end + 1;
    });
    const closeClass = Effect.fnUntraced(function* () {
      if (O.isSome(classStart)) {
        if (insensitive && classHasI(Str.slice(classStart.value, index)(source.pattern))) yield* emit("İı");
        classStart = O.none();
        yield* emit("]");
      } else yield* emit("\\x5d");
      index++;
    });
    const openClass = Effect.fnUntraced(function* () {
      classStart = O.some(index + 1);
      yield* emit("[");
      index++;
    });
    const originalCharacter = Effect.fnUntraced(function* (code: number) {
      const width = code > 0xffff ? 2 : 1;
      yield* emitBuild(width, () => Str.slice(index, index + width)(source.pattern));
    });
    const outsideCharacter = Effect.fnUntraced(function* (code: number) {
      yield* Match.value(code).pipe(
        Match.when(46, () => emit("[^\\n]")),
        Match.when(36, () => emit("(?=\\n?(?![\\s\\S]))")),
        Match.whenOr(73, 105, () => (insensitive ? emit("[iİı]") : originalCharacter(code))),
        Match.orElse(() => originalCharacter(code))
      );
    });
    const character = Effect.fnUntraced(function* (code: number, inside: boolean) {
      if (inside) yield* originalCharacter(code);
      else yield* outsideCharacter(code);
      index += code > 0xffff ? 2 : 1;
    });
    const group = Effect.fnUntraced(function* (code: number, inside: boolean) {
      if (Str.slice(index, index + 4)(source.pattern) === "(?P<") return yield* namedGroup();
      if (point(source.pattern, index + 1) === 63) {
        const kind = point(source.pattern, index + 2);
        if (kind !== 58 && kind !== 61 && kind !== 33) return yield* fail("unsupported-syntax");
      }
      yield* character(code, inside);
    });
    const step = Effect.fnUntraced(function* () {
      const code = point(source.pattern, index);
      const inside = O.isSome(classStart);
      if (insensitive && code > 127 && code !== 0x2013 && code !== 0x2014) return yield* fail("unsupported-syntax");
      yield* Match.value(code).pipe(
        Match.when(92, () => escape(inside)),
        Match.when(93, () => closeClass()),
        Match.when(91, () => (inside ? character(code, inside) : openClass())),
        Match.when(40, () => (inside ? character(code, inside) : group(code, inside))),
        Match.when(123, () => (inside ? character(code, inside) : quantifier())),
        Match.orElse(() => character(code, inside))
      );
    });
    while (index < Str.length(source.pattern)) {
      if (index % 256 === 0) yield* Effect.yieldNow;
      yield* step();
    }
    if (O.isSome(classStart)) return yield* fail("unsupported-syntax");
    return CitationTranslatedRegex.make({
      pattern: A.join(A.fromIterable(output), ""),
      flags: insensitive ? "dgiu" : "dgu",
    });
  });
  return { translate };
});
