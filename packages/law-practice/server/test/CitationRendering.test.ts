import { CitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationRendering } from "@beep/law-practice-server/internal/Citation/Rendering";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as S from "effect/Schema";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { loadCitationRendering, replayCitationRendering } from "./CitationRendering.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const ShortText = S.String.check(S.isMaxLength(64));
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original built-in rendering", (it) => {
  it.effect("matches all 14934 original rendering observations", replayCitationRendering, { timeout: 120000 });
  it.effect.prop(
    "matched-only rendering preserves schema-derived source text",
    [ShortText],
    ([text]) =>
      Effect.gen(function* () {
        const { owner, limits } = yield* loadCitationRendering();
        const unicode = yield* makeCitationPythonUnicode(limits);
        const value = yield* unicode.fromText(text);
        const rendering = yield* makeCitationRendering(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        const actual = yield* rendering.render({
          mode: "matched",
          matchedText: value.storage,
          reporter: "deliberately unread",
        });
        expect(actual).toEqual(value.storage);
      }),
    { arbitrary: fcRuns(20) }
  );
  it.effect("bounds native assembly and preserves captured outer budgets and owned results", () =>
    Effect.gen(function* () {
      const { owner, limits } = yield* loadCitationRendering();
      const request = { mode: "id", metadata: { pinCite: native("42") } };
      const make = (maximum: number) =>
        makeCitationRendering({ ...limits, producedTextUtf16: maximum }).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
      const below = yield* make(13);
      const failure = yield* below.render(request).pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      const exact = yield* make(14);
      const actual = yield* exact.render(request);
      expect(actual).toEqual(native("id., 42"));
      actual.bytes.fill(0);
      const repeated = yield* exact.render(request);
      expect(repeated).toEqual(native("id., 42"));
      expect(request.metadata.pinCite).toEqual(native("42"));
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 16 });
      yield* budget.reserve(3);
      const enclosing = yield* makeCitationRendering({ ...limits, producedTextUtf16: 16 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner),
        Effect.provideService(CitationTextBudget, budget)
      );
      const caller = yield* makeCitationTextBudget(limits);
      const exhausted = yield* enclosing
        .render(request)
        .pipe(Effect.provideService(CitationTextBudget, caller), Effect.flip);
      expect(exhausted).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      const unused = yield* caller.snapshot;
      expect(used).toBe(10);
      expect(unused).toBe(0);
    })
  );
  it.effect(
    "retains source bypasses, the captured edition owner and Clock",
    () =>
      Effect.gen(function* () {
        const { corpus, owner, limits } = yield* loadCitationRendering();
        const base = yield* Effect.fromOption(A.get(corpus.bases, 1));
        const waiting = CitationFrozenEditions.of({
          ...owner,
          source: Effect.fn("RenderingTest.wait")(() => Effect.never),
        });
        const installed = yield* makeCitationRendering(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        const request = { ...base, mode: "journal", metadata: { pinCite: null, parenthetical: null, year: null } };
        const rendered = yield* installed.render(request).pipe(Effect.provideService(CitationFrozenEditions, waiting));
        expect(rendered).toEqual(native("1 NY Slip Op (U)"));
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const timed = yield* makeCitationRendering({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
          Effect.provideService(CitationFrozenEditions, waiting),
          Effect.provideService(Clock.Clock, timer.clock)
        );
        const bypass = yield* timed.render({
          mode: "id",
          metadata: { pinCite: null },
          matchedText: "unread",
          editionGuess: "unread",
        });
        expect(bypass).toEqual(native("id."));
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const pending = yield* timed
          .render(request)
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        const expired = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(expired).toMatchObject({ limit: "extractDeadline" });
      }),
    { timeout: 60000 }
  );
});
