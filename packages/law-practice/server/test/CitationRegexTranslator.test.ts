import { citationPythonRegexData } from "@beep/law-practice-server/internal/Citation/PythonRegexData";
import { makeCitationRegexTranslator } from "@beep/law-practice-server/internal/Citation/RegexTranslator";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

it.effect("translates named groups without altering names and preserves Python dot/end semantics", () =>
  Effect.gen(function* () {
    const citationResult1 = yield* defaultCitationEnginePolicy;
    const translator = yield* makeCitationRegexTranslator(citationResult1.limits);
    const citationResult2 = yield* translator.translate({ pattern: "(?P<identifier>id.)$", flags: 2 });
    expect(citationResult2).toEqual({
      pattern: "(?<identifier>[iİı]d[^\\n])(?=\\n?(?![\\s\\S]))",
      flags: "dgiu",
    });
    const citationResult3 = yield* translator.translate({ pattern: "[(?P<identifier>)]", flags: 0 });
    expect(citationResult3).toEqual({
      pattern: "[(?P<identifier>)]",
      flags: "dgu",
    });
  })
);

it.effect("uses exhaustive frozen classes instead of host Unicode properties", () =>
  Effect.gen(function* () {
    const citationResult4 = yield* defaultCitationEnginePolicy;
    const translator = yield* makeCitationRegexTranslator(citationResult4.limits);
    for (const [escape, body] of [
      ["d", citationPythonRegexData.digitClass],
      ["s", citationPythonRegexData.spaceClass],
      ["w", citationPythonRegexData.wordClass],
    ]) {
      const citationResult5 = yield* translator.translate({ pattern: `\\${escape}`, flags: 0 });
      expect(citationResult5).toEqual({
        pattern: `[${body}]`,
        flags: "dgu",
      });
      const citationResult6 = yield* translator.translate({ pattern: `[\\${escape},]`, flags: 0 });
      expect(citationResult6).toEqual({
        pattern: `[${body},]`,
        flags: "dgu",
      });
    }
    const citationResult7 = yield* translator.translate({ pattern: "\\S", flags: 0 });
    expect(citationResult7).toEqual({
      pattern: `[^${citationPythonRegexData.spaceClass}]`,
      flags: "dgu",
    });
  })
);

it.effect("adapts ASCII ignore-case classes only when their literal/range includes I", () =>
  Effect.gen(function* () {
    const citationResult8 = yield* defaultCitationEnginePolicy;
    const translator = yield* makeCitationRegexTranslator(citationResult8.limits);
    for (const [source, expected] of [
      ["[^a-zA-Z0-9]", "[^a-zA-Z0-9İı]"],
      ["[H-J]", "[H-Jİı]"],
      ["[a\\-z]", "[a\\x2dz]"],
      ["[.,]", "[.,]"],
      ["[i]", "[iİı]"],
    ]) {
      const citationResult9 = yield* translator.translate({ pattern: source, flags: 2 });
      expect(citationResult9.pattern).toBe(expected);
    }
  })
);

it.effect("preserves literal unmatched closing brackets, class literals and escaped backslashes", () =>
  Effect.gen(function* () {
    const citationResult10 = yield* defaultCitationEnginePolicy;
    const translator = yield* makeCitationRegexTranslator(citationResult10.limits);
    const citationResult11 = yield* translator.translate({ pattern: "ch\\[.,]", flags: 0 });
    expect(citationResult11.pattern).toBe("ch\\x5b[^\\n],\\x5d");
    const citationResult12 = yield* translator.translate({ pattern: "x{,3}[{,3}]\\\\d", flags: 0 });
    expect(citationResult12.pattern).toBe("x{0,3}[{,3}]\\\\d");
  })
);

it.effect("charges expanded output before retaining it and allows exact budget equality", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const smallPolicy = { ...base, patternUtf16: 10 };
    const small = yield* makeCitationRegexTranslator(smallPolicy);
    smallPolicy.patternUtf16 = 4096;
    const citationResult13 = yield* small.translate({ pattern: "\\w", flags: 0 }).pipe(Effect.flip);
    expect(citationResult13).toMatchObject({
      operation: "extract",
      limit: "patternUtf16",
    });
    const exact = yield* makeCitationRegexTranslator({
      ...base,
      patternUtf16: Str.length(citationPythonRegexData.wordClass) + 2,
    });
    const citationResult14 = yield* exact.translate({ pattern: "\\w", flags: 0 });
    expect(citationResult14.pattern).toBe(`[${citationPythonRegexData.wordClass}]`);
    const citationResult15 = yield* small.translate({ pattern: "12345678901", flags: 0 }).pipe(Effect.flip);
    expect(citationResult15).toMatchObject({
      limit: "patternUtf16",
    });
    const citationResult16 = yield* small.translate({ pattern: Str.repeat(8193)("x"), flags: 0 }).pipe(Effect.flip);
    expect(citationResult16).toMatchObject({
      operation: "extract",
      limit: "patternUtf16",
    });
  })
);

it.effect("rejects unsupported syntax and flags without silently changing meaning", () =>
  Effect.gen(function* () {
    const citationResult17 = yield* defaultCitationEnginePolicy;
    const translator = yield* makeCitationRegexTranslator(citationResult17.limits);
    for (const pattern of ["\\D", "\\1", "[\\S]", "(?i)x", "(?P<>x)", "[x", "x{bad}", "\\"]) {
      const citationResult18 = yield* translator.translate({ pattern, flags: 0 }).pipe(Effect.flip);
      expect(citationResult18).toMatchObject({
        reason: "unsupported-syntax",
      });
    }
    for (const pattern of ["Ω", "\\w"]) {
      const citationResult19 = yield* translator.translate({ pattern, flags: 2 }).pipe(Effect.flip);
      expect(citationResult19).toMatchObject({
        reason: "unsupported-syntax",
      });
    }
    const citationResult20 = yield* translator.translate({ pattern: "x", flags: 8 }).pipe(Effect.flip);
    expect(citationResult20).toMatchObject({
      reason: "invalid-input",
    });
    const citationResult21 = yield* makeCitationRegexTranslator({}).pipe(Effect.flip);
    expect(citationResult21).toMatchObject({ reason: "invalid-policy" });
  })
);

it.effect("retains ordinary and assertion groups, leading repeat digits and escaped LF", () =>
  Effect.gen(function* () {
    const policy = yield* defaultCitationEnginePolicy;
    const translator = yield* makeCitationRegexTranslator(policy.limits);
    const translated = yield* translator.translate({ pattern: "(?:x{12,34})(?=y)(?!z)(a)\\n", flags: 0 });
    expect(translated).toEqual({ pattern: "(?:x{12,34})(?=y)(?!z)(a)\\x0a", flags: "dgu" });
    for (const pattern of ["(?P<1bad>x)", "(?P<a-b>x)"]) {
      const failure = yield* translator.translate({ pattern, flags: 0 }).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "unsupported-syntax" });
    }
  })
);
