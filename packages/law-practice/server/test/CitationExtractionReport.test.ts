import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { makeCitationSourceExtraction as makeOwnedCitationSourceExtraction } from "@beep/law-practice-server/internal/Citation/SourceExtraction";
import { CitationVerifiedExtractionConfiguration } from "@beep/law-practice-server/internal/Citation/VerifiedExtraction";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import { installCitationOwnedTestStage } from "./CitationConfigurationOwnership.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { makeCitationTestScaffoldBinding, withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const makeCitationSourceExtraction = installCitationOwnedTestStage({
  schema: CitationVerifiedExtractionConfiguration,
  install: makeOwnedCitationSourceExtraction,
});

it.layer(citationTokenizerTestLayer)("captured extraction report timing", (it) => {
  it.layer(TestClock.layer())("work duration", (it) => {
    it.effect(
      "measures resolver work through the shortcut without inventing tokenizer measurements",
      () =>
        withCitationTestInvocation(
          Effect.gen(function* () {
            const { setup, defaultConfiguration, engineArtifact, provided } =
              yield* installCitationDefaultConfigurationFixture("bun");
            const clock = yield* Clock.Clock;
            const source = yield* citationFixtureSourceProof("eyecite");
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("ExtractionReportTest.delayedSource")(() =>
                Effect.sleep(Duration.millis(7)).pipe(
                  Effect.as(ResolvedSourceText.make({ identity: source.source, text: source.sourceText }))
                )
              ),
            });
            const stage = yield* makeCitationSourceExtraction(setup.limits, setup.runtime, {
              engineArtifact,
              extraction: defaultConfiguration,
            }).pipe(
              Effect.flatMap((stage) =>
                makeCitationTestScaffoldBinding(setup.limits).pipe(
                  Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
                )
              ),
              Effect.provideContext(Context.add(provided, Clock.Clock, clock)),
              Effect.provideService(SourceTextResolver, resolver),
              DateTime.withCurrentZoneOffset(0)
            );
            const fiber = yield* Effect.forkChild(
              stage.extract({ source: source.source, sourceText: source.sourceText })
            );
            yield* TestClock.adjust(Duration.millis(7));
            const actual = yield* Fiber.join(fiber);
            expect(Duration.toMillis(actual.report.workDuration)).toBe(7);
            expect(actual.report.extraction?.tokenizer).toBe(null);
            expect(actual.report.extraction?.semanticCitations).toBe(1);
            expect(actual.report.extraction?.verifiedMentions).toBe(0);
            expect(actual.report.extraction?.unverifiedCitations).toBe(1);
            expect(actual.report.producedTextUtf16).toBe(actual.reservedUnits);
            const workers = yield* setup.observed.snapshot;
            expect(workers).toEqual({ spawned: 0, confirmed: 0 });
          })
        ),
      { timeout: 60000 }
    );
  });
});
