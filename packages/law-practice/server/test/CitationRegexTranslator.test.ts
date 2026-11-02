import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { citationPythonRegexData } from "../src/internal/Citation/PythonRegexData.ts";
import { makeCitationRegexTranslator } from "../src/internal/Citation/RegexTranslator.ts";

it.effect("translates named groups without altering names and preserves Python dot/end semantics", () =>
  Effect.gen(function* () {
    const translator = yield* makeCitationRegexTranslator((yield* defaultCitationEnginePolicy).limits);
    expect(yield* translator.translate({ pattern: "(?P<identifier>id.)$", flags: 2 })).toEqual({
      pattern: "(?<identifier>[iİı]d[^\\n])(?=\\n?(?![\\s\\S]))",
      flags: "dgiu",
    });
    expect(yield* translator.translate({ pattern: "[(?P<identifier>)]", flags: 0 })).toEqual({
      pattern: "[(?P<identifier>)]",
      flags: "dgu",
    });
  })
);

it.effect("uses exhaustive frozen classes instead of host Unicode properties", () =>
  Effect.gen(function* () {
    const translator = yield* makeCitationRegexTranslator((yield* defaultCitationEnginePolicy).limits);
    for (const [escape, body] of [
      ["d", citationPythonRegexData.digitClass],
      ["s", citationPythonRegexData.spaceClass],
      ["w", citationPythonRegexData.wordClass],
    ]) {
      expect(yield* translator.translate({ pattern: `\\${escape}`, flags: 0 })).toEqual({
        pattern: `[${body}]`,
        flags: "dgu",
      });
      expect(yield* translator.translate({ pattern: `[\\${escape},]`, flags: 0 })).toEqual({
        pattern: `[${body},]`,
        flags: "dgu",
      });
    }
    expect(yield* translator.translate({ pattern: "\\S", flags: 0 })).toEqual({
      pattern: `[^${citationPythonRegexData.spaceClass}]`,
      flags: "dgu",
    });
  })
);

it.effect("adapts ASCII ignore-case classes only when their literal/range includes I", () =>
  Effect.gen(function* () {
    const translator = yield* makeCitationRegexTranslator((yield* defaultCitationEnginePolicy).limits);
    for (const [source, expected] of [
      ["[^a-zA-Z0-9]", "[^a-zA-Z0-9İı]"],
      ["[H-J]", "[H-Jİı]"],
      ["[a\\-z]", "[a\\x2dz]"],
      ["[.,]", "[.,]"],
      ["[i]", "[iİı]"],
    ]) {
      expect((yield* translator.translate({ pattern: source, flags: 2 })).pattern).toBe(expected);
    }
  })
);

it.effect("preserves literal unmatched closing brackets, class literals and escaped backslashes", () =>
  Effect.gen(function* () {
    const translator = yield* makeCitationRegexTranslator((yield* defaultCitationEnginePolicy).limits);
    expect((yield* translator.translate({ pattern: "ch\\[.,]", flags: 0 })).pattern).toBe("ch\\x5b[^\\n],\\x5d");
    expect((yield* translator.translate({ pattern: "x{,3}[{,3}]\\\\d", flags: 0 })).pattern).toBe("x{0,3}[{,3}]\\\\d");
  })
);

it.effect("charges expanded output before retaining it and allows exact budget equality", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const smallPolicy = { ...base, patternUtf16: 10 };
    const small = yield* makeCitationRegexTranslator(smallPolicy);
    smallPolicy.patternUtf16 = 4096;
    expect(yield* small.translate({ pattern: "\\w", flags: 0 }).pipe(Effect.flip)).toMatchObject({
      operation: "extract",
      limit: "patternUtf16",
    });
    const exact = yield* makeCitationRegexTranslator({
      ...base,
      patternUtf16: Str.length(citationPythonRegexData.wordClass) + 2,
    });
    expect((yield* exact.translate({ pattern: "\\w", flags: 0 })).pattern).toBe(
      `[${citationPythonRegexData.wordClass}]`
    );
    expect(yield* small.translate({ pattern: "12345678901", flags: 0 }).pipe(Effect.flip)).toMatchObject({
      limit: "patternUtf16",
    });
    expect(yield* small.translate({ pattern: Str.repeat(8193)("x"), flags: 0 }).pipe(Effect.flip)).toMatchObject({
      operation: "extract",
      limit: "patternUtf16",
    });
  })
);

it.effect("rejects unsupported syntax and flags without silently changing meaning", () =>
  Effect.gen(function* () {
    const translator = yield* makeCitationRegexTranslator((yield* defaultCitationEnginePolicy).limits);
    for (const pattern of ["\\D", "\\1", "[\\S]", "(?i)x", "(?P<>x)", "[x", "x{bad}", "\\"]) {
      expect(yield* translator.translate({ pattern, flags: 0 }).pipe(Effect.flip)).toMatchObject({
        reason: "unsupported-syntax",
      });
    }
    for (const pattern of ["Ω", "\\w"]) {
      expect(yield* translator.translate({ pattern, flags: 2 }).pipe(Effect.flip)).toMatchObject({
        reason: "unsupported-syntax",
      });
    }
    expect(yield* translator.translate({ pattern: "x", flags: 8 }).pipe(Effect.flip)).toMatchObject({
      reason: "invalid-input",
    });
    expect(yield* makeCitationRegexTranslator({}).pipe(Effect.flip)).toMatchObject({ reason: "invalid-policy" });
  })
);
