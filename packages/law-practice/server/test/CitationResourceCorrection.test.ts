import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  makeCitationPythonUnicode,
  replaceCitationPythonStorage,
} from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationRegexTiming } from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import {
  CitationResourceCitationCorrectionInput,
  CitationResourceCorrectionInput,
  makeCitationResourceCorrection,
} from "@beep/law-practice-server/internal/Citation/ResourceCorrection";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationResourceCorrection");
const Native = CitationNativeUnicodeHex;
const Value = S.NullOr(Native);
const Request = S.Struct({
  ...CitationResourceCorrectionInput.fields,
  reporter: S.optionalKey(Value),
  page: S.optionalKey(Value),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-resource-correction/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("417d1f26aa0e4886f6b50a4d8c4a548ac5f7e9a5bf8169cb307b8d30d05e16f6"),
    cases: S.Array(S.Struct({ request: Request, reporter: Value, missingReporter: S.Boolean, page: Value })).check(
      S.isBetweenLength(396, 396)
    ),
    canonical: S.Array(S.Tuple([CitationEditionRef, Native, Native])).check(S.isBetweenLength(2533, 2533)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original reporter/page source results, missing keys, native words and every canonical edition.",
  })
);
const readCorpus = Effect.fn("ResourceCorrectionTest.readCorpus")(function* (name: string, expected: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL(`../../use-cases/test/fixtures/eyecite/${name}.json`, import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe(expected);
  return new TextDecoder().decode(bytes);
});
const load = Effect.fn("ResourceCorrectionTest.load")(function* () {
  const raw = yield* readCorpus(
    "resource-correction",
    "e67abb0daae801a181d254994d79e2a16ee453ddb022348e0cb801e7a6778100"
  );
  const corpus = yield* S.decodeEffect(Corpus)(raw);
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const limits = (yield* defaultCitationEnginePolicy).limits;
  return { corpus, owner, limits };
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const OutputIndex = S.Natural.check(S.isLessThan(2753));
const WordIndex = S.Natural.check(S.isLessThan(18));
const Failure = S.NullOr(S.Literal("invalid-reporter-replacement"));
const CitationCorpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-resource-citation-correction/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("6b249ecd8dbb5e7b5e3a9f56a01f294f24356a54205d1c89c0927dd8b3f57b74"),
    groups: S.Array(S.Struct({ reporter: S.optionalKey(Value), page: S.optionalKey(Value) })).check(
      S.isBetweenLength(132, 132)
    ),
    editions: CitationEditionRef.pipe(S.NullOr, S.Array).check(S.isBetweenLength(3, 3)),
    texts: S.Array(Native).check(S.isBetweenLength(4, 4)),
    outputs: S.Array(Native).check(S.isBetweenLength(2753, 2753)),
    controls: S.Array(
      S.Tuple([
        S.Natural.check(S.isLessThan(132)),
        S.Natural.check(S.isLessThan(3)),
        S.Natural.check(S.isLessThan(4)),
        S.NullOr(OutputIndex),
        Failure,
      ])
    ).check(S.isBetweenLength(1584, 1584)),
    canonical: S.Array(S.Tuple([CitationEditionRef, OutputIndex, S.Null])).check(S.isBetweenLength(2533, 2533)),
    replacementWords: S.Array(Native).check(S.isBetweenLength(18, 18)),
    replacements: S.Array(S.Tuple([WordIndex, WordIndex, WordIndex, OutputIndex])).check(S.isBetweenLength(2592, 2592)),
  })
).pipe(
  $I.annoteSchema("CitationCorpus", {
    description:
      "Original native replacement and corrected-citation observations with bounded interned output references.",
  })
);
const loadCitationCorpus = Effect.fn("ResourceCorrectionTest.loadCitationCorpus")(function* () {
  const raw = yield* readCorpus(
    "resource-citation-correction",
    "7094220a5b2222038ea336fa20ffbad4971b3123f0f7e2cfc7b3fcd35b6a9e47"
  );
  return yield* S.decodeEffect(CitationCorpus)(raw);
});
const at = <V>(values: ReadonlyArray<V>, index: number) => Effect.fromOption(A.get(values, index));
const ReplacementText = S.String.check(S.isMaxLength(64));
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source reporter/page correction", (it) => {
  it.effect.prop(
    "replacing a native word by itself preserves every source point",
    [ReplacementText, ReplacementText],
    ([text, search]) =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const unicode = yield* makeCitationPythonUnicode(limits);
        const source = yield* unicode.fromText(text);
        const needle = yield* unicode.fromText(search);
        const budget = yield* makeCitationTextBudget(limits);
        const actual = yield* replaceCitationPythonStorage(source.storage, needle.storage, needle.storage, (layout) =>
          budget.reserve(layout.utf16Units)
        );
        expect(actual).toEqual(source.storage);
      }),
    { arbitrary: fcRuns(50) }
  );
  it.effect(
    "preflights amplified output and interrupts adversarial native scanning",
    () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const unicode = yield* makeCitationPythonUnicode(limits);
        const replacement = yield* unicode.fromText("😀");
        const small = yield* unicode.fromText("aaa");
        const empty = yield* unicode.fromText("");
        const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 10 });
        const refused = yield* replaceCitationPythonStorage(
          small.storage,
          empty.storage,
          replacement.storage,
          (layout) =>
            Effect.gen(function* () {
              expect(layout).toEqual({ width: 4, pythonLength: 7, utf16Units: 11, byteLength: 28 });
              yield* budget.reserve(layout.utf16Units);
            })
        ).pipe(Effect.flip);
        expect(refused).toMatchObject({ limit: "producedTextUtf16" });
        const source = yield* unicode.fromText(Str.repeat(64000)("a"));
        const needle = yield* unicode.fromText(`${Str.repeat(32000)("a")}b`);
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const timing = yield* makeCitationRegexTiming({ ...limits, extractDeadline: Duration.millis(997) }, true).pipe(
          Effect.provideService(Clock.Clock, timer.clock)
        );
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const pending = yield* replaceCitationPythonStorage(
          source.storage,
          needle.storage,
          replacement.storage,
          () => Effect.void
        ).pipe(timing.timed, Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        const expired = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(expired).toMatchObject({ limit: "extractDeadline" });
        expect(source.storage.bytes[0]).toBe(97);
      }),
    { timeout: 60000 }
  );
  it.effect(
    "matches 2592 original native replacements",
    () =>
      Effect.gen(function* () {
        const corpus = yield* loadCitationCorpus();
        const { limits } = yield* load();
        const unicode = yield* makeCitationPythonUnicode(limits);
        const words = yield* Effect.forEach(corpus.replacementWords, (word) => unicode.fromStorage(word));
        for (const [source, old, replacement, result] of corpus.replacements) {
          const input = yield* at(words, source);
          const needle = yield* at(words, old);
          const next = yield* at(words, replacement);
          const budget = yield* makeCitationTextBudget(limits);
          const actual = yield* replaceCitationPythonStorage(input.storage, needle.storage, next.storage, (layout) =>
            budget.reserve(layout.utf16Units)
          );
          const expected = yield* at(corpus.outputs, result);
          expect(actual).toEqual(expected);
        }
      }),
    { timeout: 120000 }
  );
  it.effect(
    "matches all 4117 original resource renderings",
    () =>
      Effect.gen(function* () {
        const corpus = yield* loadCitationCorpus();
        const { owner, limits } = yield* load();
        const correction = yield* makeCitationResourceCorrection(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        for (const [group, edition, text, result, error] of corpus.controls) {
          const groups = yield* at(corpus.groups, group);
          const editionGuess = yield* at(corpus.editions, edition);
          const matchedText = yield* at(corpus.texts, text);
          const request = CitationResourceCitationCorrectionInput.make({ ...groups, editionGuess, matchedText });
          if (error !== null) {
            const failed = yield* correction.citation(request).pipe(Effect.flip);
            expect(failed).toMatchObject({ reason: error });
          } else {
            const actual = yield* correction.citation(request);
            expect(result).not.toBeNull();
            if (result !== null) {
              const expected = yield* at(corpus.outputs, result);
              expect(actual).toEqual(expected);
            }
          }
        }
        for (const [editionGuess, result] of corpus.canonical) {
          const actual = yield* correction.citation({
            matchedText: native("X 1[U][A] X"),
            reporter: native("X"),
            page: native("1[U][A]"),
            editionGuess,
          });
          const expected = yield* at(corpus.outputs, result);
          expect(actual).toEqual(expected);
        }
      }),
    { timeout: 120000 }
  );
  it.effect("bounds complete correction and preserves input/output ownership", () =>
    Effect.gen(function* () {
      const { owner, limits } = yield* load();
      const request = {
        matchedText: native("[U] [U]"),
        reporter: native("NY Slip Op"),
        page: native("[U]"),
        editionGuess: null,
      };
      const make = (maximum: number) =>
        makeCitationResourceCorrection({ ...limits, producedTextUtf16: maximum }).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
      const below = yield* make(32);
      const failure = yield* below.citation(request).pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      const exact = yield* make(33);
      const actual = yield* exact.citation(request);
      expect(actual).toEqual(native("(U) (U)"));
      actual.bytes.fill(0);
      const repeated = yield* exact.citation(request);
      expect(repeated).toEqual(native("(U) (U)"));
      expect(request.matchedText).toEqual(native("[U] [U]"));
      expect(request.page).toEqual(native("[U]"));
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 34 });
      yield* budget.reserve(2);
      const enclosing = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 34 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner),
        Effect.provideService(CitationTextBudget, budget)
      );
      const caller = yield* makeCitationTextBudget(limits);
      const exhausted = yield* enclosing
        .citation(request)
        .pipe(Effect.provideService(CitationTextBudget, caller), Effect.flip);
      expect(exhausted).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      const uncharged = yield* caller.snapshot;
      expect(used).toBe(28);
      expect(uncharged).toBe(0);
    })
  );
  it.effect(
    "matches all 5858 source calls with exact native payloads",
    () =>
      Effect.gen(function* () {
        const { corpus, owner, limits } = yield* load();
        const correction = yield* makeCitationResourceCorrection(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        for (const row of corpus.cases) {
          if (row.missingReporter) {
            const failed = yield* correction.reporter(row.request).pipe(Effect.flip);
            expect(failed).toMatchObject({ reason: "missing-reporter" });
          } else {
            const reporter = yield* correction.reporter(row.request);
            expect(reporter).toEqual(row.reporter);
          }
          const page = yield* correction.page(row.request);
          expect(page).toEqual(row.page);
        }
        for (const [ref, reporter, page] of corpus.canonical) {
          const request = { reporter: native("X"), page: native("1[U][A]"), editionGuess: ref };
          const actualReporter = yield* correction.reporter(request);
          const actualPage = yield* correction.page(request);
          expect(actualReporter).toEqual(reporter);
          expect(actualPage).toEqual(page);
        }
      }),
    { timeout: 60000 }
  );
  it.effect("reserves before output, preserves owned bytes and retains enclosing authority", () =>
    Effect.gen(function* () {
      const { owner, limits } = yield* load();
      const request = { reporter: native("NY Slip Op"), page: native("[U]"), editionGuess: null };
      const bounded = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 15 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner)
      );
      const failure = yield* bounded.page(request).pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      const exact = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 16 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner)
      );
      const result = yield* exact.page(request);
      expect(result).toEqual(native("(U)"));
      expect(request.page).toEqual(native("[U]"));
      if (result !== null) result.bytes.fill(0);
      const repeated = yield* exact.page(request);
      expect(repeated).toEqual(native("(U)"));
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 17 });
      yield* budget.reserve(2);
      const enclosing = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 17 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner),
        Effect.provideService(CitationTextBudget, budget)
      );
      const caller = yield* makeCitationTextBudget(limits);
      const exhausted = yield* enclosing
        .page(request)
        .pipe(Effect.provideService(CitationTextBudget, caller), Effect.flip);
      expect(exhausted).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      expect(used).toBe(15);
      const uncharged = yield* caller.snapshot;
      expect(uncharged).toBe(0);
    })
  );
  it.effect(
    "uses captured owner and deadlines under caller replacement",
    () =>
      Effect.gen(function* () {
        const { corpus, owner, limits } = yield* load();
        const row = yield* Effect.fromOption(A.head(corpus.canonical));
        const waiting = CitationFrozenEditions.of({
          ...owner,
          source: Effect.fn("ResourceCorrectionTest.wait")(() => Effect.never),
        });
        const installed = yield* makeCitationResourceCorrection(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        const reporter = yield* installed
          .reporter({ editionGuess: row[0] })
          .pipe(Effect.provideService(CitationFrozenEditions, waiting));
        expect(reporter).toEqual(row[1]);
        const corrected = yield* installed
          .citation({ matchedText: native("X"), reporter: native("X"), page: null, editionGuess: row[0] })
          .pipe(Effect.provideService(CitationFrozenEditions, waiting));
        expect(corrected).toEqual(row[1]);
        for (const method of ["reporter", "citation"] as const) {
          const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
          const timed = yield* makeCitationResourceCorrection({
            ...limits,
            extractDeadline: Duration.millis(997),
          }).pipe(
            Effect.provideService(CitationFrozenEditions, waiting),
            Effect.provideService(Clock.Clock, timer.clock)
          );
          const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
          const bypass = yield* timed.page({ reporter: native(""), page: native("[U]"), editionGuess: row[0] });
          expect(bypass).toEqual(native("[U]"));
          const pending = yield* timed[method]({
            matchedText: native("X"),
            reporter: native("X"),
            page: null,
            editionGuess: row[0],
          }).pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
          yield* timer.trigger;
          const expired = yield* Fiber.join(pending).pipe(Effect.flip);
          expect(expired).toMatchObject({ limit: "extractDeadline" });
        }
      }),
    { timeout: 60000 }
  );
});
