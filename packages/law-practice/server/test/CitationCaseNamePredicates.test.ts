import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationCaseNamePredicates } from "@beep/law-practice-server/internal/Citation/CaseNamePredicates";
import { CitationPythonCharacterData } from "@beep/law-practice-server/internal/Citation/PythonCharacterData";
import { makeCitationPythonCharacters } from "@beep/law-practice-server/internal/Citation/PythonCharacters";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationCaseNamePredicateFailure } from "@beep/law-practice-server/internal/Citation/CaseNamePredicates";

const $I = $LawPracticeServerId.create("test/CitationCaseNamePredicates");
const Result = S.NullOr(S.Boolean);
const ShortText = S.String.check(S.isMaxLength(32));
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-name-predicates/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("a33d0f75a9b5c367d66dfbf4388fc9b6947b752e18b5a606e58659bfc32bb584"),
    python: S.tag("3.11.15"),
    unicode: S.tag("14.0.0"),
    regex: S.tag("2023.12.25"),
    allPoints: S.tag(1114112),
    maskSha256: S.tag("fded3cfd80e6cb1e875eca76827bf4f6b2be0b522811403f456725aba14472ad"),
    upperPoints: S.tag(1951),
    lowerPoints: S.tag(2471),
    alphaPoints: S.tag(131756),
    dataSha256: S.tag("5a72be32d49768ac84c2460d4ad566045d45855025621c95597c74d8456dd161"),
    data: CitationPythonCharacterData,
    words: S.Array(S.Tuple([S.Literals([1, 2, 4]), S.Uint8ArrayFromHex])).check(S.isBetweenLength(224, 224)),
    cases: S.Array(
      S.Tuple([S.Int.check(S.isBetween({ minimum: 0, maximum: 223 })), S.Boolean, S.Int, Result, Result, Result])
    ).check(S.isBetweenLength(2688, 2688)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual three-helper outcomes and complete pinned one-point Unicode classifications.",
  })
);
const load = Effect.fn("CaseNamePredicatesTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/case-name-predicates.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("6477311fbd6e280de43ce8368d1f36826319b808ff8640a536b0f11a0b800259");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const maskFor = (characters: Effect.Success<ReturnType<typeof makeCitationPythonCharacters>>) => (point: number) =>
  (characters.upper(point) ? 1 : 0) | (characters.lower(point) ? 2 : 0) | (characters.alpha(point) ? 4 : 0);
const assertOutcome = Effect.fn("CaseNamePredicatesTest.outcome")(function* (
  body: Effect.Effect<boolean, CitationCaseNamePredicateFailure>,
  expected: boolean | null
) {
  if (expected === null) {
    const failure = yield* body.pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationCaseNamePredicateFailure", reason: "empty-word" });
  } else {
    const actual = yield* body;
    expect(actual).toBe(expected);
  }
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true, timeout: "30 seconds" })(
  "source case-name predicates",
  (it) => {
    it.effect(
      "matches every source upper/lower/alpha point including surrogate and future-Unicode controls",
      () =>
        Effect.gen(function* () {
          const corpus = yield* load();
          const characters = yield* makeCitationPythonCharacters();
          expect(S.toEquivalence(CitationPythonCharacterData)(corpus.data, characters.data)).toBe(true);
          const pointMask = maskFor(characters);
          const masks = new Uint8Array(corpus.allPoints);
          for (let point = 0; point < corpus.allPoints; point++) {
            if (point % 4096 === 0) yield* Effect.yieldNow;
            masks[point] = pointMask(point);
          }
          const maskHash = yield* S.decodeEffect(Sha256HexFromBytes)(masks);
          expect(maskHash).toBe(corpus.maskSha256);
        }),
      { timeout: 60000 }
    );
    it.effect("matches all 8064 original helper calls and preserves empty-word short-circuit errors", () =>
      Effect.gen(function* () {
        const corpus = yield* load();
        const policy = yield* defaultCitationEnginePolicy;
        const unicode = yield* makeCitationPythonUnicode(policy.limits);
        const predicates = yield* makeCitationCaseNamePredicates();
        const words = yield* Effect.forEach(corpus.words, ([width, bytes]) => unicode.fromStorage({ width, bytes }));
        for (const [index, hasV, length, afterV, capitalized, withoutV] of corpus.cases) {
          const word = A.getUnsafe(words, index);
          yield* assertOutcome(predicates.isLowercaseAfterV(word, hasV), afterV);
          yield* assertOutcome(predicates.isCapitalizedAbbreviation(word, hasV, length), capitalized);
          yield* assertOutcome(predicates.isLowercaseWithoutV(word, hasV), withoutV);
        }
      })
    );
    it.effect.prop(
      "preserves source presence short circuits for schema-derived native words",
      [ShortText, S.Int.check(S.isBetween({ minimum: -100, maximum: 100 }))],
      Effect.fnUntraced(function* ([text, length]) {
        const policy = yield* defaultCitationEnginePolicy;
        const unicode = yield* makeCitationPythonUnicode(policy.limits);
        const word = yield* unicode.fromText(text);
        const predicates = yield* makeCitationCaseNamePredicates();
        const afterV = yield* predicates.isLowercaseAfterV(word, false);
        const capitalized = yield* predicates.isCapitalizedAbbreviation(word, false, length);
        const withoutV = yield* predicates.isLowercaseWithoutV(word, true);
        expect([afterV, capitalized, withoutV]).toEqual([false, false, false]);
      }),
      { arbitrary: fcRuns(50) }
    );
    it.effect("keeps long native whitespace scans interruptible without publishing a result", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const unicode = yield* makeCitationPythonUnicode(policy.limits);
        const source = yield* unicode.fromStorage({ width: 1, bytes: new Uint8Array(65536).fill(32) });
        const predicates = yield* makeCitationCaseNamePredicates();
        const pending = yield* predicates.isLowercaseAfterV(source, true).pipe(Effect.forkChild);
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(pending);
        const interrupted = yield* Fiber.await(pending);
        expect(Exit.hasInterrupts(interrupted)).toBe(true);
      })
    );
  }
);
