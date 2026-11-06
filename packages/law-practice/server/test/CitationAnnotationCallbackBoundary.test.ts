import {
  CitationAnnotationReplacement,
  makeCitationAnnotationAssembly,
} from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackFailure,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import {
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";

const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
const letterC = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([67]) });
it.effect("snapshots callback returns and retains callback/budget capture through final output admission", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const replacement = CitationAnnotationAnnotator.of({
      annotate: Effect.fn("CallbackBoundaryTest.replacement")(() =>
        Effect.fail(CitationAnnotationCallbackFailure.make({ reason: "callback-failed" }))
      ),
    });
    for (const maximum of [5, 6]) {
      const limits = { ...base, producedTextUtf16: maximum };
      const budget = yield* makeCitationTextBudget(limits);
      const unicode = yield* makeCitationPythonUnicode(limits, "annotate");
      const source = yield* unicode.fromText("xy");
      const bytes = new Uint8Array([65]);
      const retained = CitationPythonUnicodeStorage.make({ width: 1, bytes });
      let calls = 0;
      const port = CitationAnnotationAnnotator.of({
        annotate: Effect.fn("CallbackBoundaryTest.returnMutable")(function* () {
          yield* Effect.yieldNow;
          calls++;
          if (calls === 1) return CitationAnnotationCallbackResult.cases.Text.make({ text: retained });
          bytes[0] = 66;
          return CitationAnnotationCallbackResult.cases.Text.make({ text: letterC });
        }),
      });
      const assembly = yield* makeCitationAnnotationAssembly(limits).pipe(
        Effect.provideService(CitationTextBudget, budget),
        Effect.provideService(CitationAnnotationAnnotator, port)
      );
      const input = [
        CitationAnnotationReplacement.make({ start: 0, end: 1, before: empty, after: empty }),
        CitationAnnotationReplacement.make({ start: 1, end: 2, before: empty, after: empty }),
      ];
      const output = assembly
        .assemble(source, input)
        .pipe(Effect.provideService(CitationAnnotationAnnotator, replacement));
      if (maximum === 5) {
        const error = yield* Effect.flip(output);
        expect(error).toEqual(CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "producedTextUtf16" }));
        const used = yield* budget.snapshot;
        expect(used).toBe(4);
      } else {
        const result = yield* output;
        expect(result).toEqual(CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([65, 67]) }));
        const used = yield* budget.snapshot;
        expect(used).toBe(6);
      }
      expect(calls).toBe(2);
    }
  })
);
it.effect("reports the enclosing deadline while a callback receiving reservation is blocked", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const limits = { ...base, annotateDeadline: Duration.millis(50), operationDeadline: Duration.millis(5) };
    const budget = yield* makeCitationTextBudget(limits);
    const entered = yield* Deferred.make<void>();
    const stalled = CitationTextBudget.of({
      ...budget,
      reserve: Effect.fn("CallbackBoundaryTest.blockReceiving")((units) =>
        units === 1 ? Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)) : budget.reserve(units)
      ),
    });
    const port = CitationAnnotationAnnotator.of({
      annotate: Effect.fn("CallbackBoundaryTest.constant")(() =>
        Effect.succeed(CitationAnnotationCallbackResult.cases.Text.make({ text: letterC }))
      ),
    });
    const assembly = yield* makeCitationAnnotationAssembly(limits).pipe(
      Effect.provideService(CitationTextBudget, stalled),
      Effect.provideService(CitationAnnotationAnnotator, port)
    );
    const unicode = yield* makeCitationPythonUnicode(limits, "annotate");
    const source = yield* unicode.fromStorage(empty);
    const pending = yield* assembly
      .assemble(source, [CitationAnnotationReplacement.make({ start: 0, end: 0, before: empty, after: empty })])
      .pipe(Effect.flip, Effect.forkChild);
    yield* Deferred.await(entered);
    yield* TestClock.adjust(Duration.millis(5));
    const error = yield* Fiber.join(pending);
    expect(error).toEqual(CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "operationDeadline" }));
    const refused = CitationAnnotationAnnotator.of({
      annotate: Effect.fn("CallbackBoundaryTest.refuseProducer")(() =>
        Effect.fail(CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" }))
      ),
    });
    const translated = yield* makeCitationAnnotationAssembly(limits).pipe(
      Effect.provideService(CitationTextBudget, budget),
      Effect.provideService(CitationAnnotationAnnotator, refused)
    );
    const producerError = yield* translated
      .assemble(source, [CitationAnnotationReplacement.make({ start: 0, end: 0, before: empty, after: empty })])
      .pipe(Effect.flip);
    expect(producerError).toEqual(
      CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "producedTextUtf16" })
    );
  })
);
