import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { makeCitationAnnotationOperation } from "@beep/law-practice-server/internal/Citation/AnnotationOperation";
import { makeCitationSourceAnnotation } from "@beep/law-practice-server/internal/Citation/SourceAnnotation";
import { CitationAnnotationReplacement, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { installCitationAnnotationEntryFixture } from "./CitationAnnotationEntry.fixtures.ts";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(citationTokenizerTestLayer)("raw-source annotation timing", (it) => {
  it.layer(TestClock.layer())("isolated clock: 24", (it) => {
    it.effect("reports source and callback work while excluding admission waiting", () =>
      Effect.gen(function* () {
        const setup = yield* installCitationAnnotationEntryFixture();
        const proof = yield* citationFixtureSourceProof("abc");
        const resolving = yield* Deferred.make<void>();
        const annotating = yield* Deferred.make<void>();
        const held = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const resolver = SourceTextResolver.of({
          resolve: Effect.fn("AnnotationReportTest.resolve")(function* () {
            yield* Deferred.succeed(resolving, undefined);
            yield* Effect.sleep(Duration.millis(5));
            return ResolvedSourceText.make({ identity: proof.source, text: "abc" });
          }),
        });
        const callback = CitationAnnotationAnnotator.of({
          annotate: Effect.fn("AnnotationReportTest.callback")(function* (_, span) {
            yield* Deferred.succeed(annotating, undefined);
            yield* Effect.sleep(Duration.millis(7));
            return CitationAnnotationCallbackResult.cases.Text.make({ text: span });
          }),
        });
        const entry = yield* makeCitationAnnotationOperation(
          setup.limits,
          setup.runtime,
          setup.configuration,
          Sha256Hex.make(Str.repeat(64)("a"))
        ).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestInvocationBinding(setup.limits, "annotate").pipe(
              Effect.map((bind) => ({ ...stage, annotate: bind(stage.annotate) }))
            )
          ),
          Effect.provideService(SourceTextResolver, resolver),
          Effect.provideService(CitationAnnotationAnnotator, callback),
          Effect.provideContext(setup.provided)
        );
        const holder = yield* setup.operation
          .run("extract", Deferred.succeed(held, undefined).pipe(Effect.andThen(Deferred.await(release))))
          .pipe(Effect.forkChild);
        yield* Deferred.await(held);
        const pending = yield* entry
          .annotate({
            plain: { source: proof.source, sourceText: "abc" },
            replacements: [CitationAnnotationReplacement.make({ start: 0, end: 1, before: word(""), after: word("") })],
          })
          .pipe(Effect.forkChild);
        yield* TestClock.adjust(Duration.millis(10));
        const queued = yield* setup.operation.snapshot;
        expect(queued).toMatchObject({ active: 1, queued: 1 });
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(holder);
        yield* Deferred.await(resolving);
        yield* TestClock.adjust(Duration.millis(5));
        yield* Deferred.await(annotating);
        yield* TestClock.adjust(Duration.millis(7));
        const result = yield* Fiber.join(pending);
        expect(result.text).toEqual(word("abc"));
        expect(Duration.toMillis(result.report.workDuration)).toBe(12);
        expect(result.report.operation).toBe("annotate");
        const admission = yield* setup.operation.snapshot;
        expect(admission).toMatchObject({ active: 0, queued: 0 });
      })
    );
  });
  it.layer(TestClock.layer())("isolated clock: 83", (it) => {
    it.effect("shares one deadline across canonical resolution and the captured callback", () =>
      Effect.gen(function* () {
        const setup = yield* installCitationAnnotationEntryFixture();
        const proof = yield* citationFixtureSourceProof("abc");
        const resolving = yield* Deferred.make<void>();
        const annotating = yield* Deferred.make<void>();
        const resolver = SourceTextResolver.of({
          resolve: Effect.fn("SourceAnnotationTimingTest.resolve")(function* () {
            yield* Deferred.succeed(resolving, undefined);
            yield* Effect.sleep(Duration.millis(40));
            return ResolvedSourceText.make({ identity: proof.source, text: "abc" });
          }),
        });
        const callback = CitationAnnotationAnnotator.of({
          annotate: Effect.fn("SourceAnnotationTimingTest.annotate")(function* (_before, span) {
            yield* Deferred.succeed(annotating, undefined);
            yield* Effect.sleep(Duration.millis(40));
            return CitationAnnotationCallbackResult.cases.Text.make({ text: span });
          }),
        });
        const entry = yield* makeCitationSourceAnnotation(
          { ...setup.limits, annotateDeadline: Duration.millis(50) },
          setup.runtime,
          setup.configuration
        ).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestInvocationBinding(
              { ...setup.limits, annotateDeadline: Duration.millis(50) },
              "annotate"
            ).pipe(Effect.map((bind) => ({ ...stage, annotate: bind(stage.annotate) })))
          ),
          Effect.provideService(SourceTextResolver, resolver),
          Effect.provideService(CitationAnnotationAnnotator, callback),
          Effect.provideContext(setup.provided)
        );
        const pending = yield* entry
          .annotate({
            plain: { source: proof.source, sourceText: "abc" },
            replacements: [CitationAnnotationReplacement.make({ start: 0, end: 1, before: word(""), after: word("") })],
          })
          .pipe(Effect.flip, Effect.forkChild);
        yield* Deferred.await(resolving);
        yield* TestClock.adjust(Duration.millis(40));
        yield* Deferred.await(annotating);
        yield* TestClock.adjust(Duration.millis(10));
        const failure = yield* Fiber.join(pending);
        expect(failure).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          operation: "annotate",
          limit: "annotateDeadline",
        });
        const admission = yield* setup.operation.snapshot;
        expect(admission).toMatchObject({ active: 0, queued: 0 });
      })
    );
  });
});
