import { makeCitationRegexAlphabet } from "@beep/law-practice-server/internal/Citation/RegexAlphabet";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationRegexProgram,
  makeCitationRegexProgram,
} from "@beep/law-practice-server/internal/Citation/RegexProgram";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const setup = Effect.fn("RegexProgramTest.setup")(function* () {
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const input = yield* makeCitationRegexInput(limits, "pattern");
  const source = yield* makeCitationRegexInput(limits);
  const compiler = yield* makeCitationRegexProgram(limits);
  const alphabet = yield* makeCitationRegexAlphabet(limits);
  const compile = Effect.fn("RegexProgramTest.compile")(function* (text: string, flags = 0) {
    const citationResult1 = yield* input.prepareText(text, () => Effect.void);
    return yield* compiler.compile(citationResult1.value.storage, flags);
  });
  return { limits, input, source, compiler, alphabet, compile };
});

it.effect("preserves names and source profiles while lowering dot and final-LF anchors", () =>
  Effect.gen(function* () {
    const { compile, source, compiler, alphabet } = yield* setup();
    const program = yield* compile("^(?P<identifier>id.)$", 2);
    expect(program.groups).toBe(1);
    expect(program.names).toEqual({ identifier: 1 });
    expect(program.minimumWidthFloor).toBe(3);
    expect(program.repeatedCaptures).toBe(false);
    expect(program.nullableMultiRepeat).toBe(false);
    expect(A.map(program.tokens, (token) => token.kind)).toEqual([
      "begin",
      "open",
      "atom",
      "atom",
      "atom",
      "close",
      "end",
    ]);
    const citationResult2 = yield* source.prepareText("İD\r", () => Effect.void);
    const encoded = yield* alphabet.prepare(program.sets, citationResult2.value.storage);
    const rendered = yield* compiler.render(program, encoded);
    expect(Str.startsWith("^(?<identifier>")(rendered)).toBe(true);
    expect(Str.endsWith(`(?=${A.getUnsafe(encoded.atoms, 3)}?(?![\\s\\S]))`)(rendered)).toBe(true);
    expect(encoded.pythonLength).toBe(3);
    expect(encoded.flags).toBe("dgu");
  })
);

it.effect("interns exact frozen categories and category complements inside and outside classes", () =>
  Effect.gen(function* () {
    const { compile } = yield* setup();
    const program = yield* compile("\\d\\s\\w\\S[\\S]");
    expect(A.map(program.tokens, (token) => token.value)).toEqual([0, 1, 2, 3, 3]);
    expect(program.sets.atoms).toBe(4);
    expect(A.length(A.filter(program.sets.intervals, (row) => row.atom === 0))).toBe(62);
    expect(A.length(A.filter(program.sets.intervals, (row) => row.atom === 1))).toBe(10);
    expect(A.length(A.filter(program.sets.intervals, (row) => row.atom === 2))).toBe(734);
    const citationResult3 = yield* compile("\\w", 2);
    const citationResult4 = yield* compile("\\w", 0);
    expect(citationResult3.sets).toEqual(citationResult4.sets);
    const citationResult5 = yield* compile(`[${Str.repeat(256)("\\w")}]`);
    const citationResult6 = yield* compile("\\w");
    expect(citationResult5.sets).toEqual(citationResult6.sets);
  })
);

it.effect("reports nullable alternatives and repeated captures without granting an execution profile", () =>
  Effect.gen(function* () {
    const { compile } = yield* setup();
    const optional = yield* compile("^(?P<a>x{,3}|y+)(z)?$");
    expect(optional.groups).toBe(2);
    expect(optional.names).toEqual({ a: 1 });
    expect(optional.minimumWidthFloor).toBe(0);
    expect(
      A.map(
        A.filter(optional.tokens, (token) => token.kind === "repeat"),
        (token) => [token.value, token.maximum, token.lazy]
      )
    ).toEqual([
      [0, 3, false],
      [1, "unbounded", false],
      [0, 1, false],
    ]);
    const repeated = yield* compile("(?P<a>a|(?P<b>b))+");
    expect(repeated.repeatedCaptures).toBe(true);
    expect(repeated.minimumWidthFloor).toBe(1);
    const nullable = yield* compile("(?:x?)*");
    expect(nullable.nullableMultiRepeat).toBe(true);
    expect(nullable.minimumWidthFloor).toBe(0);
    const citationResult7 = yield* compile("a+?");
    expect(citationResult7.tokens[1]?.lazy).toBe(true);
  })
);

it.effect("folds original ASCII range endpoints before complementing, including escaped endpoints", () =>
  Effect.gen(function* () {
    const { compile } = yield* setup();
    const positive = yield* compile("[\\x41-\\u005a]", 2);
    expect(A.map(positive.sets.intervals, (row) => [row.start, row.end])).toEqual([
      [65, 90],
      [97, 122],
      [304, 305],
      [383, 383],
      [8490, 8490],
    ]);
    const negative = yield* compile("[^\\x41-\\u005a]", 2);
    expect(A.map(negative.sets.intervals, (row) => [row.start, row.end])).toEqual([
      [0, 64],
      [91, 96],
      [123, 303],
      [306, 382],
      [384, 8489],
      [8491, 0x10ffff],
    ]);
    const universe = yield* compile("[\\U00000000-\\U0010ffff]");
    expect(A.map(universe.sets.intervals, (row) => [row.start, row.end])).toEqual([[0, 0x10ffff]]);
  })
);

it.effect("parses distinct native pattern words even when their display projections coincide", () =>
  Effect.gen(function* () {
    const { compiler } = yield* setup();
    const pair = yield* compiler.compile({ width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) }, 0);
    const scalar = yield* compiler.compile({ width: 4, bytes: new Uint8Array([0xce, 0xd7, 1, 0]) }, 0);
    expect(pair.minimumWidthFloor).toBe(2);
    expect(scalar.minimumWidthFloor).toBe(1);
    expect(A.map(pair.sets.intervals, (row) => row.start)).toEqual([0xd835, 0xdfce]);
    expect(A.map(scalar.sets.intervals, (row) => row.start)).toEqual([0x1d7ce]);
  })
);

it.effect("rejects unsupported or invalid source syntax and preserves literal unmatched punctuation", () =>
  Effect.gen(function* () {
    const { compile } = yield* setup();
    for (const pattern of [
      "(",
      "[",
      "a{3,2}",
      "a{4294967295}",
      "a**",
      "a{2}{3}",
      "{3}",
      "^+",
      "(?P<a>x)(?P<a>y)",
      "(?=x)",
      "\\U00110000",
      "[\\d-z]",
    ]) {
      const citationResult20 = yield* compile(pattern).pipe(Effect.flip);
      expect(citationResult20).toMatchObject({ reason: "unsupported-syntax" });
    }
    const citationResult8 = yield* compile("é", 2).pipe(Effect.flip);
    expect(citationResult8).toMatchObject({ reason: "unsupported-syntax" });
    const citationResult9 = yield* compile("ch\\[.,]");
    expect(citationResult9.minimumWidthFloor).toBe(6);
    const citationResult10 = yield* compile("a{broken]");
    expect(citationResult10.minimumWidthFloor).toBe(9);
    const citationResult11 = yield* compile("\\A[a-]\\Z");
    expect(citationResult11.minimumWidthFloor).toBe(1);
  })
);

it.effect("charges pattern source, interval expansion and final rendering independently", () =>
  Effect.gen(function* () {
    const { limits, input, alphabet } = yield* setup();
    const compiler = yield* makeCitationRegexProgram({ ...limits, patternUtf16: 2 });
    const citationResult12 = yield* input.prepareText("abc", () => Effect.void);
    const citationResult13 = yield* compiler.compile(citationResult12.value.storage, 0).pipe(Effect.flip);
    expect(citationResult13).toMatchObject({ limit: "patternUtf16" });
    const citationResult14 = yield* input.prepareText("\\w", () => Effect.void);
    const citationResult15 = yield* compiler.compile(citationResult14.value.storage, 0).pipe(Effect.flip);
    expect(citationResult15).toMatchObject({ limit: "patternUtf16" });
    const citationResult16 = yield* input.prepareText("x", () => Effect.void);
    const program = yield* compiler.compile(citationResult16.value.storage, 0);
    const encoded = yield* alphabet.prepare(program.sets, { width: 1, bytes: new Uint8Array(0) });
    const citationResult17 = yield* compiler.render(program, encoded).pipe(Effect.flip);
    expect(citationResult17).toMatchObject({ limit: "patternUtf16" });
  })
);

it.effect("binds rendering to the original complete atom descriptor", () =>
  Effect.gen(function* () {
    const { compile, compiler, alphabet } = yield* setup();
    const left = yield* compile("x");
    const right = yield* compile("y");
    const encoded = yield* alphabet.prepare(right.sets, { width: 1, bytes: new Uint8Array(0) });
    const citationResult18 = yield* compiler.render(left, encoded).pipe(Effect.flip);
    expect(citationResult18).toMatchObject({ reason: "unsupported-syntax" });
  })
);

it.effect("owns malformed grammar, capture bindings and LF predicates in its structured codec", () =>
  Effect.gen(function* () {
    const { compile } = yield* setup();
    const program = yield* compile("(?P<value>x)$");
    const invalid = [
      { ...program, groups: 2 },
      { ...program, names: { other: 1 } },
      { ...program, tokens: A.filter(program.tokens, (token) => token.kind !== "close") },
      { ...program, tokens: A.map(program.tokens, (token) => (token.kind === "end" ? { ...token, value: 0 } : token)) },
      {
        ...program,
        tokens: A.map(program.tokens, (token) => (token.kind === "open" ? { ...token, name: "invalid>name" } : token)),
      },
    ];
    for (const value of invalid) {
      const citationResult21 = yield* S.decodeEffect(CitationRegexProgram)(value).pipe(Effect.flip);
      expect(citationResult21).toBeDefined();
    }
  })
);

it.effect("captures the compiler Clock and equal-deadline operation priority", () =>
  Effect.gen(function* () {
    const { limits, input } = yield* setup();
    const clock = yield* Clock.Clock;
    const immediate: Clock.Clock = { ...clock, sleep: () => Effect.void };
    const disabled: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const compiler = yield* makeCitationRegexProgram({
      ...limits,
      extractDeadline: Duration.millis(10),
      operationDeadline: Duration.millis(10),
    }).pipe(Effect.provideService(Clock.Clock, immediate));
    const source = (yield* input.prepareText("abc", () => Effect.void)).value.storage;
    const citationResult19 = yield* compiler
      .compile(source, 0)
      .pipe(Effect.provideService(Clock.Clock, disabled), Effect.flip);
    expect(citationResult19).toMatchObject({ operation: "extract", limit: "operationDeadline" });
  })
);
