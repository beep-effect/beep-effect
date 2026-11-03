/** Data-only lowering of the pinned tokenizer's Python regex grammar.
 * Native compilation and execution remain inside the owned worker.
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
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationRegexAlphabetText, CitationRegexAtomInterval, CitationRegexAtomSets } from "./RegexAlphabet.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import {
  CitationRegexPointRange,
  complementCitationRegexRanges,
  makeCitationRegexPointSets,
  normalizeCitationRegexRanges,
} from "./RegexPointSets.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexProgram");
const max = CitationEngineAbsoluteMaxima;
const Limits = S.toType(CitationEngineLimits);
const sameSets = S.toEquivalence(CitationRegexAtomSets);
const Flags = LiteralKit([0, 2]).pipe(
  $I.annoteSchema("Flags", { description: "Captured source flag domain; Unicode is implicit." })
);
const Kind = LiteralKit(["atom", "open", "close", "alternative", "begin", "end", "end-strict", "repeat"]).pipe(
  $I.annoteSchema("Kind", { description: "Closed structural program tokens; no raw executable regex fragment." })
);
const Count = S.Natural.check(S.isLessThanOrEqualTo(0xfffffffe)).pipe(
  $I.annoteSchema("Count", { description: "Python's finite repeat count domain, below MAXREPEAT." })
);
const Maximum = S.Union([Count, S.Literal("unbounded")]).pipe(
  $I.annoteSchema("Maximum", { description: "Finite repeat maximum or explicit unbounded repetition." })
);
const identifier = (name: string) => {
  for (let index = 0; index < Str.length(name); index++) {
    const point = O.getOrElse(Str.codePointAt(name, index), () => -1);
    if (
      !(
        (point >= 65 && point <= 90) ||
        (point >= 97 && point <= 122) ||
        point === 95 ||
        (index > 0 && point >= 48 && point <= 57)
      )
    )
      return false;
  }
  return true;
};
const Name = S.String.check(
  S.isMaxLength(max.patternUtf16),
  S.makeFilter(
    identifier,
    $I.annote("GroupIdentifier", { description: "Empty structure name or an ASCII group identifier." })
  )
).pipe(
  $I.annoteSchema("Name", { description: "Compiler-validated ASCII capture name, or empty for unnamed structure." })
);
/** @internal @category models @since 0.0.0 */
export class CitationRegexProgramToken extends S.Opaque<CitationRegexProgramToken, { readonly brand: unique symbol }>()(
  S.Struct({ kind: Kind, value: Count, maximum: Maximum, name: Name, lazy: S.Boolean })
    .check(
      S.makeFilter(
        (token) => {
          if (token.kind !== "open" && Str.isNonEmpty(token.name)) return false;
          if (token.kind === "repeat") return token.maximum === "unbounded" || token.maximum >= token.value;
          if (token.maximum !== 0 || token.lazy) return false;
          if (token.kind === "open")
            return token.value <= max.patternUtf16 && (token.value > 0 || Str.isEmpty(token.name));
          if (token.kind === "atom" || token.kind === "end") return token.value < max.patternUtf16;
          return token.value === 0;
        },
        $I.annote("CanonicalToken", {
          description: "Unused token fields have canonical values; repeat bounds and group identities remain explicit.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexProgramToken", {
        description: "Bounded atom/group/anchor/repeat data. Decoding this token grants no native execution authority.",
      })
    )
) {}
const Floor = S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16 + 1)).pipe(
  $I.annoteSchema("Floor", {
    description: "Minimum consumed-point lower bound, saturated above the absolute source ceiling.",
  })
);
class Summary extends S.Opaque<Summary, { readonly brand: unique symbol }>()(
  S.Struct({
    minimum: Floor,
    captures: S.Boolean,
    repeatedCaptures: S.Boolean,
    nullableMultiRepeat: S.Boolean,
    quantifiable: S.Boolean,
  }).pipe($I.annoteSchema("Summary", { description: "Compositional parser profile; not a semantic execution proof." }))
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexProgram extends S.Opaque<CitationRegexProgram, { readonly brand: unique symbol }>()(
  S.Struct({
    tokens: S.Array(CitationRegexProgramToken).check(S.isMaxLength(4 * max.patternUtf16)),
    sets: CitationRegexAtomSets,
    groups: S.Natural.check(S.isLessThanOrEqualTo(max.patternUtf16)),
    names: S.Record(Name, S.Natural.check(S.isLessThanOrEqualTo(max.patternUtf16))),
    sourceFlags: Flags,
    minimumWidthFloor: Floor,
    repeatedCaptures: S.Boolean,
    nullableMultiRepeat: S.Boolean,
  })
    .check(
      S.makeFilter(
        (program) => {
          let depth = 0;
          let groups = 0;
          let named = 0;
          let quantifiable = false;
          const rows = new Uint32Array(program.sets.atoms);
          const newline = new Uint8Array(program.sets.atoms);
          for (const row of program.sets.intervals) {
            rows[row.atom] = (rows[row.atom] ?? 0) + 1;
            if (row.start === 10 && row.end === 10) newline[row.atom] = 1;
          }
          for (const token of program.tokens) {
            if (token.kind === "open") {
              depth++;
              quantifiable = false;
              if (token.value > 0) {
                if (token.value !== ++groups) return false;
              }
              if (Str.isNonEmpty(token.name)) {
                named++;
                const group = R.get(program.names, token.name);
                if (O.isNone(group) || group.value !== token.value) return false;
              }
            } else if (token.kind === "close") {
              if (--depth < 0) return false;
              quantifiable = true;
            } else if (token.kind === "repeat") {
              if (!quantifiable) return false;
              quantifiable = false;
            } else if (token.kind === "atom") {
              if (token.value >= program.sets.atoms) return false;
              quantifiable = true;
            } else {
              if (
                token.kind === "end" &&
                (token.value >= program.sets.atoms || rows[token.value] !== 1 || newline[token.value] !== 1)
              )
                return false;
              quantifiable = false;
            }
          }
          return depth === 0 && groups === program.groups && named === A.length(R.keys(program.names));
        },
        $I.annote("ProgramGrammar", {
          description:
            "Balanced groups, sequential capture identities, exact name bindings, valid atom references and LF-anchor predicates.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexProgram", {
        description:
          "Data-only native-point grammar and source profile. Every execution still needs reviewed descriptor admission and worker containment.",
      })
    )
) {}
const ProgramType = S.toType(CitationRegexProgram);
const AlphabetType = S.toType(CitationRegexAlphabetText);
const unsupported = () => CitationRegexTranslationFailure.make({ reason: "unsupported-syntax" });
const budget = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
const asciiLetter = (point: number) => (point >= 65 && point <= 90) || (point >= 97 && point <= 122);
const digit = (point: number) => point >= 48 && point <= 57;
const hex = (point: number) =>
  digit(point) ? point - 48 : point >= 65 && point <= 70 ? point - 55 : point >= 97 && point <= 102 ? point - 87 : -1;
const range = (start: number, end = start) => CitationRegexPointRange.make({ start, end });
const summary = (
  minimum: number,
  captures = false,
  quantifiable = true,
  repeatedCaptures = false,
  nullableMultiRepeat = false
) =>
  Summary.make({
    minimum: Num.min(minimum, max.sourceUtf16 + 1),
    captures,
    quantifiable,
    repeatedCaptures,
    nullableMultiRepeat,
  });
const combine = (left: Summary, right: Summary, alternative: boolean) =>
  summary(
    alternative ? Num.min(left.minimum, right.minimum) : left.minimum + right.minimum,
    left.captures || right.captures,
    true,
    left.repeatedCaptures || right.repeatedCaptures,
    left.nullableMultiRepeat || right.nullableMultiRepeat
  );
type ParseFailure = CitationRegexTranslationFailure | CitationSafetyLimitExceeded;

/** Capture limits and Clock. Parse original native pattern points, not its
 * potentially ambiguous display projection. All returned operations are R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexProgram = Effect.fn("Citation.makeRegexProgram")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(
    Effect.mapError(() => CitationRegexTranslationFailure.make({ reason: "invalid-policy" }))
  );
  const patternInput = yield* makeCitationRegexInput(limits, "pattern");
  const categories = yield* makeCitationRegexPointSets();
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.extractDeadline, limits.operationDeadline);
  const deadlineLimit = Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.extractDeadline)
    ? "operationDeadline"
    : "extractDeadline";
  const timed = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({
        duration: deadline,
        orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation: "extract", limit: deadlineLimit })),
      }),
      Effect.provideService(Clock.Clock, clock)
    );
  const compile = Effect.fn("Citation.compileRegexProgram")(function* (nativePattern: unknown, flagsInput: unknown) {
    const flags = yield* S.decodeUnknownEffect(Flags)(flagsInput).pipe(
      Effect.mapError(() => CitationRegexTranslationFailure.make({ reason: "invalid-input" }))
    );
    const prepared = yield* patternInput
      .prepareUnicode(nativePattern, () => Effect.void)
      .pipe(Effect.catchTag("CitationRegexInputFailure", () => Effect.fail(unsupported())));
    const storage = prepared.value.storage;
    const view = new DataView(storage.bytes.buffer, storage.bytes.byteOffset, storage.bytes.byteLength);
    const length = prepared.value.pythonLength;
    let index = 0;
    const peek = (offset = 0) => {
      const position = index + offset;
      if (position >= length) return -1;
      const byte = position * storage.width;
      return storage.width === 1
        ? view.getUint8(byte)
        : storage.width === 2
          ? view.getUint16(byte, true)
          : view.getUint32(byte, true);
    };
    const tokens = A.empty<CitationRegexProgramToken>();
    const intervals = A.empty<CitationRegexAtomInterval>();
    const atoms = MutableHashMap.empty<string, number>();
    let atomCount = 0;
    let groups = 0;
    let names = R.empty<string, number>();
    const emit = Effect.fnUntraced(function* (
      kind: typeof Kind.Type,
      value = 0,
      name = "",
      maximum: typeof Maximum.Type = 0,
      lazy = false
    ) {
      if (A.length(tokens) >= 4 * limits.patternUtf16) return yield* budget();
      tokens.push(CitationRegexProgramToken.make({ kind, value, name, maximum, lazy }));
    });
    const atom = Effect.fn("Citation.internRegexAtom")(function* (input: ReadonlyArray<CitationRegexPointRange>) {
      const normalized = normalizeCitationRegexRanges(input);
      const key = A.join(
        A.map(normalized, (row) => `${row.start}:${row.end}`),
        ","
      );
      const previous = MutableHashMap.get(atoms, key);
      if (O.isSome(previous)) return previous.value;
      if (atomCount >= limits.patternUtf16 || A.length(intervals) + A.length(normalized) > limits.patternUtf16)
        return yield* budget();
      const id = atomCount++;
      for (const row of normalized)
        intervals.push(CitationRegexAtomInterval.make({ atom: id, start: row.start, end: row.end }));
      MutableHashMap.set(atoms, key, id);
      return id;
    });
    const literal = Effect.fnUntraced(function* (start: number, end = start) {
      return yield* categories.literal(start, end, flags === 2);
    });
    let escapedPoint = -1;
    const escapedLiteral = Effect.fnUntraced(function* (point: number) {
      escapedPoint = point;
      return yield* literal(point);
    });
    const escape = Effect.fn("Citation.readRegexEscape")(function* (inside: boolean) {
      escapedPoint = -1;
      index++;
      const point = peek();
      index++;
      if (point < 0) return yield* unsupported();
      if (point === 100 || point === 68)
        return point === 100 ? categories.digit : complementCitationRegexRanges(categories.digit);
      if (point === 115 || point === 83)
        return point === 115 ? categories.space : complementCitationRegexRanges(categories.space);
      if (point === 119 || point === 87)
        return point === 119 ? categories.word : complementCitationRegexRanges(categories.word);
      if (point === 110) return yield* escapedLiteral(10);
      if (point === 114) return yield* escapedLiteral(13);
      if (point === 116) return yield* escapedLiteral(9);
      if (point === 118) return yield* escapedLiteral(11);
      if (point === 102) return yield* escapedLiteral(12);
      if (point === 97) return yield* escapedLiteral(7);
      if (inside && point === 98) return yield* escapedLiteral(8);
      if (point === 120 || point === 117 || point === 85) {
        const digits = point === 120 ? 2 : point === 117 ? 4 : 8;
        let value = 0;
        for (let count = 0; count < digits; count++) {
          const nibble = hex(peek());
          index++;
          if (nibble < 0) return yield* unsupported();
          value = value * 16 + nibble;
        }
        return yield* escapedLiteral(value);
      }
      if (point < 128 && !asciiLetter(point) && !digit(point)) return yield* escapedLiteral(point);
      return yield* unsupported();
    });
    const characterClass = Effect.fn("Citation.parseRegexClass")(function* () {
      index++;
      const negated = peek() === 94;
      if (negated) index++;
      let values: ReadonlyArray<CitationRegexPointRange> = A.empty();
      const merge = Effect.fnUntraced(function* (part: ReadonlyArray<CitationRegexPointRange>) {
        const next = normalizeCitationRegexRanges(A.appendAll(values, part));
        if (A.length(next) > limits.patternUtf16) return yield* budget();
        values = next;
      });
      let first = true;
      while (peek() !== 93 || first) {
        if (index % 256 === 0) yield* Effect.yieldNow;
        if (peek() < 0) return yield* unsupported();
        first = false;
        let startPoint = peek();
        let start: ReadonlyArray<CitationRegexPointRange>;
        if (startPoint === 92) {
          start = yield* escape(true);
          startPoint = escapedPoint;
        } else {
          index++;
          start = yield* literal(startPoint);
        }
        if (peek() === 45 && peek(1) !== 93 && peek(1) >= 0) {
          index++;
          let endPoint = peek();
          if (endPoint === 92) {
            yield* escape(true);
            endPoint = escapedPoint;
          } else index++;
          if (startPoint < 0 || endPoint < 0 || startPoint > endPoint) return yield* unsupported();
          yield* merge(yield* literal(startPoint, endPoint));
        } else yield* merge(start);
      }
      index++;
      const normalized = normalizeCitationRegexRanges(values);
      return negated ? complementCitationRegexRanges(normalized) : normalized;
    });
    const readNumber = () => {
      let value = 0;
      let digits = 0;
      while (digit(peek())) {
        value = Num.min(0xffffffff, value * 10 + peek() - 48);
        index++;
        digits++;
      }
      return { value, digits };
    };
    const repeat = Effect.fn("Citation.parseRegexRepeat")(function* (body: Summary) {
      const mark = peek();
      if (mark !== 42 && mark !== 43 && mark !== 63 && mark !== 123) return body;
      const saved = index;
      let minimum = mark === 43 ? 1 : 0;
      let maximum: typeof Maximum.Type = mark === 63 ? 1 : "unbounded";
      index++;
      if (mark === 123) {
        const left = readNumber();
        minimum = left.value;
        maximum = left.value;
        if (peek() === 44) {
          index++;
          const right = readNumber();
          maximum = right.digits === 0 ? "unbounded" : right.value;
        } else if (left.digits === 0) {
          index = saved;
          return body;
        }
        if (peek() !== 125) {
          index = saved;
          return body;
        }
        index++;
      }
      if (
        !body.quantifiable ||
        minimum > 0xfffffffe ||
        (maximum !== "unbounded" && (maximum > 0xfffffffe || minimum > maximum))
      )
        return yield* unsupported();
      const lazy = peek() === 63;
      if (lazy) index++;
      if (peek() === 43) return yield* unsupported();
      yield* emit("repeat", minimum, "", maximum, lazy);
      const multiple = maximum === "unbounded" || maximum > 1;
      return summary(
        body.minimum * minimum,
        body.captures,
        true,
        body.repeatedCaptures || (multiple && body.captures),
        body.nullableMultiRepeat || (multiple && body.minimum === 0)
      );
    });
    const parseAtom = Effect.fn("Citation.parseRegexAtom")(function* (): Effect.fn.Return<Summary, ParseFailure> {
      const point = peek();
      if (point === 40) {
        index++;
        let group = 0;
        let name = "";
        if (peek() === 63) {
          index++;
          if (peek() === 58) index++;
          else if (peek() === 80 && peek(1) === 60) {
            index += 2;
            while (peek() !== 62) {
              const next = peek();
              if (!(asciiLetter(next) || next === 95 || (Str.isNonEmpty(name) && digit(next))))
                return yield* unsupported();
              name += String.fromCodePoint(next);
              index++;
            }
            if (Str.isEmpty(name) || R.has(names, name)) return yield* unsupported();
            index++;
            group = ++groups;
            names = R.set(names, name, group);
          } else return yield* unsupported();
        } else group = ++groups;
        yield* emit("open", group, name);
        const body = yield* expression();
        if (peek() !== 41) return yield* unsupported();
        index++;
        yield* emit("close");
        return summary(body.minimum, group > 0 || body.captures, true, body.repeatedCaptures, body.nullableMultiRepeat);
      }
      if (point === 94) {
        index++;
        yield* emit("begin");
        return summary(0, false, false);
      }
      if (point === 36) {
        index++;
        yield* emit("end", yield* atom([range(10)]));
        return summary(0, false, false);
      }
      if (point === 92 && (peek(1) === 65 || peek(1) === 90)) {
        const kind = peek(1) === 65 ? "begin" : "end-strict";
        index += 2;
        yield* emit(kind);
        return summary(0, false, false);
      }
      if (point === 123) yield* repeat(summary(0, false, false));
      if (point < 0 || point === 41 || point === 124 || point === 42 || point === 43 || point === 63)
        return yield* unsupported();
      let values: ReadonlyArray<CitationRegexPointRange>;
      if (point === 91) values = yield* characterClass();
      else if (point === 92) values = yield* escape(false);
      else {
        index++;
        values = point === 46 ? [range(0, 9), range(11, 0x10ffff)] : yield* literal(point);
      }
      yield* emit("atom", yield* atom(values));
      return summary(1);
    });
    const sequence = Effect.fn("Citation.parseRegexSequence")(function* (): Effect.fn.Return<Summary, ParseFailure> {
      let result = summary(0);
      while (peek() >= 0 && peek() !== 41 && peek() !== 124) {
        if (index % 64 === 0) yield* Effect.yieldNow;
        result = combine(result, yield* repeat(yield* parseAtom()), false);
      }
      return result;
    });
    const expression = Effect.fn("Citation.parseRegexAlternative")(function* (): Effect.fn.Return<
      Summary,
      ParseFailure
    > {
      let result = yield* sequence();
      while (peek() === 124) {
        index++;
        yield* emit("alternative");
        result = combine(result, yield* sequence(), true);
      }
      return result;
    });
    const profile = yield* expression();
    if (index !== length) return yield* unsupported();
    // A syntax-only empty program still gets an explicit empty predicate table;
    // it is not admitted as an execution profile by this compiler.
    if (atomCount === 0) yield* atom([]);
    return CitationRegexProgram.make({
      tokens,
      sets: CitationRegexAtomSets.make({ atoms: atomCount, intervals }),
      groups,
      names,
      sourceFlags: flags,
      minimumWidthFloor: profile.minimum,
      repeatedCaptures: profile.repeatedCaptures,
      nullableMultiRepeat: profile.nullableMultiRepeat,
    });
  }, timed);
  const render = Effect.fn("Citation.renderRegexProgram")(function* (
    program: CitationRegexProgram,
    alphabet: CitationRegexAlphabetText
  ) {
    yield* S.decodeEffect(ProgramType, { onExcessProperty: "error" })(program).pipe(Effect.mapError(unsupported));
    yield* S.decodeEffect(AlphabetType, { onExcessProperty: "error" })(alphabet).pipe(Effect.mapError(unsupported));
    if (!sameSets(program.sets, alphabet.sourceSets)) return yield* unsupported();
    let pattern = "";
    let index = 0;
    for (const token of program.tokens) {
      if (index++ % 128 === 0) yield* Effect.yieldNow;
      let fragment = "";
      if (token.kind === "atom") {
        const value = A.get(alphabet.atoms, token.value);
        if (O.isNone(value)) return yield* unsupported();
        fragment = value.value;
      } else if (token.kind === "open")
        fragment = token.value === 0 ? "(?:" : Str.isEmpty(token.name) ? "(" : `(?<${token.name}>`;
      else if (token.kind === "close") fragment = ")";
      else if (token.kind === "alternative") fragment = "|";
      else if (token.kind === "begin") fragment = "^";
      else if (token.kind === "end-strict") fragment = "(?![\\s\\S])";
      else if (token.kind === "end") {
        const value = A.get(alphabet.atoms, token.value);
        if (O.isNone(value)) return yield* unsupported();
        fragment = `(?=${value.value}?(?![\\s\\S]))`;
      } else
        fragment = `{${token.value}${token.maximum === token.value ? "" : `,${token.maximum === "unbounded" ? "" : token.maximum}`}}${token.lazy ? "?" : ""}`;
      if (Str.length(fragment) > limits.patternUtf16 - Str.length(pattern)) return yield* budget();
      pattern += fragment;
    }
    return pattern;
  }, timed);
  return { compile, render };
});
