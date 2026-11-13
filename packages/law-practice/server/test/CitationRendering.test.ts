import { CitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationRendering } from "@beep/law-practice-server/internal/Citation/Rendering";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as S from "effect/Schema";
import { makeCitationTestScaffoldBinding, withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { loadCitationRendering, replayCitationRendering } from "./CitationRendering.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const ShortText = S.String.check(S.isMaxLength(64));
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original built-in rendering", (it) => {
  it.effect("rejects malformed rendering policy and requests before assembling text", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const { owner, limits } = yield* loadCitationRendering();
        const invalidPolicy = yield* makeCitationRendering(null).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(null).pipe(Effect.map((bind) => ({ ...stage, render: bind(stage.render) })))
          ),
          Effect.provideService(CitationFrozenEditions, owner),
          Effect.flip
        );
        expect(invalidPolicy).toMatchObject({ reason: "invalid-policy" });
        const renderer = yield* makeCitationRendering(limits).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(limits).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          ),
          Effect.provideService(CitationFrozenEditions, owner)
        );
        for (const input of [null, {}, { mode: "unrecognized" }]) {
          const failure = yield* renderer.render(input).pipe(Effect.flip);
          expect(failure).toMatchObject({ reason: "invalid-input" });
          expect("cause" in failure).toBe(false);
        }
      })
    )
  );
  it.effect(
    "matches all 14934 original rendering observations",
    () => withCitationTestInvocation(replayCitationRendering()),
    { timeout: 120000 }
  );
  it.effect.prop(
    "matched-only rendering preserves schema-derived source text",
    [ShortText],
    ([text]) =>
      withCitationTestInvocation(
        Effect.gen(function* () {
          const { owner, limits } = yield* loadCitationRendering();
          const unicode = yield* makeCitationPythonUnicode(limits);
          const value = yield* unicode.fromText(text);
          const rendering = yield* makeCitationRendering(limits).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding(limits).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            ),
            Effect.provideService(CitationFrozenEditions, owner)
          );
          const actual = yield* rendering.render({
            mode: "matched",
            matchedText: value.storage,
            reporter: "deliberately unread",
          });
          expect(actual).toEqual(value.storage);
        })
      ),
    { arbitrary: fcRuns(20) }
  );
  it.effect("bounds native assembly and preserves invocation budgets and owned results", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const { owner, limits } = yield* loadCitationRendering();
        const request = { mode: "id", metadata: { pinCite: native("42") } };
        const make = (maximum: number) =>
          makeCitationRendering({ ...limits, producedTextUtf16: maximum }).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding({ ...limits, producedTextUtf16: maximum }).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            ),
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
        yield* withCitationTestInvocation(
          Effect.gen(function* () {
            const budget = (yield* CitationInvocation).budget;
            yield* budget.reserve(3);
            const enclosing = yield* makeCitationRendering({ ...limits, producedTextUtf16: 16 }).pipe(
              Effect.flatMap((stage) =>
                makeCitationTestScaffoldBinding({ ...limits, producedTextUtf16: 16 }).pipe(
                  Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
                )
              ),
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
          }),
          { ...limits, producedTextUtf16: 16 }
        );
      })
    )
  );
  it.effect(
    "retains source bypasses, the captured edition owner and Clock",
    () =>
      withCitationTestInvocation(
        Effect.gen(function* () {
          const { corpus, owner, limits } = yield* loadCitationRendering();
          const base = yield* Effect.fromOption(A.get(corpus.bases, 1));
          const waiting = CitationFrozenEditions.of({
            ...owner,
            source: Effect.fn("RenderingTest.wait")(() => Effect.never),
          });
          const installed = yield* makeCitationRendering(limits).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding(limits).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            ),
            Effect.provideService(CitationFrozenEditions, owner)
          );
          const request = { ...base, mode: "journal", metadata: { pinCite: null, parenthetical: null, year: null } };
          const rendered = yield* installed
            .render(request)
            .pipe(Effect.provideService(CitationFrozenEditions, waiting));
          expect(rendered).toEqual(native("1 NY Slip Op (U)"));
          const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
          const timed = yield* makeCitationRendering({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            ),
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
        })
      ),
    { timeout: 60000 }
  );
});
