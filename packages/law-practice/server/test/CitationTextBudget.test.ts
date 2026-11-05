import { makeCitationMetadataStrings } from "@beep/law-practice-server/internal/Citation/MetadataStrings";
import { makeCitationMetadataYearFromBound } from "@beep/law-practice-server/internal/Citation/MetadataYear";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { makeCitationTokenContext } from "@beep/law-practice-server/internal/Citation/TokenContext";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { loadCitationMetadataStrings } from "./CitationMetadataStrings.fixtures.ts";
import { setupCitationRegexRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("composed parent text budget", (it) => {
  it.effect("atomically accepts only available charges and keeps allocated units across caller rollback", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const invalidPolicy = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: -1 }).pipe(Effect.flip);
      expect(invalidPolicy).toMatchObject({ reason: "invalid-policy" });
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 10 });
      const results = yield* Effect.forEach([6, 6], (units) => budget.reserve(units).pipe(Effect.exit), {
        concurrency: 2,
      });
      expect(A.filter(results, Exit.isSuccess)).toHaveLength(1);
      expect(A.filter(results, Exit.isFailure)).toHaveLength(1);
      yield* budget.reserve(4);
      const invalid = yield* budget.reserve(-1).pipe(Effect.flip);
      expect(invalid).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      expect(used).toBe(10);
      const other = yield* makeCitationTextBudget(limits);
      const aborted = yield* Effect.gen(function* () {
        yield* other.reserve(3);
        return yield* Effect.fail("caller-rollback");
      }).pipe(Effect.tx, Effect.flip);
      expect(aborted).toBe("caller-rollback");
      const retained = yield* other.snapshot;
      expect(retained).toBe(3);
    })
  );
  it.effect("shares receiving and slice charges, captures authority and excludes installed patterns", () =>
    Effect.gen(function* () {
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 10 };
      const budget = yield* makeCitationTextBudget(limits);
      const source = yield* makeCitationRegexInput(limits).pipe(Effect.provideService(CitationTextBudget, budget));
      const first = yield* source.prepareUnicode(native("abcd"), () => Effect.void);
      const sliced = yield* first.slice({ start: 0, end: 2 }, () => Effect.void);
      expect(sliced).toEqual(native("ab"));
      yield* source.prepareText("abcd", () => Effect.void);
      const replacement = yield* makeCitationTextBudget(limits);
      const refused = yield* source
        .prepareText("x", () => Effect.void)
        .pipe(Effect.provideService(CitationTextBudget, replacement), Effect.flip);
      expect(refused).toMatchObject({ limit: "producedTextUtf16" });
      const unchanged = yield* replacement.snapshot;
      expect(unchanged).toBe(0);
      const pattern = yield* makeCitationRegexInput(limits, "pattern").pipe(
        Effect.provideService(CitationTextBudget, budget)
      );
      yield* pattern.prepareText("pattern", () => Effect.void);
      const used = yield* budget.snapshot;
      expect(used).toBe(10);
    })
  );
  it.effect("reinstalls a frozen year ceiling under fresh invocation accounting", () =>
    Effect.gen(function* () {
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 8 };
      const budget = yield* makeCitationTextBudget(limits);
      const parser = yield* makeCitationMetadataYearFromBound(limits, 2027).pipe(
        Effect.provideService(CitationTextBudget, budget)
      );
      const accepted = yield* parser.getYear(native("2027"));
      const rejected = yield* parser.getYear(native("2028"));
      assertSome(accepted, 2027);
      assertNone(rejected);
      const used = yield* budget.snapshot;
      expect(used).toBe(8);
      const invalid = yield* makeCitationMetadataYearFromBound(limits, 10001).pipe(Effect.flip);
      expect(invalid).toMatchObject({ reason: "invalid-bound" });
    })
  );
  it.effect("preflights retained context words before copying the next word", () =>
    Effect.gen(function* () {
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 10 };
      const budget = yield* makeCitationTextBudget(limits);
      const context = yield* makeCitationTokenContext(limits).pipe(Effect.provideService(CitationTextBudget, budget));
      const failure = yield* context
        .plan({
          words: [
            { kind: "Text", data: native("123456") },
            { kind: "Text", data: native("abcdef") },
          ],
          prefix: native(""),
          startIndex: 0,
          stringsOnly: true,
          forward: true,
        })
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      expect(used).toBe(6);
      const fresh = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 12 });
      const freshContext = yield* makeCitationTokenContext({ ...limits, producedTextUtf16: 12 }).pipe(
        Effect.provideService(CitationTextBudget, fresh)
      );
      const result = yield* freshContext.plan({
        words: [{ kind: "Text", data: native("abcdef") }],
        prefix: native(""),
        startIndex: 0,
        stringsOnly: true,
        forward: true,
      });
      expect(result.source).toEqual(native("abcdef"));
      const exact = yield* fresh.snapshot;
      expect(exact).toBe(12);
    })
  );
  it.effect("refuses a changed borrowed native layout before successful reserved output", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const unicode = yield* makeCitationPythonUnicode(limits);
      const bytes = new Uint8Array([0, 0, 1, 0, 97, 0, 0, 0]);
      const failure = yield* unicode
        .fromStorageReserved({ width: 4, bytes }, (units) =>
          Effect.sync(() => {
            expect(units).toBe(3);
            bytes.set([0, 0, 1, 0], 4);
          })
        )
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-input" });
    })
  );
  it.effect(
    "shares the counter through metadata, context and actual worker stages without partial success",
    () =>
      Effect.gen(function* () {
        const corpus = yield* loadCitationMetadataStrings();
        const setup = yield* setupCitationRegexRuntime("bun", 24);
        const budget = yield* makeCitationTextBudget(setup.limits);
        const helpers = yield* makeCitationMetadataStrings(
          setup.limits,
          setup.runtime,
          corpus.yearPattern,
          corpus.bindings
        ).pipe(Effect.provideContext(setup.context.pipe(Context.add(CitationTextBudget, budget))));
        const pin = yield* helpers.cleanPinCite(native(" a "));
        expect(pin).toEqual(native("a"));
        const first = yield* helpers.parenthetical(native("abc"));
        expect(first).toEqual(native("abc"));
        const failure = yield* helpers.parenthetical(native("abc")).pipe(Effect.flip);
        expect(failure).toMatchObject({ limit: "producedTextUtf16" });
        const used = yield* budget.snapshot;
        expect(used).toBe(22);
        const observed = yield* setup.observed.snapshot;
        expect(observed).toEqual({ spawned: 1, confirmed: 1 });
        const admission = yield* setup.admission.snapshot;
        expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
      }),
    { timeout: 60000 }
  );
});
