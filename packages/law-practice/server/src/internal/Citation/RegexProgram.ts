/** Data-only lowering of the pinned tokenizer's Python regex grammar.
 * Verbose lexical behavior follows CPython re and regex V0 _regex_core;
 * PSF/Apache-2.0 and legacy CNRI notices are retained in THIRD_PARTY_NOTICES.md.
 * Native compilation and execution remain inside the owned worker.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationRegexAlphabetText, CitationRegexAtomInterval, CitationRegexAtomSets } from "./RegexAlphabet.ts";
import { CitationRegexSourceFlags } from "./RegexEngine.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import {
  CitationRegexPointRange,
  citationRegexHexDigit,
  complementCitationRegexRanges,
  makeCitationRegexPointSets,
  normalizeCitationRegexRanges,
} from "./RegexPointSets.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexProgram");
const max = CitationEngineAbsoluteMaxima;
const sameSets = S.toEquivalence(CitationRegexAtomSets);
const Flags = CitationRegexSourceFlags;
const Kind = LiteralKit(["atom", "open", "close", "alternative", "begin", "end", "end-strict", "repeat"]).pipe(
  $I.annoteSchema("Kind", { description: "Closed structural program tokens; no raw executable regex fragment." })
);
const Count = S.Natural.check(S.isLessThanOrEqualTo(0xfffffffe)).pipe(
  $I.annoteSchema("Count", { description: "Python's finite repeat count domain, below MAXREPEAT." })
);
const Maximum = S.Union([Count, S.Literal("unbounded")]).pipe(
  $I.annoteSchema("Maximum", { description: "Finite repeat maximum or explicit unbounded repetition." })
);
const namePoint = (text: string) => O.getOrElse(Str.codePointAt(text, 0), () => -1);
const nameStart = (point: number) => (point >= 65 && point <= 90) || (point >= 97 && point <= 122) || point === 95;
const nameRest = (text: string) => nameStart(namePoint(text)) || (namePoint(text) >= 48 && namePoint(text) <= 57);
const identifier = (name: string) =>
  Str.isEmpty(name) || (nameStart(namePoint(name)) && A.every(A.fromIterable(Str.slice(1)(name)), nameRest));
const Name = S.String.check(
  S.isMaxLength(max.patternUtf16),
  S.makeFilter(
    identifier,
    $I.annote("GroupIdentifier", { description: "Empty structure name or an ASCII group identifier." })
  )
).pipe(
  $I.annoteSchema("Name", { description: "Compiler-validated ASCII capture name, or empty for unnamed structure." })
);
const TokenShape = S.Struct({ kind: Kind, value: Count, maximum: Maximum, name: Name, lazy: S.Boolean }).pipe(
  $I.annoteSchema("TokenShape", { description: "Uniform structural token fields before canonical-role checks." })
);
const validOpen = (token: typeof TokenShape.Type) =>
  token.value === 0 ? Str.isEmpty(token.name) : token.value <= max.patternUtf16;
const canonicalToken = (token: typeof TokenShape.Type) => {
  const ordinary = token.maximum === 0 && !token.lazy;
  const structure = ordinary && Str.isEmpty(token.name);
  return Match.value(token.kind).pipe(
    Match.when(
      "repeat",
      () => Str.isEmpty(token.name) && (token.maximum === "unbounded" || token.maximum >= token.value)
    ),
    Match.when("open", () => ordinary && validOpen(token)),
    Match.whenOr("atom", "end", () => structure && token.value < max.patternUtf16),
    Match.orElse(() => structure && token.value === 0)
  );
};
/** @internal @category models @since 0.0.0 */
export class CitationRegexProgramToken extends S.Opaque<CitationRegexProgramToken, { readonly brand: unique symbol }>()(
  TokenShape.check(
    S.makeFilter(
      canonicalToken,
      $I.annote("CanonicalToken", {
        description: "Canonical unused fields, explicit repeat bounds and group identity.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationRegexProgramToken", {
      description: "Bounded structural data, never raw executable regex text or execution authority.",
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
class ClassUnit extends S.Opaque<ClassUnit, { readonly brand: unique symbol }>()(
  S.Struct({
    point: S.Int.check(S.isBetween({ minimum: -1, maximum: 0x10ffff })),
    ranges: S.Array(CitationRegexPointRange),
  }).pipe(
    $I.annoteSchema("ClassUnit", {
      description: "Original literal point or category sentinel with its resolved predicate.",
    })
  )
) {}
class RepeatBounds extends S.Opaque<RepeatBounds, { readonly brand: unique symbol }>()(
  S.Struct({
    minimum: S.Natural.check(S.isLessThanOrEqualTo(0xffffffff)),
    maximum: S.Union([S.Natural.check(S.isLessThanOrEqualTo(0xffffffff)), S.Literal("unbounded")]),
  }).pipe(
    $I.annoteSchema("RepeatBounds", {
      description: "Scanned repeat bounds before semantic validity; includes the overflow sentinel.",
    })
  )
) {}
const validRepeat = (body: Summary, bounds: RepeatBounds) =>
  body.quantifiable &&
  bounds.minimum <= 0xfffffffe &&
  (bounds.maximum === "unbounded" || (bounds.maximum <= 0xfffffffe && bounds.minimum <= bounds.maximum));
const repeatedSummary = (body: Summary, bounds: RepeatBounds) => {
  const multiple = bounds.maximum === "unbounded" || bounds.maximum > 1;
  return summary(
    body.minimum * bounds.minimum,
    body.captures,
    true,
    body.repeatedCaptures || (multiple && body.captures),
    body.nullableMultiRepeat || (multiple && body.minimum === 0)
  );
};
const invalidAtom = (point: number) => point < 0 || A.contains([41, 124, 42, 43, 63], point);
const ProgramShape = S.Struct({
  tokens: S.Array(CitationRegexProgramToken).check(S.isMaxLength(4 * max.patternUtf16)),
  sets: CitationRegexAtomSets,
  groups: S.Natural.check(S.isLessThanOrEqualTo(max.patternUtf16)),
  names: S.Record(Name, S.Natural.check(S.isLessThanOrEqualTo(max.patternUtf16))),
  sourceFlags: Flags,
  minimumWidthFloor: Floor,
  repeatedCaptures: S.Boolean,
  nullableMultiRepeat: S.Boolean,
}).pipe(
  $I.annoteSchema("ProgramShape", { description: "Structural program fields before grammar/capture binding checks." })
);
class GrammarState extends S.Opaque<GrammarState, { readonly brand: unique symbol }>()(
  S.Struct({
    depth: S.Natural,
    groups: S.Natural,
    named: S.Natural,
    quantifiable: S.Boolean,
  }).pipe(
    $I.annoteSchema("GrammarState", {
      description: "Immutable structural validation cursor; no source text or native handle.",
    })
  )
) {}
const openGrammar = (
  state: GrammarState,
  token: CitationRegexProgramToken,
  names: typeof ProgramShape.Type.names
): O.Option<GrammarState> => {
  const groups = token.value === 0 ? state.groups : state.groups + 1;
  if (token.value !== 0 && token.value !== groups) return O.none();
  let named = state.named;
  if (Str.isNonEmpty(token.name)) {
    if (!O.exists(R.get(names, token.name), (group) => group === token.value)) return O.none();
    named++;
  }
  return O.some(GrammarState.make({ depth: state.depth + 1, groups, named, quantifiable: false }));
};
const newlineAtoms = (sets: CitationRegexAtomSets) => {
  const counts = new Uint32Array(sets.atoms);
  const output = new Uint8Array(sets.atoms);
  for (const row of sets.intervals) {
    counts[row.atom] = (counts[row.atom] ?? 0) + 1;
    if (row.start === 10 && row.end === 10) output[row.atom] = 1;
  }
  for (let index = 0; index < output.byteLength; index++) if (counts[index] !== 1) output[index] = 0;
  return output;
};
const grammarStep = (
  state: GrammarState,
  token: CitationRegexProgramToken,
  program: typeof ProgramShape.Type,
  newlines: Uint8Array
): O.Option<GrammarState> =>
  Match.value(token.kind).pipe(
    Match.when("open", () => openGrammar(state, token, program.names)),
    Match.when("close", () =>
      state.depth === 0 ? O.none() : O.some(GrammarState.make({ ...state, depth: state.depth - 1, quantifiable: true }))
    ),
    Match.when("repeat", () =>
      state.quantifiable ? O.some(GrammarState.make({ ...state, quantifiable: false })) : O.none()
    ),
    Match.when("atom", () =>
      token.value < program.sets.atoms ? O.some(GrammarState.make({ ...state, quantifiable: true })) : O.none()
    ),
    Match.when("end", () =>
      token.value < program.sets.atoms && newlines[token.value] === 1
        ? O.some(GrammarState.make({ ...state, quantifiable: false }))
        : O.none()
    ),
    Match.orElse(() => O.some(GrammarState.make({ ...state, quantifiable: false })))
  );
const validGrammar = (program: typeof ProgramShape.Type) => {
  const newlines = newlineAtoms(program.sets);
  let state = GrammarState.make({ depth: 0, groups: 0, named: 0, quantifiable: false });
  for (const token of program.tokens) {
    const next = grammarStep(state, token, program, newlines);
    if (O.isNone(next)) return false;
    state = next.value;
  }
  return state.depth === 0 && state.groups === program.groups && state.named === A.length(R.keys(program.names));
};
/** @internal @category models @since 0.0.0 */
export class CitationRegexProgram extends S.Opaque<CitationRegexProgram, { readonly brand: unique symbol }>()(
  ProgramShape.check(
    S.makeFilter(
      validGrammar,
      $I.annote("ProgramGrammar", {
        description:
          "Balanced groups, sequential capture identities, name bindings, atom references and LF predicates.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationRegexProgram", {
      description:
        "Data-only native-point grammar and profile; execution requires reviewed descriptor admission and containment.",
    })
  )
) {}
const ProgramType = S.toType(CitationRegexProgram);
const AlphabetType = S.toType(CitationRegexAlphabetText);
const unsupported = () => CitationRegexTranslationFailure.make({ reason: "unsupported-syntax" });
const budget = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
const asciiLetter = (point: number) => (point >= 65 && point <= 90) || (point >= 97 && point <= 122);
const digit = (point: number) => point >= 48 && point <= 57;
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

// A render plan measures variable output before constructing it. These closures
// are local implementation values and never enter a worker request or program.
const fixedRender = (text: string) => ({ units: Str.length(text), build: () => text });
const openRender = (token: CitationRegexProgramToken) => {
  if (token.value === 0) return fixedRender("(?:");
  if (Str.isEmpty(token.name)) return fixedRender("(");
  return { units: 4 + Str.length(token.name), build: () => `(?<${token.name}>` };
};
const repeatRender = (token: CitationRegexProgramToken) => {
  const minimum = String(token.value);
  const maximum = token.maximum === "unbounded" ? "" : String(token.maximum);
  const tail = token.maximum === token.value ? "" : `,${maximum}`;
  const lazy = token.lazy ? "?" : "";
  return {
    units: 2 + Str.length(minimum) + Str.length(tail) + Str.length(lazy),
    build: () => `{${minimum}${tail}}${lazy}`,
  };
};
const renderAtom = (alphabet: CitationRegexAlphabetText, token: CitationRegexProgramToken) =>
  Effect.fromOption(A.get(alphabet.atoms, token.value)).pipe(Effect.mapError(unsupported));
const endRender = (atom: string) => {
  const suffix = "?(?![\\s\\S]))";
  return { units: 3 + Str.length(atom) + Str.length(suffix), build: () => `(?=${atom}${suffix}` };
};
const renderToken = (alphabet: CitationRegexAlphabetText, token: CitationRegexProgramToken) =>
  Match.value(token.kind).pipe(
    Match.when("atom", () => renderAtom(alphabet, token).pipe(Effect.map(fixedRender))),
    Match.when("open", () => Effect.succeed(openRender(token))),
    Match.when("close", () => Effect.succeed(fixedRender(")"))),
    Match.when("alternative", () => Effect.succeed(fixedRender("|"))),
    Match.when("begin", () => Effect.succeed(fixedRender("^"))),
    Match.when("end-strict", () => Effect.succeed(fixedRender("(?![\\s\\S])"))),
    Match.when("end", () => renderAtom(alphabet, token).pipe(Effect.map(endRender))),
    Match.when("repeat", () => Effect.succeed(repeatRender(token))),
    Match.exhaustive
  );

/** Capture limits and Clock. Parse original native pattern points, not its
 * potentially ambiguous display projection. All returned operations are R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexProgram = Effect.fn("Citation.makeRegexProgram")(function* (
  policy: unknown,
  engineInput: unknown = "python-re"
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () =>
    CitationRegexTranslationFailure.make({ reason: "invalid-policy" })
  );
  const patternInput = yield* makeCitationRegexInput(limits, "pattern");
  const categories = yield* makeCitationRegexPointSets(engineInput);
  const { timed } = yield* makeCitationRegexTiming(limits, false);

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
    const verbose = (flags & 64) !== 0;
    const whitespace = () => A.some(categories.verboseSpace, (row) => row.start <= peek() && peek() <= row.end);
    const commentStep = () => (categories.engine === "python-re" && peek() === 92 && peek(1) >= 0 ? 2 : 1);
    const skipComment = Effect.fn("Citation.skipVerboseComment")(function* () {
      while (peek() >= 0 && peek() !== 10) {
        if (index % 256 === 0) yield* Effect.yieldNow;
        index += commentStep();
      }
    });
    const skipSpace = Effect.fnUntraced(function* () {
      index++;
      if (index % 256 === 0) yield* Effect.yieldNow;
    });
    const skipIgnored = () =>
      Effect.whileLoop({
        while: () => verbose && (whitespace() || peek() === 35),
        body: () => (peek() === 35 ? skipComment() : skipSpace()),
        step: constVoid,
      });
    const skipNested = () => (categories.engine === "python-regex-v0" ? skipIgnored() : Effect.void);
    let tokens = A.empty<CitationRegexProgramToken>();
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
      return yield* categories.literal(start, end, (flags & 2) !== 0);
    });
    let escapedPoint = -1;
    const escapedLiteral = Effect.fnUntraced(function* (point: number) {
      escapedPoint = point;
      return yield* literal(point);
    });
    const categoryEscape = (point: number) =>
      Match.value(point).pipe(
        Match.when(100, () => categories.digit),
        Match.when(68, () => complementCitationRegexRanges(categories.digit)),
        Match.when(115, () => categories.space),
        Match.when(83, () => complementCitationRegexRanges(categories.space)),
        Match.when(119, () => categories.word),
        Match.orElse(() => complementCitationRegexRanges(categories.word))
      );
    const hexEscape = Effect.fn("Citation.readRegexHexEscape")(function* (point: number, inside: boolean) {
      const digits = Match.value(point).pipe(
        Match.when(120, () => 2),
        Match.when(117, () => 4),
        Match.orElse(() => 8)
      );
      let value = 0;
      for (let count = 0; count < digits; count++) {
        if (!inside) yield* skipNested();
        const nibble = citationRegexHexDigit(peek());
        index++;
        if (nibble < 0) return yield* unsupported();
        value = value * 16 + nibble;
      }
      return yield* escapedLiteral(value);
    });
    const punctuationEscape = Effect.fnUntraced(function* (point: number) {
      if (point >= 128 || (!asciiLetter(point) && !digit(point))) return yield* escapedLiteral(point);
      return yield* unsupported();
    });
    const escape = Effect.fn("Citation.readRegexEscape")(function* (inside: boolean) {
      escapedPoint = -1;
      index++;
      const point = peek();
      index++;
      if (point < 0) return yield* unsupported();
      return yield* Match.value(point).pipe(
        Match.whenOr(100, 68, 115, 83, 119, 87, () => Effect.succeed(categoryEscape(point))),
        Match.when(110, () => escapedLiteral(10)),
        Match.when(114, () => escapedLiteral(13)),
        Match.when(116, () => escapedLiteral(9)),
        Match.when(118, () => escapedLiteral(11)),
        Match.when(102, () => escapedLiteral(12)),
        Match.when(97, () => escapedLiteral(7)),
        Match.when(98, () => (inside ? escapedLiteral(8) : Effect.fail(unsupported()))),
        Match.whenOr(120, 117, 85, () => hexEscape(point, inside)),
        Match.orElse(() => punctuationEscape(point))
      );
    });
    const classUnit = Effect.fn("Citation.readRegexClassUnit")(function* () {
      const point = peek();
      if (point === 92) {
        const ranges = yield* escape(true);
        return ClassUnit.make({ point: escapedPoint, ranges });
      }
      index++;
      const citationResult1 = yield* literal(point);
      return ClassUnit.make({ point, ranges: citationResult1 });
    });
    const rangeAhead = () => peek() === 45 && peek(1) !== 93 && peek(1) >= 0;
    const classPart = Effect.fn("Citation.readRegexClassPart")(function* () {
      const start = yield* classUnit();
      if (!rangeAhead()) return start.ranges;
      index++;
      const end = yield* classUnit();
      if (start.point < 0 || end.point < start.point) return yield* unsupported();
      return yield* literal(start.point, end.point);
    });
    const appendClassPart = Effect.fnUntraced(function* (values: ReadonlyArray<CitationRegexPointRange>) {
      if (peek() < 0) return yield* unsupported();
      const citationResult2 = yield* classPart();
      const next = normalizeCitationRegexRanges(A.appendAll(values, citationResult2));
      if (A.length(next) > limits.patternUtf16) return yield* budget();
      return next;
    });
    const characterClass = Effect.fn("Citation.parseRegexClass")(function* () {
      index++;
      const negated = peek() === 94;
      if (negated) index++;
      let values: ReadonlyArray<CitationRegexPointRange> = A.empty();
      let first = true;
      while (peek() !== 93 || first) {
        if (index % 256 === 0) yield* Effect.yieldNow;
        first = false;
        values = yield* appendClassPart(values);
      }
      index++;
      return negated ? complementCitationRegexRanges(values) : values;
    });
    const readNumber = Effect.fn("Citation.readRegexRepeatNumber")(function* () {
      yield* skipNested();
      let value = 0;
      let digits = 0;
      while (digit(peek())) {
        value = Num.min(0xffffffff, value * 10 + peek() - 48);
        index++;
        digits++;
        yield* skipNested();
      }
      return { value, digits };
    });
    const bracedRepeat = Effect.fn("Citation.readRegexRepeatBounds")(function* () {
      index++;
      const left = yield* readNumber();
      let maximum: typeof Maximum.Type | number = left.value;
      if (peek() === 44) {
        index++;
        const right = yield* readNumber();
        maximum = right.digits === 0 ? "unbounded" : right.value;
      } else if (left.digits === 0) return O.none<RepeatBounds>();
      if (peek() !== 125) return O.none<RepeatBounds>();
      index++;
      return O.some(RepeatBounds.make({ minimum: left.value, maximum }));
    });
    const simpleRepeat = (minimum: number, maximum: typeof Maximum.Type) => {
      index++;
      return O.some(RepeatBounds.make({ minimum, maximum }));
    };
    const rejectUnqualifiedFuzzy = Effect.fn("Citation.rejectUnqualifiedFuzzy")(function* () {
      if (categories.engine !== "python-regex-v0" || peek() !== 123) return;
      index++;
      const prefix = yield* readNumber();
      const reserved = prefix.digits === 0 ? [100, 101, 105, 115] : [100, 105, 115, 60];
      if (A.contains(reserved, peek())) return yield* unsupported();
    });
    const repeatBounds = Effect.fn("Citation.readRegexQuantifier")(function* () {
      const saved = index;
      const bounds = yield* Match.value(peek()).pipe(
        Match.when(42, () => Effect.succeed(simpleRepeat(0, "unbounded"))),
        Match.when(43, () => Effect.succeed(simpleRepeat(1, "unbounded"))),
        Match.when(63, () => Effect.succeed(simpleRepeat(0, 1))),
        Match.when(123, () => bracedRepeat()),
        Match.orElse(() => Effect.succeed(O.none<RepeatBounds>()))
      );
      if (O.isNone(bounds)) {
        index = saved;
        yield* rejectUnqualifiedFuzzy();
        index = saved;
      }
      return bounds;
    });
    // Native optional quantifiers discard captures from an empty iteration.
    // Ordered alternation preserves Python's participating-empty capture.
    const optionalCapture = Effect.fn("Citation.lowerNullableOptionalCapture")(function* (
      start: number,
      lazy: boolean
    ) {
      if (A.length(tokens) + 3 > 4 * limits.patternUtf16) return yield* budget();
      const structural = (kind: "open" | "alternative") =>
        CitationRegexProgramToken.make({ kind, value: 0, name: "", maximum: 0, lazy: false });
      tokens = yield* Effect.fromOption(A.insertAt(tokens, start, structural("open"))).pipe(
        Effect.mapError(unsupported)
      );
      if (lazy) {
        tokens = yield* Effect.fromOption(A.insertAt(tokens, start + 1, structural("alternative"))).pipe(
          Effect.mapError(unsupported)
        );
      } else yield* emit("alternative");
      yield* emit("close");
    });
    const repeat = Effect.fn("Citation.parseRegexRepeat")(function* (body: Summary, start = A.length(tokens)) {
      const parsed = yield* repeatBounds();
      if (O.isNone(parsed)) return body;
      const bounds = parsed.value;
      if (!validRepeat(body, bounds)) return yield* unsupported();
      yield* skipNested();
      const lazy = peek() === 63;
      if (lazy) index++;
      if (peek() === 43) return yield* unsupported();
      const maximum = yield* S.decodeEffect(Maximum)(bounds.maximum).pipe(Effect.mapError(unsupported));
      if (body.minimum === 0 && body.captures && bounds.minimum === 0 && maximum === 1)
        yield* optionalCapture(start, lazy);
      else yield* emit("repeat", bounds.minimum, "", maximum, lazy);
      return repeatedSummary(body, bounds);
    });
    const captureName = Effect.fn("Citation.readRegexCaptureName")(function* () {
      index++;
      let name = "";
      yield* skipNested();
      while (peek() !== 62) {
        const point = peek();
        const valid = Str.isEmpty(name) ? nameStart(point) : nameRest(String.fromCodePoint(Num.max(point, 0)));
        if (!valid) return yield* unsupported();
        name += String.fromCodePoint(point);
        index++;
        yield* skipNested();
      }
      if (Str.isEmpty(name) || R.has(names, name)) return yield* unsupported();
      index++;
      return name;
    });
    const groupHeader = Effect.fn("Citation.readRegexGroupHeader")(function* () {
      if (peek() !== 63) return { group: ++groups, name: "" };
      index++;
      if (peek() === 58) {
        index++;
        return { group: 0, name: "" };
      }
      if (peek() !== 80) {
        yield* skipNested();
        if (peek() !== 58) return yield* unsupported();
        index++;
        return { group: 0, name: "" };
      }
      index++;
      yield* skipNested();
      if (peek() !== 60) return yield* unsupported();
      const name = yield* captureName();
      const group = ++groups;
      names = R.set(names, name, group);
      return { group, name };
    });
    const group = Effect.fn("Citation.parseRegexGroup")(function* (): Effect.fn.Return<Summary, ParseFailure> {
      index++;
      const header = yield* groupHeader();
      yield* emit("open", header.group, header.name);
      const body = yield* expression();
      if (peek() !== 41) return yield* unsupported();
      index++;
      yield* emit("close");
      return summary(
        body.minimum,
        header.group > 0 || body.captures,
        true,
        body.repeatedCaptures,
        body.nullableMultiRepeat
      );
    });
    const anchor = Effect.fn("Citation.parseRegexAnchor")(function* (point: number) {
      if (point === 94) {
        index++;
        yield* emit("begin");
        return summary(0, false, false);
      }
      if (point === 36) {
        index++;
        const citationResult3 = yield* atom([range(10)]);
        yield* emit("end", citationResult3);
        return summary(0, false, false);
      }
      const kind = peek(1) === 65 ? "begin" : "end-strict";
      index += 2;
      yield* emit(kind);
      return summary(0, false, false);
    });
    const characterAtom = Effect.fn("Citation.parseRegexCharacter")(function* (point: number) {
      const values = yield* Match.value(point).pipe(
        Match.when(91, () => characterClass()),
        Match.when(92, () => escape(false)),
        Match.when(46, () => {
          index++;
          return Effect.succeed([range(0, 9), range(11, 0x10ffff)]);
        }),
        Match.orElse(() => {
          index++;
          return literal(point);
        })
      );
      const citationResult4 = yield* atom(values);
      yield* emit("atom", citationResult4);
      return summary(1);
    });
    const parseAtom = Effect.fn("Citation.parseRegexAtom")(function* (): Effect.fn.Return<Summary, ParseFailure> {
      const point = peek();
      if (point === 40) return yield* group();
      if (point === 94 || point === 36) return yield* anchor(point);
      if (point === 92 && (peek(1) === 65 || peek(1) === 90)) return yield* anchor(point);
      if (point === 123) yield* repeat(summary(0, false, false));
      if (invalidAtom(point)) return yield* unsupported();
      return yield* characterAtom(point);
    });
    const sequence = Effect.fn("Citation.parseRegexSequence")(function* (): Effect.fn.Return<Summary, ParseFailure> {
      let result = summary(0);
      yield* skipIgnored();
      while (peek() >= 0 && peek() !== 41 && peek() !== 124) {
        if (index % 64 === 0) yield* Effect.yieldNow;
        const tokenStart = A.length(tokens);
        const citationResult5 = yield* parseAtom();
        yield* skipIgnored();
        const citationResult6 = yield* repeat(citationResult5, tokenStart);
        result = combine(result, citationResult6, false);
        yield* skipIgnored();
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
        const citationResult7 = yield* sequence();
        result = combine(result, citationResult7, true);
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
      const fragment = yield* renderToken(alphabet, token);
      if (fragment.units > limits.patternUtf16 - Str.length(pattern)) return yield* budget();
      pattern += fragment.build();
    }
    return pattern;
  }, timed);
  return { engine: categories.engine, compile, render };
});
